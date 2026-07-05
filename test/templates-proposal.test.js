import assert from "node:assert/strict";
import { test } from "node:test";

import { composePage } from "../src/compose.js";
import { get } from "../src/templates/registry.js";

function proposalEnhanced(overrides = {}) {
  return {
    version: 1,
    template: "proposal",
    style: "clinical",
    title: "客户门户改版方案",
    tldr: ["建议两阶段上线", "风险集中在迁移窗口"],
    sections: [
      { slot: "summary", html: "<p>本方案建议先上线查询能力，再逐步迁移审批能力。</p>" },
      { slot: "problem", html: "<p>现有客户门户信息分散，支持团队响应慢。</p>" },
      { slot: "solution", html: "<p>新门户统一订单、工单与知识库入口。</p>" },
      { slot: "plan", html: "<ol><li>7 月完成 MVP。</li><li>8 月灰度。</li></ol>" },
      { slot: "risks", html: "<ul><li>数据迁移｜客户短暂停写｜灰度窗口回滚</li><li>权限遗漏｜错误可见性｜双人复核</li><li>培训不足｜使用率低｜上线前培训</li></ul>" }
    ],
    ...overrides
  };
}

test("C-11 proposal slots match docs/04 section 8", () => {
  assert.deepEqual(get("proposal").slots, ["summary", "problem", "solution", "plan", "risks"]);
});

test("C-11 proposal risks render as table only when three structured items exist", () => {
  const { html, mode, validation } = composePage({
    title: "方案",
    faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
    enhanced: proposalEnhanced()
  });

  assert.equal(mode, "dual");
  assert.equal(validation.ok, true);
  assert.match(html, /class="hs-risk-table"/);
  assert.match(html, /<th>风险<\/th><th>影响<\/th><th>应对<\/th>/);
  assert.match(html, /<td>数据迁移<\/td><td>客户短暂停写<\/td><td>灰度窗口回滚<\/td>/);
});

test("C-11 proposal keeps risks as original HTML when not table-shaped", () => {
  const { html } = composePage({
    title: "方案",
    faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
    enhanced: proposalEnhanced({
      sections: [
        { slot: "summary", html: "<p>摘要内容足够长，摘要内容足够长。</p>" },
        { slot: "risks", html: "<ul><li>只有一个风险，不应表格化。</li></ul>" }
      ]
    })
  });

  assert.doesNotMatch(html, /hs-risk-table/);
  assert.match(html, /只有一个风险，不应表格化/);
});
