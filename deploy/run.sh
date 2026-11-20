#!/usr/bin/env bash
# Container entrypoint: start the database baked into the image (seed it if missing), then API, web app and nginx.
# Build step: `run.sh --bake` seeds the database and stops.
set -euo pipefail
cd /app

PGBIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
PGDATA=${PGDATA:-/home/user/pgdata}
start_db() { "$PGBIN/pg_ctl" -D "$PGDATA" -o "-c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp" -l /tmp/postgres.log -w start >/dev/null; }

if [ -d "$PGDATA" ]; then
  start_db  # baked into the image at build time: every container starts from the same fresh scenario
else
  echo "Seeding demo data"
  "$PGBIN/initdb" -D "$PGDATA" -U demo --auth=trust >/dev/null
  start_db
  "$PGBIN/createdb" -h 127.0.0.1 -U demo demos
  (cd backend && python -m app.transguard.seed)
fi
if [ "${1:-}" = "--bake" ]; then
  "$PGBIN/pg_ctl" -D "$PGDATA" -w stop >/dev/null
  exit 0
fi

echo "Starting API on :$API_PORT and web app on :3000"
(cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT") &
(cd web && node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000) &

# Optional password: set the DEMO_PASSWORD secret on the Space (user name: demo).
if [ -n "${DEMO_PASSWORD:-}" ]; then
  printf 'demo:{PLAIN}%s\n' "$DEMO_PASSWORD" > /tmp/htpasswd
  printf 'auth_basic "Demo";\nauth_basic_user_file /tmp/htpasswd;\n' > /tmp/nginx-auth.conf
else
  : > /tmp/nginx-auth.conf
fi
sed "s/__API_PORT__/$API_PORT/" deploy/nginx.conf > /tmp/nginx.conf
until curl -sf "http://127.0.0.1:$API_PORT/health" >/dev/null && curl -sf -o /dev/null http://127.0.0.1:3000/; do sleep 1; done
echo "Ready on :7860"
exec nginx -c /tmp/nginx.conf -g "daemon off;"
