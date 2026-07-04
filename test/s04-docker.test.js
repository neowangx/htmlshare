import assert from "node:assert/strict";
import { accessSync, constants, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

test("S-04 Dockerfile is multi-stage and runs as non-root with data volume", () => {
  const dockerfile = readFileSync(join(repoRoot, "server", "Dockerfile"), "utf8");

  assert.equal((dockerfile.match(/^FROM /gm) || []).length, 2);
  assert.match(dockerfile, /npm ci --omit=dev/);
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
  assert.match(script, /infrastructure\.md/);
});
