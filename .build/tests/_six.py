#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""六个问题的「改前 / 改后」对照截图。
用法：python _six.py before|after
before 用 .build/before-demo.html，after 用 在线预览/index.html。
产物：.build/six_<tag>_<name>.png
"""
import os, io, subprocess, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

tag = sys.argv[1] if len(sys.argv) > 1 else "before"
SRC = os.path.join(ROOT, ".build", "before-demo.html") if tag == "before" \
      else os.path.join(ROOT, "在线预览", "index.html")

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

STEPS = {
    # 1+2：记一笔，输入「中午食堂吃饭15」→ 看预览卡（商户名 / 是否告诉你认成哪家店）
    "pv": """
      openAddSheet();
      var q = document.getElementById("qi");
      q.value = "中午食堂吃饭15";
      q.dispatchEvent(new Event("input", {bubbles:true}));
      previewManual();
      fix();
    """,
    # 2：换一句带店名的，专门看「认成哪家店」
    "pv2": """
      openAddSheet();
      var q = document.getElementById("qi");
      q.value = "星巴克拿铁32";
      q.dispatchEvent(new Event("input", {bubbles:true}));
      previewManual();
      fix();
    """,
    # 3：记一笔底部的分类 chips（最右那个「＋ 更多」）
    "chips": """
      openAddSheet();
      fix();
      var c = document.getElementById("catChips");
      if(c) c.scrollIntoView({block:"end"});
    """,
    # 4：明细行那行灰色小字
    "row": """
      goto("flow");
    """,
    # 5：选图标 → 添加器（两行右侧的勾）
    "adder": """
      openIconPick(function(){});
      fix();
      openIcAdd();
    """,
    # 6：账本卡片右下角的设置按钮
    "books": """
      goto("stats");
      renderBooks();
    """,
}

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
"""

# 视口固定 504（headless 的怪癖），iframe 还是按手机 420 渲染，
# 再整体放大 1.2 倍正好铺满 504 —— 既不裁边，也不用留灰条。
FRAME = """<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#FBF7F2;overflow:hidden;height:860px}
iframe{width:420px;height:860px;border:0;display:block;margin:0 auto;
  box-shadow:0 0 0 1px rgba(0,0,0,.06)}</style>
</head><body><iframe src="_six_%s.html"></iframe></body></html>"""


def shot(name, code, h=860):
    html = io.open(SRC, encoding="utf-8").read()
    js = "<script>" + FIX + BOOT + "</script>\n" + (TMPL % code)
    out = os.path.join(ROOT, "_six_%s.html" % name)
    io.open(out, "w", encoding="utf-8").write(html.replace("</body>", js + "\n</body>", 1))
    frame = os.path.join(ROOT, "_sixframe.html")
    io.open(frame, "w", encoding="utf-8").write(FRAME % name)
    png = os.path.join(ROOT, ".build", "six_%s_%s.png" % (tag, name))
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=2",
                    "--virtual-time-budget=9000", "--window-size=504,%d" % (h + 20),
                    "--screenshot=" + png,
                    "http://127.0.0.1:8899/_sixframe.html"], timeout=120)
    print(os.path.basename(png), os.path.exists(png))


if __name__ == "__main__":
    names = sys.argv[2:] or list(STEPS)
    for n in names:
        shot(n, STEPS[n])
