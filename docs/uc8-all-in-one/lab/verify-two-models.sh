#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
expected=${1:-denied}; [[ "$expected" = denied || "$expected" = allowed ]] || { echo 'Usage: bash verify-two-models.sh denied|allowed' >&2; exit 1; }
key_file=${2:-private/support-key}; [ -f "$key_file" ] || { echo 'Protected key file not found' >&2; exit 1; }
gateway=$(docker compose ps -q gateway); [ -n "$gateway" ]
vip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$gateway")
docker compose exec -T -e "UC8_VIP=$vip" -e "UC8_EXPECTED=$expected" client python -c '
import json,os,sys,uuid,urllib.request,urllib.error
key=sys.stdin.read().strip(); assert key
vip=os.environ["UC8_VIP"]
def check(model,port,backend,expect):
 nonce="uc8-model-"+uuid.uuid4().hex
 body=json.dumps({"model":model,"messages":[{"role":"user","content":"hello"}]}).encode()
 req=urllib.request.Request("http://"+vip+":"+str(port)+"/v1/chat/completions",data=body,headers={"Content-Type":"application/json","X-Test-Nonce":nonce,"X-Api-Key":key})
 try:
  with urllib.request.urlopen(req,timeout=10) as r: status=r.status
 except urllib.error.HTTPError as e: status=e.code
 counts=[]
 for host in ("backend","backend-other"):
  with urllib.request.urlopen("http://"+host+":8080/receipt/"+nonce,timeout=5) as r: counts.append(json.load(r).get("count",0))
 print(model,"HTTP",status,"backend counts",*counts,flush=True)
 if (status,counts)!=(expect, [1,0] if backend==0 else ([0,1] if expect==200 else [0,0])): raise SystemExit("Unexpected routing or authorization result")
check("shared-model",20119,0,200)
check("other-model",20120,1,403 if os.environ["UC8_EXPECTED"]=="denied" else 200)
' < "$key_file"
