import { createHmac, timingSafeEqual } from "node:crypto";

function sign(secret, payload) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signSession(secret, { id, exp }) {
  const payload = `${id}.${exp}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function verifySession(secret, token, id, now = Date.now()) {
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenId, exp, mac] = parts;
  const expected = sign(secret, `${tokenId}.${exp}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return tokenId === id && now < Number(exp);
}

export function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const value = part.trim();
    const index = value.indexOf("=");
    if (index < 0) return [value, ""];
    return [decodeURIComponent(value.slice(0, index)), decodeURIComponent(value.slice(index + 1))];
  }).filter(([key]) => key));
}
