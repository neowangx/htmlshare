import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createServer } from "../server.js";
import { createPage, expireDue, getMeta, isExpired, setExpiry } from "../lib/store.js";

// Page expiry: server-side enforcement (410 + soft-delete into the recoverable grace window),
// the periodic sweep, and the PATCH /meta expiry setter.

async function withServer(run) {
  const dataDir = mkdtempSync(join(tmpdir(), "htmlshare-expiry-"));
  const server = createServer({ dataDir, token: "TOK", secret: "SECRET" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await run({ baseUrl: `http://127.0.0.1:${port}`, dataDir });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const past = () => new Date(Date.now() - 60_000).toISOString();
const future = () => new Date(Date.now() + 3_600_000).toISOString();

test("createPage stores a normalized expiresAt and rejects garbage", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "htmlshare-store-"));
  const meta = createPage(dataDir, { id: "abc234", html: "<h1>x</h1>", expiresAt: "2099-01-01" });
  assert.equal(meta.expiresAt, new Date(Date.parse("2099-01-01")).toISOString());
  assert.throws(() => createPage(dataDir, { id: "abd234", html: "<h1>x</h1>", expiresAt: "not-a-date" }), /invalid expiresAt/);
});

test("expireDue soft-deletes past-deadline pages into the grace window", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "htmlshare-due-"));
  const expiresAt = past();
  createPage(dataDir, { id: "abc234", html: "<h1>x</h1>", expiresAt });
  createPage(dataDir, { id: "abd234", html: "<h1>y</h1>", expiresAt: future() });
  assert.equal(expireDue(dataDir), 1);
  // Grace clock starts at the moment it expired, not when the sweep ran.
  assert.equal(getMeta(dataDir, "abc234").deletedAt, expiresAt);
  assert.equal(getMeta(dataDir, "abd234").deletedAt, null);
  assert.equal(expireDue(dataDir), 0); // idempotent
});

test("GET /s/:id returns 410 and reaps once the deadline passes", async () => {
  await withServer(async ({ baseUrl, dataDir }) => {
    createPage(dataDir, { id: "abc234", html: "<h1>secret</h1>", expiresAt: past() });
    const response = await fetch(`${baseUrl}/s/abc234/`);
    assert.equal(response.status, 410);
    assert.match(await response.text(), /已过期/);
    // Lazily reaped on access: now soft-deleted.
    assert.ok(getMeta(dataDir, "abc234").deletedAt);
  });
});

test("GET meta returns 410 EXPIRED past the deadline", async () => {
  await withServer(async ({ baseUrl, dataDir }) => {
    createPage(dataDir, { id: "abc234", html: "<h1>x</h1>", expiresAt: past() });
    const response = await fetch(`${baseUrl}/api/pages/abc234/meta`, { headers: { authorization: "Bearer TOK" } });
    assert.equal(response.status, 410);
    assert.equal((await response.json()).error, "EXPIRED");
  });
});

test("PATCH /meta sets and clears expiry", async () => {
  await withServer(async ({ baseUrl, dataDir }) => {
    createPage(dataDir, { id: "abc234", html: "<h1>x</h1>" });
    const set = await fetch(`${baseUrl}/api/pages/abc234/meta`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: "Bearer TOK" },
      body: JSON.stringify({ expiresAt: "2099-01-01" })
    });
    assert.equal(set.status, 200);
    assert.equal(getMeta(dataDir, "abc234").expiresAt, new Date(Date.parse("2099-01-01")).toISOString());

    const clear = await fetch(`${baseUrl}/api/pages/abc234/meta`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: "Bearer TOK" },
      body: JSON.stringify({ expiresAt: null })
    });
    assert.equal(clear.status, 200);
    assert.equal(getMeta(dataDir, "abc234").expiresAt, null);
  });
});

test("PATCH /meta requires auth and rejects bad expiresAt", async () => {
  await withServer(async ({ baseUrl, dataDir }) => {
    createPage(dataDir, { id: "abc234", html: "<h1>x</h1>" });
    const noAuth = await fetch(`${baseUrl}/api/pages/abc234/meta`, { method: "PATCH", body: "{}" });
    assert.equal(noAuth.status, 401);
    const bad = await fetch(`${baseUrl}/api/pages/abc234/meta`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: "Bearer TOK" },
      body: JSON.stringify({ expiresAt: "nope" })
    });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error, "INVALID_INPUT");
  });
});

test("setExpiry is a no-op on a deleted page", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "htmlshare-setexp-"));
  createPage(dataDir, { id: "abc234", html: "<h1>x</h1>" });
  assert.equal(isExpired(getMeta(dataDir, "abc234")), false);
  assert.ok(setExpiry(dataDir, "abc234", future()));
  assert.equal(setExpiry(dataDir, "missing", future()), null);
});
