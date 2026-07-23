import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

import { hashCode } from "./code.js";

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const ID_PATTERN = /^[a-z0-9]{6}$/;

export function isValidId(id) {
  return typeof id === "string" && ID_PATTERN.test(id);
}

// Normalize a client-supplied expiry to an ISO string or null. Kept server-side (not imported
// from src/) so the server stays a self-contained Docker artifact (D14).
export function normalizeExpiresAt(value) {
  if (value == null || value === "") return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    const error = new Error("invalid expiresAt");
    error.code = "INVALID_INPUT";
    throw error;
  }
  return new Date(parsed).toISOString();
}

export function isExpired(meta, now = Date.now()) {
  return Boolean(meta?.expiresAt) && Date.parse(meta.expiresAt) <= now;
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

export function createPage(dataDir, { id = null, title = "Untitled", html, code = null, expiresAt = null, meta = {} }) {
  // Never derive a filesystem path from an unvalidated client id — reject anything that
  // isn't exactly the 6-char id shape, closing the `../` path-traversal write (B4).
  if (id != null && !isValidId(id)) {
    const error = new Error("invalid id");
    error.code = "INVALID_INPUT";
    throw error;
  }
  const normalizedExpiry = normalizeExpiresAt(expiresAt);
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
    expiresAt: normalizedExpiry,
    version: 1,
    meta,
    versions: [{ ...firstVersion, at: now }]
  });
}

export function updatePage(dataDir, id, { title, html, code, expiresAt, meta = {} }, { retainVersions = 20 } = {}) {
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
  // Only touch expiry when the caller sends the field, so a plain content update keeps it.
  if (expiresAt !== undefined) {
    existing.expiresAt = normalizeExpiresAt(expiresAt);
  }
  existing.updatedAt = version.at;
  existing.versions.push(version);
  pruneVersions(dataDir, existing, retainVersions);
  return writeMeta(dataDir, existing);
}

// Post-hoc expiry change (PATCH /meta): set or clear the deadline without a content version bump.
export function setExpiry(dataDir, id, expiresAt) {
  const existing = getMeta(dataDir, id);
  if (!existing || existing.deletedAt) return null;
  existing.expiresAt = normalizeExpiresAt(expiresAt);
  existing.updatedAt = new Date().toISOString();
  return writeMeta(dataDir, existing);
}

// Bump the private unique-visitor tally. Uniqueness is decided by the caller (a per-page visitor
// cookie); this only persists the increment and never touches version history, updatedAt, or
// expiry. The count is exposed solely through the token-protected /meta endpoint, never on the
// public page. The read-modify-write is atomic under Node's single thread (all sync fs calls);
// it assumes one process owns dataDir — running the server clustered against a shared dir could
// lose updates or clobber a concurrent write, which is out of scope for this single-box deploy.
export function incrementUniqueViews(dataDir, id) {
  const existing = getMeta(dataDir, id);
  if (!existing || existing.deletedAt) return null;
  existing.uniqueViews = (existing.uniqueViews || 0) + 1;
  return writeMeta(dataDir, existing);
}

export function deletePage(dataDir, id, { now = new Date().toISOString() } = {}) {
  const existing = getMeta(dataDir, id);
  if (!existing || existing.deletedAt) return null;
  existing.deletedAt = now;
  existing.updatedAt = now;
  return writeMeta(dataDir, existing);
}

// Soft-delete pages whose deadline has passed so they leave the recoverable grace window from
// the moment they expired (deletedAt = expiresAt). Called on access (lazy) and periodically so
// an un-visited expired page is still reaped. Safe to run repeatedly.
export function expireDue(dataDir, { now = Date.now() } = {}) {
  let expired = 0;
  let entries;
  try {
    entries = readdirSync(dataDir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !isValidId(entry.name)) continue;
    const meta = getMeta(dataDir, entry.name);
    if (!meta || meta.deletedAt || !isExpired(meta, now)) continue;
    meta.deletedAt = meta.expiresAt;
    meta.updatedAt = new Date().toISOString();
    writeMeta(dataDir, meta);
    expired += 1;
  }
  return expired;
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
