# -*- coding: utf-8 -*-
"""真实场景模拟器：把一段 JS 跑在 index.html 里，打印它返回的文本。

为什么不用 --dump-dom / --eval 命令行：中文参数过长会被命令行层面吃掉，
这里用 CDP 直接把脚本内容送进页面，完全绕开命令行编码问题。

用法：
  python .build/tools/sim.py .build/tests/sim_real.js
  python .build/tools/sim.py .build/tests/sim_real.js --wait 2500 --url file:///D:/小账本/index.html
"""
import json, os, subprocess, sys, tempfile, time, shutil, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import shot

PORT = 9344


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    jsfile = sys.argv[1]
    url = "file:///D:/小账本/index.html"
    wait = 1500
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--wait":
            wait = int(sys.argv[i + 1]); i += 2
        elif sys.argv[i] == "--url":
            url = sys.argv[i + 1]; i += 2
        else:
            i += 1
    src = open(jsfile, encoding="utf-8").read()

    prof = tempfile.mkdtemp(prefix="xzb_sim_")
    proc = subprocess.Popen([shot.EDGE, "--headless=new", "--disable-gpu", "--no-proxy-server",
                             "--hide-scrollbars", "--remote-debugging-port=%d" % PORT,
                             "--window-size=480,900", "--user-data-dir=" + prof, "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not shot.wait_port(PORT):
            sys.exit("Edge 没起来")
        ver = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json/version" % PORT).read())
        ws = shot.WS(ver["webSocketDebuggerUrl"])
        mid = [0]

        def call(m, p=None):
            mid[0] += 1
            return shot.cdp(ws, mid[0], m, p)

        tgt = call("Target.createTarget", {"url": "about:blank"})
        tid = tgt["targetId"]
        pws = shot.WS("ws://127.0.0.1:%d/devtools/page/%s" % (PORT, tid))
        pmid = [0]

        def pcall(m, p=None):
            pmid[0] += 1
            return shot.cdp(pws, pmid[0], m, p)

        pcall("Page.enable")
        pcall("Runtime.enable")
        pcall("Emulation.setDeviceMetricsOverride",
              {"width": 480, "height": 900, "deviceScaleFactor": 2, "mobile": True})
        boot = ("window.__errs=[];"
                "window.addEventListener('error',function(e){window.__errs.push((e.message||'')"
                "+' @'+(e.filename||'').split('/').pop()+':'+(e.lineno||0));},true);"
                "window.addEventListener('unhandledrejection',function(e){window.__errs.push("
                "'promise: '+((e.reason&&e.reason.message)||e.reason));});")
        pcall("Page.addScriptToEvaluateOnNewDocument", {"source": boot})
        pcall("Page.navigate", {"url": url})
        time.sleep(wait / 1000.0)

        r = pcall("Runtime.evaluate", {
            "expression": "(function(){try{ return String(\n" + src + "\n); }"
                          "catch(e){ return 'SIM ERROR: ' + e.message + '\\n' + (e.stack||''); }})()",
            "returnByValue": True, "awaitPromise": True, "timeout": 120000})
        res = r.get("result", {})
        out = res.get("value")
        print(out if isinstance(out, str) else json.dumps(res, ensure_ascii=False))
        if r.get("exceptionDetails"):
            print("异常:", json.dumps(r["exceptionDetails"], ensure_ascii=False)[:600])
        e = pcall("Runtime.evaluate", {"expression": "window.__errs||[]", "returnByValue": True})
        errs = e.get("result", {}).get("value") or []
        if errs:
            print("\n[页面报错] " + json.dumps(errs, ensure_ascii=False))
    finally:
        try:
            proc.terminate(); proc.wait(timeout=8)
        except Exception:
            pass
        shutil.rmtree(prof, ignore_errors=True)


if __name__ == "__main__":
    main()
