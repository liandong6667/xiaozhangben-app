#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""只画明细行：把 itemHTML 的输出单独摆一页，专看左边图标长什么样。
用法：python _shotrows.py [输出png名]
"""
import os, subprocess, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
OUT_HTML = os.path.join(ROOT, "_shotrows.html")
OUT_PNG = r"D:\小账本\.build\_shot_rows.png"
if len(sys.argv) > 1:
    OUT_PNG = os.path.join(r"D:\小账本\.build", sys.argv[1])

JS = """
<script>
setTimeout(function(){
  var box = document.createElement("div");
  box.style.cssText = "position:fixed;left:0;top:0;width:100%;padding:14px 12px;background:var(--bg);z-index:99999";
  var lines = ["火锅 1010", "铜锅涮肉 128", "麻辣烫 23", "西餐 90", "板面卤蛋 19", "海底捞 200"];
  var html = "";
  lines.forEach(function(s, i){
    var r = parseOne(s, Date.now() - i * 60000, "expense");
    r.id = "z" + i; r.book = "daily"; r.src = "manual"; r.peer = r.note;
    r.sub = subGuess(r.note, r.cat);
    html += itemHTML(r);
  });
  box.innerHTML = '<div class="list" style="margin:0">' + html + "</div>";
  document.body.appendChild(box);
}, 600);
</script>
"""

html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
open(OUT_HTML, "w", encoding="utf-8").write(html.replace("</body>", JS + "\n</body>", 1))

subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--virtual-time-budget=3000", "--window-size=560,560",
                "--screenshot=" + OUT_PNG,
                "http://127.0.0.1:8899/_shotrows.html"], timeout=120)
print(OUT_PNG, os.path.exists(OUT_PNG))
