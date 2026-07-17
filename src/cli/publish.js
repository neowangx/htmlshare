import { createHash, randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";

import { composePage } from "../compose.js";
import { convertFile } from "../convert.js";
import { MAX_LOCAL_ASSET_BYTES, assetDependenciesValid, embedLocalAssets } from "../assets.js";
import { encryptHtml, generateStaticCode } from "../encrypt.js";
import { describeExpiry, parseExpiry, wrapWithExpiry } from "../expiry.js";
import { getAdapter } from "../adapters/index.js";
import { AdapterError } from "../adapters/errors.js";
import { loginCloud, redeemInvite } from "../adapters/cloud.js";
import { resolveTarget } from "../adapters/resolve.js";
import { findEntry, loadManifest, remove, upsert } from "../lib/manifest.js";
import { loadConfig, saveConfig } from "../lib/config.js";
import { AppError } from "../lib/errors.js";

function gateOf(adapter, target) {
  return adapter?.gate || (target === "vercel" || target === "cloudflare" ? "static" : "server");
}

const TARGETS = new Set(["selfhost", "cloud", "vercel", "cloudflare"]);
const STYLES = new Set(["auto", "clinical", "minimal", "editorial", "darktech"]);

const BOOLEAN_FLAGS = new Set(["public", "force", "json", "yes", "no-expires", "off"]);

function parseArgs(argv) {
  const [command, ...rest] = argv;
  let file = null;
  const positionals = [];
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else if (BOOLEAN_FLAGS.has(arg.slice(2))) {
        flags[arg.slice(2)] = true;
      } else {
        flags[arg.slice(2)] = rest[index + 1];
        index += 1;
      }
    } else if (!file) {
      file = arg;
      positionals.push(arg);
    } else {
      positionals.push(arg);
    }
  }
  return { command, file, flags, positionals };
}

function defaultCacheDir() {
  return join(homedir(), ".cache", "htmlshare");
}

// Cache key must cover every input that changes the rendered artifact, or a second publish
// with new --enhanced/--style/--title would silently reuse the stale HTML.
function cacheKey(absPath, flags, config) {
  const stat = statSync(absPath);
  const enhancedContent = flags.enhanced ? readFileSafe(resolve(flags.enhanced)) : "";
  const render = JSON.stringify({
    style: flags.style || config.defaults?.style || "clinical",
    title: flags.title || "",
    footer: configFooter(config),
    enhanced: enhancedContent
  });
  return createHash("sha256").update(`${absPath}:${stat.mtimeMs}:${stat.size}:${render}`).digest("hex").slice(0, 16);
}

function readFileSafe(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return `__missing__:${path}`;
  }
}

function serverCode() {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

// D4: the auto-generated code differs by track — 4-digit for server-gated targets (rate
// limited), 8-char Crockford for static targets (offline-bruteforce resistant).
function autoCode(gate) {
  return gate === "static" ? generateStaticCode() : serverCode();
}

// Returns { code, explicit }. explicit=true means the user expressed code intent
// (--public/--code/config default), so a republish is allowed to change the code.
function resolveCode(flags, config, gate, existing) {
  if (flags.public) return { code: null, explicit: true };
  if (flags.code) return { code: String(flags.code), explicit: true };
  const configured = config.defaults?.code;
  if (configured === "none") return { code: null, explicit: true };
  if (configured && configured !== "auto") return { code: configured, explicit: true };
  // No explicit intent: keep the already-published code so shared links keep working (D8).
  if (existing && Object.hasOwn(existing, "code")) return { code: existing.code, explicit: false };
  return { code: autoCode(gate), explicit: false };
}

// D20: collect every local resource into the one HTML publication unit. Already self-contained
// direct HTML remains byte-exact; a known broken local reference aborts before upload.
function htmlFromInput(absPath, flags, stderr, config) {
  if (extname(absPath).toLowerCase() === ".html") {
    stderr.write("COLLECT: html direct\n");
    const raw = readFileSync(absPath, "utf8");
    const embedded = embedLocalAssets(raw, dirname(absPath), { strict: true });
    if (embedded.assets.length) {
      const bytes = embedded.assets.reduce((sum, item) => sum + item.size, 0);
      stderr.write(`ASSET: embedded ${embedded.assets.length} local file(s), ${(bytes / 1024 / 1024).toFixed(2)}MB\n`);
    }
    return { html: embedded.html, title: basename(absPath, ".html"), directHtml: true, warnings: [], assets: embedded.assets };
  }

  stderr.write("CONVERT: markdown\n");
  const faithful = convertFile(absPath, { strictAssets: true });
  for (const warning of faithful.warnings || []) stderr.write(`${warning}\n`);
  // Pass the raw enhanced string straight to compose so a malformed file degrades to the
  // faithful version (V1) instead of throwing — D6 says publish must still succeed.
  const enhancedRaw = flags.enhanced ? readFileSafe(resolve(flags.enhanced)) : null;
  const page = composePage({
    title: flags.title || faithful.title,
    faithfulHtml: faithful.html,
    enhanced: enhancedRaw,
    footerBadge: configFooter(config),
    style: flags.style || config.defaults?.style || "clinical",
    styleOverride: flags.style || null,
    codeProtected: !flags.public
  });
  if (flags.enhanced && !page.validation.ok) {
    const reason = page.validation.errors?.[0] || "unknown";
    stderr.write(`ENHANCED: degraded to faithful (${reason})\n`);
  }
  for (const warning of page.validation.warnings || []) stderr.write(`ENHANCED: ${warning}\n`);
  // The faithful fragment has already been embedded before sanitizing. This second pass captures
  // local sources introduced by the A2UI enhanced view and the composed page CSS.
  const embedded = embedLocalAssets(page.html, dirname(absPath), { strict: true });
  const assets = [...(faithful.assets || []), ...embedded.assets];
  if (assets.length) {
    const unique = new Map(assets.map((item) => [item.path, item]));
    const bytes = [...unique.values()].reduce((sum, item) => sum + item.size, 0);
    if (bytes > MAX_LOCAL_ASSET_BYTES) {
      throw new AppError("INVALID_INPUT", `本地资源原始总量超过 ${MAX_LOCAL_ASSET_BYTES / 1024 / 1024}MB`);
    }
    stderr.write(`ASSET: embedded ${unique.size} local file(s), ${(bytes / 1024 / 1024).toFixed(2)}MB\n`);
    return { html: embedded.html, title: flags.title || faithful.title, directHtml: false, warnings: faithful.warnings || [], assets: [...unique.values()] };
  }
  return { html: embedded.html, title: flags.title || faithful.title, directHtml: false, warnings: faithful.warnings || [], assets: [] };
}

function configFooter(config) {
  return config.footerBadge !== false;
}

function redactToken(token) {
  if (!token) return null;
  const value = String(token);
  return `***${value.slice(-4)}`;
}

function publicConfig(config) {
  return {
    ...config,
    selfhost: config.selfhost ? { ...config.selfhost, uploadToken: redactToken(config.selfhost.uploadToken) } : undefined,
    cloud: config.cloud ? { ...config.cloud, token: redactToken(config.cloud.token) } : undefined
  };
}

function saveAndReport(config, configDir, stdout) {
  saveConfig(config, configDir);
  stdout.write("CONFIG: saved\n");
  return 0;
}

async function promptValue(deps, label) {
  const stdin = deps.stdin || process.stdin;
  const stdout = deps.stdout || process.stdout;
  if (!stdin.isTTY) return null;
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question(`${label}: `);
  } finally {
    rl.close();
  }
}

// Resolve the publish-time expiry. Explicit flags win; otherwise, when a terminal is attached,
// ask so nothing goes out without the user confirming a deadline (or "never"). A non-TTY run
// with no flag (script/CI) defaults to never so it can't hang. Returns an ISO string or null.
// Throws (code INVALID_EXPIRY) on an unparseable value so the caller can exit 2.
async function resolveExpiry(flags, deps) {
  if (flags["no-expires"]) return null;
  if (flags.expires !== undefined) return parseExpiry(flags.expires);
  const stdin = deps.stdin || process.stdin;
  if (stdin?.isTTY) {
    const answer = await promptValue(deps, "设置过期时间？(如 7d / 24h / 2026-08-01，回车=永不过期)");
    return parseExpiry(answer);
  }
  return null;
}

async function configCommand(parsed, deps) {
  const stdout = deps.stdout;
  const stderr = deps.stderr;
  const configDir = deps.configDir;
  const config = deps.config || loadConfig(configDir);
  const [subcommand, key, value] = parsed.positionals;

  if (!subcommand || subcommand === "show") {
    stdout.write(`${JSON.stringify(publicConfig(config), null, 2)}\n`);
    return 0;
  }

  if (subcommand === "target") {
    if (!TARGETS.has(key)) {
      stderr.write("CONFIG: target must be one of selfhost|cloud|vercel|cloudflare\n");
      return 2;
    }
    return saveAndReport({ ...config, defaultTarget: key }, configDir, stdout);
  }

  if (subcommand === "selfhost") {
    const baseUrl = parsed.flags["base-url"] || parsed.flags.baseUrl || await promptValue(deps, "selfhost baseUrl");
    const uploadToken = parsed.flags.token || await promptValue(deps, "selfhost uploadToken");
    if (!baseUrl || !uploadToken) {
      stderr.write("CONFIG: selfhost requires --base-url and --token in non-interactive mode\n");
      return 2;
    }
    return saveAndReport({
      ...config,
      defaultTarget: config.defaultTarget || "selfhost",
      selfhost: { baseUrl: String(baseUrl).replace(/\/+$/, ""), uploadToken: String(uploadToken) }
    }, configDir, stdout);
  }

  if (subcommand === "defaults") {
    if (!key) {
      stdout.write(`${JSON.stringify(config.defaults || {}, null, 2)}\n`);
      return 0;
    }
    if (!["style", "code"].includes(key) || value === undefined) {
      stderr.write("CONFIG: defaults usage: htmlshare config defaults <style|code> <value>\n");
      return 2;
    }
    if (key === "style" && !STYLES.has(value)) {
      stderr.write("CONFIG: style must be auto|clinical|minimal|editorial|darktech\n");
      return 2;
    }
    return saveAndReport({ ...config, defaults: { ...(config.defaults || {}), [key]: value } }, configDir, stdout);
  }

  stderr.write("CONFIG: unknown subcommand\n");
  return 2;
}

async function publishCommand(file, flags, deps) {
  const stdout = deps.stdout;
  const stderr = deps.stderr;
  const cwd = deps.cwd || process.cwd();
  const absPath = isAbsolute(file) ? file : resolve(cwd, file);
  if (!existsSync(absPath)) {
    stderr.write(`INPUT: file not found ${absPath}\n`);
    return 2;
  }

  if (flags.public && flags.code) {
    stderr.write("INPUT: --public 与 --code 互斥，请二选一\n");
    return 2;
  }
  if (flags.target && !TARGETS.has(flags.target) && !deps.adapters?.[flags.target]) {
    stderr.write("INPUT: --target 必须是 selfhost|cloud|vercel|cloudflare 之一\n");
    return 2;
  }
  if (flags.style && !STYLES.has(flags.style)) {
    stderr.write("INPUT: --style 必须是 auto|clinical|minimal|editorial|darktech 之一\n");
    return 2;
  }

  const configDir = deps.configDir;
  const config = deps.config || loadConfig(configDir);
  const resolved = await resolveTarget({
    requestedTarget: flags.target,
    config,
    configDir,
    adapters: deps.adapters,
    remember: deps.rememberTarget !== false
  });
  if (!resolved.target) {
    stderr.write(resolved.guide);
    return 3;
  }
  const target = resolved.target;
  const adapter = resolved.adapter || getAdapter(target);
  const detected = flags.target ? await adapter.detect?.(config) : null;
  if (detected && detected.available === false) {
    stderr.write(`TARGET: ${detected.reason || "not available"}\n`);
    return 3;
  }
  if (resolved.remembered) {
    stderr.write(`TARGET: ${target} 可用，已记住为默认目标。\n`);
  }

  const dir = join(deps.cacheDir || defaultCacheDir(), cacheKey(absPath, flags, config));
  const artifactPath = join(dir, "artifact.html");
  const statePath = join(dir, "state.json");
  mkdirSync(dir, { recursive: true });

  let html;
  let title;
  const cachedState = existsSync(statePath) ? readState(statePath) : null;
  if (!flags.force && existsSync(artifactPath) && cachedState?.assetBundleVersion === 1 && assetDependenciesValid(cachedState.assets)) {
    stderr.write("CACHE: hit CONVERT\n");
    html = readFileSync(artifactPath, "utf8");
    title = flags.title || cachedState.title || basename(absPath, extname(absPath));
  } else {
    if (cachedState?.assets?.length) stderr.write("CACHE: local asset changed, rebuilding\n");
    let rendered;
    try {
      rendered = htmlFromInput(absPath, flags, stderr, config);
    } catch (error) {
      if (error instanceof AppError && error.code === "INVALID_INPUT") {
        stderr.write(`INPUT: ${error.message}\n`);
        return 2;
      }
      throw error;
    }
    html = rendered.html;
    title = flags.title || rendered.title;
    writeFileSync(artifactPath, html);
    writeFileSync(statePath, `${JSON.stringify({ source: absPath, target, title, assetBundleVersion: 1, assets: rendered.assets || [], at: new Date().toISOString() }, null, 2)}\n`);
  }

  const gate = gateOf(adapter, target);
  const existing = findEntry(absPath, target, configDir);
  const { code, explicit } = resolveCode(flags, config, gate, existing);

  let expiresAt;
  try {
    expiresAt = await resolveExpiry(flags, deps);
  } catch (expiryError) {
    stderr.write(`INPUT: ${expiryError.message}\n`);
    return 2;
  }
  // Always echo the resolved deadline so a publish never goes out without confirming it.
  stderr.write(`EXPIRES: ${describeExpiry(expiresAt)}\n`);

  // D4 static track: no server gate, so encrypt the page itself with the access code. Expiry on
  // static has no server to enforce it, so bake in a client-side guard as an honest backstop
  // (bypassable — real reaping is `htmlshare sweep`); wrap it outermost so it runs first.
  let uploadHtml = html;
  let encrypted = false;
  if (gate === "static" && code) {
    uploadHtml = encryptHtml(html, code).html;
    encrypted = true;
  }
  if (gate === "static" && expiresAt) {
    uploadHtml = wrapWithExpiry(uploadHtml, expiresAt);
    stderr.write("EXPIRES: 静态目标到期依赖页内守卫（可被绕过）与 htmlshare sweep 清扫，非服务端强制\n");
  }

  const meta = {
    title,
    code,
    setCode: explicit,
    expiresAt,
    // Rendering is A2UI-driven now; "template" persists only as an opaque storage label so the
    // server/adapter meta shape stays byte-identical across repos (D9).
    template: "generic",
    style: flags.style || config.defaults?.style || "clinical",
    encrypted
  };

  try {
    const result = await withRetry(() => adapter.publish({ html: uploadHtml, id: existing?.id || null, meta, config }), stderr);
    const now = new Date().toISOString();
    upsert({
      source: absPath,
      target,
      id: result.id,
      url: result.url,
      code,
      title,
      template: meta.template,
      style: meta.style,
      expiresAt: expiresAt || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    }, configDir);
    stdout.write(`URL: ${result.url}\n`);
    stdout.write(`CODE: ${code || "none"}\n`);
    return 0;
  } catch (error) {
    if (error instanceof AdapterError) {
      stderr.write(`UPLOAD: ${error.code} ${error.message}\n`);
      return 4;
    }
    throw error;
  }
}

function readState(statePath) {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

// docs/03 state machine: retry a failed upload twice before giving up. Don't retry
// deterministic client errors (bad input / auth / quota) — only transient failures.
const NON_RETRYABLE = new Set(["INVALID_INPUT", "UNAUTHORIZED", "PLAN_REQUIRED", "QUOTA_EXCEEDED", "ID_CONFLICT", "TOO_LARGE"]);

async function withRetry(fn, stderr, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!(error instanceof AdapterError) || NON_RETRYABLE.has(error.code) || attempt === attempts) throw error;
      stderr.write(`UPLOAD: retry ${attempt}/${attempts - 1} after ${error.code}\n`);
    }
  }
  throw lastError;
}

export async function run(argv = process.argv.slice(2), deps = {}) {
  const stdout = deps.stdout || process.stdout;
  const stderr = deps.stderr || process.stderr;
  const parsed = parseArgs(argv);
  if (parsed.command === "--help" || parsed.command === "-h" || !parsed.command) {
    stdout.write("htmlshare\n\nUsage:\n  htmlshare publish <file> [--target T] [--code C | --public] [--expires 7d | --no-expires] [--enhanced a2ui.json] [--style S] [--title T] [--force]\n  htmlshare login <邀请码> | login [--base-url URL]\n  htmlshare list [--json]\n  htmlshare unpublish <file|id> [--yes]\n  htmlshare expire <file|id> <7d|24h|2026-08-01|--off>\n  htmlshare sweep [--yes]\n  htmlshare config [show|target|selfhost|defaults]\n\nFlags:\n  --target selfhost|cloud|vercel|cloudflare  发布目标（缺省自动探测）\n  --code C | --public                        自定义访问码 / 关闭门禁\n  --expires 7d | --no-expires                过期时间（缺省会询问；到期后不可访问）\n  --enhanced a2ui.json                       A2UI 组件树增强内容（缺省仅忠实版）\n  --style auto|clinical|minimal|editorial|darktech  主题（也可由 A2UI 文档内 theme 指定）\n  --title T                                  覆盖标题\n  --force                                    跳过转换缓存，强制重渲染\n");
    return 0;
  }
  if (parsed.command === "--version" || parsed.command === "-v") {
    stdout.write("htmlshare 0.0.0\n");
    return 0;
  }
  if (parsed.command === "list") {
    const manifest = loadManifest(deps.configDir);
    if (parsed.flags.json) {
      stdout.write(`${JSON.stringify(manifest.entries, null, 2)}\n`);
    } else {
      stdout.write("title\ttarget\turl\tupdatedAt\tcode\texpires\n");
      for (const entry of manifest.entries) {
        stdout.write(`${entry.title || ""}\t${entry.target}\t${entry.url}\t${entry.updatedAt || ""}\t${entry.code || "none"}\t${entry.expiresAt || "none"}\n`);
      }
    }
    return 0;
  }

  if (parsed.command === "config") {
    return configCommand(parsed, { ...deps, stdout, stderr });
  }

  if (parsed.command === "login") {
    const invite = parsed.flags.invite || parsed.file;
    try {
      if (invite) {
        await redeemInvite({
          invite,
          baseUrl: parsed.flags["base-url"] || parsed.flags.baseUrl,
          configDir: deps.configDir,
          stdout,
          fetchFn: deps.fetchFn
        });
      } else {
        await loginCloud({
          baseUrl: parsed.flags["base-url"] || parsed.flags.baseUrl,
          configDir: deps.configDir,
          stdout,
          stderr,
          fetchFn: deps.fetchFn,
          intervalMs: deps.loginIntervalMs
        });
      }
      return 0;
    } catch (error) {
      if (error instanceof AdapterError) {
        stderr.write(`LOGIN: ${error.code} ${error.message}\n`);
        return error.code === "INVALID_INPUT" ? 2 : 4;
      }
      throw error;
    }
  }

  if (parsed.command === "unpublish" && parsed.file) {
    const manifest = loadManifest(deps.configDir);
    const config = deps.config || loadConfig(deps.configDir);
    const target = parsed.flags.target || config.defaultTarget;
    const maybePath = isAbsolute(parsed.file) ? parsed.file : resolve(deps.cwd || process.cwd(), parsed.file);
    // Locate by id regardless of default target (an id is globally unique); only the
    // path-based lookup is scoped by target.
    const entry = manifest.entries.find((item) => item.id === parsed.file)
      || manifest.entries.find((item) => item.source === maybePath && (!target || item.target === target));
    if (!entry) {
      stderr.write("UNPUBLISH: entry not found\n");
      return 2;
    }
    const stdin = deps.stdin || process.stdin;
    if (!parsed.flags.yes) {
      if (!stdin.isTTY) {
        stderr.write(`撤回 ${entry.url} 需要确认；脚本环境请加 --yes。各目标生效时间可能从数秒到数分钟不等。\n`);
        return 5;
      }
      const answer = await promptValue({ ...deps, stdout, stderr }, `确认撤回 ${entry.url}？输入 y 确认`);
      if (String(answer || "").trim().toLowerCase() !== "y") {
        stderr.write("UNPUBLISH: 已取消\n");
        return 0;
      }
    }
    const adapter = deps.adapters?.[entry.target] || getAdapter(entry.target);
    try {
      await adapter.unpublish({ id: entry.id, config });
      remove(entry.source, entry.target, deps.configDir);
      stdout.write(`UNPUBLISHED: ${entry.id}\n`);
      return 0;
    } catch (error) {
      if (error instanceof AdapterError) {
        stderr.write(`UNPUBLISH: ${error.code} ${error.message}\n`);
        return 4;
      }
      throw error;
    }
  }

  if (parsed.command === "expire" && parsed.file) {
    const manifest = loadManifest(deps.configDir);
    const config = deps.config || loadConfig(deps.configDir);
    const target = parsed.flags.target || config.defaultTarget;
    const maybePath = isAbsolute(parsed.file) ? parsed.file : resolve(deps.cwd || process.cwd(), parsed.file);
    const entry = manifest.entries.find((item) => item.id === parsed.file)
      || manifest.entries.find((item) => item.source === maybePath && (!target || item.target === target));
    if (!entry) {
      stderr.write("EXPIRE: entry not found\n");
      return 2;
    }
    let expiresAt;
    try {
      expiresAt = parsed.flags.off ? null : parseExpiry(parsed.positionals[1]);
    } catch (expiryError) {
      stderr.write(`INPUT: ${expiryError.message}\n`);
      return 2;
    }
    const adapter = deps.adapters?.[entry.target] || getAdapter(entry.target);
    if (typeof adapter.setExpiry !== "function") {
      stderr.write(`EXPIRE: ${entry.target} 是静态目标，改期请重新 htmlshare publish <file> --expires ...\n`);
      return 2;
    }
    try {
      await adapter.setExpiry({ id: entry.id, expiresAt, config });
      upsert({ source: entry.source, target: entry.target, expiresAt: expiresAt || null }, deps.configDir);
      stdout.write(`EXPIRES: ${describeExpiry(expiresAt)}\n`);
      return 0;
    } catch (error) {
      if (error instanceof AdapterError) {
        stderr.write(`EXPIRE: ${error.code} ${error.message}\n`);
        return 4;
      }
      throw error;
    }
  }

  if (parsed.command === "sweep") {
    const manifest = loadManifest(deps.configDir);
    const config = deps.config || loadConfig(deps.configDir);
    const nowMs = Date.now();
    const due = manifest.entries.filter((entry) => entry.expiresAt && Date.parse(entry.expiresAt) <= nowMs);
    if (!due.length) {
      stdout.write("SWEPT: 0\n");
      return 0;
    }
    const stdin = deps.stdin || process.stdin;
    if (!parsed.flags.yes) {
      if (!stdin.isTTY) {
        stderr.write(`将删除 ${due.length} 个已过期分享；脚本环境请加 --yes。\n`);
        return 5;
      }
      const answer = await promptValue({ ...deps, stdout, stderr }, `确认删除 ${due.length} 个已过期分享？输入 y 确认`);
      if (String(answer || "").trim().toLowerCase() !== "y") {
        stderr.write("SWEEP: 已取消\n");
        return 0;
      }
    }
    let swept = 0;
    for (const entry of due) {
      const adapter = deps.adapters?.[entry.target] || getAdapter(entry.target);
      try {
        await adapter.unpublish({ id: entry.id, config });
      } catch (error) {
        // A server target may have already reaped it (NOT_FOUND); either way drop the stale
        // manifest entry. Surface anything else but keep sweeping the rest.
        if (!(error instanceof AdapterError) || error.code !== "NOT_FOUND") {
          stderr.write(`SWEEP: ${entry.id} ${error.code || "ERROR"} ${error.message || ""}\n`);
          continue;
        }
      }
      remove(entry.source, entry.target, deps.configDir);
      swept += 1;
    }
    stdout.write(`SWEPT: ${swept}\n`);
    return 0;
  }

  if (parsed.command !== "publish" || !parsed.file) {
    stderr.write("Usage: htmlshare publish <file>\n");
    return 2;
  }
  return publishCommand(parsed.file, parsed.flags, { ...deps, stdout, stderr });
}
