#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""首页明细行的肉眼检查：造几笔（火锅 / 西餐 / 板面卤蛋 / 麻辣烫），截图看图标。"""
import os, subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
OUT_HTML = os.path.join(ROOT, "_shotlist.html")
OUT_PNG = r"D:\小账本\.build\_shot_list.png"

JS = """
<script>
setTimeout(function(){
  var now = Date.now();
  var rows = [
    ["火锅", 1010, "food", "dish"],
    ["铜锅涮肉", 128, "food", "dish"],
    ["麻辣烫", 23, "food", "dish"],
    ["西餐", 90, "food", "west"],
    ["板面 + 卤蛋", 19, "food", "noodle"],
    ["板面卤蛋", 19, "food", "noodle"]
  ];
  rows.forEach(function(x, i){
    state.records.unshift({id:"s"+i, amt:x[1], cat:x[2], sub:x[3], type:"expense",
      peer:x[0], note:"", ts:now - i*60000, book:"daily", src:"manual"});
  });
  save(); renderAll();
  setTimeout(function(){ window.scrollTo(0, 330); }, 120);
}, 500);
</script>
"""

html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
open(OUT_HTML, "w", encoding="utf-8").write(html.replace("</body>", JS + "\n</body>", 1))

subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--virtual-time-budget=3000", "--window-size=520,900",
                "--screenshot=" + OUT_PNG,
                "http://127.0.0.1:8899/_shotlist.html"], timeout=120)
print(OUT_PNG, os.path.exists(OUT_PNG))
