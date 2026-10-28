#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
name=${1:-uc8-support}
[[ "$name" =~ ^[A-Za-z0-9_.-]{1,63}$ ]] || { echo 'Invalid tenant ID' >&2; exit 1; }
docker compose exec -T -e "UC8_TENANT=$name" client python -c '
import json,os,urllib.parse,urllib.request
url="http://gateway:11111/netlox/v1/config/ai/tenant/ratelimit/"+urllib.parse.quote(os.environ["UC8_TENANT"],safe="")
with urllib.request.urlopen(url,timeout=5) as response: data=json.load(response)
keys=["tenant_id","rps","tokens_per_min","burst_pct","model_limits","priority_class","default_objective","allowed_objectives"]
print(json.dumps({k:data.get(k) for k in keys}))
'
