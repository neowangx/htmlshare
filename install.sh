#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${HTMLSHARE_REPO_URL:-https://github.com/neowangx/htmlshare.git}"
SOURCE_DIR="${HTMLSHARE_SOURCE_DIR:-}"
INSTALL_DIR="${HTMLSHARE_INSTALL_DIR:-$HOME/.htmlshare}"
BIN_DIR="${HTMLSHARE_BIN_DIR:-$HOME/.local/bin}"
SKILL_NAME="${HTMLSHARE_SKILL_NAME:-htmlshare}"

log() {
  printf '%s\n' "$*"
}

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Error: '$1' is required but not found on PATH." >&2
    exit 1
  fi
}

# Refuse to rm -rf a directory we didn't create — only clear it if it's empty, a prior
# htmlshare install (has SKILL.md), or our git clone. Otherwise abort rather than risk
# deleting a user directory that INSTALL_DIR happens to point at.
safe_reset_install_dir() {
  if [ ! -e "$INSTALL_DIR" ]; then
    return 0
  fi
  if [ -d "$INSTALL_DIR/.git" ] || [ -f "$INSTALL_DIR/SKILL.md" ] || [ -z "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
    rm -rf "$INSTALL_DIR"
    return 0
  fi
  log "Error: $INSTALL_DIR exists and is not an htmlshare install. Refusing to overwrite." >&2
  log "Set HTMLSHARE_INSTALL_DIR to a different path, or remove it yourself." >&2
  exit 1
}

# Replace a symlink target safely even when an old real directory sits at the link path
# (a stale copy-install), which would otherwise make `ln -sfn` nest the link inside it.
safe_symlink() {
  local target="$1" link="$2"
  if [ -d "$link" ] && [ ! -L "$link" ]; then
    rm -rf "$link"
  fi
  ln -sfn "$target" "$link"
}

clone_or_update() {
  if [ -n "$SOURCE_DIR" ]; then
    log "Installing htmlshare from local source $SOURCE_DIR..."
    safe_reset_install_dir
    mkdir -p "$INSTALL_DIR"
    cp -R "$SOURCE_DIR/package.json" "$SOURCE_DIR/package-lock.json" "$SOURCE_DIR/SKILL.md" "$INSTALL_DIR/"
    cp -R "$SOURCE_DIR/bin" "$SOURCE_DIR/src" "$SOURCE_DIR/agents" "$SOURCE_DIR/scripts" "$INSTALL_DIR/"
    # Carry bundled dependencies through when the source ships them, so an offline/self-hosted
    # install needs neither GitHub nor the npm registry (install_cli then skips npm install).
    if [ -d "$SOURCE_DIR/node_modules" ]; then
      cp -R "$SOURCE_DIR/node_modules" "$INSTALL_DIR/"
    fi
    return 0
  fi

  if [ -d "$INSTALL_DIR/.git" ]; then
    log "Updating htmlshare in $INSTALL_DIR..."
    git -C "$INSTALL_DIR" fetch --all --prune
    if ! git -C "$INSTALL_DIR" pull --ff-only; then
      log "Error: local changes prevent a fast-forward update in $INSTALL_DIR." >&2
      log "Resolve or remove the directory, then re-run." >&2
      exit 1
    fi
  else
    safe_reset_install_dir
    log "Installing htmlshare to $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
}

install_cli() {
  if [ -d "$INSTALL_DIR/node_modules" ] && [ -n "$(ls -A "$INSTALL_DIR/node_modules" 2>/dev/null)" ]; then
    log "Using bundled dependencies (skipping npm install)."
  else
    require npm
    log "Installing npm dependencies..."
    npm --prefix "$INSTALL_DIR" install --omit=dev
  fi
  mkdir -p "$BIN_DIR"
  safe_symlink "$INSTALL_DIR/bin/htmlshare.js" "$BIN_DIR/htmlshare"
  chmod +x "$INSTALL_DIR/bin/htmlshare.js"
}

install_claude() {
  # Detect Claude by its home dir, then create the skills dir if needed — same policy as the
  # openclaw/hermes installers, so a Claude user who never made ~/.claude/skills isn't skipped.
  if [ ! -d "$HOME/.claude" ]; then
    return 0
  fi
  local skills_dir="$HOME/.claude/skills"
  mkdir -p "$skills_dir"
  safe_symlink "$INSTALL_DIR" "$skills_dir/$SKILL_NAME"
  log "Installed Claude Code skill: $skills_dir/$SKILL_NAME -> $INSTALL_DIR"
}

install_codex_placeholder() {
  if [ -d "$HOME/.codex" ]; then
    local codex_file="$HOME/.codex/AGENTS.md"
    local snippet="$INSTALL_DIR/agents/codex/AGENTS.md"
    local start="<!-- htmlshare:start -->"
    local end="<!-- htmlshare:end -->"
    mkdir -p "$HOME/.codex"
    touch "$codex_file"
    # Command substitution strips trailing newlines from the pre-existing content, so
    # repeated installs produce byte-identical output (no accumulating blank lines — P4).
    local base
    base="$(awk -v start="$start" -v end="$end" '
      $0 == start { skip = 1; next }
      $0 == end { skip = 0; next }
      skip != 1 { print }
    ' "$codex_file")"
    {
      if [ -n "$base" ]; then
        printf '%s\n\n' "$base"
      fi
      printf '%s\n' "$start"
      cat "$snippet"
      printf '%s\n' "$end"
    } > "$codex_file"
    log "Installed Codex wrapper into $codex_file"
  fi
}

install_openclaw_placeholder() {
  if [ -d "$HOME/.openclaw" ]; then
    mkdir -p "$HOME/.openclaw/skills"
    safe_symlink "$INSTALL_DIR/agents/openclaw" "$HOME/.openclaw/skills/$SKILL_NAME"
    log "Installed OpenClaw skill: $HOME/.openclaw/skills/$SKILL_NAME -> $INSTALL_DIR/agents/openclaw"
  fi
}

install_hermes_placeholder() {
  if [ -d "$HOME/.hermes" ]; then
    mkdir -p "$HOME/.hermes/skills"
    safe_symlink "$INSTALL_DIR/agents/hermes" "$HOME/.hermes/skills/$SKILL_NAME"
    log "Installed Hermes skill: $HOME/.hermes/skills/$SKILL_NAME -> $INSTALL_DIR/agents/hermes"
  fi
}

require node
if [ -z "$SOURCE_DIR" ]; then
  require git
fi

clone_or_update
install_cli
install_claude
install_codex_placeholder
install_openclaw_placeholder
install_hermes_placeholder

log ""
log "htmlshare installed."
log "Make sure $BIN_DIR is on PATH, then tell your agent: 分享 <某文件>"
