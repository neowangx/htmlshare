import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function newShareId() {
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join("");
}

export function siteDir(target, project, baseDir = join(homedir(), ".local", "share", "htmlshare", "sites")) {
  return join(baseDir, target, project);
}

export function ensureSiteRoot(root) {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "index.html"), "<!doctype html><meta name=\"robots\" content=\"noindex\"><title>htmlshare</title>");
}

export function writeShare(root, id, html) {
  const dir = join(root, "s", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
}

export function removeShare(root, id) {
  rmSync(join(root, "s", id), { recursive: true, force: true });
}
