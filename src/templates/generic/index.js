import { escapeHtml } from "../../convert.js";

const SLOT_LABELS = {
  body: "正文",
  conclusions: "结论",
  actions: "行动项",
  open_issues: "开放问题",
  discussion: "讨论过程",
  summary: "摘要",
  problem: "问题",
  solution: "方案",
  plan: "计划",
  risks: "风险",
  overview: "概览",
  prerequisites: "前置条件",
  steps: "步骤",
  faq: "FAQ",
  highlights: "亮点",
  changes: "变更",
  upgrade_notes: "升级说明"
};

export const slots = ["body"];

export function render(sections = [], common = {}) {
  const tldr = renderTldr(common.tldr || []);
  const body = sections.map((section) => renderSection(section)).join("");
  return `${tldr}${body}`;
}

function renderTldr(items) {
  if (!items.length) return "";
  const list = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<div class="hs-tldr"><h2>TL;DR</h2><ul>${list}</ul></div>`;
}

function renderSection(section) {
  const label = SLOT_LABELS[section.slot] || section.slot;
  return `<section class="hs-section" data-slot="${escapeHtml(section.slot)}"><h2>${escapeHtml(label)}</h2>${section.html}</section>`;
}
