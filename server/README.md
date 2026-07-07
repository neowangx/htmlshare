# htmlshare Self-Hosted Server

This directory contains a small compatible server for users who want to publish to their own endpoint instead of official cloud, Vercel, or Cloudflare.

It implements the core HTTP API documented in [../docs/04-数据模型与API契约.md](../docs/04-数据模型与API契约.md): create/update/delete pages, metadata lookup, access-code gate, unlock cookies, rate limiting, and version retention.

## Local Smoke Test

Start the server with a token and data directory:

```bash
PORT=8090 UPLOAD_TOKEN=change-me DATA_DIR=./data node server/server.js
```

Then configure the CLI from another shell:

```bash
htmlshare config selfhost --base-url http://127.0.0.1:8090 --token change-me
```

## Docker

Build the image:

```bash
docker build -f server/Dockerfile -t htmlshare-server:local .
```

Run with a persistent data directory. `UPLOAD_TOKEN` (CLI auth) and `SESSION_SECRET` (signs
the access-code session cookie) are both required — the server refuses to start without them:

```bash
docker run --rm -p 8090:8090 -v "$PWD/data:/data" \
  -e UPLOAD_TOKEN=change-me -e SESSION_SECRET="$(openssl rand -hex 32)" \
  htmlshare-server:local
```

Behind an HTTPS reverse proxy, also set `-e TRUST_PROXY=1` (so unlock rate-limiting uses the
real client IP from `X-Forwarded-For`) and `-e COOKIE_SECURE=1`.

`server/deploy.sh <user@host> <port> <token>` builds the image, copies it over SSH, and runs
it with a persistent named volume; it generates a `SESSION_SECRET` automatically (set
`HTMLSHARE_SESSION_SECRET` to keep it stable across redeploys).
