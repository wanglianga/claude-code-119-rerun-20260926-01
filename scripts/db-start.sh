#!/usr/bin/env bash
# 启动用户态 PostgreSQL 集群（无需 root / docker）：
# 首次运行自动 initdb 到项目 .pgdata（端口 5433，trust 认证），并创建 openair_cinema 库。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN=/usr/lib/postgresql/15/bin
DATA="$ROOT/.pgdata"
LOG="$DATA/pg.log"

if [ ! -d "$DATA" ]; then
  echo "首次运行：初始化 PostgreSQL 数据目录 $DATA"
  "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8
  {
    echo "port = 5433"
    echo "unix_socket_directories = '/tmp'"
  } >> "$DATA/postgresql.conf"
fi

if ! "$PG_BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl" -D "$DATA" -l "$LOG" start
  for _ in $(seq 1 20); do
    "$PG_BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

"$PG_BIN/psql" -h localhost -p 5433 -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='openair_cinema'" | grep -q 1 \
  || "$PG_BIN/createdb" -h localhost -p 5433 -U postgres openair_cinema
echo "PostgreSQL 就绪：localhost:5433/openair_cinema（日志 $LOG）"
