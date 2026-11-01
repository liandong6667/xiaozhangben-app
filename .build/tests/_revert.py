#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""复看两处：记一笔的分类 chips（「＋ 更多」淡黄底）、账本卡片（⚙️ 回到原样）。
用法：先起 nocache_serve.py 8899，再 python _revert.py
产物：.build/chk_chips.png / .build/chk_books.png
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
    "chips": """
      openAddSheet();
      fix();
    """,
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

FRAME = """<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#FBF7F2;overflow:hidden;height:860px}
iframe{width:420px;height:860px;border:0;display:block;margin:0 auto;
  box-shadow:0 0 0 1px rgba(0,0,0,.06)}</style>
</head><body><iframe src="_chk_%s.html"></iframe></body></html>"""


def shot(name, code, h=860):
    html = io.open(SRC, encoding="utf-8").read()
    js = "<script>" + FIX + BOOT + "</script>\n" + (TMPL % code)
    io.open(os.path.join(ROOT, "_chk_%s.html" % name), "w", encoding="utf-8").write(
        html.replace("</body>", js + "\n</body>", 1))
    io.open(os.path.join(ROOT, "_chkframe.html"), "w", encoding="utf-8").write(FRAME % name)
    png = os.path.join(ROOT, ".build", "chk_%s.png" % name)
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=2",
                    "--virtual-time-budget=9000", "--window-size=504,%d" % (h + 20),
                    "--screenshot=" + png,
                    "http://127.0.0.1:8899/_chkframe.html"], timeout=120)
    print(os.path.basename(png), os.path.exists(png))


for n in STEPS:
    shot(n, STEPS[n])
