#!/usr/bin/env bash
# 启动用户态 PostgreSQL（端口 5433，socket /tmp/pgsock，库 cinema）
# 适用于无系统库 superuser 权限的隔离环境；若你已有可用 PostgreSQL，
# 可在 server/.env 中改 DB_HOST/DB_PORT/DB_USER/DB_PASS 并把 DB_SOCKET 置空。
set -e
PGBIN=/usr/lib/postgresql/15/bin
PGDATA=$HOME/pgdata/cinema
SOCK=/tmp/pgsock
mkdir -p "$SOCK"

if ! "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  if [ ! -d "$PGDATA" ]; then
    echo "首次运行：初始化 PostgreSQL 数据目录 $PGDATA"
    "$PGBIN/initdb" -D "$PGDATA" --auth=trust --username=postgres --encoding=UTF8 --locale=C.UTF-8
    cat >> "$PGDATA/postgresql.conf" <<EOF

# cinema platform local instance
port = 5433
unix_socket_directories = '/tmp/pgsock'
listen_addresses = 'localhost'
EOF
  fi
  "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/start.log" start
  for i in $(seq 1 20); do
    if pg_isready -h "$SOCK" -p 5433 >/dev/null 2>&1; then break; fi
    sleep 1
  done
  echo "PostgreSQL 已启动（端口 5433）"
else
  echo "PostgreSQL 已在运行（端口 5433）"
fi

# 确保 cinema 库存在
if ! psql -h "$SOCK" -p 5433 -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='cinema'" | grep -q 1; then
  createdb -h "$SOCK" -p 5433 -U postgres cinema
  echo "已创建数据库 cinema"
fi
pg_isready -h "$SOCK" -p 5433
