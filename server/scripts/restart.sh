#!/usr/bin/env bash
# 重启后端：可选 --seed 重置演示数据（配置读取 server/.env）
set -e
cd "$(dirname "$0")/.."
BIN=./node_modules/.bin/ts-node

ps aux | grep "[s]rc/main.ts" | awk '{print $2}' | xargs -r kill || true
sleep 1
if [ "$1" = "--seed" ]; then
  $BIN src/seed.ts
fi
nohup $BIN src/main.ts > /tmp/cinema-server.log 2>&1 &
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/auth/login 2>/dev/null || true)
  if [ "$code" = "400" ] || [ "$code" = "401" ]; then
    echo "server is up at http://localhost:3000/api"
    exit 0
  fi
  sleep 2
done
echo "server failed to start; log:"
tail -20 /tmp/cinema-server.log
exit 1
