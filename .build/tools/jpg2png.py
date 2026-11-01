# -*- coding: utf-8 -*-
"""把 JPG 转成 PNG —— 本机没有 Pillow / ImageMagick，但有 Edge。

原理：用 CDP cri 一个无头 Edge，把图片以 dataURL 塞进 <img>，
用 canvas 画一遍再 toDataURL('image/png') 取回来。零第三方依赖。

用法：python jpg2png.py <输入.jpg> <输出.png>
"""
import base64, json, os, shutil, subprocess, sys, tempfile, time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shot import WS, cdp, wait_port, EDGE

PORT = 9334


def convert(src, dst):
    data = base64.b64encode(open(src, 'rb').read()).decode()
    js = ("new Promise(function(res){var i=new Image();"
          "i.onload=function(){var c=document.createElement('canvas');"
          "c.width=i.naturalWidth;c.height=i.naturalHeight;"
          "var x=c.getContext('2d');x.fillStyle='#fff';"
          "x.fillRect(0,0,c.width,c.height);x.drawImage(i,0,0);"
          "res(JSON.stringify({w:c.width,h:c.height,d:c.toDataURL('image/png')}));};"
          "i.onerror=function(){res(JSON.stringify({err:'decode failed'}));};"
          "i.src='data:image/jpeg;base64," + data + "';})")

    prof = tempfile.mkdtemp(prefix='edgejpg_')
    proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--no-proxy-server",
                             "--remote-debugging-port=%d" % PORT,
                             "--window-size=200,200", "--user-data-dir=" + prof,
                             "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not wait_port(PORT):
            raise SystemExit('Edge 没起来')
        ver = json.loads(urllib.request.urlopen(
            "http://127.0.0.1:%d/json/version" % PORT).read())
        bws = WS(ver["webSocketDebuggerUrl"])
        mid = [0]

        def bcall(m, p=None):
            mid[0] += 1
            return cdp(bws, mid[0], m, p)

        tid = bcall("Target.createTarget", {"url": "about:blank"})["targetId"]
        pws = WS("ws://127.0.0.1:%d/devtools/page/%s" % (PORT, tid))
        pmid = [0]

        def pcall(m, p=None):
            pmid[0] += 1
            return cdp(pws, pmid[0], m, p)

        pcall("Page.enable")
        pcall("Page.navigate", {"url": "about:blank"})
        time.sleep(0.6)
        r = pcall("Runtime.evaluate", {"expression": js, "awaitPromise": True,
                                       "returnByValue": True})
        val = r.get("result", {}).get("value")
        if not val:
            raise SystemExit('取不到画布数据: %s' % json.dumps(r)[:300])
        o = json.loads(val)
        if o.get('err'):
            raise SystemExit('图片解码失败')
        raw = base64.b64decode(o['d'].split(',', 1)[1])
        open(dst, 'wb').write(raw)
        print('已转换 %s → %s  %dx%d  %.1f KB' % (src, dst, o['w'], o['h'], len(raw) / 1024.0))
        return o['w'], o['h']
    finally:
        try:
            proc.terminate()
            proc.wait(timeout=8)
        except Exception:
            pass
        shutil.rmtree(prof, ignore_errors=True)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    convert(sys.argv[1], sys.argv[2])
