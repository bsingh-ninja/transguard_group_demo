#!/usr/bin/env bash
# Start the Transguard Workforce Intelligence demo: database, API (:8002) and web app (:3002).
# Usage: ./start-transguard.sh          (Ctrl+C stops what this script started; the database keeps running)
#        ./start-transguard.sh --reseed (reset tonight's roster and the workforce data first)
set -euo pipefail
cd "$(dirname "$0")"

echo "1/4 Database"
docker compose up -d db >/dev/null
until docker exec transguard-demo-db pg_isready -U demo >/dev/null 2>&1; do sleep 1; done

echo "2/4 Backend dependencies"
if [ ! -x backend/.venv/bin/uvicorn ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements.txt
fi
backend/.venv/bin/python -c "import ortools" 2>/dev/null || backend/.venv/bin/pip install -q -r backend/requirements.txt
[ -f backend/.env ] || cp backend/.env.example backend/.env

echo "3/4 Demo data"
seeded=$(docker exec transguard-demo-db psql -U demo -d demos -tAc "select to_regclass('transguard.shift') is not null" 2>/dev/null || echo f)
if [ "${1:-}" = "--reseed" ] || [ "$seeded" != "t" ]; then
  (cd backend && .venv/bin/python -m app.transguard.seed)
fi

echo "4/4 API and web app"
[ -d web/node_modules ] || (cd web && pnpm install --silent --allow-build sharp)
PIDS=()
if ! curl -s -m 2 localhost:8002/health >/dev/null; then
  (cd backend && .venv/bin/python -m uvicorn app.main:app --port 8002 --reload --reload-dir app) &
  PIDS+=($!)
fi
(cd web && pnpm dev --port 3002) &
PIDS+=($!)
trap 'kill "${PIDS[@]}" 2>/dev/null' EXIT INT TERM

echo
echo "Transguard demo: http://localhost:3002   (Arabic: http://localhost:3002/?lang=ar)"
wait
