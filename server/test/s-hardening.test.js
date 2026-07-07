import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createServer } from "../server.js";
import { createPage, deletePage, getMeta, purgeDeleted } from "../lib/store.js";

// Open-source-server hardening tests. Kept OUT of s01-s03 so those stay byte-identical to
// the cloud repo's copies (D9 shared contract).

async function withServer(run) {
  const dataDir = mkdtempSync(join(tmpdir(), "htmlshare-harden-"));
  const server = createServer({ dataDir, token: "TOK", secret: "SECRET" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await run({ baseUrl: `http://127.0.0.1:${port}`, dataDir });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function authHeaders() {
  return { "content-type": "application/json", authorization: "Bearer TOK" };
}

test("B4 malformed id is rejected 400 and writes nothing outside data dir", async () => {
  await withServer(async ({ baseUrl, dataDir }) => {
    for (const id of ["../../evil", "ABCDEF", "abc-23", "abc2345"]) {
      const response = await fetch(`${baseUrl}/api/pages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id, html: "<h1>x</h1>" })
      });
      assert.equal(response.status, 400, `id ${id} should be 400`);
      assert.equal((await response.json()).error, "INVALID_INPUT");
    }
    assert.equal(existsSync(join(dataDir, "..", "..", "evil")), false);
  });
});

test("B3 server refuses to start without a session secret", () => {
  assert.throws(() => createServer({ dataDir: mkdtempSync(join(tmpdir(), "htmlshare-nosecret-")), token: "TOK", secret: undefined }), /SESSION_SECRET/);
});

test("S2 soft-deleted pages are purged after the grace window", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "htmlshare-purge-"));
  createPage(dataDir, { id: "abc234", html: "<h1>x</h1>", title: "t" });
  deletePage(dataDir, "abc234", { now: new Date("2026-01-01T00:00:00Z").toISOString() });
  assert.equal(purgeDeleted(dataDir, { now: Date.parse("2026-01-05T00:00:00Z") }), 0);
  assert.ok(getMeta(dataDir, "abc234"));
  assert.equal(purgeDeleted(dataDir, { now: Date.parse("2026-01-10T00:00:00Z") }), 1);
  assert.equal(existsSync(join(dataDir, "abc234")), false);
});
