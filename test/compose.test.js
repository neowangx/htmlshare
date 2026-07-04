import assert from "node:assert/strict";
import { test } from "node:test";

import { composePage, validateEnhanced } from "../src/compose.js";
import { convertFaithful } from "../src/convert.js";

const source = `# 产品评审会纪要

今天确认 Q3 主打 X 功能，预算本周五前由 CFO 审批。

## 结论

- Q3 主打 X 功能
- 保留轻量访问码

## 行动项

- Alice 周五前提交预算
- Bob 下周完成原型走查

## 讨论过程

团队讨论了发布路径、风险和下一轮验收。
`;

function validEnhanced(overrides = {}) {
  return {
    version: 1,
    template: "meeting",
    style: "clinical",
    title: "产品评审会纪要",
    tldr: ["定了：Q3 主打 X 功能", "待定：预算需 CFO 批", "你要做：见行动项"],
    sections: [
      { slot: "conclusions", html: "<ul><li>Q3 主打 X 功能</li><li>保留轻量访问码</li></ul>" },
      { slot: "actions", html: "<ul><li>Alice 周五前提交预算</li><li>Bob 下周完成原型走查</li></ul>" },
      { slot: "discussion", html: "<details><summary>讨论过程</summary><p>团队讨论了发布路径、风险和下一轮验收，并保留原文对照。</p></details>" }
    ],
    ...overrides
  };
}

test("composePage renders dual mode with toggle and exact faithful html", () => {
  const faithful = convertFaithful(source, "fb");
  const { html, mode, validation } = composePage({
    title: faithful.title,
    faithfulHtml: faithful.html,
    enhanced: validEnhanced()
  });

  assert.equal(mode, "dual");
  assert.equal(validation.ok, true);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /id="hs-toggle"/);
  assert.match(html, /id="hs-enhanced"/);
  assert.match(html, new RegExp(`<section id="hs-faithful" class="hs-panel" hidden>${faithful.html.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/section>`));
  assert.doesNotMatch(html, /https?:\/\//);
});

test("composePage without enhanced input renders faithful-only page without toggle", () => {
  const faithful = convertFaithful(source, "fb");
  const { html, mode } = composePage({ title: faithful.title, faithfulHtml: faithful.html });

  assert.equal(mode, "faithful");
  assert.doesNotMatch(html, /id="hs-toggle"/);
  assert.doesNotMatch(html, /id="hs-enhanced"/);
  assert.match(html, /id="hs-faithful"/);
});

test("composePage directHtml returns html unchanged for encryption callers", () => {
  const html = "<!doctype html><html><body><h1>Raw</h1></body></html>";
  assert.equal(composePage({ faithfulHtml: html, directHtml: true }).html, html);
});

test("V1 rejects invalid JSON or wrong version", () => {
  assert.equal(validateEnhanced("{ nope").ok, false);
  assert.match(validateEnhanced({ ...validEnhanced(), version: 2 }).errors.join("\n"), /V1/);
});

test("V2 rejects invalid template or style", () => {
  const result = validateEnhanced(validEnhanced({ template: "minutes" }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /V2/);
});

test("V3 drops illegal slots and keeps legal sections", () => {
  const result = validateEnhanced(validEnhanced({
    sections: [
      { slot: "evil", html: "<p>drop</p>" },
      { slot: "actions", html: "<p>keep action item with enough detail to pass the short faithful comparison easily.</p>" }
    ]
  }), "short");

  assert.equal(result.ok, true);
  assert.equal(result.enhanced.sections.length, 1);
  assert.equal(result.enhanced.sections[0].slot, "actions");
  assert.match(result.warnings.join("\n"), /V3/);
});

test("V4 sanitizes script and event attributes in section html", () => {
  const result = validateEnhanced(validEnhanced({
    sections: [
      { slot: "actions", html: '<p onclick="x()">keep</p><script>alert(1)</script>' }
    ]
  }), "tiny");

  assert.equal(result.ok, true);
  assert.doesNotMatch(result.enhanced.sections[0].html, /script|onclick|alert/i);
  assert.match(result.enhanced.sections[0].html, /keep/);
});

test("V5 clips tldr count and item length", () => {
  const long = "x".repeat(100);
  const result = validateEnhanced(validEnhanced({ tldr: ["1", "2", "3", "4", "5", "6", long] }), "tiny");

  assert.equal(result.ok, true);
  assert.equal(result.enhanced.tldr.length, 5);
  assert.ok(result.enhanced.tldr.every((item) => item.length <= 80));
  assert.match(result.warnings.join("\n"), /V5/);
});

test("V6 falls back when enhanced content is too short", () => {
  const result = validateEnhanced(validEnhanced({
    tldr: ["短"],
    sections: [{ slot: "body", html: "<p>短</p>" }],
    template: "generic"
  }), "原文".repeat(100));

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /V6/);
});
