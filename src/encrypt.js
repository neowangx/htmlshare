import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

export const KDF_ITERATIONS = 600000;
export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function normalizeCode(code) {
  return String(code || "").replace(/-/g, "").trim().toUpperCase();
}

export function generateStaticCode() {
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) code += CROCKFORD[byte % CROCKFORD.length];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function deriveKey(code, salt, iter = KDF_ITERATIONS) {
  return pbkdf2Sync(normalizeCode(code), salt, iter, 32, "sha256");
}

function vaultJson(vault) {
  // Embedded in a raw-text <script> element: HTML entities are NOT decoded there,
  // so escaping " as &quot; would corrupt JSON.parse. The only sequence that can break
  // out of the element is a literal `</script`, so neutralize `<` via a JS-string-safe
  // unicode escape (valid inside JSON, harmless to JSON.parse).
  return JSON.stringify(vault).replace(/</g, "\\u003c");
}

function shell(vault) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>htmlshare protected page</title>
<style>
:root{--hs-bg:#F7F8FA;--hs-surface:#FFFFFF;--hs-text:#1A2233;--hs-muted:#5A6472;--hs-border:#D8DEE8;--hs-primary:#2456D6;--hs-danger:#C23934}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--hs-bg);color:var(--hs-text);font:400 16px/1.65 -apple-system,"PingFang SC","Noto Sans SC",sans-serif}.card{width:min(360px,calc(100% - 32px));padding:24px;background:var(--hs-surface);border:1px solid var(--hs-border);border-radius:10px;box-shadow:0 1px 3px rgba(16,24,40,.07)}h1{font-size:20px;line-height:1.3;letter-spacing:0;margin:0 0 12px}.muted{color:var(--hs-muted);font-size:13px}input{width:100%;height:48px;border:1px solid var(--hs-border);border-radius:8px;padding:0 12px;text-transform:uppercase;font:inherit}button{width:100%;height:44px;margin-top:12px;border:0;border-radius:8px;background:var(--hs-primary);color:var(--hs-surface);font:inherit}.error input{border-color:var(--hs-danger)}.error-text{min-height:20px;color:var(--hs-danger);font-size:13px}.progress{height:4px;margin-top:12px;background:var(--hs-border);border-radius:999px;overflow:hidden}.progress span{display:block;width:0;height:100%;background:var(--hs-primary)}.busy .progress span{width:64%}
</style>
</head>
<body>
<main class="card" id="hs-gate">
  <h1>请输入访问码</h1>
  <p class="muted">静态页面在本地解密。访问码用于轻量分享保护，不适合强机密。</p>
  <form id="hs-form">
    <input id="hs-code" name="code" autocomplete="off" inputmode="text" placeholder="XXXX-XXXX" autofocus>
    <button type="submit">解密</button>
    <div class="progress" aria-hidden="true"><span></span></div>
    <p class="error-text" id="hs-error"></p>
  </form>
</main>
<script type="application/json" id="hs-vault">${vaultJson(vault)}</script>
<script>
const form=document.querySelector("#hs-form"),input=document.querySelector("#hs-code"),gate=document.querySelector("#hs-gate"),err=document.querySelector("#hs-error");
function clean(v){return v.replace(/-/g,"").trim().toUpperCase()}
input.addEventListener("input",()=>{const v=clean(input.value).slice(0,8);input.value=v.length>4?v.slice(0,4)+"-"+v.slice(4):v;});
async function b64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
form.addEventListener("submit",async e=>{e.preventDefault();err.textContent="";gate.classList.remove("error");gate.classList.add("busy");try{const v=JSON.parse(document.querySelector("#hs-vault").textContent);const keyMaterial=await crypto.subtle.importKey("raw",new TextEncoder().encode(clean(input.value)),"PBKDF2",false,["deriveKey"]);const key=await crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt:await b64(v.salt),iterations:v.iter},keyMaterial,{name:"AES-GCM",length:256},false,["decrypt"]);const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:await b64(v.iv)},key,await b64(v.ct));const stream=new Response(plain).body.pipeThrough(new DecompressionStream("gzip"));const html=await new Response(stream).text();document.open();document.write(html);document.close();}catch{gate.classList.add("error");err.textContent="访问码不正确或页面已损坏";}finally{gate.classList.remove("busy");}});
</script>
</body>
</html>`;
}

export function encryptHtml(html, code = generateStaticCode()) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(code, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(gzipSync(String(html))), cipher.final(), cipher.getAuthTag()]);
  const vault = {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iter: KDF_ITERATIONS,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    ct: encrypted.toString("base64")
  };
  return { html: shell(vault), code, vault };
}

export function decryptVault(vault, code) {
  const salt = Buffer.from(vault.salt, "base64");
  const iv = Buffer.from(vault.iv, "base64");
  const encrypted = Buffer.from(vault.ct, "base64");
  const authTag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(code, salt, vault.iter), iv);
  decipher.setAuthTag(authTag);
  return gunzipSync(Buffer.concat([decipher.update(ciphertext), decipher.final()])).toString("utf8");
}
