import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createServer } from "../server.js";
import * as selfhost from "../../src/adapters/selfhost.js";

async function withServer(run) {
  const dataDir = mkdtempSync(join(tmpdir(), "htmlshare-s05-"));
  const server = createServer({ dataDir, token: "TOK", secret: "SECRET" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await run({
      baseUrl: `http://127.0.0.1:${port}`,
      config: { selfhost: { baseUrl: `http://127.0.0.1:${port}`, uploadToken: "TOK" } }
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("S-05 selfhost adapter publishes, updates, unlocks, and unpublishes against real server", async () => {
  await withServer(async ({ baseUrl, config }) => {
    const created = await selfhost.publish({
      html: "<!doctype html><h1>Version 1</h1>",
      meta: { title: "E2E", code: "4821", template: "generic", style: "clinical" },
      config
    });
    assert.match(created.id, /^[a-z0-9]{6}$/);
    assert.equal(created.version, 1);

    const updated = await selfhost.publish({
      id: created.id,
      html: "<!doctype html><h1>Version 2</h1>",
      meta: { title: "E2E updated", code: "4821", template: "generic", style: "clinical" },
      config
    });
    assert.equal(updated.version, 2);

    const unlocked = await fetch(`${baseUrl}/s/${created.id}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "4821" })
    });
    assert.equal(unlocked.status, 200);
    assert.equal(await unlocked.text(), "<!doctype html><h1>Version 2</h1>");

    await selfhost.unpublish({ id: created.id, config });
    const afterDelete = await fetch(`${baseUrl}/s/${created.id}/`);
    assert.equal(afterDelete.status, 404);
  });
});
