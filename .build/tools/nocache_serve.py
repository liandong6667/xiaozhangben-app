"""给预览用的静态服务：强制不缓存。

Python 自带的 http.server 不发 Cache-Control，浏览器会用启发式缓存把旧页面留在面板里，
改完代码看着像"没改"。这里统一加 no-store，刷新就一定拿到磁盘上最新的一份。
"""
import functools
import http.server
import os
import re
import socketserver

ROOT = r"D:\小账本"
PORT = 8897          # 预览用；测试用 8899，命令行第一个参数可改
RESDIR = os.path.join(ROOT, ".build", "tests", "_run")


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass

    def _safe(self, s):
        return re.sub(r"[^\w.-]", "_", s or "unknown")

    def handle_one_request(self):
        # 浏览器关页面时会强行断连，Windows 抛 10054，属于正常现象，别刷一屏 traceback
        try:
            super().handle_one_request()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            self.close_connection = True

    def _write_result(self, data):
        """测试页把 document.title 回传到这里落盘。

        为什么不靠 --dump-dom：新版 Edge 启动后会把子进程分离出去，父进程立刻退出，
        标准输出直接丢掉 —— 读到的永远是空。落盘这条路不依赖 stdout。
        """
        try:
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            name = self._safe((q.get("name") or ["unknown"])[0])
            os.makedirs(RESDIR, exist_ok=True)
            with open(os.path.join(RESDIR, "res_%s.txt" % name), "wb") as f:
                f.write(data or b"")
        except Exception:
            pass

    def do_POST(self):
        if self.path.startswith("/__result"):
            n = int(self.headers.get("Content-Length") or 0)
            self._write_result(self.rfile.read(n) if n > 0 else b"")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"ok")
            return
        self.send_error(404)

    def do_GET(self):
        # 兜底：个别环境不允许 POST 时用 GET 传（内容走查询串）
        if self.path.startswith("/__result"):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            d = (q.get("d") or [""])[0]
            self._write_result(d.encode("utf-8"))
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"ok")
            return
        super().do_GET()



if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        PORT = int(sys.argv[1])
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(Handler, directory=ROOT)
    with socketserver.TCPServer(("127.0.0.1", PORT), handler) as httpd:
        print("serving %s at http://127.0.0.1:%d (no-cache)" % (ROOT, PORT))
        httpd.serve_forever()
