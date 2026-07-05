import assert from "node:assert/strict";
import { test } from "node:test";

import { composePage } from "../src/compose.js";
import { get } from "../src/templates/registry.js";

function releaseEnhanced(overrides = {}) {
  return {
    version: 1,
    template: "release",
    style: "clinical",
    title: "v0.1.0 发布公告",
    tldr: ["首个公开版本", "升级需注意配置项"],
    sections: [
      { slot: "highlights", html: "<ul><li>支持一键发布 HTML。</li></ul>" },
      { slot: "changes", html: "<ul><li>新增：cloud 登录流程</li><li>修复：重复发布链接不变</li><li>破坏性：配置路径改为 htmlshare</li><li>文档补充 README</li></ul>" },
      { slot: "upgrade_notes", html: "<p>从旧版本升级时请重新运行安装脚本。</p>" }
    ],
    ...overrides
  };
}

test("C-13 release slots match docs/04 section 8", () => {
  assert.deepEqual(get("release").slots, ["highlights", "changes", "upgrade_notes"]);
});

test("C-13 release changes render grouped badges", () => {
  const { html, mode, validation } = composePage({
    title: "发布",
    faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
    enhanced: releaseEnhanced()
  });

  assert.equal(mode, "dual");
  assert.equal(validation.ok, true);
  assert.match(html, /<span class="hs-change-badge">新增<\/span><ul><li>cloud 登录流程<\/li><\/ul>/);
  assert.match(html, /<span class="hs-change-badge">修复<\/span><ul><li>重复发布链接不变<\/li><\/ul>/);
  assert.match(html, /<span class="hs-change-badge">破坏性<\/span><ul><li>配置路径改为 htmlshare<\/li><\/ul>/);
  assert.match(html, /<span class="hs-change-badge">其他<\/span><ul><li>文档补充 README<\/li><\/ul>/);
});

test("C-13 release omits missing upgrade_notes heading", () => {
  const { html } = composePage({
    title: "发布",
    faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
    enhanced: releaseEnhanced({
      sections: [
        { slot: "highlights", html: "<p>亮点内容足够长，亮点内容足够长。</p>" },
        { slot: "changes", html: "<ul><li>新增：能力</li></ul>" }
      ]
    })
  });

  assert.doesNotMatch(html, /升级说明/);
});
