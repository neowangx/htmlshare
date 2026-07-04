import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createVercelAdapter } from "../src/adapters/vercel.js";
import { getAdapter, listAdapters } from "../src/adapters/index.js";

function mockExec(calls, stdout = "Preview: https://preview.vercel.app\nProduction: https://htmlshare-pages.vercel.app\n") {
  return async (cmd, args, options = {}) => {
    calls.push({ cmd, args, cwd: options.cwd });
    return { stdout, stderr: "" };
  };
}

test("P-02 registry exposes vercel adapter", () => {
  assert.equal(getAdapter("vercel").name, "vercel");
  assert.ok(listAdapters().includes("vercel"));
});

test("P-02 detect calls npx vercel whoami", async () => {
  const calls = [];
  const adapter = createVercelAdapter({ execFile: mockExec(calls) });
  assert.deepEqual(await adapter.detect(), { available: true });
  assert.deepEqual(calls[0].args, ["vercel", "whoami"]);
});

test("P-02 publish writes site mirror layout and deploys with Vercel CLI", async () => {
  const calls = [];
  const root = mkdtempSync(join(tmpdir(), "htmlshare-vercel-"));
  const adapter = createVercelAdapter({ execFile: mockExec(calls) });
  const result = await adapter.publish({
    id: "abc234",
    html: "<!doctype html><h1>Static</h1>",
    config: { siteDataDir: root, vercel: { project: "htmlshare-pages" } }
  });

  const siteRoot = join(root, "vercel", "htmlshare-pages");
  assert.equal(readFileSync(join(siteRoot, "s", "abc234", "index.html"), "utf8"), "<!doctype html><h1>Static</h1>");
  assert.equal(existsSync(join(siteRoot, "index.html")), true);
  assert.equal(result.url, "https://htmlshare-pages.vercel.app/s/abc234/");
  assert.deepEqual(calls.at(-1), { cmd: "npx", args: ["vercel", "deploy", "--prod", "--yes"], cwd: siteRoot });
});

test("P-02 unpublish removes share directory and redeploys", async () => {
  const calls = [];
  const root = mkdtempSync(join(tmpdir(), "htmlshare-vercel-"));
  const adapter = createVercelAdapter({ execFile: mockExec(calls) });
  await adapter.publish({ id: "abc234", html: "x", config: { siteDataDir: root, vercel: { project: "htmlshare-pages" } } });
  await adapter.unpublish({ id: "abc234", config: { siteDataDir: root, vercel: { project: "htmlshare-pages" } } });

  const siteRoot = join(root, "vercel", "htmlshare-pages");
  assert.equal(existsSync(join(siteRoot, "s", "abc234")), false);
  assert.equal(calls.filter((call) => call.args.includes("deploy")).length, 2);
});
