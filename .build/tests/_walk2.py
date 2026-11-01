#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""1.6.102 之后的整体走查截图：主界面 + 这一版动过的几个地方。
用法：先起 nocache_serve.py 8899，再 python _walk2.py [步骤名...]
产物：.build/w2_<name>.png
"""
import io, os, subprocess, sys

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
function fire(el, ev){ el.dispatchEvent(new Event(ev || "input", {bubbles:true})); }
function fix(){
  ["sheetCat","sheetIcons","sheetBook","sheetNewBook","sheetAdd","sheetUc","mask"].forEach(function(id){
    var e = document.getElementById(id); if(e) e.style.transition = "none";
  });
  var s = document.querySelector(".sheet.on"); if(s) s.style.transform = "translateY(0)";
}
function seed(){
  var D = 86400000, t = new Date(); t.setHours(0,0,1,0); var T0 = t.getTime();
  function at(h, m){ return T0 + h*3600000 + (m||0)*60000; }
  state.books = [
    {id:"daily", name:"日常", icon:"🏠", color:"#DE6B45", cat:null, budget:2000, def:true},
    {id:"food",  name:"吃喝", icon:"🍜", color:"#2E8C63", cat:"food",  budget:800,  def:false}
  ];
  state.records = [
    {id:"r1", amt:100, type:"expense", cat:"food", peer:"海底捞", note:"AA，我先垫的",
     ts:at(12,5), book:"daily", src:"manual"},
    {id:"r2", amt:32,  type:"expense", cat:"drink", peer:"星巴克", note:"", ts:at(9,20),
     book:"daily", src:"manual"},
    {id:"r3", amt:12,  type:"expense", cat:"transport", peer:"地铁", note:"", ts:at(8,10),
     book:"daily", src:"manual"},
    {id:"r4", amt:158, type:"expense", cat:"cloth", peer:"优衣库", note:"换季", ts:at(15,40)-D,
     book:"daily", src:"manual"},
    {id:"r5", amt:25,  type:"expense", cat:null, peer:"美团外卖", note:"", ts:at(19,0)-D,
     book:"daily", src:"manual"},
    {id:"r6", amt:3000,type:"income",  cat:"salary", peer:"工资", note:"", ts:at(10,0)-3*D,
     book:"daily", src:"manual"}
  ];
  save(); renderAll(); renderHome();
}
"""

TMPL = """
<script>
setTimeout(function(){
  ready(function(){
    try{ %s }catch(e){ document.title = "ERR " + (e && e.message); }
  });
}, 500);
</script>
"""

STEPS = {
    # 首页：卡片 / 最近 / 待分类
    "home": """
      seed();
    """,
    # 记一笔：输入一句口语，看预览把这句话认成什么，顺便看备注框
    "add": """
      seed();
      openAddSheet();
      var q = document.getElementById("qi");
      q.value = "今中午和朋友吃火锅花了100"; fire(q);
      previewManual();
      var nt = document.getElementById("qiNote");
      if(nt){ nt.value = "AA，我先垫的"; fire(nt); }
      fix();
    """,
    # 记完之后首页那一条
    "row": """
      seed();
      openAddSheet();
      var q = document.getElementById("qi");
      q.value = "今中午和朋友吃火锅花了100"; fire(q); previewManual();
      var nt = document.getElementById("qiNote");
      if(nt){ nt.value = "AA，我先垫的"; fire(nt); }
      document.getElementById("btnAdd").click();
      if(typeof closeSheets === "function") closeSheets();
      goto("home"); renderHome();
    """,
    # 明细
    "flow": """
      seed(); goto("flow");
    """,
    # 统计 + 我的账本
    "books": """
      seed(); goto("stats"); renderBooks();
    """,
    # 更多分类（正常态）
    "cats": """
      seed(); openAddSheet(); openCatSheet(); fix();
    """,
    # 更多分类（编辑态：减号 + 加号）
    "catedit": """
      seed(); openAddSheet(); openCatSheet();
      document.getElementById("catEdit").click(); fix();
    """,
    # 添加器：点编辑态里某个大类的加号
    "adder": """
      seed(); openAddSheet(); openCatSheet();
      document.getElementById("catEdit").click();
      var b = document.querySelector("#catGrid .sub-add");
      if(b) b.click();
      fix();
    """,
    # 待分类清算
    "uncat": """
      seed(); goto("flow"); openUc(); fix();
    """,
    # 深色模式下的几个关键界面
    "dk_add": """
      seed(); if(typeof setMode === "function") setMode("dark");
      openAddSheet();
      var q = document.getElementById("qi");
      q.value = "今中午和朋友吃火锅花了100"; fire(q); previewManual();
      var nt = document.getElementById("qiNote");
      if(nt){ nt.value = "AA，我先垫的"; fire(nt); }
      fix();
    """,
    "dk_home": """
      seed(); if(typeof setMode === "function") setMode("dark"); renderAll(); renderHome();
    """,
    "dk_catedit": """
      seed(); if(typeof setMode === "function") setMode("dark");
      openAddSheet(); openCatSheet();
      document.getElementById("catEdit").click(); fix();
    """,
    "longnote": """
      seed();
      state.records[0].note = "这句话故意写得长一点看看会不会把整行撑坏";
      state.records[0].note = state.records[0].note.slice(0, 30);
      renderAll(); goto("flow"); renderHome();
    """,
    # 我的
    "me": """
      seed(); goto("me");
    """,
}

FRAME = """<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#FBF7F2;overflow:hidden;height:900px}
iframe{width:420px;height:900px;border:0;display:block;margin:0 auto;
  box-shadow:0 0 0 1px rgba(0,0,0,.06)}</style>
</head><body><iframe src="_w2_%s.html"></iframe></body></html>"""


def shot(name, code, h=900):
    html = io.open(SRC, encoding="utf-8").read()
    js = "<script>" + BOOT + "</script>\n" + (TMPL % code)
    io.open(os.path.join(ROOT, "_w2_%s.html" % name), "w", encoding="utf-8").write(
        html.replace("</body>", js + "\n</body>", 1))
    io.open(os.path.join(ROOT, "_w2frame.html"), "w", encoding="utf-8").write(FRAME % name)
    png = os.path.join(ROOT, ".build", "w2_%s.png" % name)
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=2",
                    "--virtual-time-budget=9000", "--window-size=504,%d" % (h + 20),
                    "--screenshot=" + png,
                    "http://127.0.0.1:8899/_w2frame.html"], timeout=120)
    print(os.path.basename(png), os.path.exists(png))


want = sys.argv[1:] or list(STEPS)
for n in want:
    shot(n, STEPS[n])
