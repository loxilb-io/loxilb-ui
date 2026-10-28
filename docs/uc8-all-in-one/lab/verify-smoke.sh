#!/usr/bin/env bash
# Run after creating the documented keyless baseline rule in the UI.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
gateway=$(docker compose ps -q gateway)
[ -n "$gateway" ] || { echo 'Gateway container is absent.' >&2; exit 1; }
vip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$gateway")
[ -n "$vip" ] || { echo 'Gateway IP is unavailable.' >&2; exit 1; }
docker compose exec -T -e "UC8_VIP=$vip" client python -c '
import json,os,uuid,urllib.request
nonce="uc8-smoke-"+uuid.uuid4().hex
body=json.dumps({"model":"shared-model","messages":[{"role":"user","content":"hello"}]}).encode()
url="http://"+os.environ["UC8_VIP"]+":20119/v1/chat/completions"
request=urllib.request.Request(url,data=body,headers={"Content-Type":"application/json","X-Test-Nonce":nonce})
with urllib.request.urlopen(request,timeout=10) as response: status=response.status
with urllib.request.urlopen("http://backend:8080/receipt/"+nonce,timeout=5) as response: receipt=json.load(response)
print("HTTP",status,"backend count",receipt.get("count"))
if status!=200 or receipt.get("count")!=1: raise SystemExit(1)
'
