import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(repoRoot, "prototype", "pages");

const tokens = {
  clinical: ["#F7F8FA", "#FFFFFF", "#1A2233", "#5A6472", "#D8DEE8", "#2456D6", "#111827", "#F9FAFB", "10px", "0 1px 3px rgba(16,24,40,.07)", "-apple-system, \"PingFang SC\", \"Noto Sans SC\", sans-serif", "26px"],
  minimal: ["#FCFCFC", "#FCFCFC", "#1A2233", "#5A6472", "#DDE1E7", "#2456D6", "#111827", "#F9FAFB", "0px", "none", "-apple-system, \"PingFang SC\", \"Noto Sans SC\", sans-serif", "26px"],
  editorial: ["#FFFFFF", "#FFFFFF", "#1A2233", "#5A6472", "#D8DEE8", "#2456D6", "#111827", "#F9FAFB", "10px", "none", "Georgia, \"Songti SC\", serif", "34px"],
  darktech: ["#0E1116", "#161B22", "#E8EDF7", "#AAB6C6", "#303846", "#4C8DFF", "#0B0F15", "#E8EDF7", "10px", "0 1px 3px rgba(16,24,40,.07)", "-apple-system, \"PingFang SC\", \"Noto Sans SC\", sans-serif", "26px"]
};

const pages = [
  ["01-generic-clinical", "1 通用文档 × clinical", "clinical", "generic"],
  ["02-generic-minimal", "2 通用文档 × minimal", "minimal", "generic"],
  ["03-generic-editorial", "3 通用文档 × editorial", "editorial", "generic"],
  ["04-generic-darktech", "4 通用文档 × darktech", "darktech", "generic"],
  ["05-meeting-clinical", "5 会议纪要 × clinical", "clinical", "meeting"],
  ["06-proposal-clinical", "6 方案提案 × clinical", "clinical", "proposal"],
  ["07-tutorial-clinical", "7 教程指南 × clinical", "clinical", "tutorial"],
  ["08-release-clinical", "8 发布公告 × clinical", "clinical", "release"],
  ["09-meeting-empty-slot", "9 会议纪要 × 空槽位", "clinical", "meeting-empty"],
  ["10-toggle-demo", "10 原文增强切换", "clinical", "toggle"],
  ["11-gate-server", "11 门禁页 · 服务端轨", "clinical", "gate-server"],
  ["12-gate-static", "12 门禁页 · 静态加密轨", "clinical", "gate-static"],
  ["13-extreme-data", "13 极端数据", "clinical", "extreme"],
  ["14-adaptive-theme", "14 clinical 深浅色自适应", "clinical", "adaptive"]
];

function vars(style) {
  const [bg, surface, text, muted, border, primary, codeBg, codeText, radius, shadow, titleFont, titleSize] = tokens[style];
  return `--hs-bg:${bg};--hs-surface:${surface};--hs-text:${text};--hs-muted:${muted};--hs-border:${border};--hs-primary:${primary};--hs-success:#1F7A4D;--hs-warning:#B96A00;--hs-danger:#C23934;--hs-code-bg:${codeBg};--hs-code-text:${codeText};--hs-radius-card:${radius};--hs-radius-control:8px;--hs-shadow-card:${shadow};--hs-title-font:${titleFont};--hs-title-size:${titleSize};`;
}

const css = `
*{box-sizing:border-box}html{background:var(--hs-bg);color:var(--hs-text)}body{margin:0;background:var(--hs-bg);color:var(--hs-text);font:400 16px/1.65 -apple-system,"PingFang SC","Noto Sans SC",sans-serif}a{color:var(--hs-primary)}.page{max-width:72ch;margin:0 auto;padding:48px 24px 64px}.wide{max-width:1120px}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:32px;padding-bottom:16px;border-bottom:1px solid var(--hs-border)}h1{margin:0;color:var(--hs-text);font-family:var(--hs-title-font);font-size:var(--hs-title-size);line-height:1.22;font-weight:650;letter-spacing:0}h2{margin:32px 0 12px;color:var(--hs-text);font-size:20px;line-height:1.35;font-weight:650;letter-spacing:0}p{margin:0 0 16px}.muted,.foot,.eyebrow{color:var(--hs-muted);font-size:13px}.eyebrow{font-weight:650;margin-bottom:8px}.panel{margin:24px 0;padding:20px;background:var(--hs-surface);border:1px solid var(--hs-border);border-radius:var(--hs-radius-card);box-shadow:var(--hs-shadow-card)}.tldr{border-left:3px solid var(--hs-primary)}.tldr ul{margin:0;padding-left:20px}.toggle{display:inline-flex;gap:4px;padding:4px;border:1px solid var(--hs-border);border-radius:999px;background:var(--hs-surface)}button,.button{min-height:32px;border:1px solid var(--hs-border);border-radius:var(--hs-radius-control);padding:0 12px;background:var(--hs-surface);color:var(--hs-text);font:inherit;cursor:pointer}.toggle button{border:0;border-radius:999px;background:transparent;color:var(--hs-muted)}.toggle button[aria-pressed=true],button.primary{background:var(--hs-primary);color:var(--hs-surface)}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{min-width:0;padding:16px;border:1px solid var(--hs-border);border-radius:var(--hs-radius-card)}.badge{display:inline-flex;align-items:center;min-height:24px;margin-top:12px;padding:0 10px;border-radius:999px;background:var(--hs-bg);color:var(--hs-muted);font-size:13px}details{border-left:1px solid var(--hs-border);padding-left:16px}summary{cursor:pointer;color:var(--hs-text);font-weight:650}blockquote{margin:20px 0;padding-left:16px;border-left:3px solid var(--hs-primary);color:var(--hs-muted)}pre{overflow:auto;margin:16px 0;padding:16px;background:var(--hs-code-bg);color:var(--hs-code-text);border-radius:var(--hs-radius-control);font:14px/1.55 ui-monospace,"SF Mono",Menlo,monospace}table{display:block;width:100%;overflow-x:auto;border-collapse:collapse;margin:16px 0}th,td{padding:8px 12px;border:1px solid var(--hs-border);text-align:left;white-space:nowrap}.gate{max-width:360px;margin:12vh auto;padding:24px;background:var(--hs-surface);border:1px solid var(--hs-border);border-radius:var(--hs-radius-card);box-shadow:var(--hs-shadow-card)}input{width:100%;height:48px;border:1px solid var(--hs-border);border-radius:var(--hs-radius-control);padding:0 12px;background:var(--hs-surface);color:var(--hs-text);font:inherit}.error input{border-color:var(--hs-danger)}.error-text{color:var(--hs-danger);font-size:13px}.progress{height:4px;background:var(--hs-border);border-radius:999px;overflow:hidden}.progress span{display:block;height:100%;width:62%;background:var(--hs-primary)}[hidden]{display:none!important}.foot{margin-top:32px;padding-top:16px;border-top:1px solid var(--hs-border)}@media(max-width:720px){.page{padding:32px 16px 48px}.top{flex-direction:column}.grid{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}@media print{.toggle{display:none}details:not([open])>*{display:block}}`;

function shell(id, title, style, body, wide = false, script = "") {
  return `<!doctype html><html lang="zh-CN" data-prototype="${id}" data-style="${style}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>:root{${vars(style)}}${css}</style></head><body>${body}${script ? `<script>${script}</script>` : ""}</body></html>`;
}

function content(kind) {
  if (kind === "proposal") return `<section class="panel tldr"><h2>TL;DR</h2><ul><li>建议把云服务作为零配置入口，但开源自托管保持完整可用。</li><li>首批只做设备码登录、配额和控制台，计费在 Q2 确认后接入。</li></ul></section><section class="panel"><h2>方案</h2><p>CLI 通过统一适配器发布到 selfhost、Vercel、Cloudflare 或 cloud，云协议是自托管协议超集。</p><blockquote>核心约束：云服务下线不影响任何开源发布目标。</blockquote></section>`;
  if (kind === "tutorial") return `<section class="panel tldr"><h2>TL;DR</h2><ul><li>安装 skill 后，用户只需要运行 publish 命令。</li><li>没有配置目标时进入一次性引导，检测已有平台登录状态。</li></ul></section><section class="panel"><h2>步骤</h2><ol><li>安装 htmlshare。</li><li>准备 Markdown 或 HTML 文件。</li><li>运行发布命令并复制访问码。</li></ol><pre><code>htmlshare publish ./guide.md --target vercel</code></pre></section>`;
  if (kind === "release") return `<section class="panel tldr"><h2>TL;DR</h2><ul><li>v0.1.0 聚焦单文件发布、访问码和稳定链接。</li><li>已提供自托管、静态平台和多 agent 安装入口。</li></ul></section><section class="panel"><h2>变更</h2><table><tbody><tr><td>新增</td><td>双模式内容页</td></tr><tr><td>修复</td><td>损坏 JSON 不再覆盖原配置</td></tr></tbody></table></section>`;
  if (kind === "meeting-empty") return `<section class="panel tldr"><h2>TL;DR</h2><ul><li>本次会议没有遗留分歧，因此不渲染 open_issues 空槽位。</li><li>行动项集中在原型走查和 selfhost 联调。</li></ul></section><section class="panel"><h2>结论</h2><p>继续按 clinical 方向完成 U-02，高保真原型覆盖 14 个状态。</p></section><section class="panel"><h2>行动项</h2><p>Alice 完成浏览器走查，Bob 准备服务端联调。</p></section>`;
  return `<section class="panel tldr"><h2>TL;DR</h2><ul><li>内容页优先服务阅读，而不是展示工具存在感。</li><li>模板决定信息结构，风格只覆写 token。</li><li>访问码体验保持统一，但安全轨道区分静态和服务端。</li></ul></section><section class="panel"><h2>正文</h2><p>htmlshare 面向经常让 AI 生成会议纪要、方案、教程和发布说明的人。它把一份 Markdown 转成可以直接分享的网页，同时保留原文对照。</p><details open><summary>完整背景</summary><p>产品的关键不是炫技，而是让读者打开链接后立刻理解重点，并能在需要时回到忠实原文。</p></details><pre><code>htmlshare publish ./note.md --style clinical</code></pre><table><thead><tr><th>模板</th><th>适用内容</th></tr></thead><tbody><tr><td>generic</td><td>通用文档</td></tr><tr><td>meeting</td><td>会议纪要</td></tr></tbody></table></section>`;
}

function documentPage(id, title, style, kind) {
  const body = `<main class="page"><header class="top"><div><div class="eyebrow">htmlshare prototype</div><h1>${title}</h1><p class="muted">真实感中文业务内容；无外链资源；使用 --hs-* token。</p></div><div class="toggle"><button type="button">原文</button><button type="button" aria-pressed="true">增强</button></div></header>${content(kind)}<footer class="foot">made with htmlshare · 轻量访问码保护</footer></main>`;
  return shell(id, title, style, body);
}

function togglePage(id, title, style) {
  const script = `(()=>{const e=document.querySelector('#enhanced'),f=document.querySelector('#faithful'),buttons=document.querySelectorAll('[data-view]');for(const b of buttons)b.onclick=()=>{const v=b.dataset.view;e.hidden=v!=='enhanced';f.hidden=v!=='faithful';buttons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)))}})();`;
  const body = `<main class="page"><header class="top"><div><div class="eyebrow">toggle demo</div><h1>${title}</h1></div><div class="toggle"><button type="button" data-view="faithful">原文</button><button type="button" data-view="enhanced" aria-pressed="true">增强</button></div></header><section id="enhanced" class="panel tldr"><h2>增强版</h2><ul><li>把决策、行动项和讨论过程拆开。</li><li>默认展示重点，保留完整原文入口。</li></ul></section><section id="faithful" class="panel" hidden><h2>原文</h2><p>今天讨论了发布路径、访问码和样式方向。大家同意先完成自托管闭环，再接静态平台。</p></section></main>`;
  return shell(id, title, style, body, false, script);
}

function gatePage(id, title, mode) {
  const states = mode === "server"
    ? `<div class="panel"><h2>常态</h2><input autofocus value="" aria-label="访问码"><p class="muted">请输入 4 位访问码。</p><button class="primary">打开</button></div><div class="panel error"><h2>错误</h2><input value="1234" aria-label="错误访问码"><p class="error-text">访问码不正确，请检查后重试。</p></div><div class="panel"><h2>限速</h2><input disabled value="----" aria-label="限速"><p class="muted">尝试过于频繁，42 秒后可重试。</p><button disabled>等待中</button></div>`
    : `<div class="panel"><h2>常态</h2><input autofocus value="" aria-label="访问码"><p class="muted">请输入 8 位访问码。</p><button class="primary">解密</button></div><div class="panel"><h2>解密中</h2><div class="progress"><span></span></div><p class="muted">正在本地解密页面内容。</p></div><div class="panel error"><h2>错误</h2><input value="7XK4-Q2NM" aria-label="错误访问码"><p class="error-text">无法解密，请确认访问码完整。</p></div>`;
  return shell(id, title, "clinical", `<main class="gate"><div class="eyebrow">htmlshare gate</div><h1>${title}</h1>${states}<details><summary>轻量保护声明</summary><p class="muted">访问码用于轻量分享保护，不适合强机密材料。</p></details></main>`);
}

function extremePage(id, title) {
  const rows = Array.from({ length: 200 }, (_, i) => `<tr><td>Row ${i + 1}</td><td>超长字段用于验证横向滚动和单元格不挤压</td><td>负责人 ${i % 7}</td><td>2026-07-${String((i % 28) + 1).padStart(2, "0")}</td><td>稳定链接、访问码、版本留底、撤回状态、审计备注</td></tr>`).join("");
  const body = `<main class="page wide"><header class="top"><div><div class="eyebrow">extreme data</div><h1>${title}</h1><p class="muted">验证超长标题、超宽表格和长文滚动。</p></div></header><section class="panel"><h2>超宽表格</h2><table><thead><tr><th>编号</th><th>描述</th><th>负责人</th><th>日期</th><th>备注</th></tr></thead><tbody>${rows}</tbody></table></section></main>`;
  return shell(id, title, "clinical", body, true);
}

function adaptivePage(id, title) {
  const body = `<main class="page"><header class="top"><div><div class="eyebrow">adaptive theme</div><h1>${title}</h1><p class="muted">同一 clinical 骨架展示浅色和深色 token。</p></div></header><section class="panel"><h2>浅色</h2><p>背景、卡面和正文对比度保持在 4.5:1 以上。</p></section><section class="panel" style="--hs-bg:#0E1116;--hs-surface:#161B22;--hs-text:#E8EDF7;--hs-muted:#AAB6C6;--hs-border:#303846;--hs-primary:#4C8DFF;--hs-code-bg:#0B0F15;--hs-code-text:#E8EDF7;color:var(--hs-text);background:var(--hs-surface)"><h2>深色</h2><p class="muted">深色演示不使用纯黑底或纯白字。</p></section></main>`;
  return shell(id, title, "clinical", body);
}

mkdirSync(outDir, { recursive: true });
for (const [id, title, style, kind] of pages) {
  const html = kind === "toggle" ? togglePage(id, title, style)
    : kind === "gate-server" ? gatePage(id, title, "server")
    : kind === "gate-static" ? gatePage(id, title, "static")
    : kind === "extreme" ? extremePage(id, "这是一条用于验证页面不会被超长标题压垮的产品复盘文档标题，它包含多个业务名词、日期和状态说明")
    : kind === "adaptive" ? adaptivePage(id, title)
    : documentPage(id, title, style, kind);
  writeFileSync(join(outDir, `${id}.html`), html);
}

writeFileSync(join(repoRoot, "prototype", "index.html"), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>htmlshare prototype</title><style>:root{--hs-bg:#F7F8FA;--hs-surface:#FFFFFF;--hs-text:#1A2233;--hs-muted:#5A6472;--hs-border:#D8DEE8;--hs-primary:#2456D6}body{margin:0;background:var(--hs-bg);color:var(--hs-text);font:400 16px/1.65 -apple-system,"PingFang SC","Noto Sans SC",sans-serif}main{max-width:800px;margin:0 auto;padding:48px 24px}a{color:var(--hs-primary)}li{margin:8px 0}.muted{color:var(--hs-muted)}</style></head><body><main><h1>htmlshare 高保真原型包</h1><p class="muted">覆盖 docs/02A §5 的 14 个页面与状态。</p><ol>${pages.map(([id, title]) => `<li><a href="./pages/${id}.html">${title}</a></li>`).join("")}</ol><p><a href="./u01/index.html">U-01 四风格样张</a></p></main></body></html>`);
