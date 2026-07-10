// Expiry helpers shared by the CLI. Two jobs:
//  1. parse a user-supplied expiry (`7d`, `24h`, `2026-08-01`, …) into an absolute ISO string;
//  2. wrap a static-target page in a client-side guard so that, even if nobody runs
//     `htmlshare sweep` to physically delete it, an honest visitor past the deadline sees an
//     "expired" notice instead of the content. This guard is a courtesy backstop, NOT a
//     security boundary — the payload still ships in the page and can be recovered by reading
//     source / disabling JS. Server-gated targets enforce expiry for real, server-side.

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

// Returns an absolute ISO timestamp, or null for "never" (empty / off / none / 0).
// Throws an Error with code INVALID_EXPIRY on an unparseable or past value.
export function parseExpiry(input, now = Date.now()) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw || /^(never|none|off|0)$/i.test(raw)) return null;

  const relative = raw.match(/^(\d+)\s*(s|m|h|d|w)$/i);
  if (relative) {
    return new Date(now + Number(relative[1]) * UNIT_MS[relative[2].toLowerCase()]).toISOString();
  }

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    throw expiryError(`无法解析过期时间「${raw}」（示例：7d / 24h / 2026-08-01）`);
  }
  if (parsed <= now) {
    throw expiryError(`过期时间必须在将来：${raw}`);
  }
  return new Date(parsed).toISOString();
}

function expiryError(message) {
  const error = new Error(message);
  error.code = "INVALID_EXPIRY";
  return error;
}

export function isExpired(expiresAt, now = Date.now()) {
  return Boolean(expiresAt) && Date.parse(expiresAt) <= now;
}

// Human-readable one-liner for the publish-time confirmation echo.
export function describeExpiry(expiresAt, now = Date.now()) {
  if (!expiresAt) return "永不过期";
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return `${expiresAt}（已过期）`;
  const days = Math.floor(ms / UNIT_MS.d);
  const hours = Math.floor((ms % UNIT_MS.d) / UNIT_MS.h);
  const rel = days > 0 ? `${days} 天${hours > 0 ? ` ${hours} 小时` : ""}后` : hours > 0 ? `${hours} 小时后` : "不到 1 小时后";
  return `${expiresAt}（${rel}）`;
}

// The static-target expiry guard. Wraps a full inner HTML document; on load it renders the
// inner page unless the deadline has passed, in which case it shows an expired notice. The
// payload is base64-encoded so arbitrary inner HTML (including `</script>`) can't break out.
export function wrapWithExpiry(innerHtml, expiresAt) {
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) throw expiryError(`wrapWithExpiry needs a valid expiresAt, got ${expiresAt}`);
  const payload = Buffer.from(String(innerHtml), "utf8").toString("base64");
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>htmlshare</title>
<style>
:root{--hs-bg:#F7F8FA;--hs-surface:#FFFFFF;--hs-text:#1A2233;--hs-muted:#5A6472;--hs-border:#D8DEE8}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--hs-bg);color:var(--hs-text);font:400 16px/1.65 -apple-system,"PingFang SC","Noto Sans SC",sans-serif}
.card{width:min(360px,calc(100% - 32px));padding:24px;background:var(--hs-surface);border:1px solid var(--hs-border);border-radius:10px;box-shadow:0 1px 3px rgba(16,24,40,.07);text-align:center}
h1{font-size:20px;line-height:1.3;margin:0 0 12px}.muted{color:var(--hs-muted);font-size:13px;margin:0}
</style>
</head>
<body>
<main class="card" id="hs-expired" hidden>
  <h1>链接已过期</h1>
  <p class="muted">此分享已于 <span id="hs-exp"></span> 过期，内容不再显示。</p>
</main>
<script type="application/octet-stream" id="hs-payload">${payload}</script>
<script>
(function(){
  var exp=${expiresMs};
  if(Date.now()>=exp){
    var box=document.getElementById("hs-expired");
    document.getElementById("hs-exp").textContent=new Date(exp).toLocaleString();
    box.hidden=false;
    return;
  }
  var b64=document.getElementById("hs-payload").textContent.trim();
  var bytes=Uint8Array.from(atob(b64),function(c){return c.charCodeAt(0);});
  var html=new TextDecoder("utf-8").decode(bytes);
  document.open();document.write(html);document.close();
})();
</script>
</body>
</html>`;
}
