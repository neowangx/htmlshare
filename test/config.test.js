import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { configFile, defaultConfigDir, loadConfig, saveConfig } from "../src/lib/config.js";

test("empty config is usable with zero required fields", () => {
  const dir = mkdtempSync(join(tmpdir(), "htmlshare-cfg-"));
  assert.deepEqual(loadConfig(dir), {});
});

test("save then load config roundtrip with optional fields", () => {
  const dir = mkdtempSync(join(tmpdir(), "htmlshare-cfg-"));
  const config = {
    defaultTarget: "vercel",
    defaults: { template: "auto", style: "auto", code: "auto" },
    selfhost: { baseUrl: "https://x.example.com", uploadToken: "TOK" },
    footerBadge: true
  };

  saveConfig(config, dir);
  assert.deepEqual(loadConfig(dir), config);
});

test("default config path is isolated to htmlshare", () => {
  const dir = defaultConfigDir();
  assert.match(dir, /htmlshare$/);
  assert.doesNotMatch(dir, /mdshare/);
  assert.match(configFile(), /htmlshare\/config\.json$/);
});

test("corrupt config JSON throws and preserves the original file", () => {
  const dir = mkdtempSync(join(tmpdir(), "htmlshare-cfg-"));
  const path = configFile(dir);
  writeFileSync(path, "{ broken");

  assert.throws(() => loadConfig(dir), /Failed to read JSON/);
  assert.equal(readFileSync(path, "utf8"), "{ broken");
});
