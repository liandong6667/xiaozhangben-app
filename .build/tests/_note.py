#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""看补记面板（备注框 + 底部那行小字是否已删）和记完之后首页那条明细。
用法：先起 nocache_serve.py 8899，再 python _note.py
"""
import io, os, subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
SRC = os.path.join(ROOT, "index.html")

BOOT = """
function ready(fn){
  var n = 0;
  (function go(){
    n++;
    if(typeof load === "function" && document.getElementById("homeStack")){ fn(); return; }
    if(n > 60){ document.title = "ERR"; return; }
    setTimeout(go, 100);
  })();
}
function fire(el, ev){ el.dispatchEvent(new Event(ev || "input")); }
"""

STEPS = {
    # 补记面板本身：看备注框和底部（那行小字应该没了）
    "panel": """
      openAddSheet();
      var s = document.getElementById("sheetAdd");
      s.style.transition = "none"; s.style.transform = "translateY(0)";
      document.getElementById("mask").style.transition = "none";
    """,
    # 输入一句话 + 填备注 → 记上 → 首页那条长什么样
    "after": """
      openAddSheet();
      var q = document.getElementById("qi");
      q.value = "今中午和朋友吃火锅花了100"; fire(q);
      previewManual();
      document.getElementById("qiNote").value = "AA，我先垫的"; fire(document.getElementById("qiNote"));
      document.getElementById("btnAdd").click();
      if(typeof closeSheets === "function") closeSheets();
      goto("home");
      renderHome();
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

FRAME = """<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#FBF7F2;overflow:hidden;height:900px}
iframe{width:420px;height:900px;border:0;display:block;margin:0 auto;
  box-shadow:0 0 0 1px rgba(0,0,0,.06)}</style>
</head><body><iframe src="_note_%s.html"></iframe></body></html>"""


def shot(name, code, h=900):
    html = io.open(SRC, encoding="utf-8").read()
    js = "<script>" + BOOT + "</script>\n" + (TMPL % code)
    io.open(os.path.join(ROOT, "_note_%s.html" % name), "w", encoding="utf-8").write(
        html.replace("</body>", js + "\n</body>", 1))
    io.open(os.path.join(ROOT, "_noteframe.html"), "w", encoding="utf-8").write(FRAME % name)
    png = os.path.join(ROOT, ".build", "note_%s.png" % name)
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=2",
                    "--virtual-time-budget=9000", "--window-size=504,%d" % (h + 20),
                    "--screenshot=" + png,
                    "http://127.0.0.1:8899/_noteframe.html"], timeout=120)
    print(os.path.basename(png), os.path.exists(png))


for n in STEPS:
    shot(n, STEPS[n])
