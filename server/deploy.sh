#!/usr/bin/env bash
# Deploy htmlshare selfhost server.
# Usage: deploy.sh <user@host> <port> <token>
#
# Before real deployment, read ~/.claude/infrastructure.md for target/server
# context. After successful deployment, update it with the final baseUrl,
# container name, port, and data volume.
set -euo pipefail

usage() {
  echo "Usage: $0 <user@host> <port> <token>" >&2
}

if [ "$#" -ne 3 ]; then
  usage
  exit 2
fi

HOST="$1"
PORT="$2"
TOKEN="$3"
CONTAINER_NAME="${HTMLSHARE_CONTAINER_NAME:-htmlshare}"
IMAGE_NAME="${HTMLSHARE_IMAGE_NAME:-htmlshare-server:local}"
REMOTE_DIR="${HTMLSHARE_REMOTE_DIR:-~/htmlshare-server}"
VOLUME_NAME="${HTMLSHARE_VOLUME_NAME:-htmlshare-data}"
PUBLIC_HOST="${HOST#*@}"
PUBLIC_BASE="${HTMLSHARE_PUBLIC_BASE:-http://${PUBLIC_HOST}:${PORT}}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="$(mktemp -t htmlshare-image.XXXXXX.tar)"

cleanup() {
  rm -f "$ARCHIVE"
}
trap cleanup EXIT

quote() {
  printf "%q" "$1"
}

echo "Building ${IMAGE_NAME}..."
docker build -f "$ROOT_DIR/server/Dockerfile" -t "$IMAGE_NAME" "$ROOT_DIR"
docker save "$IMAGE_NAME" -o "$ARCHIVE"

echo "Uploading image to ${HOST}..."
# shellcheck disable=SC2029
ssh "$HOST" "mkdir -p ${REMOTE_DIR}"
scp "$ARCHIVE" "$HOST:${REMOTE_DIR}/htmlshare-image.tar"

REMOTE_RUN="
set -euo pipefail
cd ${REMOTE_DIR}
docker load -i htmlshare-image.tar
docker volume create $(quote "$VOLUME_NAME") >/dev/null
docker rm -f $(quote "$CONTAINER_NAME") >/dev/null 2>&1 || true
docker run -d --name $(quote "$CONTAINER_NAME") --restart unless-stopped \
  -p $(quote "${PORT}:8090") \
  -v $(quote "${VOLUME_NAME}:/data") \
  -e PORT=8090 \
  -e DATA_DIR=/data \
  -e UPLOAD_TOKEN=$(quote "$TOKEN") \
  -e PUBLIC_BASE=$(quote "$PUBLIC_BASE") \
  $(quote "$IMAGE_NAME")
rm -f htmlshare-image.tar
"

echo "Starting remote container..."
# shellcheck disable=SC2029
ssh "$HOST" "$REMOTE_RUN"

echo "Verifying ${PUBLIC_BASE}/healthz..."
ok=0
for attempt in $(seq 1 15); do
  sleep 2
  if curl -fsS "${PUBLIC_BASE}/healthz" >/dev/null; then
    ok=1
    break
  fi
  echo "healthz attempt ${attempt}/15 failed, retrying..." >&2
done

if [ "$ok" -ne 1 ]; then
  echo "healthz FAILED after 15 attempts" >&2
  exit 1
fi

echo "Deployed htmlshare selfhost."
echo "baseUrl=${PUBLIC_BASE}"
echo "uploadToken=${TOKEN}"
