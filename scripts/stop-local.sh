#!/bin/bash
set -eu
APP_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd -P)"
PID_FILE="$APP_DIR/server.pid"
CANDIDATES=$(/usr/sbin/lsof -nP -t -iTCP:3040 -sTCP:LISTEN 2>/dev/null || true)
if [[ -f "$PID_FILE" ]]; then CANDIDATES="$CANDIDATES $(cat "$PID_FILE")"; fi
STOPPED=0
for pid in $CANDIDATES; do
  [[ "$pid" =~ ^[0-9]+$ ]] || continue
  command=$(/bin/ps -p "$pid" -o comm= 2>/dev/null || true)
  [[ "${command##*/}" == 'node' ]] || continue
  arguments=$(/bin/ps -p "$pid" -o args= 2>/dev/null || true)
  [[ "$arguments" == *'dist/index.js'* ]] || continue
  process_dir=$(/usr/sbin/lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | /usr/bin/sed -n 's/^n//p' || true)
  [[ "$process_dir" == "$APP_DIR" ]] || continue
  if [[ "${1:-}" == '--dry-run' ]]; then echo "Đúng tiến trình Chat Local: $pid"; STOPPED=1; continue; fi
  kill -TERM "$pid" 2>/dev/null || true
  for ((attempt=0;attempt<50;attempt++)); do
    kill -0 "$pid" 2>/dev/null || break
    /bin/sleep 0.2
  done
  if kill -0 "$pid" 2>/dev/null; then kill -KILL "$pid" 2>/dev/null || true; fi
  STOPPED=1
 done
if [[ "${1:-}" != '--dry-run' ]]; then
  if [[ "$STOPPED" == 1 ]]; then /bin/rm -f "$PID_FILE"; echo 'Đã tắt Chat Local.'; else echo 'Chat Local hiện không chạy.'; fi
fi
