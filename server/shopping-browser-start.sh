#!/bin/sh
set -eu
export DISPLAY=:96
export SHOPPING_HEADFUL=1
worker_pid=''
vnc_pid=''
display_pid=''
cleanup() {
  trap - EXIT TERM INT
  if [ -n "$worker_pid" ]; then kill "$worker_pid" 2>/dev/null || true; wait "$worker_pid" 2>/dev/null || true; fi
  if [ -n "$vnc_pid" ]; then kill "$vnc_pid" 2>/dev/null || true; fi
  if [ -n "$display_pid" ]; then kill "$display_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT TERM INT
/usr/bin/Xvfb "$DISPLAY" -screen 0 1920x1080x24 -nolisten tcp -ac &
display_pid=$!
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if [ -S /tmp/.X11-unix/X96 ]; then break; fi
  sleep 0.2
done
/usr/bin/x11vnc -display "$DISPLAY" -listen 127.0.0.1 -localhost -no6 -rfbport 5906 -forever -shared -nopw -noclipboard -noxdamage -quiet -o /dev/null &
vnc_pid=$!
/usr/bin/node /opt/ayan-shopping/shopping-browser-worker.cjs &
worker_pid=$!
wait "$worker_pid"
