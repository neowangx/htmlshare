import assert from "node:assert/strict";
import { test } from "node:test";

import { KDF_ITERATIONS, decryptVault, encryptHtml, generateStaticCode, normalizeCode } from "../src/encrypt.js";

test("C-08 encrypt then decrypt roundtrips original HTML", () => {
  const original = "<!doctype html><html><body><h1>Secret</h1></body></html>";
  const encrypted = encryptHtml(original, "7XK4-Q2NM");
  assert.equal(decryptVault(encrypted.vault, "7xk4q2nm"), original);
  assert.equal(decryptVault(encrypted.vault, "7xk4-q2nm"), original);
});

test("C-08 wrong code fails GCM authentication", () => {
  const encrypted = encryptHtml("<!doctype html><h1>Secret</h1>", "7XK4-Q2NM");
  assert.throws(() => decryptVault(encrypted.vault, "0000-0000"));
});

test("C-08 shell has no external resources and embeds vault JSON", () => {
  const encrypted = encryptHtml("<!doctype html><h1>Secret</h1>", "7XK4-Q2NM");
  assert.match(encrypted.html, /id="hs-vault"/);
  assert.match(encrypted.html, /DecompressionStream\("gzip"\)/);
  assert.doesNotMatch(encrypted.html, /(?:src|href)=["']https?:\/\//i);
  assert.doesNotMatch(encrypted.html, /@import|url\(/i);
});

test("C-08 vault parses out of the shell exactly as a browser textContent would", () => {
  // Regression for the HTML-entity bug: <script> is raw-text, entities are not decoded,
  // so the embedded vault must be valid JSON verbatim (no &quot;), and must survive a
  // plaintext payload containing a literal </script>.
  const original = "<h1>Secret</h1><script>alert('</script> pwn')</script>";
  const encrypted = encryptHtml(original, "7XK4-Q2NM");
  const raw = encrypted.html.match(/<script type="application\/json" id="hs-vault">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(raw, /&quot;|&amp;/);
  const vault = JSON.parse(raw);
  assert.equal(decryptVault(vault, encrypted.code), original);
});

test("C-08 uses at least 600k PBKDF2 iterations", () => {
  assert.ok(KDF_ITERATIONS >= 600000);
  assert.equal(encryptHtml("x", "7XK4-Q2NM").vault.iter, KDF_ITERATIONS);
});

test("C-08 static access code is 8 Crockford Base32 characters with display hyphen", () => {
  const code = generateStaticCode();
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.equal(normalizeCode(code).length, 8);
});
