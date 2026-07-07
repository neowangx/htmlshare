import { getAdapter } from "./index.js";
import { saveConfig } from "../lib/config.js";

export const GUIDE_TEXT = `! 还没有可用的发布目标，可以按你的托管情况选择：
  1) 有自己的 VPS/主机: 先部署兼容服务端，再执行:
     htmlshare config selfhost --base-url https://share.example.com --token <token>
  2) 没有 VPS/想跳过主机配置: 使用 Cloudflare Pages，先执行:
     npx wrangler login
  3) 也可以使用 Vercel，先执行:
     npx vercel login
  4) 官方云服务可用后，执行:
     htmlshare login
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
      // Only remember on first-run auto-detect. Never overwrite an explicit defaultTarget
      // just because it was transiently unavailable this once.
      const shouldRemember = remember && !config.defaultTarget && config.defaultTarget !== target;
      if (shouldRemember) {
        saveConfig({ ...config, defaultTarget: target }, configDir);
      }
      return { target, adapter, remembered: shouldRemember, reasons };
    }
    reasons.push({ target, reason: detected.reason || "not available" });
  }

  return { target: null, adapter: null, remembered: false, reasons, guide: GUIDE_TEXT };
}
