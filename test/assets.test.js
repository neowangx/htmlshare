import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { embedLocalAssets } from "../src/assets.js";

test("D20 embeds image, audio, video, poster, track, download and CSS URLs", () => {
  const root = mkdtempSync(join(tmpdir(), "htmlshare-assets-"));
  const fixtures = {
    "image.png": "png", "sound.mp3": "mp3", "movie.mp4": "mp4", "captions.vtt": "WEBVTT",
    "file.bin": "download", "background.webp": "webp"
  };
  for (const [name, content] of Object.entries(fixtures)) writeFileSync(join(root, name), content);
  const source = `<style>.hero{background:url('./background.webp')}</style>`
    + `<img src="./image.png"><audio src='./sound.mp3'></audio>`
    + `<video src="./movie.mp4" poster="./image.png"><track src="./captions.vtt"></video>`
    + `<a href="./file.bin">下载</a>`;

  const result = embedLocalAssets(source, root, { strict: true });
  assert.match(result.html, /data:image\/png;base64,/);
  assert.match(result.html, /data:audio\/mpeg;base64,/);
  assert.match(result.html, /data:video\/mp4;base64,/);
  assert.match(result.html, /data:text\/vtt;base64,/);
  assert.match(result.html, /data:application\/octet-stream;base64,/);
  assert.match(result.html, /data:image\/webp;base64,/);
  assert.equal(result.assets.length, 6, "poster reuses the already-read image");
  assert.doesNotMatch(result.html, /(?:src|href|poster)=["']\.\//);
});

test("D20 leaves remote, data, anchor and site-root URLs untouched", () => {
  const source = `<img src="https://example.com/a.png"><audio src="data:audio/mpeg;base64,AA=="></audio>`
    + `<a href="#part">章节</a><img src="/site/image.png">`;
  const result = embedLocalAssets(source, "/tmp", { strict: true });
  assert.equal(result.html, source);
  assert.deepEqual(result.assets, []);
});

test("D20 embeds unquoted direct-HTML resource attributes", () => {
  const root = mkdtempSync(join(tmpdir(), "htmlshare-assets-"));
  writeFileSync(join(root, "image.png"), "png");
  assert.match(embedLocalAssets(`<img src=./image.png>`, root, { strict: true }).html, /src="data:image\/png;base64,/);
});

test("D20 strict mode rejects missing files and the total-size limit", () => {
  const root = mkdtempSync(join(tmpdir(), "htmlshare-assets-"));
  assert.throws(() => embedLocalAssets(`<img src="./missing.png">`, root, { strict: true }), /本地资源不存在/);
  writeFileSync(join(root, "sound.mp3"), "12345");
  assert.throws(() => embedLocalAssets(`<audio src="./sound.mp3"></audio>`, root, { strict: true, maxBytes: 4 }), /超过 0MB/);
});

test("D20 does not scan JavaScript strings as CSS dependencies", () => {
  const source = `<script>const demo = "url('./not-a-file.png')";</script>`;
  assert.equal(embedLocalAssets(source, "/tmp", { strict: true }).html, source);
});

test("D20 applies media safety checks even when the same file was already linked", () => {
  const root = mkdtempSync(join(tmpdir(), "htmlshare-assets-"));
  writeFileSync(join(root, "active.svg"), `<svg><script>alert(1)</script></svg>`);
  assert.throws(() => embedLocalAssets(
    `<a href="./active.svg">source</a><img src="./active.svg">`, root, { strict: true }
  ), /不能安全嵌入/);
});
