# -*- coding: utf-8 -*-
"""测首页卡片收起 / 叫回来的"那一帧"到底掉了多久。

为什么不用 performance.now() 夹住 .click()：
  那只量到 JS 处理函数本身（几毫秒），真正让人感觉到"卡一下"的是
  **点击之后被交付的那一帧总时长**（处理函数 + 样式重算 + 布局 + 绘制 + 建合成层）。
  所以这里点完就盯着 rAF 的间隔：间隔 > 33ms 就是掉了帧，肉眼能看出来。

用法：python .build/tools/dropcheck.py <页面相对路径> [次数]
"""
import re
import statistics
import subprocess
import sys

EV = r"""
(function(){
  function once(){
    return new Promise(function(res){
      var prev = null, n = 0, clicked = false, out = {sync: 0, gaps: [], t: 0};
      function loop(ts){
        if(prev !== null) out.gaps.push(Math.round(ts - prev));
        prev = ts;
        if(!clicked && n === 3){
          clicked = true;
          var btn = document.getElementById("hmXMonth");
          /* 真手指是 pointerdown → pointerup → click 三步。
             程序化 .click() 不会派发 pointerdown，这里补上，
             否则连"按下就预建合成层"这种优化都测不到。 */
          try{ btn.dispatchEvent(new PointerEvent("pointerdown", {bubbles: true})); }catch(e){}
          var s = performance.now();
          btn.click();
          out.sync = +(performance.now() - s).toFixed(1);
        }
        if(n < 40){ n++; requestAnimationFrame(loop); }
        else { out.firstGap = out.gaps[3]; out.worst = Math.max.apply(null, out.gaps.slice(2, 12)); res(out); }
      }
      requestAnimationFrame(loop);
    });
  }
  return once().then(function(r){ return JSON.stringify(r); });
})()
"""


def run(page, cpu=6, wait=2500):
    r = subprocess.run(["python", ".build/tools/shot.py", ".build/shots/_drop.png",
                        "http://127.0.0.1:8899/" + page,
                        "--wait", str(wait), "--cpu", str(cpu), "--eval", EV],
                       capture_output=True, text=True)
    m = re.search(r"EVAL: (.*)", r.stdout)
    if not m:
        return None
    import json
    return json.loads(json.loads(m.group(1)))


def main():
    page = sys.argv[1]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 6
    rows = []
    for i in range(n):
        d = run(page)
        if d:
            rows.append(d)
    if not rows:
        sys.exit("没测到数据")
    gaps = [r["firstGap"] for r in rows]
    worst = [r["worst"] for r in rows]
    sync = [r["sync"] for r in rows]
    print("页面 %s" % page)
    print("  点击那一帧   中位 %4.0fms  最小 %3.0f  最大 %3.0f   丢帧(>33) %d/%d" % (
        statistics.median(gaps), min(gaps), max(gaps), sum(1 for g in gaps if g > 33), len(gaps)))
    print("  前三帧最差   中位 %4.0fms  最小 %3.0f  最大 %3.0f" % (
        statistics.median(worst), min(worst), max(worst)))
    print("  处理函数     中位 %5.1fms  最小 %.1f  最大 %.1f" % (
        statistics.median(sync), min(sync), max(sync)))


if __name__ == "__main__":
    main()
