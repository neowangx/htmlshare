import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createServer } from "../server.js";

async function withServer(options, run) {
  const dataDir = mkdtempSync(join(tmpdir(), "htmlshare-s07-"));
  const server = createServer({ dataDir, token: "TOK", secret: "SECRET", ...options });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await run({ baseUrl: `http://127.0.0.1:${port}`, dataDir });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function create(baseUrl, body) {
  return fetch(`${baseUrl}/api/pages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer TOK" },
    body: JSON.stringify(body)
  }).then((response) => response.json());
}

function views(baseUrl, id) {
  return fetch(`${baseUrl}/api/pages/${id}/meta`, { headers: { authorization: "Bearer TOK" } })
    .then((response) => response.json())
    .then((meta) => meta.uniqueViews);
}

test("S-07 unique views count once per browser, not per refresh", async () => {
  await withServer({}, async ({ baseUrl }) => {
    const page = await create(baseUrl, { html: "<!doctype html><h1>hi</h1>", title: "t" }); // no code → public

    const first = await fetch(`${baseUrl}/s/${page.id}/`);
    assert.equal(first.status, 200);
    assert.match(first.headers.getSetCookie().join("; "), new RegExp(`hsv_${page.id}=1`));
    assert.equal(await views(baseUrl, page.id), 1);

    // same browser refreshes (returns its marker cookie) → not re-counted
    await fetch(`${baseUrl}/s/${page.id}/`, { headers: { cookie: `hsv_${page.id}=1` } });
    assert.equal(await views(baseUrl, page.id), 1);

    // a different browser (no cookie) → counted
    await fetch(`${baseUrl}/s/${page.id}/`);
    assert.equal(await views(baseUrl, page.id), 2);
  });
});

test("S-07 the access-code gate is not counted; a successful unlock counts once", async () => {
  await withServer({}, async ({ baseUrl }) => {
    const page = await create(baseUrl, { html: "<!doctype html><h1>secret</h1>", title: "t", code: "4821" });

    // seeing the gate (not the content) must not count
    await fetch(`${baseUrl}/s/${page.id}/`);
    assert.equal(await views(baseUrl, page.id), 0);

    const unlocked = await fetch(`${baseUrl}/s/${page.id}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "4821" })
    });
    assert.equal(unlocked.status, 200);
    const cookies = unlocked.headers.getSetCookie().join("; ");
    assert.match(cookies, new RegExp(`hs_${page.id}=`)); // session cookie
    assert.match(cookies, new RegExp(`hsv_${page.id}=1`)); // view marker alongside it
    assert.equal(await views(baseUrl, page.id), 1);
  });
});
