import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";

import { AdapterError, getAdapter, listAdapters } from "../src/adapters/index.js";
import * as selfhost from "../src/adapters/selfhost.js";

async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function config(baseUrl) {
  return { selfhost: { baseUrl, uploadToken: "TOK" } };
}

test("adapter registry exposes selfhost", () => {
  assert.equal(getAdapter("selfhost").name, "selfhost");
  assert.deepEqual(listAdapters(), ["selfhost"]);
});

test("selfhost detect uses config without throwing", async () => {
  assert.deepEqual(await selfhost.detect({}), { available: false, reason: "selfhost.baseUrl missing" });
  assert.deepEqual(await selfhost.detect({ selfhost: { baseUrl: "http://x" } }), { available: false, reason: "selfhost.uploadToken missing" });
  assert.deepEqual(await selfhost.detect({ selfhost: { baseUrl: "http://x", uploadToken: "TOK" } }), { available: true });
});

test("selfhost publish POST sends bearer token and request body", async () => {
  await withServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/pages");
    assert.equal(request.headers.authorization, "Bearer TOK");
    const body = await readJson(request);
    assert.equal(body.html, "<!doctype html>");
    assert.equal(body.id, null);
    assert.equal(body.code, "4821");
    assert.equal(body.title, "Title");
    response.writeHead(201, { "content-type": "application/json" });
    response.end(JSON.stringify({ id: "k3f9m2", url: "http://host/s/k3f9m2/", version: 1 }));
  }, async (baseUrl) => {
    const result = await selfhost.publish({
      html: "<!doctype html>",
      meta: { title: "Title", code: "4821", template: "meeting", style: "clinical" },
      config: config(baseUrl)
    });
    assert.equal(result.id, "k3f9m2");
  });
});

test("selfhost publish PUT updates existing id", async () => {
  await withServer(async (request, response) => {
    assert.equal(request.method, "PUT");
    assert.equal(request.url, "/api/pages/abc234");
    const body = await readJson(request);
    assert.equal(body.id, "abc234");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ version: 2 }));
  }, async (baseUrl) => {
    const result = await selfhost.publish({ id: "abc234", html: "next", meta: { title: "T" }, config: config(baseUrl) });
    assert.equal(result.version, 2);
    assert.equal(result.url, `${baseUrl}/s/abc234/`);
  });
});

test("selfhost unpublish DELETE is idempotent on adapter side", async () => {
  await withServer((request, response) => {
    assert.equal(request.method, "DELETE");
    assert.equal(request.url, "/api/pages/abc234");
    response.writeHead(204);
    response.end();
  }, async (baseUrl) => {
    await selfhost.unpublish({ id: "abc234", config: config(baseUrl) });
  });
});

test("selfhost maps 409, 413 and 401 to AdapterError codes", async () => {
  for (const [status, code] of [[409, "ID_CONFLICT"], [413, "TOO_LARGE"], [401, "UNAUTHORIZED"]]) {
    await withServer((request, response) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: code, message: code }));
    }, async (baseUrl) => {
      await assert.rejects(
        () => selfhost.publish({ html: "x", meta: {}, config: config(baseUrl) }),
        (error) => error instanceof AdapterError && error.code === code && error.status === status
      );
    });
  }
});
