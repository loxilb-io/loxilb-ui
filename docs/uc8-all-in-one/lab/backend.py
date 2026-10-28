#!/usr/bin/env python3
"""Synthetic receipt/hold server; no inference engine or GPU simulation."""
import json, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
lock=threading.Condition(); receipts={}; released=set(); order=[]
class H(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def reply(self,data,code=200):
  raw=json.dumps(data).encode(); self.send_response(code); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(raw))); self.end_headers()
  try:self.wfile.write(raw)
  except (BrokenPipeError,ConnectionResetError):pass
 def do_GET(self):
  path=self.path.split('?',1)[0]; name=path.rsplit('/',1)[-1]
  with lock:
   if path.startswith('/release/'):
    released.add(name);lock.notify_all();return self.reply({'released':name})
   if path.startswith('/receipt/'):return self.reply(receipts.get(name,{'count':0}))
   if path=='/order':return self.reply(order)
  self.reply({'ready':True})
 def do_POST(self):
  raw=self.rfile.read(int(self.headers.get('Content-Length','0')))
  try:body=json.loads(raw)
  except ValueError:return self.reply({'error':'fixture_invalid_json'},400)
  name=self.headers.get('X-Test-Nonce','missing')
  record={'count':1,'name':name,'body':body,'headers':{k.lower():v for k,v in self.headers.items()},'arrival':time.time()}
  with lock:
   record['count']=receipts.get(name,{}).get('count',0)+1;receipts[name]=record;order.append(name)
   if self.headers.get('X-Test-Hold')=='1':lock.wait_for(lambda:name in released,timeout=60)
  time.sleep(int(self.headers.get('X-Test-Delay-Ms','0'))/1000)
  self.reply({'id':name,'choices':[{'message':{'role':'assistant','content':'synthetic response'}}],'usage':{'prompt_tokens':2,'completion_tokens':2,'total_tokens':4}})
ThreadingHTTPServer(('0.0.0.0',8080),H).serve_forever()
