import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createCloudflareAdapter } from "../src/adapters/cloudflare.js";
import { getAdapter, listAdapters } from "../src/adapters/index.js";

function mockExec(calls, stdout = "Uploaded htmlshare-pages (1.23 sec)\nhttps://htmlshare-pages.pages.dev\n") {
  return async (cmd, args, options = {}) => {
    calls.push({ cmd, args, cwd: options.cwd });
    return { stdout, stderr: "" };
  };
}

test("P-03 registry exposes cloudflare adapter", () => {
  assert.equal(getAdapter("cloudflare").name, "cloudflare");
  assert.ok(listAdapters().includes("cloudflare"));
});

test("P-03 detect calls npx wrangler whoami", async () => {
  const calls = [];
  const adapter = createCloudflareAdapter({ execFile: mockExec(calls) });
  assert.deepEqual(await adapter.detect(), { available: true });
  assert.deepEqual(calls[0].args, ["wrangler", "whoami"]);
});

test("P-03 publish writes site mirror layout and deploys with Wrangler", async () => {
  const calls = [];
  const root = mkdtempSync(join(tmpdir(), "htmlshare-cf-"));
  const adapter = createCloudflareAdapter({ execFile: mockExec(calls) });
  const result = await adapter.publish({
    id: "abc234",
    html: "<!doctype html><h1>Static</h1>",
    config: { siteDataDir: root, cloudflare: { project: "htmlshare-pages" } }
  });

  const siteRoot = join(root, "cloudflare", "htmlshare-pages");
  assert.equal(readFileSync(join(siteRoot, "s", "abc234", "index.html"), "utf8"), "<!doctype html><h1>Static</h1>");
  assert.equal(existsSync(join(siteRoot, "index.html")), true);
  assert.equal(result.url, "https://htmlshare-pages.pages.dev/s/abc234/");
  assert.deepEqual(calls.at(-1), {
    cmd: "npx",
    args: ["wrangler", "pages", "deploy", siteRoot, "--project-name", "htmlshare-pages"],
    cwd: siteRoot
  });
});

test("P-03 unpublish removes share directory and redeploys", async () => {
  const calls = [];
  const root = mkdtempSync(join(tmpdir(), "htmlshare-cf-"));
  const adapter = createCloudflareAdapter({ execFile: mockExec(calls) });
  await adapter.publish({ id: "abc234", html: "x", config: { siteDataDir: root, cloudflare: { project: "htmlshare-pages" } } });
  await adapter.unpublish({ id: "abc234", config: { siteDataDir: root, cloudflare: { project: "htmlshare-pages" } } });

  const siteRoot = join(root, "cloudflare", "htmlshare-pages");
  assert.equal(existsSync(join(siteRoot, "s", "abc234")), false);
  assert.equal(calls.filter((call) => call.args.includes("deploy")).length, 2);
});
