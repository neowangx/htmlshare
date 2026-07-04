import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

function runInstall(home) {
  return execFileSync("bash", [join(repoRoot, "install.sh")], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      HTMLSHARE_SOURCE_DIR: repoRoot,
      HTMLSHARE_BIN_DIR: join(home, ".local", "bin")
    }
  });
}

test("K-02 install.sh uses strict mode and no sudo", () => {
  const script = execFileSync("sed", ["-n", "1,220p", join(repoRoot, "install.sh")], { encoding: "utf8" });
  assert.match(script, /set -euo pipefail/);
  assert.doesNotMatch(script, /\bsudo\b/);
  assert.match(script, /git clone/);
  assert.match(script, /npm --prefix "\$INSTALL_DIR" install --omit=dev/);
});

test("K-02 install.sh is idempotent in a clean HOME sandbox", () => {
  const home = mkdtempSync(join(tmpdir(), "htmlshare-home-"));
  mkdirSync(join(home, ".claude", "skills"), { recursive: true });
  mkdirSync(join(home, ".codex"), { recursive: true });
  mkdirSync(join(home, ".openclaw"), { recursive: true });
  mkdirSync(join(home, ".hermes"), { recursive: true });

  const first = runInstall(home);
  const second = runInstall(home);

  const installDir = join(home, ".htmlshare");
  const claudeSkill = join(home, ".claude", "skills", "htmlshare");
  const bin = join(home, ".local", "bin", "htmlshare");

  assert.equal(existsSync(join(installDir, "SKILL.md")), true);
  assert.equal(lstatSync(claudeSkill).isSymbolicLink(), true);
  assert.equal(readlinkSync(claudeSkill), installDir);
  assert.equal(lstatSync(bin).isSymbolicLink(), true);
  assert.equal(readlinkSync(bin), join(installDir, "bin", "htmlshare.js"));
  assert.match(first, /Installed Claude Code skill/);
  assert.match(first, /Installed Codex wrapper/);
  assert.match(first, /Detected OpenClaw/);
  assert.match(first, /Detected Hermes/);
  assert.match(second, /Installing htmlshare from local source/);
  assert.equal((execFileSync("grep", ["-c", "htmlshare:start", join(home, ".codex", "AGENTS.md")], { encoding: "utf8" }).trim()), "1");
});
