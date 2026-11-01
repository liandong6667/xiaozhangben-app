# -*- coding: utf-8 -*-
"""量"刚进 App 点加减号为什么卡"。

思路和 shot.py 一样走 CDP，区别是这个脚本不看画面，只在页面里埋探针，
然后照真实用户的样子在不同时刻点一次减号 / 加号，把耗时打出来。

关键手段：
  --cpu 6  把 CPU 降速 6 倍，近似一台中低端安卓机。
           桌面无头跑满 60 帧，不降速什么都量不出来。

用法：
  python .build/tools/measure_startup.py --cpu 6 --seed 800
  python .build/tools/measure_startup.py --cpu 6 --seed 800 --no-warm
"""
import json, sys, time, tempfile, subprocess, urllib.request, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shot import WS, cdp, wait_port, EDGE, PORT

URL = "http://127.0.0.1:8899/index.html"
KEY = "xiaozhangben.v3"

# 在页面自己的脚本之前跑：装长任务观察器 + 包住 hideCard/showCard
PRE = r"""
window.__lt = [];          // longtask 列表
window.__hit = [];         // 每次点击的耗时
window.__t0 = performance.now();
try{
  new PerformanceObserver(function(list){
    list.getEntries().forEach(function(e){
      window.__lt.push({at: Math.round(e.startTime), ms: Math.round(e.duration)});
    });
  }).observe({entryTypes: ["longtask"]});
}catch(e){}

/* 包住那两个函数：它们是在全局作用域里声明的，所以 window 上有。
   页面脚本还没执行，先用定时器盯着，出现就立刻包。 */
var __wrapT = setInterval(function(){
  if(typeof window.hideCard !== "function" || typeof window.showCard !== "function") return;
  clearInterval(__wrapT);
  ["hideCard", "showCard", "warmHome", "renderAll", "renderHome", "renderFlow",
   "paintCards", "paintBar", "syncNotices", "renderAutoBar", "load"].forEach(function(nm){
    var orig = window[nm];
    if(!orig || orig.__wrapped) return;
    var w = function(){
      var a = performance.now();
      var r = orig.apply(this, arguments);
      var b = performance.now();
      window.__hit.push({fn: nm, at: Math.round(a), ms: +(b - a).toFixed(2)});
      return r;
    };
    w.__wrapped = true;
    window[nm] = w;
  });
}, 0);
"""

# 在指定时刻点一次减号，等动画走完再点加号恢复
CLICK_AT = r"""
window.__seq = function(at, key){
  setTimeout(function(){
    var el = document.querySelector('[data-hide="' + key + '"]');
    if(el) el.click();
    setTimeout(function(){
      var b = document.querySelector('[data-show="' + key + '"]');
      if(b) b.click();
      setTimeout(function(){ window.__hit.push({fn: "done:" + key, at: Math.round(performance.now()), ms: 0}); }, 700);
    }, 700);
  }, at);
};
"""


def seed_js(n):
    """造 n 条账目，铺满最近两个月 —— 数量是"重排有多贵"的直接变量。"""
    return r"""
    (function(){
      var now = new Date(), recs = [], cats = ["food","study","daily","home","shop","traffic","fun","medical","other"];
      var peers = ["蜜雪冰城","老张热干面","学校书店","胖乖生活","公交","超市","奶茶","喝水","房租","理发"];
      for(var i = 0; i < %d; i++){
        var d = new Date(now.getTime() - (i * 3600 * 1000) * 3);
        recs.push({
          id: "p" + i, ts: d.getTime(), amt: 1 + (i %% 90),
          type: i %% 23 === 0 ? "income" : "expense",
          cat: cats[i %% cats.length], peer: peers[i %% peers.length],
          from: i %% 3 === 0 ? "微信" : (i %% 3 === 1 ? "支付宝" : ""),
          note: "", book: i %% 5 === 0 ? "study" : "daily", src: "notify"
        });
      }
      var st = {records: recs, books: [
        {id:"daily", name:"日常", icon:"🏠", color:"#DE6B45", budget:2000, def:true},
        {id:"study", name:"学习", icon:"📚", color:"#9B7EDE", budget:500}
      ], book: "all", hide: {}};
      localStorage.setItem("%s", JSON.stringify(st));
      return recs.length;
    })()
    """ % (n, KEY)


def main():
    cpu = 6
    seed = 800
    moments = [120, 320, 700, 1200, 2000, 3400]
    no_warm = False
    i = 1
    while i < len(sys.argv):
        a = sys.argv[i]
        if a == "--cpu":
            cpu = int(sys.argv[i + 1]); i += 2
        elif a == "--seed":
            seed = int(sys.argv[i + 1]); i += 2
        elif a == "--moments":
            moments = [int(x) for x in sys.argv[i + 1].split(",")]; i += 2
        elif a == "--no-warm":
            no_warm = True; i += 1
        else:
            i += 1

    prof = tempfile.mkdtemp(prefix="edgecdp_")
    proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--no-proxy-server",
                             "--hide-scrollbars", "--remote-debugging-port=%d" % PORT,
                             "--window-size=420,900",
                             "--user-data-dir=" + prof, "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not wait_port(PORT):
            sys.exit("Edge 没起来")
        ver = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json/version" % PORT).read())
        ws = WS(ver["webSocketDebuggerUrl"])
        mid = [0]

        def call(m, p=None):
            mid[0] += 1
            return cdp(ws, mid[0], m, p)

        tid = call("Target.createTarget", {"url": "about:blank"})["targetId"]
        pws = WS("ws://127.0.0.1:%d/devtools/page/%s" % (PORT, tid))
        pmid = [0]

        def pcall(m, p=None):
            pmid[0] += 1
            return cdp(pws, pmid[0], m, p)

        pcall("Page.enable")
        pcall("Runtime.enable")
        pcall("Emulation.setDeviceMetricsOverride",
              {"width": 420, "height": 900, "deviceScaleFactor": 2, "mobile": True})
        pcall("Emulation.setCPUThrottlingRate", {"rate": cpu})

        def ev(expr):
            r = pcall("Runtime.evaluate", {"expression": expr, "returnByValue": True})
            if "exceptionDetails" in r:
                return {"__err": str(r["exceptionDetails"])[:200]}
            return r.get("result", {}).get("value")

        # 第一次导航：写入种子数据
        pcall("Page.navigate", {"url": URL})
        time.sleep(3.0)
        n = ev(seed_js(seed))
        print("种子数据：%s 条" % n)

        # 第二次导航：真正的冷启动测量
        pre = PRE + CLICK_AT
        if no_warm:
            pre += "window.XZB_NO_ANIM=false;"
        pcall("Page.addScriptToEvaluateOnNewDocument", {"source": pre})
        nav_at = time.time()
        pcall("Page.navigate", {"url": URL})

        # 按 moments 排好的时刻依次点减号（第 n 秒点第 n 个）
        plan = ",".join("window.__seq(%d, 'month')" % m for m in moments)
        ev(plan)

        time.sleep((max(moments) + 4000) / 1000.0)

        lt = ev("JSON.stringify(window.__lt)") or "[]"
        hit = ev("JSON.stringify(window.__hit)") or "[]"
        dd = ev("JSON.stringify({rs: document.readyState, n: (state.records||[]).length})") or "{}"
        lt = json.loads(lt); hit = json.loads(hit); dd = json.loads(dd)
        print("页面状态：%s" % dd)

        print("\n===== 长任务（>50ms 才会被记到）=====")
        if not lt:
            print("  没有")
        for x in lt:
            print("  在 %5d ms  持续 %4d ms" % (x["at"], x["ms"]))

        print("\n===== 每次点击的耗时 =====")
        for x in hit:
            if x["fn"].startswith("done:"):
                print("        ---- %d ms 处一轮结束" % x["at"])
            else:
                print("  %5d ms 处  %-9s  %6.2f ms" % (x["at"], x["fn"], x["ms"]))
    finally:
        try:
            proc.kill()
        except Exception:
            pass
        time.sleep(0.4)
        try:
            import shutil
            shutil.rmtree(prof, ignore_errors=True)
        except Exception:
            pass


if __name__ == "__main__":
    main()
