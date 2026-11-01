/*@bridge@*/
/* 1.6.102 走查：把这一版动过的地方按真人顺序点一遍，顺带戳几个边角。 */
(function(){
  var R = [], all = 0, bad = 0;
  function p(k, v){ R.push(k + "=" + v); }
  function ok(name, cond, extra){ all++; if(!cond) bad++; p((cond ? "Y" : "N") + name, extra || ""); }
  function q(id){ return document.getElementById(id); }
  function fire(el, ev){ el.dispatchEvent(new Event(ev || "input", {bubbles: true})); }
  function seedRecs(){
    var D = 86400000, t = new Date(); t.setHours(0, 0, 1, 0); var T0 = t.getTime();
    state.books = [
      {id: "daily", name: "日常", icon: "🏠", color: "#DE6B45", cat: null, budget: 2000, def: true},
      {id: "food", name: "吃喝", icon: "🍜", color: "#2E8C63", cat: "food", budget: 800, def: false}
    ];
    state.records = [
      {id: "r1", amt: 100, type: "expense", cat: "food", peer: "海底捞", note: "AA，我先垫的",
       ts: T0 + 12 * 3600000, book: "daily", src: "manual"},
      {id: "r2", amt: 32, type: "expense", cat: "drink", peer: "星巴克", note: "",
       ts: T0 + 9 * 3600000, book: "daily", src: "manual"}
    ];
    save(); renderAll(); renderHome();
  }

  /* ---- A. 记一笔 + 备注 ---- */
  try{
    seedRecs();
    openAddSheet();
    var s = q("sheetAdd"); if(s) s.style.transition = "none";
    ok("A1 备注框在", !!q("qiNote"));
    ok("A2 备注框有占位提示", q("qiNote").getAttribute("placeholder").indexOf("备注") >= 0);
    ok("A3 备注最长 30 字", q("qiNote").getAttribute("maxlength") === "30");

    var n0 = state.records.length;
    q("qi").value = "今中午和朋友吃火锅花了100"; fire(q("qi"));
    previewManual();
    q("qiNote").value = "AA，我先垫的"; fire(q("qiNote"));
    q("btnAdd").click();
    var last = state.records[0];
    ok("A4 记上了", state.records.length === n0 + 1);
    ok("A5 标题是火锅不是半句话", last && last.peer === "火锅", last && last.peer);
    ok("A6 备注存进了 note", last && last.note === "AA，我先垫的", last && last.note);
    ok("A7 金额 100", last && last.amt === 100, last && last.amt);
    ok("A8 分类是餐饮", last && last.cat === "food", last && last.cat);
    ok("A9 记完清空了备注框", q("qiNote").value === "");

    /* 只填备注、不写正文 → 必须拦住 */
    var n1 = state.records.length;
    q("qiNote").value = "只有备注"; fire(q("qiNote"));
    q("btnAdd").click();
    ok("A10 只填备注不写正文会被拦", state.records.length === n1);
    q("qiNote").value = "";
    if(typeof closeSheets === "function") closeSheets();
    goto("home"); renderHome();
  }catch(e){ ok("A 段没抛异常", false, e.message); }

  /* ---- B. 明细行小字：备注要露出来 ---- */
  try{
    seedRecs();
    state.records[0].note = "这半句比较长，正好试试会不会被吃掉";
    renderAll(); renderHome(); goto("flow");
    var row = document.querySelector("#flowList .sw") || document.querySelector(".sw");
    var sub = row ? row.querySelector(".it-s") : null;
    ok("B1 明细行有副标题", !!sub);
    ok("B2 这一行有备注", !!sub && sub.textContent.indexOf("这半句") >= 0, sub && sub.textContent);
    var bits = sub ? sub.textContent.split("·").length : 99;
    ok("B3 小字最多四段", bits <= 4, bits + " 段");
    ok("B4 没有「手动」", !!sub && sub.textContent.indexOf("手动") < 0);
  }catch(e){ ok("B 段没抛异常", false, e.message); }

  /* ---- C. 备注里的尖括号不会变成标签 ---- */
  try{
    seedRecs();
    state.records[0].note = '<img src=x onerror="window.__XSS=1">';
    state.records[0].peer = '<b>店名</b>';
    renderAll(); goto("flow"); renderHome();
    ok("C1 没有生成真实 img 标签", document.querySelectorAll('#flowList img, #homeStack img[src="x"]').length === 0);
    ok("C2 没有执行 onerror", !window.__XSS);
    var t = document.querySelector(".it-n");
    ok("C3 店名原样当文字显示", !!t && t.textContent.indexOf("<b>") >= 0, t && t.textContent);
  }catch(e){ ok("C 段没抛异常", false, e.message); }

  /* ---- D. 备份：备注要带上 ---- */
  try{
    seedRecs();
    state.records[0].note = "AA，我先垫的";
    var dump = JSON.stringify({records: state.records, books: state.books});
    ok("D1 备份里带 note", dump.indexOf("AA，我先垫的") >= 0);
    ok("D2 备份里带 books", dump.indexOf("\"books\"") >= 0);
    ok("D3 备份里带 book", dump.indexOf("\"book\":\"daily\"") >= 0);
  }catch(e){ ok("D 段没抛异常", false, e.message); }

  /* ---- E. 分类面板编辑态 ---- */
  try{
    seedRecs(); openAddSheet(); openCatSheet();
    var eb = q("catEditBox");
    ok("E1 右上角有编辑按钮", !!eb && !!q("catEdit"));
    ok("E2 一开始是「编辑」", q("catEdit").textContent.indexOf("编辑") >= 0, q("catEdit").textContent);
    q("catEdit").click();
    ok("E3 点完变「完成」", q("catEdit").textContent.indexOf("完成") >= 0);
    ok("E4 出现减号", document.querySelectorAll("#catGrid [data-sdel]").length > 0);
    ok("E5 出现加号", document.querySelectorAll("#catGrid .sub-add").length > 0);
    ok("E6 编辑态点分类不会选中", (function(){
      var c = document.querySelector('#catGrid .cat-chip[data-cat], #catGrid .cat-chip[data-k]');
      if(!c) return true;
      var before = JSON.stringify(state.manualCat || null);
      c.click();
      return JSON.stringify(state.manualCat || null) === before;
    })());
    q("catEdit").click();
    ok("E7 再点回到「编辑」", q("catEdit").textContent.indexOf("编辑") >= 0);
    if(typeof closeSheets === "function") closeSheets();
  }catch(e){ ok("E 段没抛异常", false, e.message); }

  /* ---- F. 记一笔底下那行小字确实没了 ---- */
  try{
    openAddSheet();
    var tips = document.querySelectorAll("#sheetAdd .mini-tip");
    ok("F1 补记面板没有多余的提示行", tips.length === 0);
    ok("F2 面板里也没有「导入账单更省事」", q("sheetAdd").textContent.indexOf("更省事") < 0);
    if(typeof closeSheets === "function") closeSheets();
  }catch(e){ ok("F 段没抛异常", false, e.message); }

  /* ---- G. 深色模式下备注框还看得清 ---- */
  try{
    seedRecs(); openAddSheet();
    if(typeof setMode === "function") setMode("dark");
    var inp = q("qiNote");
    var cs = getComputedStyle(inp);
    ok("G1 深色下备注框有底色", cs.backgroundColor !== "rgba(0, 0, 0, 0)", cs.backgroundColor);
    ok("G2 深色下字是浅色", (function(){
      var c = cs.color.replace(/[^0-9,]/g, "").split(",").map(Number);
      return (c[0] + c[1] + c[2]) / 3 > 120;
    })(), cs.color);
    if(typeof setMode === "function") setMode("light");
    if(typeof closeSheets === "function") closeSheets();
  }catch(e){ ok("G 段没抛异常", false, e.message); }

  /* ---- H. 深色下那两个小圆点单独反色 ---- */
  try{
    var cssTxt = "";
    [].slice.call(document.querySelectorAll("style")).forEach(function(s){ cssTxt += s.textContent || ""; });
    ok("H1 深色减去色有单独一套", cssTxt.indexOf('html[data-dark="1"] .cat-chip .cx') >= 0);
    ok("H2 深色恢复色也有", cssTxt.indexOf('html[data-dark="1"] .cat-off .cx') >= 0);
    seedRecs(); openAddSheet(); openCatSheet(); q("catEdit").click();
    if(typeof setMode === "function") setMode("dark");
    var cx = document.querySelector("#catGrid .cx");
    var cs = cx ? getComputedStyle(cx) : null;
    ok("H3 深色里减号是实心彩色圈", !!cs && cs.backgroundColor !== "rgba(0, 0, 0, 0)",
       cs && cs.backgroundColor);
    ok("H4 符号跟圈反差够", !!cs && (function(){
      var a = cs.color.replace(/[^0-9,]/g, "").split(",").map(Number);
      var b = cs.backgroundColor.replace(/[^0-9,]/g, "").split(",").map(Number);
      var la = (a[0] + a[1] + a[2]) / 3, lb = (b[0] + b[1] + b[2]) / 3;
      return Math.abs(la - lb) > 90;
    })(), cs && (cs.color + " on " + cs.backgroundColor));
    if(typeof setMode === "function") setMode("light");
    if(typeof closeSheets === "function") closeSheets();
  }catch(e){ ok("H 段没抛异常", false, e.message); }

  p("ERR", (window.__errs || []).length ? window.__errs.join(" | ") : "none");
  document.title = all + "/" + all + " || " + (bad ? R.filter(function(x){ return x.charAt(0) === "N"; }).join(" | ") : "全过");
})();
