import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createServer } from "../server.js";

async function withServer(options, run) {
  const dataDir = mkdtempSync(join(tmpdir(), "htmlshare-s03-"));
  const server = createServer({ dataDir, token: "TOK", secret: "SECRET", ...options });
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

async function createPage(baseUrl, body = {}) {
  const response = await fetch(`${baseUrl}/api/pages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ html: "<!doctype html><h1>v1</h1>", code: "4821", title: "v1", ...body })
  });
  return response.json();
}

test("S-03 PUT increments version and keeps v1.html", async () => {
  await withServer({}, async ({ baseUrl, dataDir }) => {
    const page = await createPage(baseUrl);
    const updated = await fetch(`${baseUrl}/api/pages/${page.id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ html: "<!doctype html><h1>v2</h1>", title: "v2" })
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(await updated.json(), { version: 2 });
    assert.equal(readFileSync(join(dataDir, page.id, "v1.html"), "utf8"), "<!doctype html><h1>v1</h1>");
    assert.equal(readFileSync(join(dataDir, page.id, "v2.html"), "utf8"), "<!doctype html><h1>v2</h1>");
  });
});

test("S-03 GET meta returns contracted fields", async () => {
  await withServer({}, async ({ baseUrl }) => {
    const page = await createPage(baseUrl);
    const response = await fetch(`${baseUrl}/api/pages/${page.id}/meta`, { headers: { authorization: "Bearer TOK" } });
    assert.equal(response.status, 200);
    const meta = await response.json();
    assert.equal(meta.id, page.id);
    assert.equal(meta.title, "v1");
    assert.equal(meta.version, 1);
    assert.equal(meta.hasCode, true);
    assert.match(meta.createdAt, /^\d{4}-/);
  });
});

test("S-03 DELETE soft deletes without physical data loss", async () => {
  await withServer({}, async ({ baseUrl, dataDir }) => {
    const page = await createPage(baseUrl);
    const response = await fetch(`${baseUrl}/api/pages/${page.id}`, { method: "DELETE", headers: { authorization: "Bearer TOK" } });
    assert.equal(response.status, 204);
    const view = await fetch(`${baseUrl}/s/${page.id}/`);
    assert.equal(view.status, 404);
    assert.equal(existsSync(join(dataDir, page.id, "v1.html")), true);
    const meta = JSON.parse(readFileSync(join(dataDir, page.id, "meta.json"), "utf8"));
    assert.match(meta.deletedAt, /^\d{4}-/);
  });
});

test("S-03 RETAIN_VERSIONS prunes old version files", async () => {
  await withServer({ retainVersions: 2 }, async ({ baseUrl, dataDir }) => {
    const page = await createPage(baseUrl);
    for (const n of [2, 3]) {
      await fetch(`${baseUrl}/api/pages/${page.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ html: `<!doctype html><h1>v${n}</h1>` })
      });
    }
    assert.equal(existsSync(join(dataDir, page.id, "v1.html")), false);
    assert.equal(existsSync(join(dataDir, page.id, "v2.html")), true);
    assert.equal(existsSync(join(dataDir, page.id, "v3.html")), true);
  });
});

test("S-03 required error codes are returned", async () => {
  await withServer({ maxPageBytes: 5 }, async ({ baseUrl }) => {
    const badJson = await fetch(`${baseUrl}/api/pages`, { method: "POST", headers: authHeaders(), body: "{" });
    assert.equal(badJson.status, 400);
    assert.equal((await badJson.json()).error, "INVALID_INPUT");

    const noAuth = await fetch(`${baseUrl}/api/pages/abc234/meta`);
    assert.equal(noAuth.status, 401);
    assert.equal((await noAuth.json()).error, "UNAUTHORIZED");

    const missing = await fetch(`${baseUrl}/api/pages/abc234/meta`, { headers: { authorization: "Bearer TOK" } });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error, "NOT_FOUND");

    const tooLarge = await fetch(`${baseUrl}/api/pages`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ html: "too large" }) });
    assert.equal(tooLarge.status, 413);
    assert.equal((await tooLarge.json()).error, "TOO_LARGE");
  });
});

test("S-03 explicit id conflict returns 409", async () => {
  await withServer({}, async ({ baseUrl }) => {
    await createPage(baseUrl, { id: "abc234" });
    const conflict = await fetch(`${baseUrl}/api/pages`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: "abc234", html: "again" })
    });
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error, "ID_CONFLICT");
  });
});
