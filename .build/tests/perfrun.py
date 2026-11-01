#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""量「首页加减号第一次点为什么卡」。

和 runtests.py 的区别只有一个但很致命：**不带 --virtual-time-budget**。
虚拟时钟下 performance.now() 在同步代码里不前进，量性能全是 0。

用法：python .build/tests/perfrun.py [perf1] [次数]
前提：127.0.0.1:8899 上已经有静态服务（和 runtests.py 共用）。
"""
import json, os, re, subprocess, sys, time

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 8899
TMP = os.path.join(BASE, "_run")
os.makedirs(TMP, exist_ok=True)

REPORTER = """<script>
(function(){
  var NAME = "%s";
  var init = %s;
  var sent = false;
  function post(force){
    if(sent) return;
    var t = document.title || "";
    if(!force && (!t || t === init)) return;
    sent = true;
    try{
      fetch("/__result?name=" + NAME, {method:"POST", cache:"no-store",
            headers:{"Content-Type":"text/plain;charset=UTF-8"}, body:t});
    }catch(e){}
  }
  setInterval(function(){ post(false); }, 100);
  setTimeout(function(){ post(true); }, 25000);
})();
</script>"""


def build(name):
    js = open(os.path.join(BASE, name + ".js"), encoding="utf-8").read()
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    block = "<script>\n" + js + "\n</script>"
    orig = re.search(r"<title>(.*?)</title>", html, re.S)
    orig = orig.group(1) if orig else ""
    out = html.replace("</body>", block + (REPORTER % (name, json.dumps(orig))) + "\n</body>", 1)
    fn = os.path.join(TMP, "p_%s.html" % name)
    with open(fn, "w", encoding="utf-8") as f:
        f.write(out)
    return fn


def run_once(name, idx):
    prof = os.path.join(TMP, "_pprof", "%s_%d" % (name, idx))
    resf = os.path.join(TMP, "res_%s.txt" % name)
    for p in (resf,):
        try:
            if os.path.exists(p):
                os.remove(p)
        except Exception:
            pass
    cmd = [EDGE, "--headless=new", "--no-proxy-server",
           "--no-first-run", "--no-default-browser-check",
           "--window-size=412,915",
           "--force-device-scale-factor=1",
           "--user-data-dir=" + prof,
           "http://127.0.0.1:%d/.build/tests/_run/p_%s.html" % (PORT, name)]
    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(400):          # 等最多 40s
        time.sleep(0.1)
        if os.path.exists(resf):
            try:
                t = open(resf, encoding="utf-8", errors="ignore").read().strip()
            except Exception:
                continue
            if t:
                return t
    return None


def main():
    name = sys.argv[1] if len(sys.argv) > 1 else "perf1"
    times = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    build(name)
    for i in range(times):
        t = run_once(name, i)
        print("--- 第 %d 次 ---" % (i + 1))
        print(t if t else "TIMEOUT（页面没回传）")
        time.sleep(1.0)


if __name__ == "__main__":
    main()
