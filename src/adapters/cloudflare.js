import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";

import { AdapterError } from "./errors.js";
import { ensureSiteRoot, newShareId, removeShare, siteDir, writeShare } from "../lib/sitedir.js";

const execFileAsync = promisify(nodeExecFile);

export const name = "cloudflare";
export const gate = "static";

function projectName(config) {
  return config?.cloudflare?.project || "htmlshare-pages";
}

function dataDir(config) {
  return config?.siteDataDir;
}

// D8: stable link derived from the fixed Pages project domain, not from the hashed
// per-deploy URL that `wrangler pages deploy` prints.
function productionBase(config) {
  const explicit = config?.cloudflare?.url;
  if (explicit) return String(explicit).replace(/\/+$/, "");
  return `https://${projectName(config)}.pages.dev`;
}

export function createCloudflareAdapter({ execFile = execFileAsync } = {}) {
  async function deploy(root, project) {
    await execFile("npx", ["wrangler", "pages", "deploy", root, "--project-name", project], { cwd: root });
  }

  return {
    name,
    gate,
    async detect() {
      try {
        await execFile("npx", ["wrangler", "whoami"]);
        return { available: true };
      } catch {
        return { available: false, reason: "wrangler login required" };
      }
    },
    async publish({ html, id = null, config } = {}) {
      const project = projectName(config);
      const root = siteDir("cloudflare", project, dataDir(config));
      const shareId = id || newShareId();
      ensureSiteRoot(root);
      writeShare(root, shareId, html);
      try {
        await deploy(root, project);
        return { id: shareId, url: `${productionBase(config)}/s/${shareId}/` };
      } catch (error) {
        if (error instanceof AdapterError) throw error;
        throw new AdapterError("INTERNAL", error.message, { cause: error });
      }
    },
    async unpublish({ id, config } = {}) {
      const project = projectName(config);
      const root = siteDir("cloudflare", project, dataDir(config));
      ensureSiteRoot(root);
      removeShare(root, id);
      await deploy(root, project);
    }
  };
}

const adapter = createCloudflareAdapter();
export const detect = adapter.detect;
export const publish = adapter.publish;
export const unpublish = adapter.unpublish;
