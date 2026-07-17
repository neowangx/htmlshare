import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { AdapterError, getAdapter, listAdapters } from "../src/adapters/index.js";
import * as cloud from "../src/adapters/cloud.js";
import { run } from "../src/cli/publish.js";
import { loadConfig } from "../src/lib/config.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function withServer(handler, runServer) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await runServer(`http://127.0.0.1:${port}`);
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
  return { cloud: { baseUrl, token: "TOK" } };
}

function harness() {
  const root = mkdtempSync(join(tmpdir(), "htmlshare-cloud-adapter-"));
  const configDir = join(root, "config");
  const out = [];
  const err = [];
  return {
    configDir,
    stdout: { write: (value) => out.push(value) },
    stderr: { write: (value) => err.push(value) },
    out: () => out.join(""),
    err: () => err.join("")
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}

test("P-05 adapter registry exposes cloud", () => {
  assert.equal(getAdapter("cloud").name, "cloud");
  assert.ok(listAdapters().includes("cloud"));
});

test("P-05 cloud detect uses config without throwing", async () => {
  assert.deepEqual(await cloud.detect({}), { available: false, reason: "cloud.baseUrl missing" });
  assert.deepEqual(await cloud.detect({ cloud: { baseUrl: "https://cloud.example.com" } }), { available: false, reason: "cloud.token missing" });
  assert.deepEqual(await cloud.detect({ cloud: { baseUrl: "https://cloud.example.com", token: "TOK" } }), { available: true });
});

test("P-05 cloud publish reuses selfhost protocol with bearer token", async () => {
  await withServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/pages");
    assert.equal(request.headers.authorization, "Bearer TOK");
    const body = await readJson(request);
    assert.equal(body.html, "<!doctype html>");
    assert.equal(body.code, "4821");
    assert.equal(body.title, "Title");
    assert.deepEqual(body.meta, { template: "meeting", style: "clinical", encrypted: false });
    response.writeHead(201, { "content-type": "application/json" });
    response.end(JSON.stringify({ id: "cloud123", url: "https://cloud.example.com/s/cloud123/", version: 1 }));
  }, async (baseUrl) => {
    const result = await cloud.publish({
      html: "<!doctype html>",
      meta: { title: "Title", code: "4821", template: "meeting", style: "clinical" },
      config: config(baseUrl)
    });
    assert.equal(result.id, "cloud123");
  });
});

test("P-05 cloud publish PUT updates existing id", async () => {
  await withServer(async (request, response) => {
    assert.equal(request.method, "PUT");
    assert.equal(request.url, "/api/pages/abc234");
    const body = await readJson(request);
    assert.equal(body.id, "abc234");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ version: 2 }));
  }, async (baseUrl) => {
    const result = await cloud.publish({ id: "abc234", html: "next", meta: { title: "T" }, config: config(baseUrl) });
    assert.equal(result.version, 2);
    assert.equal(result.url, `${baseUrl}/s/abc234/`);
  });
});

test("P-05 cloud maps plan and quota errors to actionable messages", async () => {
  for (const [status, code, hint] of [
    [402, "PLAN_REQUIRED", /升级计划/],
    [403, "QUOTA_EXCEEDED", /htmlshare list 清理旧页面/]
  ]) {
    await withServer((request, response) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: code, message: code }));
    }, async (baseUrl) => {
      await assert.rejects(
        () => cloud.publish({ html: "x", meta: {}, config: config(baseUrl) }),
        (error) => error instanceof AdapterError
          && error.code === code
          && error.status === status
          && hint.test(error.message)
      );
    });
  }
});

test("P-05 htmlshare login polls device code and saves cloud config", async () => {
  const h = harness();
  let tokenAttempts = 0;
  const calls = [];
  const fetchFn = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === "https://cloud.example.com/api/auth/device") {
      return jsonResponse(201, {
        deviceCode: "DEV-1",
        userCode: "ABCD-1234",
        verificationUrl: "https://cloud.example.com/activate",
        interval: 0
      });
    }
    assert.equal(url, "https://cloud.example.com/api/auth/token");
    assert.deepEqual(JSON.parse(options.body), { deviceCode: "DEV-1" });
    tokenAttempts += 1;
    return tokenAttempts === 1
      ? jsonResponse(428, { error: "AUTH_PENDING" })
      : jsonResponse(200, { token: "CLOUD-TOKEN" });
  };

  const code = await run(["login", "--base-url", "https://cloud.example.com/"], {
    configDir: h.configDir,
    stdout: h.stdout,
    stderr: h.stderr,
    fetchFn,
    loginIntervalMs: 0
  });

  assert.equal(code, 0);
  assert.match(h.out(), /Open: https:\/\/cloud\.example\.com\/activate/);
  assert.match(h.out(), /Code: ABCD-1234/);
  assert.match(h.err(), /waiting for activation/);
  assert.equal(calls.length, 3);
  assert.deepEqual(loadConfig(h.configDir), {
    defaultTarget: "cloud",
    cloud: { baseUrl: "https://cloud.example.com", token: "CLOUD-TOKEN" }
  });
});

test("P-05 htmlshare login reports expired device codes", async () => {
  const h = harness();
  const fetchFn = async (url) => {
    if (url.endsWith("/api/auth/device")) {
      return jsonResponse(201, {
        deviceCode: "DEV-2",
        userCode: "WXYZ-9876",
        verificationUrl: "https://cloud.example.com/activate",
        interval: 0
      });
    }
    return jsonResponse(410, { error: "EXPIRED" });
  };

  const code = await run(["login", "--base-url", "https://cloud.example.com"], {
    configDir: h.configDir,
    stdout: h.stdout,
    stderr: h.stderr,
    fetchFn,
    loginIntervalMs: 0
  });

  assert.equal(code, 4);
  assert.match(h.err(), /LOGIN: EXPIRED/);
});

test("P-05 cloud adapter remains weakly coupled to CLI and registry", () => {
  const allowed = new Set(["src/adapters/index.js", "src/cli/publish.js"]);
  const queue = [join(repoRoot, "src")];
  const offenders = [];
  while (queue.length > 0) {
    const dir = queue.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(path);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const rel = relative(repoRoot, path);
        if (!allowed.has(rel) && readFileSync(path, "utf8").includes("cloud.js")) {
          offenders.push(rel);
        }
      }
    }
  }
  assert.deepEqual(offenders, []);
});

function inviteBlob(baseUrl, code) {
  return "hsi_" + Buffer.from(JSON.stringify({ u: baseUrl, c: code })).toString("base64url");
}

test("redeemInvite: a blob carries the server URL, saves token + defaultTarget=cloud", async () => {
  await withServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/auth/redeem");
    const body = await readJson(request);
    assert.equal(body.invite, "CODE123");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ token: "granted-token" }));
  }, async (baseUrl) => {
    const h = harness();
    const result = await cloud.redeemInvite({ invite: inviteBlob(baseUrl, "CODE123"), configDir: h.configDir, stdout: h.stdout });
    assert.equal(result.token, "granted-token");
    const saved = loadConfig(h.configDir);
    assert.equal(saved.defaultTarget, "cloud");
    assert.equal(saved.cloud.baseUrl, baseUrl);
    assert.equal(saved.cloud.token, "granted-token");
  });
});

test("redeemInvite: a bare code needs --base-url, and a used invite surfaces INVITE_USED", async () => {
  await withServer((request, response) => {
    response.writeHead(409, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "INVITE_USED", message: "邀请码已被使用" }));
  }, async (baseUrl) => {
    const h = harness();
    await assert.rejects(
      () => cloud.redeemInvite({ invite: "RAWCODE", configDir: h.configDir, stdout: h.stdout }),
      (error) => error instanceof AdapterError && error.code === "INVALID_INPUT"
    );
    await assert.rejects(
      () => cloud.redeemInvite({ invite: "RAWCODE", baseUrl, configDir: h.configDir, stdout: h.stdout }),
      (error) => error instanceof AdapterError && error.code === "INVITE_USED"
    );
  });
});
