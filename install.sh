#!/usr/bin/env bash
set -euo pipefail

REPO="boennemann/vscode-agent-color"

# Detect editor
if command -v cursor &>/dev/null; then
  EDITOR_CMD="cursor"
elif command -v code &>/dev/null; then
  EDITOR_CMD="code"
else
  echo "Error: neither 'cursor' nor 'code' found in PATH" >&2
  exit 1
fi

echo "Using: $EDITOR_CMD"

# Get latest .vsix download URL from GitHub Releases
VSIX_URL=$(curl -sL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep -o '"browser_download_url": *"[^"]*\.vsix"' \
  | head -1 \
  | grep -o 'https://[^"]*')

if [ -z "$VSIX_URL" ]; then
  echo "Error: no .vsix found in latest release" >&2
  echo "Check https://github.com/${REPO}/releases" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
VSIX_FILE="${TMPDIR}/agent-color.vsix"

echo "Downloading ${VSIX_URL##*/}..."
curl -sL -o "$VSIX_FILE" "$VSIX_URL"

echo "Installing..."
"$EDITOR_CMD" --install-extension "$VSIX_FILE"

rm -rf "$TMPDIR"
echo "Done. Reload your window to activate."
