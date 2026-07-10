import assert from "node:assert/strict";
import { test } from "node:test";

import { describeExpiry, isExpired, parseExpiry, wrapWithExpiry } from "../src/expiry.js";

const NOW = Date.parse("2026-07-10T00:00:00.000Z");

test("parseExpiry resolves relative durations from a fixed now", () => {
  assert.equal(parseExpiry("7d", NOW), new Date(NOW + 7 * 86_400_000).toISOString());
  assert.equal(parseExpiry("24h", NOW), new Date(NOW + 24 * 3_600_000).toISOString());
  assert.equal(parseExpiry("30m", NOW), new Date(NOW + 30 * 60_000).toISOString());
  assert.equal(parseExpiry("2w", NOW), new Date(NOW + 14 * 86_400_000).toISOString());
});

test("parseExpiry accepts an absolute future date", () => {
  assert.equal(parseExpiry("2099-01-01", NOW), new Date(Date.parse("2099-01-01")).toISOString());
});

test("parseExpiry treats empty/never/off/null as no expiry", () => {
  for (const value of [null, undefined, "", "  ", "never", "off", "none", "0"]) {
    assert.equal(parseExpiry(value, NOW), null);
  }
});

test("parseExpiry rejects unparseable and past values", () => {
  assert.throws(() => parseExpiry("garbage", NOW), /无法解析/);
  assert.throws(() => parseExpiry("2000-01-01", NOW), /将来/);
  try {
    parseExpiry("nope", NOW);
    assert.fail("should throw");
  } catch (error) {
    assert.equal(error.code, "INVALID_EXPIRY");
  }
});

test("isExpired compares against the deadline", () => {
  const past = new Date(NOW - 1000).toISOString();
  const future = new Date(NOW + 1000).toISOString();
  assert.equal(isExpired(past, NOW), true);
  assert.equal(isExpired(future, NOW), false);
  assert.equal(isExpired(null, NOW), false);
});

test("describeExpiry is human-readable and never-safe", () => {
  assert.equal(describeExpiry(null), "永不过期");
  assert.match(describeExpiry(new Date(NOW + 7 * 86_400_000).toISOString(), NOW), /7 天/);
});

test("wrapWithExpiry embeds a guard that hides the payload past the deadline", () => {
  const inner = "<!doctype html><h1>secret</h1><script>1</script>";
  const at = new Date(NOW + 86_400_000).toISOString();
  const wrapped = wrapWithExpiry(inner, at);
  // The deadline is baked in as an epoch and the guard checks it before revealing anything.
  assert.match(wrapped, new RegExp(String(NOW + 86_400_000)));
  assert.match(wrapped, /链接已过期/);
  assert.match(wrapped, /document\.write\(html\)/);
  // Payload is base64 (no raw </script> breakout, plaintext not directly present).
  assert.ok(!wrapped.includes("<h1>secret</h1>"));
  assert.ok(wrapped.includes(Buffer.from(inner, "utf8").toString("base64")));
});
