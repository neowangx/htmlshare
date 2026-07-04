import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createServer } from "../server.js";

async function withServer(run) {
  const dataDir = mkdtempSync(join(tmpdir(), "htmlshare-server-"));
  const server = createServer({ dataDir, token: "TOK", secret: "SECRET" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await run({ baseUrl: `http://127.0.0.1:${port}`, dataDir });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("S-01 POST /api/pages stores meta.json and v1.html", async () => {
  await withServer(async ({ baseUrl, dataDir }) => {
    const response = await fetch(`${baseUrl}/api/pages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer TOK" },
      body: JSON.stringify({ html: "<!doctype html><h1>Hello</h1>", code: "4821", title: "Hello", meta: { template: "generic", style: "clinical" } })
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.match(body.id, /^[a-z0-9]{6}$/);
    assert.equal(body.version, 1);

    const meta = JSON.parse(readFileSync(join(dataDir, body.id, "meta.json"), "utf8"));
    assert.equal(meta.title, "Hello");
    assert.match(meta.codeHash, /^scrypt:/);
    assert.deepEqual(meta.versions.map((item) => item.n), [1]);
    assert.equal(readFileSync(join(dataDir, body.id, "v1.html"), "utf8"), "<!doctype html><h1>Hello</h1>");
  });
});

test("S-01 gate page, unlock success, and wrong code response", async () => {
  await withServer(async ({ baseUrl }) => {
    const created = await fetch(`${baseUrl}/api/pages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer TOK" },
      body: JSON.stringify({ html: "<!doctype html><h1>Secret</h1>", code: "4821", title: "Secret" })
    }).then((response) => response.json());

    const gate = await fetch(`${baseUrl}/s/${created.id}/`);
    assert.equal(gate.status, 200);
    assert.match(await gate.text(), /请输入访问码/);

    const wrong = await fetch(`${baseUrl}/s/${created.id}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "0000" })
    });
    assert.equal(wrong.status, 403);
    assert.deepEqual(await wrong.json(), { error: "INVALID_INPUT", message: "访问码不正确" });

    const unlocked = await fetch(`${baseUrl}/s/${created.id}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "4821" })
    });
    assert.equal(unlocked.status, 200);
    assert.match(unlocked.headers.get("set-cookie"), new RegExp(`hs_${created.id}=`));
    assert.equal(await unlocked.text(), "<!doctype html><h1>Secret</h1>");
  });
});

test("S-01 rejects missing bearer token", async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/pages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ html: "x" })
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "UNAUTHORIZED", message: "token 缺失或无效" });
  });
});

test("S-01 server entrypoint starts with PORT=0", async () => {
  const child = spawn(process.execPath, ["server/server.js"], {
    cwd: new URL("../..", import.meta.url).pathname,
    env: { ...process.env, PORT: "0", UPLOAD_TOKEN: "TOK", DATA_DIR: mkdtempSync(join(tmpdir(), "htmlshare-entry-")) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 3000);
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      if (text.includes("htmlshare-server listening")) {
        clearTimeout(timer);
        resolve(text);
      }
    });
    child.on("error", reject);
  });
  assert.match(output, /htmlshare-server listening on :\d+/);
  child.kill("SIGTERM");
});
