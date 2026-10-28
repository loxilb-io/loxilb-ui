#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
key_file=${1:-private/support-key}; [ -f "$key_file" ] || { echo 'Protected key file not found.' >&2; exit 1; }
gateway=$(docker compose ps -q gateway); [ -n "$gateway" ]
vip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$gateway")
docker compose exec -T -e "UC8_VIP=$vip" client python -c '
import json,os,sys,uuid,urllib.request,urllib.error
key=sys.stdin.read().strip(); assert key
url="http://"+os.environ["UC8_VIP"]+":20119/v1/chat/completions"; base="http://backend:8080"; seen=[]
for i in range(40):
 nonce="uc8-tpm-"+uuid.uuid4().hex
 data=json.dumps({"model":"shared-model","messages":[{"role":"user","content":"hi"}],"max_tokens":16}).encode()
 h={"Content-Type":"application/json","X-Test-Nonce":nonce,"X-Api-Key":key}; reason=""
 try:
  with urllib.request.urlopen(urllib.request.Request(url,data=data,headers=h),timeout=10) as r:status=r.status
 except urllib.error.HTTPError as e:
  status=e.code
  try:
   value=json.loads(e.read()); reason=str(value.get("error", ""))[:100]
  except Exception:reason="unparsed"
 with urllib.request.urlopen(base+"/receipt/"+nonce,timeout=5) as r:count=json.load(r).get("count",0)
 print("request",i+1,"HTTP",status,"backend count",count,"reason",reason,flush=True); seen.append((status,count,reason))
 if status==429:break
if not any(s==200 and c==1 for s,c,_ in seen) or not any(s==429 and c==0 and "token" in r.lower() for s,c,r in seen):raise SystemExit("TPM outcome not established; inspect effective limits")
' < "$key_file"
