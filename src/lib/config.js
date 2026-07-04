import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export function defaultConfigDir() {
  return join(homedir(), ".config", "htmlshare");
}

export function configFile(dir = defaultConfigDir()) {
  return join(dir, "config.json");
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw new Error(`Failed to read JSON at ${path}: ${error.message}`, { cause: error });
  }
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tempPath, path);
}

export function loadConfig(dir = defaultConfigDir()) {
  return readJson(configFile(dir), {});
}

export function saveConfig(config, dir = defaultConfigDir()) {
  writeJsonAtomic(configFile(dir), config || {});
  return config || {};
}

export { readJson, writeJsonAtomic };
