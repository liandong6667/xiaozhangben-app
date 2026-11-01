#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""只画账本图标位：1~4 个字在三种容器里的真实尺寸，专看会不会挤/裁。
用法：先起一个静态服务（python -m http.server 8899 于项目根），再 python _shotbi.py [输出png名]
"""
import os, subprocess, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
OUT_HTML = os.path.join(ROOT, "_shotbi.html")
OUT_PNG = r"D:\小账本\.build\_shot_bi.png"
if len(sys.argv) > 1:
    OUT_PNG = os.path.join(r"D:\小账本\.build", sys.argv[1])

JS = """
<script>
setTimeout(function(){
  var demo = [
    {icon:"💅", iconTxt:"税",        color:"#DE6B45"},
    {icon:"💅", iconTxt:"美甲",      color:"#5B8DEF"},
    {icon:"💅", iconTxt:"美甲店",    color:"#3FA76B"},
    {icon:"💅", iconTxt:"宠物医院",  color:"#B26BD8"},
    {icon:"",   iconTxt:"宠物医院",  color:"#C9A227"}
  ];
  var h = "";
  demo.forEach(function(b){
    h += '<div class="bcard" style="width:132px;display:inline-block;margin:5px;vertical-align:top">' +
         '<div class="bh">' + bookIcHtml(b) + '<span style="font-size:12px">' + (b.iconTxt||"白纸") + '</span></div></div>';
  });
  var h2 = "";
  demo.forEach(function(b){
    h2 += '<span class="bookchip" style="margin:4px">' + bookIcHtml(b) + '</span>';
  });
  var box = document.createElement("div");
  box.style.cssText = "position:fixed;left:0;top:0;width:100%;padding:12px;background:var(--bg);z-index:99999";
  box.innerHTML = '<div style="font:700 11px sans-serif;color:#999;margin:2px 0 6px">账本卡片 30px 图标位</div>' + h +
    '<div style="font:700 11px sans-serif;color:#999;margin:12px 0 6px">顶部账本条 22px 图标位</div><div>' + h2 + '</div>';
  document.body.appendChild(box);
}, 600);
</script>
"""

html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
open(OUT_HTML, "w", encoding="utf-8").write(html.replace("</body>", JS + "\n</body>", 1))

subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--virtual-time-budget=3000", "--window-size=700,430",
                "--screenshot=" + str(OUT_PNG),
                "http://127.0.0.1:8899/_shotbi.html"], timeout=120)
print(OUT_PNG, os.path.exists(OUT_PNG))
