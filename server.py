import http.server
import socketserver
import json
import os
import sys
import mimetypes

mimetypes.add_type('video/quicktime', '.mov')

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class PortfolioSyncHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("[SERVER] %s\n" % (fmt % args))
        sys.stderr.flush()

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')

    def end_headers(self):
        self.send_cors_headers()
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/save':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length)
                data = json.loads(body.decode('utf-8'))

                target = os.path.join(DIRECTORY, 'assets', 'data', 'portfolio-data.json')
                os.makedirs(os.path.dirname(target), exist_ok=True)

                with open(target, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                resp = json.dumps({"success": True, "message": "Synced to all devices!"}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                self.log_message("portfolio-data.json UPDATED - all devices will see changes!")
            except Exception as e:
                self.log_message("ERROR: %s", str(e))
                resp = json.dumps({"success": False, "error": str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
        else:
            resp = b'{"error":"Not found"}'
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)

class ThreadedServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    banner = """
=======================================================
  Portfolio Real-Time Sync Server
  Port: %d
  Serving: %s
  Local:   http://localhost:%d
  Mobile:  http://0.0.0.0:%d
=======================================================
""" % (PORT, DIRECTORY, PORT, PORT)
    sys.stderr.write(banner)
    sys.stderr.flush()

    httpd = ThreadedServer(('0.0.0.0', PORT), PortfolioSyncHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        sys.stderr.write("\n[SERVER] Shutting down.\n")
        httpd.shutdown()
