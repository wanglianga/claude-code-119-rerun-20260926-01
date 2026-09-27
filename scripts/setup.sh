#!/usr/bin/env bash
# 一键初始化环境：启动数据库 -> 安装依赖 -> 写入演示数据
set -e
cd "$(dirname "$0")/.."

echo "=== 1/4 启动 PostgreSQL（用户态，端口 5433）==="
./scripts/start-db.sh

echo "=== 2/4 安装后端依赖 ==="
npm --prefix server install --cache /tmp/npm-cache --no-audit --no-fund

echo "=== 3/4 安装前端依赖 ==="
npm --prefix web install --cache /tmp/npm-cache --no-audit --no-fund

echo "=== 4/4 写入演示数据 ==="
(cd server && npm run seed)

echo ""
echo "初始化完成。后续分别启动服务："
echo "  后端：  (cd server && npm run start:dev)   # http://localhost:3000/api"
echo "  前端：  (cd web && npm run dev)           # http://localhost:5173"
echo "验证：  node server/scripts/smoke.mjs"
