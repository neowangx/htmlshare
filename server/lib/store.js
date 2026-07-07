import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

import { hashCode } from "./code.js";

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const ID_PATTERN = /^[a-z0-9]{6}$/;

export function isValidId(id) {
  return typeof id === "string" && ID_PATTERN.test(id);
}

export function newId() {
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join("");
}

export function pageDir(dataDir, id) {
  return join(dataDir, id);
}

export function metaPath(dataDir, id) {
  return join(pageDir(dataDir, id), "meta.json");
}

function versionPath(dataDir, id, version) {
  return join(pageDir(dataDir, id), `v${version}.html`);
}

function writeMeta(dataDir, meta) {
  mkdirSync(pageDir(dataDir, meta.id), { recursive: true });
  writeFileSync(metaPath(dataDir, meta.id), `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
}

export function getMeta(dataDir, id) {
  try {
    return JSON.parse(readFileSync(metaPath(dataDir, id), "utf8"));
  } catch {
    return null;
  }
}

export function getLatestHtml(dataDir, id) {
  const meta = getMeta(dataDir, id);
  if (!meta || meta.deletedAt) return null;
  return readFileSync(versionPath(dataDir, id, meta.version), "utf8");
}

function writeVersion(dataDir, id, version, html) {
  writeFileSync(versionPath(dataDir, id, version), html);
  return { n: version, at: new Date().toISOString(), bytes: Buffer.byteLength(html) };
}

function pruneVersions(dataDir, meta, retainVersions = 20) {
  while (meta.versions.length > retainVersions) {
    const [removed] = meta.versions.splice(0, 1);
    try {
      unlinkSync(versionPath(dataDir, meta.id, removed.n));
    } catch {
      // Best-effort cleanup; metadata remains the source of truth.
    }
  }
}

export function createPage(dataDir, { id = null, title = "Untitled", html, code = null, meta = {} }) {
  // Never derive a filesystem path from an unvalidated client id — reject anything that
  // isn't exactly the 6-char id shape, closing the `../` path-traversal write (B4).
  if (id != null && !isValidId(id)) {
    const error = new Error("invalid id");
    error.code = "INVALID_INPUT";
    throw error;
  }
  const pageId = id || newId();
  if (existsSync(metaPath(dataDir, pageId))) {
    const error = new Error("id conflict");
    error.code = "ID_CONFLICT";
    throw error;
  }

  const now = new Date().toISOString();
  mkdirSync(pageDir(dataDir, pageId), { recursive: true });
  const firstVersion = writeVersion(dataDir, pageId, 1, html);
  return writeMeta(dataDir, {
    id: pageId,
    title,
    codeHash: code ? hashCode(code) : null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    meta,
    versions: [{ ...firstVersion, at: now }]
  });
}

export function updatePage(dataDir, id, { title, html, code, meta = {} }, { retainVersions = 20 } = {}) {
  const existing = getMeta(dataDir, id);
  if (!existing || existing.deletedAt) return null;
  const nextVersion = existing.version + 1;
  const version = writeVersion(dataDir, id, nextVersion, html);
  existing.version = nextVersion;
  existing.title = title ?? existing.title;
  existing.meta = { ...(existing.meta || {}), ...meta };
  if (code !== undefined) {
    existing.codeHash = code ? hashCode(code) : null;
  }
  existing.updatedAt = version.at;
  existing.versions.push(version);
  pruneVersions(dataDir, existing, retainVersions);
  return writeMeta(dataDir, existing);
}

export function deletePage(dataDir, id, { now = new Date().toISOString() } = {}) {
  const existing = getMeta(dataDir, id);
  if (!existing || existing.deletedAt) return null;
  existing.deletedAt = now;
  existing.updatedAt = now;
  return writeMeta(dataDir, existing);
}

// Contract §6.1: soft-deleted pages are physically removed after a grace window (default
// 7 days). Meant to be called periodically (and once at startup); safe to run repeatedly.
export function purgeDeleted(dataDir, { now = Date.now(), graceMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
  let removed = 0;
  let entries;
  try {
    entries = readdirSync(dataDir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !isValidId(entry.name)) continue;
    const meta = getMeta(dataDir, entry.name);
    if (!meta || !meta.deletedAt) continue;
    if (now - Date.parse(meta.deletedAt) < graceMs) continue;
    try {
      rmSync(pageDir(dataDir, entry.name), { recursive: true, force: true });
      removed += 1;
    } catch {
      // Best-effort; next sweep retries.
    }
  }
  return removed;
}
