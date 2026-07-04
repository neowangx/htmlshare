import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";

import { AdapterError } from "./errors.js";
import { ensureSiteRoot, newShareId, removeShare, siteDir, writeShare } from "../lib/sitedir.js";

const execFileAsync = promisify(nodeExecFile);

export const name = "cloudflare";

function projectName(config) {
  return config?.cloudflare?.project || "htmlshare-pages";
}

function dataDir(config) {
  return config?.siteDataDir;
}

function parseDeployUrl(stdout) {
  const matches = String(stdout).match(/https:\/\/[^\s]+/g);
  return matches ? matches[matches.length - 1] : null;
}

export function createCloudflareAdapter({ execFile = execFileAsync } = {}) {
  async function deploy(root, project) {
    const { stdout } = await execFile("npx", ["wrangler", "pages", "deploy", root, "--project-name", project], { cwd: root });
    const url = parseDeployUrl(stdout);
    if (!url) throw new AdapterError("INTERNAL", "Unable to parse Cloudflare Pages deployment URL");
    return url;
  }

  return {
    name,
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
        const deployUrl = await deploy(root, project);
        return { id: shareId, url: `${deployUrl.replace(/\/+$/, "")}/s/${shareId}/` };
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
