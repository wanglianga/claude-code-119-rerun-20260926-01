#!/usr/bin/env bash
# 停止用户态 PostgreSQL 集群
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
/usr/lib/postgresql/15/bin/pg_ctl -D "$ROOT/.pgdata" stop
