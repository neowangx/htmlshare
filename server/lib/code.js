import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashCode(code) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(code), salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyCode(code, codeHash) {
  if (!codeHash) return true;
  const [kind, salt, hash] = String(codeHash).split(":");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(String(code), salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
