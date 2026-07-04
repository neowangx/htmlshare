import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { defaultConfigDir, readJson, writeJsonAtomic } from "./config.js";

export function manifestFile(dir = defaultConfigDir()) {
  return join(dir, "manifest.json");
}

export function emptyManifest() {
  return { entries: [] };
}

export function loadManifest(dir = defaultConfigDir()) {
  const manifest = readJson(manifestFile(dir), emptyManifest());
  if (!manifest || !Array.isArray(manifest.entries)) return emptyManifest();
  return manifest;
}

export function saveManifest(manifest, dir = defaultConfigDir()) {
  const normalized = manifest && Array.isArray(manifest.entries) ? manifest : emptyManifest();
  mkdirSync(dir, { recursive: true });
  writeJsonAtomic(manifestFile(dir), normalized);
  return normalized;
}

export function findEntry(source, target, dir = defaultConfigDir()) {
  return loadManifest(dir).entries.find((entry) => entry.source === source && entry.target === target) || null;
}

export function upsert(entry, dir = defaultConfigDir()) {
  if (!entry || !entry.source || !entry.target) {
    throw new Error("Manifest entry requires source and target");
  }

  const manifest = loadManifest(dir);
  const existingIndex = manifest.entries.findIndex((item) => item.source === entry.source && item.target === entry.target);
  const previous = existingIndex >= 0 ? manifest.entries[existingIndex] : null;
  const nextEntry = { ...previous, ...entry };

  if (existingIndex >= 0) {
    manifest.entries[existingIndex] = nextEntry;
  } else {
    manifest.entries.push(nextEntry);
  }

  saveManifest(manifest, dir);
  return nextEntry;
}

export function remove(source, target, dir = defaultConfigDir()) {
  const manifest = loadManifest(dir);
  const before = manifest.entries.length;
  manifest.entries = manifest.entries.filter((entry) => !(entry.source === source && entry.target === target));
  saveManifest(manifest, dir);
  return manifest.entries.length !== before;
}
