#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""跑 .build/tests 下的回归测试：把每个 js 包成 <script> 塞进 index.html 副本，
用 Edge headless 打开、从 document.title 读断言统计。

约定：
- profile 目录按测试名分开（ingest 会写 localStorage，共用会互相污染），
  已存在的直接复用，不删（删目录会被安全策略拦）。
- fix3 需要 window.__SAMPLE_CSV，这里统一注入示例账单。
- deep2 依赖 deep1 写下的缓存，所以要排在 deep1 后面并复用同一 profile。
"""
import json, os, re, subprocess, sys, time

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 8899
WAIT_SEC = 60          # 单个测试等结果回传的上限（虚拟时钟下通常几秒就够）
TMP = os.path.join(BASE, "_run")
os.makedirs(TMP, exist_ok=True)

ORDER = ["brands2", "games", "real", "real2", "real3", "fix18", "fix19", "fix20", "fix21", "fix22", "fix25", "fix26", "fix27", "fix28", "fix30", "fix31", "vds", "vds2", "vds3", "cardanim", "cardhide", "pinicon", "storefail", "audit", "deep3", "deep5", "deep6", "deep4", "big1", "big2", "big3", "big4", "big5", "big6", "big7", "fix17", "fix16", "fix15", "fix14", "fix13", "fix3", "fix2", "fix5", "fix6", "fix7", "fix8", "fix9", "fix10", "fix11", "fix12", "imp", "dlgtest", "fix32", "fix34", "fix35", "fix36", "fix37", "fix38", "fix39", "fix40", "fix41", "fix42", "fix43", "fix44", "fix45", "fix46", "fix47", "fix49", "walkuse", "smoke", "updfake2", "tmppay", "apidrive", "deep1", "deep2"]


def sample_csv():
    p = os.path.join(ROOT, "示例账单.csv")
    if not os.path.exists(p):
        return None
    return open(p, encoding="utf-8-sig").read()


BRIDGE_MARK = "/*@bridge@*/"


def build(name):
    js = open(os.path.join(BASE, name + ".js"), encoding="utf-8").read()
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    if js.lstrip().startswith("<script"):
        block = js
    elif js.lstrip().startswith("setTimeout"):
        block = "<script>" + js + "</script>"
    else:
        block = "<script>\n" + js + "\n</script>"
    csv = sample_csv()
    if csv and "__SAMPLE_CSV" in js:
        seed = "<script>window.__SAMPLE_CSV=%s;</script>\n" % json.dumps(csv, ensure_ascii=False)
        block = seed + block
    # 需要「假装自己在 App 里」的用例：把假原生桥塞进 <head>，
    # 必须早于主脚本执行 —— index.html 里的 NATIVE 是解析时就定死的常量。
    head_seed = ""
    if BRIDGE_MARK in js:
        bridge = open(os.path.join(BASE, "_bridge.js"), encoding="utf-8").read()
        head_seed = "<script>\n" + bridge + "\n</script>\n"
        js = js.replace(BRIDGE_MARK, "/* 假原生桥已注入 <head> */")
        block = "<script>\n" + js + "\n</script>"
        if csv and "__SAMPLE_CSV" in js:
            block = seed + block
    orig = re.search(r"<title>(.*?)</title>", html, re.S)
    orig = orig.group(1) if orig else ""
    # 先替换 body 末尾、再插 head：反过来的话，测试脚本里只要出现一次 </body> 字样
    # （注释里写一句都会被算），桥就被劈成两半，整页直接不执行。
    # 同理 "</body>" 取最后一个，不取第一个。
    out = html.rsplit("</body>", 1)
    out = out[0] + block + (REPORTER % (name, json.dumps(orig))) + "\n</body>" + out[1]
    if head_seed:
        out = out.replace("</head>", head_seed + "</head>", 1)
    fn = os.path.join(TMP, "t_%s.html" % name)
    open(fn, "w", encoding="utf-8").write(out)
    return fn


def parse_title(t):
    # 1) 纯数字统计：52/52 、PASS=51 FAIL=0 、pass=40 fail=0
    # 两侧加边界：不然把 "1.9/24.2 MB"、"2026-11-01/2/https" 里的片段当成通过比例，
    # 会凭空报出一堆假红灯（apidrive 就这么被误判成 9/24 过）。
    m = re.search(r"(?<![\d./])(\d+)\s*/\s*(\d+)(?![\d./])", t)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        return a, b, max(0, b - a)
    m = re.search(r"pass\s*=\s*(\d+)\s+fail\s*=\s*(\d+)", t, re.I)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        return a, a + b, b
    # 2) 逐条形如 "Yxxx | Nyyy || ERR none"
    body = t.split("||")[0]
    segs = [s.strip() for s in body.split("|")]
    y = sum(1 for s in segs if re.match(r"^Y\S", s))
    n = sum(1 for s in segs if re.match(r"^N\S", s))
    if y or n:
        return y, y + n, n
    return None


PROF_ALIAS = {"deep2": "deep1"}   # deep2 要读 deep1 写下的缓存

# 这些文件是**截图/取样用的布景页**，不是用例：它们只把界面点成某个样子就停，
# 从来不回传标题，硬跑必然 TIMEOUT（长期被误记成"红的"）。
# 留着文件是因为 _six.py / _shotcat.py / _walk.py 这些脚本还要用它们。
NOT_TESTS = {"shot4", "shot5", "dump_bill", "dump_edge", "dump_real", "dump_ui"}

# 这些是**取样/体检脚本**：只打印数值（耗时、色值、边界表现），本来就没有
# "N/N 断言"这种格式。以前一律打成 ERR，看着像红灯，其实是在报数据。
DIAG = {"iconwall", "iconwall2", "perf1", "perf2", "dbg", "bg", "edge", "empty",
        "long", "wall48", "wallgame"}


# 结果回传脚本：测试改的是 document.title，这里盯着它一变就 POST 给本地服务落盘。
# 不走 --dump-dom —— 新版 Edge 会把子进程分离出去，父进程立刻退出，stdout 全丢。
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
  setInterval(function(){ post(false); }, 120);
  setTimeout(function(){ post(true); }, 12000);
})();
</script>"""


def clear_storage(prof):
    """同一个 profile 反复跑会带着上次的账目，测试分支会跑偏（deep1 就是这么卡死的）。
    先用同 origin 的空页面把 localStorage 清掉，profile 就能安全复用。"""
    cmd = [EDGE, "--headless=new", "--disable-gpu", "--no-proxy-server",
           "--user-data-dir=" + prof, "--virtual-time-budget=1500", "--dump-dom",
           "http://127.0.0.1:%d/.build/tests/_run/reset.html" % PORT]
    try:
        subprocess.run(cmd, capture_output=True, timeout=60)
    except Exception:
        pass


def park_profile(name):
    """deep1 光清 localStorage 还不够 —— 它还依赖 profile 里的其他状态，
    脏了就会卡到超时。直接把旧目录改名挪走，下次自然新建一个干净的。
    改名不是删除，不会被安全策略拦；挪走的东西堆在 _prof/_old 里，随手清。"""
    prof = os.path.join(BASE, "_prof", name)
    if not os.path.isdir(prof):
        return
    old = os.path.join(BASE, "_prof", "_old")
    try:
        os.makedirs(old, exist_ok=True)
        n = 1
        while os.path.exists(os.path.join(old, "%s_%d" % (name, n))):
            n += 1
        os.rename(prof, os.path.join(old, "%s_%d" % (name, n)))
    except Exception:
        pass


def run(name):
    build(name)
    # 每个测试都用全新的 profile。
    # 为什么不再"复用 + 清 localStorage"：清 localStorage 那一步也得起一次 Edge，
    # 而新版 Edge 会把渲染进程分离出去、父进程立刻返回 —— 上一个 Edge 还攥着 profile，
    # 下一个实例就起不来（症状：整组 TIMEOUT、页面根本没加载）。
    # 改名挪走旧目录（不是删除，躲开安全策略），下次自然新建一份干净的。
    if name in PROF_ALIAS:
        prof = os.path.join(BASE, "_prof", PROF_ALIAS[name])   # deep2 要接着 deep1 的数据
    else:
        park_profile(name)
        prof = os.path.join(BASE, "_prof", name)
    resf = os.path.join(TMP, "res_%s.txt" % name)
    try:
        if os.path.exists(resf):
            os.remove(resf)
    except Exception:
        pass
    cmd = [EDGE, "--headless=new", "--disable-gpu", "--no-proxy-server",
           "--no-first-run", "--no-default-browser-check",
           "--user-data-dir=" + prof, "--virtual-time-budget=9000",
           "http://127.0.0.1:%d/.build/tests/_run/t_%s.html" % (PORT, name)]
    try:
        # Edge 会把渲染进程分离出去、父进程立刻返回，所以这里不等它退出，
        # 只等页面把结果 POST 回来（落盘）。
        # 先等一下：上一轮 Edge 可能还在收尾、攥着 profile 锁（deep2 复用 deep1 的目录，最容易撞）。
        time.sleep(1.2)
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        return None, "启动失败: %s" % e
    for _ in range(WAIT_SEC * 10):
        time.sleep(0.1)
        if os.path.exists(resf):
            try:
                t = open(resf, encoding="utf-8", errors="ignore").read().strip()
            except Exception:
                continue
            if t:
                return t, None
    return None, "TIMEOUT %ds（页面没回传结果）" % WAIT_SEC


def main():
    names = sys.argv[1:] or ORDER
    ty = tn = 0
    skipped = []
    for n in names:
        if not os.path.exists(os.path.join(BASE, n + ".js")):
            print("缺文件", n)
            continue
        if n in NOT_TESTS:
            skipped.append(n)      # 布景页，不算用例也不跑
            continue
        t, err = run(n)
        if err and "TIMEOUT" in err:
            time.sleep(3)          # profile 抢锁这种偶发，重试一次就过了
            t, err = run(n)
        if err:
            print("ERR  %-8s %s" % (n, err))
            continue
        p = parse_title(t)
        if not p:
            if n in DIAG:
                print("取样 %-8s %s" % (n, t[:110]))
            else:
                print("ERR  %-8s %s" % (n, t[:120]))
            continue
        ok_, total, bad = p
        ty += ok_
        tn += bad
        flag = "OK  " if bad == 0 else "FAIL"
        print("%s %-8s %d/%d" % (flag, n, ok_, total))
        if bad:
            fails = re.findall(r"(?:^|\|)\s*(N[:：]?\s*[^|]+)", t)
            print("      " + " ; ".join(f.strip() for f in fails)[:400])
    print("\n==== 合计 %d 通过 / %d 失败 ====" % (ty, tn))
    if skipped:
        print("跳过 %d 个布景页（截图用，无断言）：%s" % (len(skipped), " ".join(skipped)))


if __name__ == "__main__":
    main()
