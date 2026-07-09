import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { run } from "../src/cli/publish.js";
import { AdapterError } from "../src/adapters/errors.js";

function harness() {
  const root = mkdtempSync(join(tmpdir(), "htmlshare-cli-"));
  const configDir = join(root, "config");
  const cacheDir = join(root, "cache");
  const out = [];
  const err = [];
  return {
    root,
    configDir,
    cacheDir,
    stdout: { write: (value) => out.push(value) },
    stderr: { write: (value) => err.push(value) },
    out: () => out.join(""),
    err: () => err.join("")
  };
}

function mockAdapter(results = {}) {
  const calls = [];
  return {
    calls,
    name: "mock",
    async detect() { return { available: true }; },
    async publish(input) {
      calls.push(input);
      if (results.fail) throw new AdapterError("INTERNAL", "mock upload failed");
      return { id: input.id || "abc234", url: "https://mock/s/abc234/", version: input.id ? 2 : 1 };
    }
  };
}

test("publish md without enhanced outputs URL and CODE contract", async () => {
  const h = harness();
  const adapter = mockAdapter();
  const file = join(h.root, "note.md");
  writeFileSync(file, "# 标题\n\n正文");

  const code = await run(["publish", file, "--target", "mock", "--code", "4821"], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: { defaultTarget: "mock" },
    adapters: { mock: adapter },
    stdout: h.stdout,
    stderr: h.stderr
  });

  assert.equal(code, 0);
  assert.match(adapter.calls[0].html, /id="hs-faithful"/);
  assert.match(h.out(), /URL: https:\/\/mock\/s\/abc234\/\nCODE: 4821\n$/);
});

test("publish md with valid enhanced renders dual mode", async () => {
  const h = harness();
  const adapter = mockAdapter();
  const file = join(h.root, "meeting.md");
  const enhanced = join(h.root, "enhanced.json");
  writeFileSync(file, "# 会纪要\n\n## 结论\n\n我们确认继续推进，内容足够长以通过增强长度比例校验。");
  writeFileSync(enhanced, JSON.stringify({
    version: 1,
    template: "generic",
    style: "clinical",
    title: "会纪要",
    tldr: ["确认继续推进"],
    sections: [{ slot: "body", html: "<p>我们确认继续推进，内容足够长以通过增强长度比例校验，并保留原文对照。</p>" }]
  }));

  const code = await run(["publish", file, "--target", "mock", "--code", "4821", "--enhanced", enhanced], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: { defaultTarget: "mock" },
    adapters: { mock: adapter },
    stdout: h.stdout,
    stderr: h.stderr
  });

  assert.equal(code, 0);
  assert.match(adapter.calls[0].html, /id="hs-toggle"/);
  assert.match(adapter.calls[0].html, /id="hs-enhanced"/);
});

test("publish html direct passes input through", async () => {
  const h = harness();
  const adapter = mockAdapter();
  const file = join(h.root, "page.html");
  writeFileSync(file, "<!doctype html><h1>Raw</h1>");

  const code = await run(["publish", file, "--target", "mock", "--public"], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: { defaultTarget: "mock" },
    adapters: { mock: adapter },
    stdout: h.stdout,
    stderr: h.stderr
  });

  assert.equal(code, 0);
  assert.equal(adapter.calls[0].html, "<!doctype html><h1>Raw</h1>");
  assert.match(h.out(), /CODE: none\n$/);
});

test("publish without target uses P-04 resolver and remembers target", async () => {
  const h = harness();
  const adapter = mockAdapter();
  const file = join(h.root, "note.md");
  writeFileSync(file, "# Auto\n\n正文");

  const code = await run(["publish", file, "--code", "4821"], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: {},
    adapters: {
      selfhost: { name: "selfhost", async detect() { return { available: false, reason: "missing" }; } },
      vercel: adapter
    },
    stdout: h.stdout,
    stderr: h.stderr
  });

  assert.equal(code, 0);
  assert.match(h.err(), /TARGET: vercel 可用，已记住为默认目标/);
  assert.match(readFileSync(join(h.configDir, "config.json"), "utf8"), /"defaultTarget": "vercel"/);
  assert.match(h.out(), /URL: https:\/\/mock\/s\/abc234\//);
});

test("publish without available target exits 3 with first-use guide", async () => {
  const h = harness();
  const file = join(h.root, "note.md");
  writeFileSync(file, "# None\n\n正文");

  const code = await run(["publish", file], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: {},
    adapters: {
      selfhost: { name: "selfhost", async detect() { return { available: false, reason: "missing" }; } },
      cloud: { name: "cloud", async detect() { return { available: false, reason: "missing" }; } },
      vercel: { name: "vercel", async detect() { return { available: false, reason: "missing" }; } },
      cloudflare: { name: "cloudflare", async detect() { return { available: false, reason: "missing" }; } }
    },
    stdout: h.stdout,
    stderr: h.stderr
  });

  assert.equal(code, 3);
  assert.match(h.err(), /还没有可用的发布目标/);
  assert.match(h.err(), /npx vercel login/);
});

test("upload failure exits 4, keeps cache, and rerun skips convert", async () => {
  const h = harness();
  const file = join(h.root, "note.md");
  writeFileSync(file, "# Cached\n\n正文");

  const failed = await run(["publish", file, "--target", "mock", "--code", "4821"], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: { defaultTarget: "mock" },
    adapters: { mock: mockAdapter({ fail: true }) },
    stdout: h.stdout,
    stderr: h.stderr
  });
  assert.equal(failed, 4);
  assert.match(h.err(), /CONVERT: markdown/);

  const successAdapter = mockAdapter();
  const rerun = await run(["publish", file, "--target", "mock", "--code", "4821"], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: { defaultTarget: "mock" },
    adapters: { mock: successAdapter },
    stdout: h.stdout,
    stderr: h.stderr
  });
  assert.equal(rerun, 0);
  assert.match(h.err(), /CACHE: hit CONVERT/);
  assert.match(readFileSync(join(h.configDir, "manifest.json"), "utf8"), /abc234/);
});

function staticAdapter() {
  const calls = [];
  return {
    calls,
    name: "vercel",
    gate: "static",
    async detect() { return { available: true }; },
    async publish(input) { calls.push(input); return { id: input.id || "abc234", url: "https://static/s/abc234/" }; }
  };
}

test("B2 static target encrypts the page and never uploads plaintext", async () => {
  const h = harness();
  const adapter = staticAdapter();
  const file = join(h.root, "note.md");
  writeFileSync(file, "# 机密\n\nSECRET-MARKER 内容");

  const code = await run(["publish", file, "--target", "vercel", "--code", "7XK4Q2NM"], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: { defaultTarget: "vercel" },
    adapters: { vercel: adapter },
    stdout: h.stdout,
    stderr: h.stderr
  });

  assert.equal(code, 0);
  assert.equal(adapter.calls[0].meta.encrypted, true);
  assert.match(adapter.calls[0].html, /id="hs-vault"/);
  assert.doesNotMatch(adapter.calls[0].html, /SECRET-MARKER/);
});

test("B2 static --public uploads plaintext with no code", async () => {
  const h = harness();
  const adapter = staticAdapter();
  const file = join(h.root, "note.md");
  writeFileSync(file, "# 公开\n\n正文");

  await run(["publish", file, "--target", "vercel", "--public"], {
    configDir: h.configDir, cacheDir: h.cacheDir, config: { defaultTarget: "vercel" },
    adapters: { vercel: adapter }, stdout: h.stdout, stderr: h.stderr
  });

  assert.equal(adapter.calls[0].meta.encrypted, false);
  assert.doesNotMatch(adapter.calls[0].html, /id="hs-vault"/);
  assert.match(h.out(), /CODE: none\n$/);
});

test("C3 republish without code intent reuses the existing code and does not change it", async () => {
  const h = harness();
  const adapter = mockAdapter();
  const file = join(h.root, "note.md");
  writeFileSync(file, "# T\n\n正文");

  await run(["publish", file, "--target", "mock", "--code", "4821"], {
    configDir: h.configDir, cacheDir: h.cacheDir, config: { defaultTarget: "mock" },
    adapters: { mock: adapter }, stdout: h.stdout, stderr: h.stderr
  });
  // Second publish with no --code: same code, and PUT must omit the code field (setCode false).
  await run(["publish", file, "--target", "mock"], {
    configDir: h.configDir, cacheDir: h.cacheDir, config: { defaultTarget: "mock" },
    adapters: { mock: adapter }, stdout: h.stdout, stderr: h.stderr
  });

  assert.equal(adapter.calls[1].meta.code, "4821");
  assert.equal(adapter.calls[1].meta.setCode, false);
  assert.match(h.out(), /CODE: 4821\n$/);
});

test("C4 explicit --style overrides enhanced.style", async () => {
  const h = harness();
  const adapter = mockAdapter();
  const file = join(h.root, "note.md");
  const enhanced = join(h.root, "e.json");
  writeFileSync(file, "# T\n\n正文足够长以通过增强长度比例校验，正文足够长。");
  writeFileSync(enhanced, JSON.stringify({
    version: 1, template: "generic", style: "clinical", title: "T",
    tldr: ["要点"], sections: [{ slot: "body", html: "<p>正文足够长以通过增强长度比例校验，正文足够长。</p>" }]
  }));

  await run(["publish", file, "--target", "mock", "--public", "--enhanced", enhanced, "--style", "darktech"], {
    configDir: h.configDir, cacheDir: h.cacheDir, config: { defaultTarget: "mock" },
    adapters: { mock: adapter }, stdout: h.stdout, stderr: h.stderr
  });

  assert.match(adapter.calls[0].html, /data-hs-style="darktech"/);
});

test("C5 malformed enhanced.json degrades to faithful and still succeeds", async () => {
  const h = harness();
  const adapter = mockAdapter();
  const file = join(h.root, "note.md");
  const enhanced = join(h.root, "bad.json");
  writeFileSync(file, "# T\n\n正文内容");
  writeFileSync(enhanced, "{ not valid json");

  const code = await run(["publish", file, "--target", "mock", "--public", "--enhanced", enhanced], {
    configDir: h.configDir, cacheDir: h.cacheDir, config: { defaultTarget: "mock" },
    adapters: { mock: adapter }, stdout: h.stdout, stderr: h.stderr
  });

  assert.equal(code, 0);
  assert.match(h.err(), /ENHANCED: degraded to faithful/);
  assert.match(adapter.calls[0].html, /id="hs-faithful"/);
});

test("HTML direct upload inlines local images that exist as data URIs", async () => {
  const h = harness();
  const adapter = mockAdapter();
  // 1x1 transparent PNG.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  );
  writeFileSync(join(h.root, "photo.png"), png);
  const file = join(h.root, "page.html");
  const raw = "<!doctype html><h1>Hi</h1><img src=\"./photo.png\"><img src=\"https://x/y.png\">";
  writeFileSync(file, raw);

  await run(["publish", file, "--target", "mock", "--public"], {
    configDir: h.configDir, cacheDir: h.cacheDir, config: { defaultTarget: "mock" },
    adapters: { mock: adapter }, stdout: h.stdout, stderr: h.stderr
  });

  const uploaded = adapter.calls[0].html;
  assert.match(uploaded, /src="data:image\/png;base64,/); // local image inlined
  assert.match(uploaded, /src="https:\/\/x\/y\.png"/); // remote image untouched
  assert.match(h.err(), /IMAGE: inlined 1\/1 local image/);
});

test("HTML direct upload with no local images ships bytes unchanged (D12)", async () => {
  const h = harness();
  const adapter = mockAdapter();
  const file = join(h.root, "page.html");
  const raw = "<!doctype html><h1>Hi</h1><img src=\"data:image/gif;base64,AA==\"><img src=\"https://x/y.png\">";
  writeFileSync(file, raw);

  await run(["publish", file, "--target", "mock", "--public"], {
    configDir: h.configDir, cacheDir: h.cacheDir, config: { defaultTarget: "mock" },
    adapters: { mock: adapter }, stdout: h.stdout, stderr: h.stderr
  });

  assert.equal(adapter.calls[0].html, raw); // byte-exact (D12)
  assert.doesNotMatch(h.err(), /IMAGE:/);
});

test("HTML direct upload warns and keeps link when local image is missing", async () => {
  const h = harness();
  const adapter = mockAdapter();
  const file = join(h.root, "page.html");
  const raw = "<!doctype html><h1>Hi</h1><img src=\"./missing.png\">";
  writeFileSync(file, raw);

  await run(["publish", file, "--target", "mock", "--public"], {
    configDir: h.configDir, cacheDir: h.cacheDir, config: { defaultTarget: "mock" },
    adapters: { mock: adapter }, stdout: h.stdout, stderr: h.stderr
  });

  assert.equal(adapter.calls[0].html, raw); // nothing to inline, left as link
  assert.match(h.err(), /IMAGE: file not found, left as link/);
  assert.match(h.err(), /IMAGE: inlined 0\/1 local image/);
});

test("C7 --public and --code together is rejected", async () => {
  const h = harness();
  const file = join(h.root, "note.md");
  writeFileSync(file, "# T\n\n正文");
  const code = await run(["publish", file, "--target", "mock", "--public", "--code", "1234"], {
    configDir: h.configDir, cacheDir: h.cacheDir, config: { defaultTarget: "mock" },
    adapters: { mock: mockAdapter() }, stdout: h.stdout, stderr: h.stderr
  });
  assert.equal(code, 2);
  assert.match(h.err(), /互斥/);
});
