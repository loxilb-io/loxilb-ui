#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
name=${1:-uc8-interactive}
[[ "$name" =~ ^[A-Za-z0-9_.-]{1,63}$ ]] || { echo 'Invalid objective name' >&2; exit 1; }
docker compose exec -T -e "UC8_OBJECTIVE=$name" client python -c '
import json,os,urllib.request
with urllib.request.urlopen("http://gateway:11111/netlox/v1/config/ai/objective",timeout=5) as r: data=json.load(r)
matches=[x for x in data.get("objectiveAttr",[]) if x.get("name")==os.environ["UC8_OBJECTIVE"]]
if len(matches)!=1: raise SystemExit("Objective missing or not unique")
print(json.dumps({"name":matches[0].get("name"),"priority":matches[0].get("priority")}))
'
