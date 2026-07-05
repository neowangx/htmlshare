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

Run with a persistent data directory:

```bash
docker run --rm -p 8090:8090 -v "$PWD/data:/data" -e UPLOAD_TOKEN=change-me htmlshare-server:local
```

Before deploying to a real machine, follow the repository rule in [AGENTS.md](../AGENTS.md): read `~/.claude/infrastructure.md`, then update it after a successful deployment.
