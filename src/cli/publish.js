import { createHash, randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, isAbsolute, join, resolve } from "node:path";

import { composePage } from "../compose.js";
import { convertFile } from "../convert.js";
import { getAdapter } from "../adapters/index.js";
import { AdapterError } from "../adapters/errors.js";
import { findEntry, upsert } from "../lib/manifest.js";
import { loadConfig } from "../lib/config.js";

function parseArgs(argv) {
  const [command, file, ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--public" || arg === "--force") {
      flags[arg.slice(2)] = true;
    } else if (arg.startsWith("--")) {
      flags[arg.slice(2)] = rest[index + 1];
      index += 1;
    }
  }
  return { command, file, flags };
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

function htmlFromInput(absPath, flags, stderr) {
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
    footerBadge: configFooter(flags)
  });
  return { html: page.html, title: flags.title || faithful.title, directHtml: false };
}

function configFooter() {
  return true;
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
  const target = flags.target || config.defaultTarget || "selfhost";
  const adapter = deps.adapters?.[target] || getAdapter(target);
  const detected = await adapter.detect?.(config);
  if (detected && detected.available === false) {
    stderr.write(`TARGET: ${detected.reason || "not available"}\n`);
    return 3;
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
    const rendered = htmlFromInput(absPath, flags, stderr);
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
      template: flags.template || "generic",
      style: flags.style || "clinical",
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
    stdout.write("htmlshare\n\nUsage:\n  htmlshare publish <file> [--target T] [--code C | --public] [--enhanced enhanced.json]\n");
    return 0;
  }
  if (parsed.command === "--version" || parsed.command === "-v") {
    stdout.write("htmlshare 0.0.0\n");
    return 0;
  }
  if (parsed.command !== "publish" || !parsed.file) {
    stderr.write("Usage: htmlshare publish <file>\n");
    return 2;
  }
  return publishCommand(parsed.file, parsed.flags, { ...deps, stdout, stderr });
}
