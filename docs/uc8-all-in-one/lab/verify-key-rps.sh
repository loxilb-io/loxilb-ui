#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
key_file=${1:-private/support-key}
[ -f "$key_file" ] || { echo 'Protected key file not found.' >&2; exit 1; }
gateway=$(docker compose ps -q gateway); [ -n "$gateway" ]
vip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$gateway")
docker compose exec -T -e "UC8_VIP=$vip" client python -c '
import json,os,sys,time,uuid,urllib.request,urllib.error
key=sys.stdin.read().strip(); assert key
base="http://backend:8080"; url="http://"+os.environ["UC8_VIP"]+":20119/v1/chat/completions"
def request(label):
 nonce="uc8-rps-"+label+"-"+uuid.uuid4().hex
 body=json.dumps({"model":"shared-model","messages":[{"role":"user","content":"hello"}]}).encode()
 headers={"Content-Type":"application/json","X-Test-Nonce":nonce,"X-Api-Key":key}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=headers),timeout=10) as r: status=r.status
 except urllib.error.HTTPError as e: status=e.code
 with urllib.request.urlopen(base+"/receipt/"+nonce,timeout=5) as r: count=json.load(r).get("count",0)
 print(label,"HTTP",status,"backend count",count,flush=True); return status,count
time.sleep(2); first=request("first"); second=request("second"); time.sleep(2); recovered=request("refilled")
if [first,second,recovered]!=[(200,1),(429,0),(200,1)]: raise SystemExit("Unexpected quota result; check competing limits and request timing")
' < "$key_file"
