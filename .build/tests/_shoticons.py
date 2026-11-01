#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把所有分类图标摆成一张表，3x 截图看画得像不像。

改图标时用它：先在 41px 方块的真实尺寸下看一遍，
不认识的直接改 GL 里的 path，别等到用户手机上才发现。
"""
import os, subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(EDGE):
    EDGE = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
OUT_HTML = os.path.join(ROOT, "_icons.html")
OUT_PNG = r"D:\小账本\.build\_icons.png"

JS = """
<script>
setTimeout(function(){
  /* 样式必须塞进 head：下面要清空 body，写在 body 里的 <style> 会跟着一起没。
     （第一版就是这么翻车的，渲染出来是一列没底的裸图标 —— 别删这段注释） */
  var st = document.createElement('style');
  st.textContent = 'body{margin:0;padding:14px;background:#FBF7F2;font-family:sans-serif}' +
    '.ig{display:grid;grid-template-columns:repeat(6,1fr);gap:9px}' +
    '.ic{text-align:center}' +
    '.sq{width:41px;height:41px;border-radius:14px;display:grid;place-items:center;' +
    'font-size:19px;margin:0 auto;color:#DE6B45;background:rgba(222,107,69,.12)}' +
    '.nm{font-size:8px;color:#8a8177;margin-top:3px;letter-spacing:-.2px}';
  document.head.appendChild(st);
  var keys = Object.keys(GL);
  document.body.innerHTML = '<div class="ig">' + keys.map(function(k){
    return '<div class="ic"><div class="sq">' + gicon(k) + '</div>' +
           '<div class="nm">' + k + '</div></div>';
  }).join('') + '</div>';
}, 600);
</script>
"""

html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
open(OUT_HTML, "w", encoding="utf-8").write(html.replace("</body>", JS + "\n</body>", 1))

subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=3", "--virtual-time-budget=3000",
                "--window-size=380,820", "--screenshot=" + OUT_PNG,
                "http://127.0.0.1:8899/_icons.html"], timeout=120)
print(OUT_PNG, os.path.exists(OUT_PNG))
