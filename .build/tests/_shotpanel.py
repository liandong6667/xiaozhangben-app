#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""单笔改分类面板的肉眼检查：造一笔，打开 sheetUc，截图。"""
import os, subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
OUT_HTML = os.path.join(ROOT, "_shot.html")
SUB_PNG = r"D://小账本//.build//_shot_sub.png"
OUT_PNG = r"D:\小账本\.build\_shot_uc.png"

JS = """
<script>
setTimeout(function(){
  var r = {id:"shot1", amt:60, cat:"food", type:"expense", peer:"拌面加卤蛋", note:"",
           ts:Date.now(), book:"daily", src:"manual"};
  state.records.unshift(r);
  save(); renderAll();
  openCatFor(r.id);
  if(location.hash === "#more") ucShowMore();
}, 500);
</script>
"""

html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
open(OUT_HTML, "w", encoding="utf-8").write(html.replace("</body>", JS + "\n</body>", 1))

subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--virtual-time-budget=3000", "--window-size=500,1100",
                "--screenshot=" + OUT_PNG,
                "http://127.0.0.1:8899/_shot.html"], timeout=120)
subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--virtual-time-budget=3000", "--window-size=500,1100",
                "--screenshot=" + SUB_PNG,
                "http://127.0.0.1:8899/_shot.html#more"], timeout=120)
print(OUT_PNG, os.path.exists(OUT_PNG))
print(SUB_PNG, os.path.exists(SUB_PNG))
