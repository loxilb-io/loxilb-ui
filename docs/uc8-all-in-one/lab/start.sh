#!/usr/bin/env bash
# Experimental isolated UC-8 lab. Review the README before running.
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[ "$(uname -s)" = Linux ] || { echo 'Run on a dedicated Linux host; macOS Docker Desktop is unsupported.' >&2; exit 1; }
command -v docker >/dev/null; command -v python3 >/dev/null; docker info >/dev/null; docker compose version >/dev/null
for name in UC8_POSTGRES_IMAGE UC8_GATEWAY_IMAGE UC8_OAM_IMAGE UC8_UI_IMAGE UC8_PYTHON_IMAGE; do [ -n "${!name:-}" ] || { echo "Set $name to a reviewed image." >&2; exit 1; }; done
[ -f aigw-db-bootstrap.sql ] || { echo 'Provide the matching aigw-db-bootstrap.sql as described in the lab README.' >&2; exit 1; }
project=${UC8_PROJECT:-uc8-manual}
[[ "$project" =~ ^uc8-manual(-[a-z0-9]+)*$ ]] || { echo 'UC8_PROJECT must start with uc8-manual and use lowercase letters, digits and hyphens.' >&2; exit 1; }
[ ! -e .env ] || { echo ".env exists; preserve it and use a new lab directory." >&2; exit 1; }
[ ! -e private ] || { echo 'private/ exists; preserve it and use a new lab directory.' >&2; exit 1; }
[ -z "$(docker ps -aq --filter label=com.docker.compose.project=$project)" ] || { echo "$project project already exists." >&2; exit 1; }
[ -z "$(docker volume ls -q --filter label=com.docker.compose.project=$project)" ] || { echo "$project volumes already exist." >&2; exit 1; }
if docker network inspect "${project}_lab" >/dev/null 2>&1; then echo "${project}_lab network exists." >&2; exit 1; fi
printf 'This test starts a privileged Gateway on a separate Docker network; it shares the host kernel.\n'
read -r -p 'Type UC8 to start this isolated lab: ' answer
[ "$answer" = UC8 ] || { echo 'Stopped without changes.'; exit 1; }
mkdir -m 700 private
for name in UC8_POSTGRES_IMAGE UC8_GATEWAY_IMAGE UC8_OAM_IMAGE UC8_UI_IMAGE UC8_PYTHON_IMAGE; do
  [[ "${!name}" =~ ^[A-Za-z0-9._/:@-]+$ ]] || { echo "Invalid image reference: $name" >&2; exit 1; }
  printf '%s=%s\n' "$name" "${!name}" >> .env
done
[[ "${UC8_UI_PORT:-3019}" =~ ^[0-9]+$ ]] && (( 10#${UC8_UI_PORT:-3019} >= 1 && 10#${UC8_UI_PORT:-3019} <= 65535 )) || { echo 'Invalid UI port' >&2; exit 1; }
printf 'UC8_PROJECT=%s\nUC8_UI_PORT=%s\n' "$project" "${UC8_UI_PORT:-3019}" >> .env
chmod 600 .env
python3 - <<'PY'
import secrets, pathlib, re
import os
p=pathlib.Path('private'); port=os.environ.get('UC8_UI_PORT','3019'); owner=secrets.token_hex(24); dp=secrets.token_hex(24); mgmt=secrets.token_hex(24); jwt=secrets.token_hex(32)
while True:
 admin='U8a!'+secrets.token_hex(16)
 if not re.search(r'(.)\1\1',admin): break
def out(name,text):
 f=p/name; f.write_text(text); f.chmod(0o600)
out('dp-password',dp+'\n'); out('admin-password',admin+'\n')
out('postgres.env',f'POSTGRES_USER=labowner\nPOSTGRES_DB=loxioam\nPOSTGRES_PASSWORD={owner}\n')
out('bootstrap.env',f'PGHOST=postgres\nPGPORT=5432\nPGUSER=labowner\nPGDATABASE=loxioam\nPGPASSWORD={owner}\nAIGW_DB_PASSWORD={dp}\nAIGW_MGMT_DB_PASSWORD={mgmt}\n')
out('oam.env',f'DB_USER=labowner\nDB_HOST=postgres\nDB_PORT=5432\nDB_NAME=loxioam\nDB_PASSWORD={owner}\nOAM_JWT_SECRET={jwt}\nOAM_DEFAULT_ADMIN_PASSWORD={admin}\nOAM_DB_MIGRATE=auto\nSERVER_PORT=8080\nOAM_ALLOWED_ORIGINS=http://localhost:{port}\n')
PY
docker compose config --quiet
docker compose up -d
bash status.sh
printf 'Initial admin password is in private/admin-password.\n'
