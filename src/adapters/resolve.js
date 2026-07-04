import { getAdapter } from "./index.js";
import { saveConfig } from "../lib/config.js";

export const GUIDE_TEXT = `! 还没有可用的发布目标，三选一：
  1) Vercel      免费，需先执行:  npx vercel login
  2) Cloudflare  免费，需先执行:  npx wrangler login
  3) 自托管      自己的服务器，执行:  htmlshare config selfhost
  完成后重新执行本命令即可。转换结果已暂存，不会重做。
`;

const DETECT_ORDER = ["selfhost", "cloud", "vercel", "cloudflare"];

function orderedTargets(config) {
  const result = [];
  if (config?.defaultTarget) result.push(config.defaultTarget);
  for (const target of DETECT_ORDER) {
    if (!result.includes(target)) result.push(target);
  }
  return result;
}

function adapterFor(target, adapters) {
  if (adapters?.[target]) return adapters[target];
  try {
    return getAdapter(target);
  } catch {
    return null;
  }
}

export async function resolveTarget({ requestedTarget, config = {}, configDir, adapters, remember = true } = {}) {
  if (requestedTarget) {
    return { target: requestedTarget, adapter: adapterFor(requestedTarget, adapters), remembered: false };
  }

  const reasons = [];
  for (const target of orderedTargets(config)) {
    const adapter = adapterFor(target, adapters);
    if (!adapter) {
      reasons.push({ target, reason: "adapter not installed" });
      continue;
    }
    const detected = await adapter.detect?.(config);
    if (!detected || detected.available !== false) {
      const shouldRemember = remember && config.defaultTarget !== target;
      if (shouldRemember) {
        saveConfig({ ...config, defaultTarget: target }, configDir);
      }
      return { target, adapter, remembered: shouldRemember, reasons };
    }
    reasons.push({ target, reason: detected.reason || "not available" });
  }

  return { target: null, adapter: null, remembered: false, reasons, guide: GUIDE_TEXT };
}
