#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""手动「用一遍」：拿带演示数据的预览副本，按真实点击顺序走一遍，每一步截一张图。
用法：先起 nocache_serve.py 8899，再 python _walk.py [step ...]
不带参数 = 全跑。
"""
import os, io, subprocess, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
SRC = os.path.join(ROOT, "在线预览", "index.html")

BOOT = """
function ready(fn){
  var n = 0;
  (function go(){
    n++;
    if(typeof load === "function" && document.getElementById("homeStack")){ fn(); return; }
    if(n > 60){ document.title = "ERR 没起来"; return; }
    setTimeout(go, 100);
  })();
}
"""

STEPS = {
    # 首页：账本卡片、本月、今天
    "home": "",
    # 记一笔：打一句话，看预览卡
    "add": """
      openAddSheet();
      var q = document.getElementById("qi");
      q.value = "中午食堂吃饭15 加了个鸡腿";
      q.dispatchEvent(new Event("input", {bubbles:true}));
      previewManual();
    """,
    # 分类面板：普通态
    "cat": """
      openAddSheet();
      openCatSheet();
      fix();
    """,
    # 分类面板：编辑态
    "catedit": """
      openAddSheet();
      openCatSheet();
      fix();
      document.getElementById("catEdit").click();
    """,
    # 「这笔算哪一类」→ 更多分类（从某条账点「改分类」进来的那层）
    "ucmore": """
      openAddSheet();
      ucMode = "single"; ucQ = [state.records[0]]; ucI = 0;
      openSheet("sheetUc"); ucRender();
      fix();
      setTimeout(function(){
        var m = document.getElementById("ucMore");
        if(m){ m.click(); fix(); }
      }, 250);
    """,
    # 选图标 + 添加器
    "icons": """
      openIconPick(function(){});
      fix();
      openIcAdd();
    """,
    # 账本面板
    "books": """
      openBookPicker();
    """,
    # 新建账本
    "newbook": """
      openNewBook();
    """,
    # 明细
    "flow": """ goto("flow"); """,
    # 统计
    "stats": """ goto("stats"); """,
    # 我的 / 设置
    "me": """ goto("me"); """,
}

# 面板是贴底滑上来的，截图要等动画停下 —— 直接掐掉 transition
FIX = """
    function fix(){
      ["sheetCat","sheetIcons","sheetBook","sheetNewBook","sheetAdd","mask"].forEach(function(id){
        var e = document.getElementById(id);
        if(e){ e.style.transition = "none"; }
      });
      var s = document.querySelector(".sheet.on");
      if(s) s.style.transform = "translateY(0)";
    }
"""

TMPL = """
<script>
setTimeout(function(){
  ready(function(){
    try{
      %s
    }catch(e){ document.title = "ERR " + (e && e.message); }
  });
}, 500);
</script>
<script>%s</script>
"""


FRAME = """<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#9a948d}iframe{width:420px;height:860px;border:0;display:block}</style>
</head><body><iframe src="_walk_%s.html"></iframe></body></html>"""


def shot(name, code):
    """截图要"手机宽度"，但 Edge headless 的 innerWidth 恒为 504（无视 --window-size），
    直接截 420 会把右边裁掉，看着像排版溢出。所以套一层 420px 宽的 iframe：
       外页视口 504，里面 iframe 420 —— 页面自己看到的就是 420。"""
    html = io.open(SRC, encoding="utf-8").read()
    js = (TMPL % (code, ""))
    # 把 fix() 提前定义好：塞在操作之前
    js = "<script>" + FIX + BOOT + "</script>\n" + js
    out = os.path.join(ROOT, "_walk_%s.html" % name)
    io.open(out, "w", encoding="utf-8").write(html.replace("</body>", js + "\n</body>", 1))
    frame = os.path.join(ROOT, "_walkframe.html")
    io.open(frame, "w", encoding="utf-8").write(FRAME % name)
    png = os.path.join(ROOT, ".build", "walk_%s.png" % name)
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=2",
                    "--virtual-time-budget=9000", "--window-size=470,880",
                    "--screenshot=" + png,
                    "http://127.0.0.1:8899/_walkframe.html"], timeout=120)
    print(os.path.basename(png), os.path.exists(png))


if __name__ == "__main__":
    names = sys.argv[1:] or list(STEPS)
    for n in names:
        shot(n, STEPS[n])
