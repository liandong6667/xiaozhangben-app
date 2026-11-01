# -*- coding: utf-8 -*-
"""用 CDP 截图（Edge 155 之后 `--screenshot` 在这台机器上不再落文件）。

为什么自己写：新版 Edge 把渲染进程分离出去，命令行截图的产物不知道飞哪去了；
`--dump-dom` 的 stdout 也是空的。CDP 是唯一还稳的路。
不依赖任何第三方库：websocket 握手和帧编解码手写，够用就行。

用法：
  python .build/tools/shot.py <输出png> <url> [--size 480x900] [--js "脚本"] [--wait 1500]
  --js    截图前在页面里执行一段 JS（比如 goto("books") 切到账本页）
  --wait  导航后等多少毫秒（默认 1500，给渲染和动画留时间）
"""
import base64, hashlib, json, os, socket, struct, subprocess, sys, tempfile, time, shutil
import urllib.request

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9333


class WS(object):
    """最小 websocket 客户端：只支持 text 帧，够 CDP 用。"""

    def __init__(self, url):
        assert url.startswith("ws://")
        rest = url[5:]
        hostport, _, path = rest.partition("/")
        host, _, port = hostport.partition(":")
        self.s = socket.create_connection((host, int(port or 80)), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        req = ("GET /%s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\n"
               "Connection: Upgrade\r\nSec-WebSocket-Key: %s\r\n"
               "Sec-WebSocket-Version: 13\r\n\r\n") % (path, hostport, key)
        self.s.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.s.recv(4096)
        if b"101" not in buf.split(b"\r\n")[0]:
            raise IOError("websocket 握手失败: %r" % buf[:120])
        self.buf = buf.split(b"\r\n\r\n", 1)[1]

    def _read(self, n):
        while len(self.buf) < n:
            d = self.s.recv(65536)
            if not d:
                raise IOError("连接断了")
            self.buf += d
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def send(self, text):
        data = text.encode("utf-8")
        hdr = bytearray([0x81])                      # FIN + text
        n = len(data)
        if n < 126:
            hdr.append(0x80 | n)
        elif n < 65536:
            hdr.append(0x80 | 126)
            hdr += struct.pack(">H", n)
        else:
            hdr.append(0x80 | 127)
            hdr += struct.pack(">Q", n)
        mask = os.urandom(4)
        hdr += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.s.sendall(bytes(hdr) + masked)

    def recv(self):
        while True:
            b1, b2 = self._read(2)
            op = b1 & 0x0F
            ln = b2 & 0x7F
            if ln == 126:
                ln = struct.unpack(">H", self._read(2))[0]
            elif ln == 127:
                ln = struct.unpack(">Q", self._read(8))[0]
            payload = self._read(ln)
            if op == 8:
                raise IOError("服务端关闭")
            if op == 9:                              # ping
                self.send("")                        # 简化：回个空帧，CDP 不会主动 ping
                continue
            if op in (1, 2):
                return payload.decode("utf-8", "replace")


def cdp(ws, mid, method, params=None):
    ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == mid:
            if "error" in msg:
                raise IOError("CDP %s 出错: %s" % (method, msg["error"]))
            return msg.get("result", {})


def wait_port(port, timeout=15):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            urllib.request.urlopen("http://127.0.0.1:%d/json/version" % port, timeout=1).read()
            return True
        except Exception:
            time.sleep(0.25)
    return False


def main():
    args = [a for a in sys.argv[1:]]
    if len(args) < 2:
        sys.exit(__doc__)
    out, url = args[0], args[1]
    size, js, wait = "480x900", "", 1500
    after, hold, play = "", 1200, 1.0
    ev, pre = "", ""
    cpu = 1
    i = 2
    while i < len(args):
        if args[i] == "--pre":
            pre = args[i + 1]; i += 2
        elif args[i] == "--cpu":
            cpu = int(args[i + 1]); i += 2
        elif args[i] == "--size":
            size = args[i + 1]; i += 2
        elif args[i] == "--js":
            js = args[i + 1]; i += 2
        elif args[i] == "--eval":
            ev = args[i + 1]; i += 2
        elif args[i] == "--wait":
            wait = int(args[i + 1]); i += 2
        elif args[i] == "--after":
            after = args[i + 1]; i += 2
        elif args[i] == "--hold":
            hold = int(args[i + 1]); i += 2
        elif args[i] == "--play":
            play = float(args[i + 1]); i += 2
        else:
            i += 1
    w, h = [int(x) for x in size.lower().split("x")]

    prof = tempfile.mkdtemp(prefix="edgecdp_")
    proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--no-proxy-server",
                             "--hide-scrollbars", "--remote-debugging-port=%d" % PORT,
                             "--window-size=%d,%d" % (w, h),
                             "--user-data-dir=" + prof, "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not wait_port(PORT):
            sys.exit("Edge 没起来（调试端口没通）")
        ver = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json/version" % PORT).read())
        ws = WS(ver["webSocketDebuggerUrl"])
        mid = [0]

        def call(m, p=None):
            mid[0] += 1
            return cdp(ws, mid[0], m, p)

        # 浏览器级 ws 只能建 target，真正的截图要连 target 自己的 ws
        tgt = call("Target.createTarget", {"url": "about:blank"})
        tid = tgt["targetId"]
        info = call("Target.getTargetInfo", {"targetId": tid})
        # 直接连 target：/devtools/page/<id>
        page_ws_url = "ws://127.0.0.1:%d/devtools/page/%s" % (PORT, tid)
        pws = WS(page_ws_url)
        pmid = [0]

        def pcall(m, p=None):
            pmid[0] += 1
            return cdp(pws, pmid[0], m, p)

        pcall("Page.enable")
        pcall("Emulation.setDeviceMetricsOverride",
              {"width": w, "height": h, "deviceScaleFactor": 2, "mobile": True})
        # --cpu 4 → 把 CPU 降速 4 倍，近似一台中低端安卓机。
        # 桌面无头跑满 60 帧看不出任何问题，降速之后才量得到"卡一下"。
        if cpu != 1:
            pcall("Emulation.setCPUThrottlingRate", {"rate": cpu})
        # 在页面自己的脚本跑之前注入：用来模拟"存储不可用""存储满"这类真实环境，
        # 也顺手挂一个错误收集器 —— 页面白屏时得知道第一句报错是什么。
        boot = ("window.__errs=[];"
                "window.addEventListener('error',function(e){"
                "window.__errs.push((e.message||'')+' @'+(e.filename||'').split('/').pop()"
                "+':'+(e.lineno||0));},true);"
                "window.addEventListener('unhandledrejection',function(e){"
                "window.__errs.push('promise: '+((e.reason&&e.reason.message)||e.reason));});")
        if pre:
            boot += pre
        pcall("Page.addScriptToEvaluateOnNewDocument", {"source": boot})
        pcall("Page.navigate", {"url": url})
        time.sleep(wait / 1000.0)
        if play != 1.0:
            # 慢放：动画时间轴按倍数拉长，才截得到"冲过头"那一帧。
            # CSS transition 和 WAAPI 都受这条控制。
            pcall("Animation.enable")
            pcall("Animation.setPlaybackRate", {"playbackRate": play})
        if js:
            pcall("Runtime.evaluate", {"expression": js, "awaitPromise": False})
            time.sleep(1.2)
        if after:
            pcall("Runtime.evaluate", {"expression": after, "awaitPromise": False})
            time.sleep(hold / 1000.0)
        if ev:
            r = pcall("Runtime.evaluate", {"expression": ev, "returnByValue": True,
                                           "awaitPromise": True})
            res = r.get("result", {})
            print("EVAL:", json.dumps(res.get("value", res), ensure_ascii=False))
            if r.get("exceptionDetails"):
                print("EVAL 异常:", json.dumps(r["exceptionDetails"], ensure_ascii=False)[:400])
        shot = pcall("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        data = base64.b64decode(shot["data"])
        d = os.path.dirname(os.path.abspath(out))
        if not os.path.isdir(d):
            os.makedirs(d)
        open(out, "wb").write(data)
        print("已截图 %s（%.0f KB）" % (out, len(data) / 1024.0))
    finally:
        try:
            proc.terminate()
            proc.wait(timeout=8)
        except Exception:
            pass
        shutil.rmtree(prof, ignore_errors=True)


if __name__ == "__main__":
    main()
