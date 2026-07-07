import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";

import { AdapterError } from "./errors.js";
import { ensureSiteRoot, newShareId, removeShare, siteDir, writeShare } from "../lib/sitedir.js";

const execFileAsync = promisify(nodeExecFile);

export const name = "vercel";
export const gate = "static";

function projectName(config) {
  return config?.vercel?.project || "htmlshare-pages";
}

function dataDir(config) {
  return config?.siteDataDir;
}

// D8: the shared link must be stable across re-deploys, so derive it from the fixed
// project's production domain — never from `vercel deploy` stdout, whose URL carries a
// per-deploy hash and would change every publish.
function productionBase(config) {
  const explicit = config?.vercel?.url;
  if (explicit) return String(explicit).replace(/\/+$/, "");
  return `https://${projectName(config)}.vercel.app`;
}

export function createVercelAdapter({ execFile = execFileAsync } = {}) {
  async function deploy(root) {
    await execFile("npx", ["vercel", "deploy", "--prod", "--yes"], { cwd: root });
  }

  return {
    name,
    gate,
    async detect() {
      try {
        await execFile("npx", ["vercel", "whoami"]);
        return { available: true };
      } catch {
        return { available: false, reason: "vercel login required" };
      }
    },
    async publish({ html, id = null, config } = {}) {
      const project = projectName(config);
      const root = siteDir("vercel", project, dataDir(config));
      const shareId = id || newShareId();
      ensureSiteRoot(root);
      writeShare(root, shareId, html);
      try {
        await deploy(root);
        return { id: shareId, url: `${productionBase(config)}/s/${shareId}/` };
      } catch (error) {
        if (error instanceof AdapterError) throw error;
        throw new AdapterError("INTERNAL", error.message, { cause: error });
      }
    },
    async unpublish({ id, config } = {}) {
      const project = projectName(config);
      const root = siteDir("vercel", project, dataDir(config));
      ensureSiteRoot(root);
      removeShare(root, id);
      await deploy(root);
    }
  };
}

const adapter = createVercelAdapter();
export const detect = adapter.detect;
export const publish = adapter.publish;
export const unpublish = adapter.unpublish;
