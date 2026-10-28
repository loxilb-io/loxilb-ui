#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
key_file=${1:-private/support-key}
[ -f "$key_file" ] || { echo 'Provide a protected support API key file.' >&2; exit 1; }
gateway=$(docker compose ps -q gateway); [ -n "$gateway" ]
vip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$gateway")
docker compose exec -T -e "UC8_VIP=$vip" client python -c '
import json,os,sys,uuid,urllib.request,urllib.error
key=sys.stdin.read().strip(); assert key
base="http://backend:8080"; url="http://"+os.environ["UC8_VIP"]+":20119/v1/chat/completions"
def case(label,model,credential):
 nonce="uc8-"+label+"-"+uuid.uuid4().hex
 body=json.dumps({"model":model,"messages":[{"role":"user","content":"hello"}]}).encode()
 headers={"Content-Type":"application/json","X-Test-Nonce":nonce}
 if credential: headers["X-Api-Key"]=key
 try:
  with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=headers),timeout=10) as r: status=r.status
 except urllib.error.HTTPError as e: status=e.code
 with urllib.request.urlopen(base+"/receipt/"+nonce,timeout=5) as r: count=json.load(r).get("count",0)
 print(label,"HTTP",status,"backend count",count,flush=True)
 return status,count
results=[case("allowed","shared-model",True),case("denied-model","other-model",True),case("missing-key","shared-model",False)]
if results!=[(200,1),(403,0),(401,0)]: raise SystemExit("Unexpected access result")
' < "$key_file"
