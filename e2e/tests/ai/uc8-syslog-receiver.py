"""QA TLS syslog receiver: retain only counts for one synthetic request."""
import json, os, socketserver, ssl, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

wanted = os.environ['UC8_REQUEST_ID']
lock = threading.Lock()
result = {'matches': 0, 'complete': False, 'status200': False, 'correlated': False}
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('/fixture/server.crt', '/fixture/server.key')

class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        try:
            with context.wrap_socket(self.request, server_side=True) as sock:
                stream = sock.makefile('rb')
                while True:
                    prefix = bytearray()
                    while True:
                        b = stream.read(1)
                        if not b: return
                        if b == b' ': break
                        if not b.isdigit() or len(prefix) > 8: return
                        prefix.extend(b)
                    length = int(prefix)
                    if length > 1048576: return
                    frame = stream.read(length)
                    if len(frame) != length: return
                    start = frame.find(b'{')
                    if start < 0: continue
                    try: record = json.loads(frame[start:])
                    except (ValueError, UnicodeError): continue
                    if record.get('request_id') != wanted: continue
                    with lock:
                        result['matches'] += 1
                        result['complete'] |= record.get('event_type') == 'data.ai.complete'
                        result['status200'] |= (record.get('outcome') or {}).get('status') == 200
                        result['correlated'] |= record.get('event_type') == 'data.ai.complete' and (record.get('outcome') or {}).get('status') == 200
        except (OSError, ssl.SSLError, ValueError): pass

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

class Receipt(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/receipt': self.send_error(404); return
        with lock: data = json.dumps(result).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(data)
    def log_message(self, *_args): pass

threading.Thread(target=Server(('0.0.0.0', 6514), Handler).serve_forever, daemon=True).start()
ThreadingHTTPServer(('0.0.0.0', 8081), Receipt).serve_forever()
