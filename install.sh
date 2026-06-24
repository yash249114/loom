#!/usr/bin/env bash
set -euo pipefail

# Loom Installer — Unix (macOS, Linux, WSL)
# Usage: curl -fsSL https://raw.githubusercontent.com/loom/loom-agent/main/install.sh | sh

REPO="loom/loom-agent"
INSTALL_DIR="${LOOM_DIR:-$HOME/.loom/bin}"
PROFILE="$HOME/.profile"

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
RESET="\033[0m"

# Detect platform
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

case "$OS" in
  linux)   OS="linux" ;;
  darwin)  OS="darwin" ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

# Prefer npm install if Node.js is available
if command -v node &>/dev/null; then
  echo -e "${BOLD}Node.js detected. Installing via npm...${RESET}"
  npm install -g loom-agent
  echo ""
  echo -e "${GREEN}✓ Loom installed via npm${RESET}"
  echo "Run: loom <prompt>"
  exit 0
fi

# Fallback: try download a pre-built binary (if available)
BINARY="loom-${OS}-${ARCH}"
URL="https://github.com/${REPO}/releases/latest/download/${BINARY}"

mkdir -p "$INSTALL_DIR"

echo -e "${BOLD}Downloading Loom for ${OS}/${ARCH}...${RESET}"
if command -v curl &>/dev/null; then
  curl -fsSL "$URL" -o "$INSTALL_DIR/loom"
elif command -v wget &>/dev/null; then
  wget -q "$URL" -O "$INSTALL_DIR/loom"
else
  echo "Need curl or wget to download. Install one of them or use npm."
  exit 1
fi

chmod +x "$INSTALL_DIR/loom"

# Add to PATH if not already
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
  echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$PROFILE"
  echo -e "${CYAN}Added $INSTALL_DIR to PATH in $PROFILE${RESET}"
  echo -e "${CYAN}Reload with: source $PROFILE${RESET}"
fi

echo ""
echo -e "${GREEN}✓ Loom installed to $INSTALL_DIR/loom${RESET}"
echo "Run: loom <prompt>"
