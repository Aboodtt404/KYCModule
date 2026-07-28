#!/usr/bin/env python3
"""Host-rewrite proxy: :8943 -> 127.0.0.1:4943 with Host pinned to the II canister subdomain.

The IC HTTP gateway routes canisters by Host header; the cloudflared quick tunnel
forwards the public trycloudflare hostname, which the gateway doesn't recognize.
This proxy pins Host so the tunneled II origin always resolves to the local II canister.
"""
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

II_HOST = "umunu-kh777-77774-qaaca-cai.localhost:4943"  # II 2.0 frontend canister
HOP = {"connection", "keep-alive", "transfer-encoding", "te", "trailer",
       "proxy-authenticate", "proxy-authorization", "upgrade", "host",
       "accept-encoding"}


_CONFIG_CACHE = {}


def config_blob():
    """The latest II frontend wasm traps serving /.config.did.bin (asset certification
    bug); the identical candid blob is inlined base64 in index.html's
    data-canister-config attribute, so we synthesize the response from there."""
    if "blob" not in _CONFIG_CACHE:
        import base64
        import re
        c = http.client.HTTPConnection("127.0.0.1", 4943, timeout=60)
        c.request("GET", "/", headers={"Host": II_HOST})
        html = c.getresponse().read().decode("utf8", "replace")
        c.close()
        m = re.search(r'data-canister-config="([^"]+)"', html)
        b64 = m.group(1)
        b64 += "=" * (-len(b64) % 4)
        _CONFIG_CACHE["blob"] = base64.b64decode(b64)
    return _CONFIG_CACHE["blob"]


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _proxy(self):
        if self.command == "GET" and self.path.split("?")[0] == "/.config.did.bin":
            data = config_blob()
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        body = None
        n = self.headers.get("Content-Length")
        if n:
            body = self.rfile.read(int(n))
        c = http.client.HTTPConnection("127.0.0.1", 4943, timeout=60)
        hdrs = {k: v for k, v in self.headers.items() if k.lower() not in HOP}
        hdrs["Host"] = II_HOST
        c.request(self.command, self.path, body=body, headers=hdrs)
        r = c.getresponse()
        data = r.read()
        self.send_response(r.status)
        for k, v in r.getheaders():
            if k.lower() not in HOP and k.lower() != "content-length":
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
        c.close()

    do_GET = do_POST = do_PUT = do_DELETE = do_HEAD = do_OPTIONS = _proxy

    def log_message(self, *a):
        pass


print("II host-rewrite proxy on :8943 ->", II_HOST, flush=True)
ThreadingHTTPServer(("127.0.0.1", 8943), H).serve_forever()
