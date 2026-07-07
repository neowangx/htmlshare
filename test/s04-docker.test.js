import assert from "node:assert/strict";
import { accessSync, constants, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

test("S-04 Dockerfile runs as non-root with data volume and no npm dependency install", () => {
  const dockerfile = readFileSync(join(repoRoot, "server", "Dockerfile"), "utf8");

  // The server has zero npm runtime deps, so the image must NOT run npm ci (that would pull
  // in the CLI's markdown/sanitize packages the server never imports — D14).
  assert.doesNotMatch(dockerfile, /npm ci/);
  assert.doesNotMatch(dockerfile, /node_modules/);
  assert.match(dockerfile, /^USER node$/m);
  assert.match(dockerfile, /VOLUME \["\/data"\]/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /CMD \["node", "server\/server\.js"\]/);
});

test("S-04 deploy.sh implements build, transfer, run, persistent volume, and health check", () => {
  const scriptPath = join(repoRoot, "server", "deploy.sh");
  accessSync(scriptPath, constants.X_OK);
  const script = readFileSync(scriptPath, "utf8");

  assert.match(script, /Usage: .* <user@host> <port> <token>/);
  assert.match(script, /docker build -f "\$ROOT_DIR\/server\/Dockerfile"/);
  assert.match(script, /docker save "\$IMAGE_NAME"/);
  assert.match(script, /scp "\$ARCHIVE"/);
  assert.match(script, /docker volume create/);
  assert.match(script, /docker run -d --name/);
  assert.match(script, /-v \$\(quote "\$\{VOLUME_NAME\}:\/data"\)/);
  assert.match(script, /curl -fsS "\$\{PUBLIC_BASE\}\/healthz"/);
  // Session-cookie secret must be provisioned (B3) and internal ops paths must not leak (D16).
  assert.match(script, /-e SESSION_SECRET=/);
  assert.doesNotMatch(script, /infrastructure\.md/);
});
