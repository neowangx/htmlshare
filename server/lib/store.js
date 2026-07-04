import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

import { hashCode } from "./code.js";

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

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
  if (Object.hasOwn({ code }, "code") && code !== undefined) {
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
