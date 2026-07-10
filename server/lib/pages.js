function shell(title, body) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>:root{--hs-bg:#F7F8FA;--hs-surface:#FFFFFF;--hs-text:#1A2233;--hs-muted:#5A6472;--hs-border:#D8DEE8;--hs-primary:#2456D6;--hs-danger:#C23934}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--hs-bg);color:var(--hs-text);font:400 16px/1.65 -apple-system,"PingFang SC","Noto Sans SC",sans-serif}.card{width:min(360px,calc(100% - 32px));padding:24px;background:var(--hs-surface);border:1px solid var(--hs-border);border-radius:10px}h1{font-size:20px;line-height:1.3;letter-spacing:0}input{width:100%;height:48px;border:1px solid var(--hs-border);border-radius:8px;padding:0 12px;font:inherit}button{width:100%;height:44px;margin-top:12px;border:0;border-radius:8px;background:var(--hs-primary);color:var(--hs-surface);font:inherit}.err{color:var(--hs-danger);font-size:13px;min-height:20px}</style></head><body><main class="card">${body}</main></body></html>`;
}

export function gatePage(id, { error = "" } = {}) {
  return shell("需要访问码", `<form method="post" action="/s/${id}/unlock"><h1>请输入访问码</h1><input name="code" inputmode="numeric" autocomplete="off" autofocus><p class="err">${error}</p><button type="submit">打开</button></form>`);
}

export function expiredPage() {
  return shell("链接已过期", `<h1>链接已过期</h1><p class="err">此分享已过期，内容不再显示。</p>`);
}
