import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { findEntry, loadManifest, manifestFile, remove, upsert } from "../src/lib/manifest.js";

function sampleEntry(overrides = {}) {
  return {
    source: "/abs/path/meeting.md",
    target: "vercel",
    id: "k3f9m2",
    url: "https://htmlshare-pages-x.vercel.app/s/k3f9m2/",
    code: "7XK4Q2NM",
    title: "产品评审会纪要",
    template: "meeting",
    style: "clinical",
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
    ...overrides
  };
}

test("empty manifest has entries array", () => {
  const dir = mkdtempSync(join(tmpdir(), "htmlshare-man-"));
  assert.deepEqual(loadManifest(dir), { entries: [] });
});

test("upsert is idempotent by source plus target", () => {
  const dir = mkdtempSync(join(tmpdir(), "htmlshare-man-"));
  const first = sampleEntry();
  const second = sampleEntry({ title: "新版标题", updatedAt: "2026-07-04T01:00:00.000Z" });

  upsert(first, dir);
  upsert(second, dir);

  const manifest = loadManifest(dir);
  assert.equal(manifest.entries.length, 1);
  assert.equal(manifest.entries[0].title, "新版标题");
  assert.equal(manifest.entries[0].id, "k3f9m2");
});

test("findEntry returns matching source and target only", () => {
  const dir = mkdtempSync(join(tmpdir(), "htmlshare-man-"));
  upsert(sampleEntry(), dir);
  upsert(sampleEntry({ target: "cloudflare", id: "abc234" }), dir);

  assert.equal(findEntry("/abs/path/meeting.md", "vercel", dir).id, "k3f9m2");
  assert.equal(findEntry("/abs/path/meeting.md", "selfhost", dir), null);
});

test("remove deletes a source plus target entry", () => {
  const dir = mkdtempSync(join(tmpdir(), "htmlshare-man-"));
  upsert(sampleEntry(), dir);

  assert.equal(remove("/abs/path/meeting.md", "vercel", dir), true);
  assert.equal(remove("/abs/path/meeting.md", "vercel", dir), false);
  assert.deepEqual(loadManifest(dir), { entries: [] });
});

test("corrupt manifest JSON throws and preserves the original file", () => {
  const dir = mkdtempSync(join(tmpdir(), "htmlshare-man-"));
  const path = manifestFile(dir);
  writeFileSync(path, "{ broken");

  assert.throws(() => loadManifest(dir), /Failed to read JSON/);
  assert.equal(readFileSync(path, "utf8"), "{ broken");
});
