#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""只画「选个分类」面板：普通态 / 编辑态 各一张，专看 ✕、＋、灰格子长什么样。
用法：先起 nocache_serve.py 8899，再 python _shotcat.py [后缀]
"""
import os, subprocess, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
TAG = sys.argv[1] if len(sys.argv) > 1 else "a"

JS = """
<script>
setTimeout(function(){
  try{
    localStorage.removeItem("xiaozhangben.v3");
    load(); renderAll(); renderHome();
    state.manualType = "expense";
    openCatSheet();
    var sh = document.getElementById("sheetCat");
    sh.style.transition = "none"; sh.style.transform = "translateY(0)";
    document.getElementById("mask").style.transition = "none";
    %s
  }catch(e){ document.title = "ERR " + e.message; }
}, 600);
</script>
"""

def shot(code, name):
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    out = os.path.join(ROOT, "_shotcat.html")
    open(out, "w", encoding="utf-8").write(html.replace("</body>", (JS % code) + "\n</body>", 1))
    png = os.path.join(r"D:\小账本\.build", "_cat_%s.png" % name)
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--virtual-time-budget=6000", "--window-size=780,900",
                    "--screenshot=" + png,
                    "http://127.0.0.1:8899/_shotcat.html"], timeout=120)
    print(png, os.path.exists(png))

shot("", TAG + "_normal")
shot("document.getElementById('catEdit').click();", TAG + "_edit")
shot("document.getElementById('catEdit').click(); document.querySelector('[data-catadd]').click();", TAG + "_adder")
