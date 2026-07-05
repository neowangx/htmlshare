import { escapeHtml } from "../../convert.js";
import { render as renderGenericTldr } from "../generic/index.js";

export const slots = ["summary", "problem", "solution", "plan", "risks"];

const LABELS = {
  summary: "摘要",
  problem: "问题",
  solution: "方案",
  plan: "计划",
  risks: "风险"
};

export function render(sections = [], common = {}) {
  const bySlot = new Map(sections.map((section) => [section.slot, section]));
  const ordered = slots
    .map((slot) => bySlot.get(slot))
    .filter(Boolean)
    .map((section) => section.slot === "risks" ? renderRisks(section) : renderSection(section))
    .join("");

  return `${renderGenericTldr([], common)}${ordered}`;
}

function renderSection(section) {
  return `<section class="hs-section" data-slot="${escapeHtml(section.slot)}"><h2>${LABELS[section.slot]}</h2>${section.html}</section>`;
}

function renderRisks(section) {
  const rows = extractListItems(section.html).map(splitRisk).filter((row) => row.length >= 3);
  if (rows.length < 3) return renderSection(section);

  const body = rows.map(([risk, impact, mitigation]) => `<tr><td>${escapeHtml(risk)}</td><td>${escapeHtml(impact)}</td><td>${escapeHtml(mitigation)}</td></tr>`).join("");
  return `<section class="hs-section" data-slot="risks"><h2>${LABELS.risks}</h2><table class="hs-risk-table"><thead><tr><th>风险</th><th>影响</th><th>应对</th></tr></thead><tbody>${body}</tbody></table></section>`;
}

function extractListItems(html) {
  return [...String(html).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function splitRisk(item) {
  return item.split(/\s*[|｜]\s*/).map((part) => part.trim()).filter(Boolean);
}
