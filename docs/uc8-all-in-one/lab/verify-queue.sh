#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
key_file=${1:-private/support-key}; [ -f "$key_file" ] || { echo 'Protected key file not found.' >&2; exit 1; }
gateway=$(docker compose ps -q gateway); [ -n "$gateway" ]
vip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$gateway")
docker compose exec -T -e "UC8_VIP=$vip" client python -c '
import json,os,sys,time,uuid,urllib.request,urllib.error,threading
key=sys.stdin.read().strip(); assert key
vip=os.environ["UC8_VIP"]; base="http://backend:8080"; url="http://"+vip+":20119/v1/chat/completions"; api="http://gateway:11111/netlox/v1/config/loadbalancer/all"
prefix="uc8-queue-"+uuid.uuid4().hex; names=[prefix+"-held",prefix+"-queued",prefix+"-overflow"]; result={}; threads=[]
body=json.dumps({"model":"shared-model","messages":[{"role":"user","content":"hello"}]}).encode()
def get(u):
 with urllib.request.urlopen(u,timeout=3) as r: return json.load(r)
def count(n):return get(base+"/receipt/"+n).get("count",0)
def post(n,hold=False):
 h={"Content-Type":"application/json","X-Test-Nonce":n,"X-Api-Key":key}
 if hold:h["X-Test-Hold"]="1"
 try:
  with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=h),timeout=15) as r:result[n]=r.status
 except urllib.error.HTTPError as e:result[n]=e.code
 except Exception as e:result[n]="transport-error:"+type(e).__name__
def start(n,hold=False):
 t=threading.Thread(target=post,args=(n,hold),daemon=True);threads.append(t);t.start();return t
def wait_for(f,seconds):
 end=time.monotonic()+seconds
 while time.monotonic()<end:
  if f():return True
  time.sleep(.05)
 return False
def queued():
 for x in get(api).get("lbAttr",[]):
  s=x.get("serviceArguments",{})
  if s.get("name")=="uc8-shared":return (s.get("fc_effective") or {}).get("queued",0)
 return 0
try:
 start(names[0],True)
 if not wait_for(lambda:count(names[0])==1,5):raise RuntimeError("holder did not arrive")
 start(names[1])
 if not wait_for(lambda:queued()==1,3):raise RuntimeError("waiter not observed")
 t=start(names[2]);t.join(3)
 overflow=(result.get(names[2]),count(names[2]));before=count(names[1]); print("queued before release",before,"overflow",overflow,flush=True)
 if overflow!=(429,0) or before!=0:raise RuntimeError("unexpected overflow")
finally:
 try:get(base+"/release/"+names[0])
 except Exception as e:print("release failed",type(e).__name__,flush=True)
 for t in threads:t.join(15)
print("held",result.get(names[0]),"queued",result.get(names[1]),"queued receipt",count(names[1]),flush=True)
if result.get(names[0])!=200 or result.get(names[1])!=200 or count(names[1])!=1:raise SystemExit("queue recovery failed")
' < "$key_file"
