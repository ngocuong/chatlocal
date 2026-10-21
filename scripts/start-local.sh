#!/bin/zsh
set -eu
umask 077
cd -- "$(dirname -- "$0")/.."
export PATH="/Applications/ChatGPT.app/Contents/Resources/codex-cli/codex-path:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
exec /opt/homebrew/bin/node dist/index.js
