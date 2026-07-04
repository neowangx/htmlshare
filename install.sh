#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${HTMLSHARE_REPO_URL:-https://github.com/neomini/htmlshare.git}"
INSTALL_DIR="${HTMLSHARE_INSTALL_DIR:-$HOME/.htmlshare}"
BIN_DIR="${HTMLSHARE_BIN_DIR:-$HOME/.local/bin}"
SKILL_NAME="${HTMLSHARE_SKILL_NAME:-htmlshare}"

log() {
  printf '%s\n' "$*"
}

clone_or_update() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    log "Updating htmlshare in $INSTALL_DIR..."
    git -C "$INSTALL_DIR" fetch --all --prune
    git -C "$INSTALL_DIR" pull --ff-only
  else
    rm -rf "$INSTALL_DIR"
    log "Installing htmlshare to $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
}

install_cli() {
  log "Installing npm dependencies..."
  npm --prefix "$INSTALL_DIR" install --omit=dev
  mkdir -p "$BIN_DIR"
  ln -sfn "$INSTALL_DIR/bin/htmlshare.js" "$BIN_DIR/htmlshare"
  chmod +x "$INSTALL_DIR/bin/htmlshare.js"
}

install_claude() {
  local skills_dir="$HOME/.claude/skills"
  if [ ! -d "$skills_dir" ]; then
    return 0
  fi
  ln -sfn "$INSTALL_DIR" "$skills_dir/$SKILL_NAME"
  log "Installed Claude Code skill: $skills_dir/$SKILL_NAME -> $INSTALL_DIR"
}

install_codex_placeholder() {
  if [ -d "$HOME/.codex" ]; then
    log "Detected Codex; wrapper install will be enabled by K-03."
  fi
}

install_openclaw_placeholder() {
  if [ -d "$HOME/.openclaw" ]; then
    log "Detected OpenClaw; wrapper install will be enabled by K-04."
  fi
}

install_hermes_placeholder() {
  if [ -d "$HOME/.hermes" ]; then
    log "Detected Hermes; wrapper install will be enabled by K-04."
  fi
}

clone_or_update
install_cli
install_claude
install_codex_placeholder
install_openclaw_placeholder
install_hermes_placeholder

log ""
log "htmlshare installed."
log "Make sure $BIN_DIR is on PATH, then tell your agent: 分享 <某文件>"
