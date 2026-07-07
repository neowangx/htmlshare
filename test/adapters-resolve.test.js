import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { GUIDE_TEXT, resolveTarget } from "../src/adapters/resolve.js";

function adapter(name, available) {
  return {
    name,
    async detect() {
      return available ? { available: true } : { available: false, reason: `${name} unavailable` };
    }
  };
}

async function selected(config, availability) {
  const root = mkdtempSync(join(tmpdir(), "htmlshare-resolve-"));
  const result = await resolveTarget({
    config,
    configDir: root,
    adapters: Object.fromEntries(Object.entries(availability).map(([name, value]) => [name, adapter(name, value)]))
  });
  return { result, root };
}

test("P-04 resolve matrix follows D7 order", async () => {
  const cases = [
    [{ defaultTarget: "vercel" }, { selfhost: true, cloud: true, vercel: true, cloudflare: true }, "vercel"],
    [{ defaultTarget: "vercel" }, { selfhost: true, cloud: false, vercel: false, cloudflare: true }, "selfhost"],
    [{}, { selfhost: true, cloud: true, vercel: true, cloudflare: true }, "selfhost"],
    [{}, { selfhost: false, cloud: true, vercel: true, cloudflare: true }, "cloud"],
    [{}, { selfhost: false, cloud: false, vercel: true, cloudflare: true }, "vercel"],
    [{}, { selfhost: false, cloud: false, vercel: false, cloudflare: true }, "cloudflare"],
    [{ defaultTarget: "cloudflare" }, { selfhost: true, cloud: false, vercel: true, cloudflare: true }, "cloudflare"],
    [{ defaultTarget: "cloud" }, { selfhost: true, cloud: false, vercel: true, cloudflare: true }, "selfhost"]
  ];

  for (const [config, availability, expected] of cases) {
    const { result } = await selected(config, availability);
    assert.equal(result.target, expected);
  }
});

test("P-04 remembers auto-detected target in config", async () => {
  const { result, root } = await selected({}, {
    selfhost: false,
    cloud: false,
    vercel: true,
    cloudflare: true
  });

  assert.equal(result.target, "vercel");
  assert.equal(result.remembered, true);
  assert.match(readFileSync(join(root, "config.json"), "utf8"), /"defaultTarget": "vercel"/);
});

test("P-04 requested target bypasses auto detection and does not remember", async () => {
  const result = await resolveTarget({
    requestedTarget: "cloudflare",
    config: {},
    adapters: { cloudflare: adapter("cloudflare", true) }
  });

  assert.equal(result.target, "cloudflare");
  assert.equal(result.remembered, false);
});

test("P-04 returns first-use guide when no target is available", async () => {
  const { result } = await selected({}, {
    selfhost: false,
    cloud: false,
    vercel: false,
    cloudflare: false
  });

  assert.equal(result.target, null);
  assert.equal(result.guide, GUIDE_TEXT);
  assert.match(result.guide, /VPS\/主机/);
  assert.match(result.guide, /--base-url https:\/\/share\.example\.com --token <token>/);
  assert.match(result.guide, /跳过主机配置/);
  assert.match(result.guide, /npx vercel login/);
  assert.match(result.guide, /npx wrangler login/);
  assert.match(result.guide, /htmlshare config selfhost/);
  assert.match(result.guide, /htmlshare login/);
});
