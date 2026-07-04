import { createHash, randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, isAbsolute, join, resolve } from "node:path";

import { composePage } from "../compose.js";
import { convertFile } from "../convert.js";
import { getAdapter } from "../adapters/index.js";
import { AdapterError } from "../adapters/errors.js";
import { resolveTarget } from "../adapters/resolve.js";
import { findEntry, loadManifest, remove, upsert } from "../lib/manifest.js";
import { loadConfig, saveConfig } from "../lib/config.js";

const TARGETS = new Set(["selfhost", "cloud", "vercel", "cloudflare"]);
const TEMPLATES = new Set(["auto", "generic", "meeting", "proposal", "tutorial", "release"]);
const STYLES = new Set(["auto", "clinical", "minimal", "editorial", "darktech"]);

function parseArgs(argv) {
  const [command, ...rest] = argv;
  let file = null;
  const positionals = [];
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--public" || arg === "--force" || arg === "--json" || arg === "--yes") {
      flags[arg.slice(2)] = true;
    } else if (arg.startsWith("--")) {
      flags[arg.slice(2)] = rest[index + 1];
      index += 1;
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

function cacheKey(absPath) {
  const stat = statSync(absPath);
  return createHash("sha256").update(`${absPath}:${stat.mtimeMs}:${stat.size}`).digest("hex").slice(0, 16);
}

function randomCode() {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

function chooseCode(flags, config) {
  if (flags.public) return null;
  if (flags.code) return flags.code;
  const configured = config.defaults?.code;
  if (configured && configured !== "auto" && configured !== "none") return configured;
  if (configured === "none") return null;
  return randomCode();
}

function htmlFromInput(absPath, flags, stderr, config) {
  if (extname(absPath).toLowerCase() === ".html") {
    stderr.write("COLLECT: html direct\n");
    return { html: readFileSync(absPath, "utf8"), title: basename(absPath, ".html"), directHtml: true };
  }

  stderr.write("CONVERT: markdown\n");
  const faithful = convertFile(absPath);
  const enhanced = flags.enhanced ? JSON.parse(readFileSync(resolve(flags.enhanced), "utf8")) : null;
  const page = composePage({
    title: flags.title || faithful.title,
    faithfulHtml: faithful.html,
    enhanced,
    footerBadge: configFooter(config)
  });
  return { html: page.html, title: flags.title || faithful.title, directHtml: false };
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
    if (!["template", "style", "code"].includes(key) || value === undefined) {
      stderr.write("CONFIG: defaults usage: htmlshare config defaults <template|style|code> <value>\n");
      return 2;
    }
    if (key === "template" && !TEMPLATES.has(value)) {
      stderr.write("CONFIG: template must be auto|generic|meeting|proposal|tutorial|release\n");
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

  const dir = join(deps.cacheDir || defaultCacheDir(), cacheKey(absPath));
  const artifactPath = join(dir, "artifact.html");
  const statePath = join(dir, "state.json");
  mkdirSync(dir, { recursive: true });

  let html;
  let title;
  if (!flags.force && existsSync(artifactPath)) {
    stderr.write("CACHE: hit CONVERT\n");
    html = readFileSync(artifactPath, "utf8");
    title = flags.title || basename(absPath, extname(absPath));
  } else {
    const rendered = htmlFromInput(absPath, flags, stderr, config);
    html = rendered.html;
    title = flags.title || rendered.title;
    writeFileSync(artifactPath, html);
    writeFileSync(statePath, `${JSON.stringify({ source: absPath, target, title, at: new Date().toISOString() }, null, 2)}\n`);
  }

  const code = chooseCode(flags, config);
  const existing = findEntry(absPath, target, configDir);
  try {
    const result = await adapter.publish({
      html,
      id: existing?.id || null,
      meta: {
        title,
        code,
        template: flags.template || config.defaults?.template || "generic",
        style: flags.style || config.defaults?.style || "clinical",
        encrypted: false
      },
      config
    });
    const now = new Date().toISOString();
    upsert({
      source: absPath,
      target,
      id: result.id,
      url: result.url,
      code,
      title,
      template: flags.template || config.defaults?.template || "generic",
      style: flags.style || config.defaults?.style || "clinical",
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

export async function run(argv = process.argv.slice(2), deps = {}) {
  const stdout = deps.stdout || process.stdout;
  const stderr = deps.stderr || process.stderr;
  const parsed = parseArgs(argv);
  if (parsed.command === "--help" || parsed.command === "-h" || !parsed.command) {
    stdout.write("htmlshare\n\nUsage:\n  htmlshare publish <file> [--target T] [--code C | --public] [--enhanced enhanced.json]\n  htmlshare list [--json]\n  htmlshare unpublish <file|id> [--yes]\n  htmlshare config [show|target|selfhost|defaults]\n");
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
      stdout.write("title\ttarget\turl\tupdatedAt\tcode\n");
      for (const entry of manifest.entries) {
        stdout.write(`${entry.title || ""}\t${entry.target}\t${entry.url}\t${entry.updatedAt || ""}\t${entry.code || "none"}\n`);
      }
    }
    return 0;
  }

  if (parsed.command === "config") {
    return configCommand(parsed, { ...deps, stdout, stderr });
  }

  if (parsed.command === "unpublish" && parsed.file) {
    const manifest = loadManifest(deps.configDir);
    const config = deps.config || loadConfig(deps.configDir);
    const target = parsed.flags.target || config.defaultTarget;
    const maybePath = isAbsolute(parsed.file) ? parsed.file : resolve(deps.cwd || process.cwd(), parsed.file);
    const entry = manifest.entries.find((item) => item.id === parsed.file && (!target || item.target === target))
      || manifest.entries.find((item) => item.source === maybePath && (!target || item.target === target));
    if (!entry) {
      stderr.write("UNPUBLISH: entry not found\n");
      return 2;
    }
    const stdin = deps.stdin || process.stdin;
    if (!parsed.flags.yes && !stdin.isTTY) {
      stderr.write(`撤回 ${entry.url} 需要确认；脚本环境请加 --yes。各目标生效时间可能从数秒到数分钟不等。\n`);
      return 5;
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

  if (parsed.command !== "publish" || !parsed.file) {
    stderr.write("Usage: htmlshare publish <file>\n");
    return 2;
  }
  return publishCommand(parsed.file, parsed.flags, { ...deps, stdout, stderr });
}
