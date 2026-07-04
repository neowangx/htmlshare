import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createServer } from "../server.js";

async function withServer(run) {
  const dataDir = mkdtempSync(join(tmpdir(), "htmlshare-s02-"));
  const server = createServer({ dataDir, token: "TOK", secret: "SECRET", unlockRateLimit: 5 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function createPage(baseUrl, html, code = "4821") {
  const response = await fetch(`${baseUrl}/api/pages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer TOK" },
    body: JSON.stringify({ html, code, title: "Secret" })
  });
  return response.json();
}

test("S-02 sixth wrong unlock attempt returns 429", async () => {
  await withServer(async (baseUrl) => {
    const page = await createPage(baseUrl, "<!doctype html><h1>Secret</h1>");
    for (let index = 0; index < 5; index += 1) {
      const response = await fetch(`${baseUrl}/s/${page.id}/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "0000" })
      });
      assert.equal(response.status, 403);
    }

    const limited = await fetch(`${baseUrl}/s/${page.id}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "0000" })
    });
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), { error: "RATE_LIMITED", message: "解锁尝试过频" });
  });
});

test("S-02 successful unlock cookie allows direct GET content", async () => {
  await withServer(async (baseUrl) => {
    const page = await createPage(baseUrl, "<!doctype html><h1>Unlocked</h1>");
    const unlocked = await fetch(`${baseUrl}/s/${page.id}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "4821" })
    });
    const cookie = unlocked.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, new RegExp(`Path=/s/${page.id}`));
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Max-Age=86400/);

    const direct = await fetch(`${baseUrl}/s/${page.id}/`, { headers: { cookie } });
    assert.equal(direct.status, 200);
    assert.equal(await direct.text(), "<!doctype html><h1>Unlocked</h1>");
  });
});

test("S-02 cookie for one id does not unlock another id", async () => {
  await withServer(async (baseUrl) => {
    const first = await createPage(baseUrl, "<!doctype html><h1>One</h1>");
    const second = await createPage(baseUrl, "<!doctype html><h1>Two</h1>");
    const unlocked = await fetch(`${baseUrl}/s/${first.id}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "4821" })
    });
    const cookie = unlocked.headers.get("set-cookie");

    const other = await fetch(`${baseUrl}/s/${second.id}/`, { headers: { cookie } });
    assert.equal(other.status, 200);
    assert.match(await other.text(), /请输入访问码/);
  });
});
