/*@bridge@*/
/* 1.6.104：① 吹头发/洗头识别不出来 ② 教过的分类对「补记」无效 ③「更多」和选中态撞色 */
(function(){
  var R = [], all = 0, bad = 0;
  function p(k, v){ R.push(k + "=" + v); }
  function ok(name, cond, extra){ all++; if(!cond) bad++; p((cond ? "Y" : "N") + name, extra || ""); }
  function q(id){ return document.getElementById(id); }
  function fire(el, ev){ el.dispatchEvent(new Event(ev || "input", {bubbles: true})); }

  function rule(sel){
    var out = [];
    for(var i = 0; i < document.styleSheets.length; i++){
      var ss = document.styleSheets[i], rs;
      try{ rs = ss.cssRules || []; }catch(e){ continue; }
      for(var j = 0; j < rs.length; j++){
        if(rs[j].selectorText === sel) out.push((rs[j].style.cssText || "").replace(/\s+/g, ""));
      }
    }
    return out.join(";");
  }

  function parse2(t){
    var r = parseOne(t, Date.now(), "expense");
    var sb = (r && r.note) ? subGuess(r.note, r.cat) : null;
    return {cat: r ? r.cat : null, sub: sb};
  }

  /* ---- A. 理发 / 洗护那一批词 ---- */
  try{
    var a1 = parse2("吹头发1块");
    ok("A1 「吹头发1块」不再掉进待分类", a1.cat === "daily", a1.cat);
    ok("A2 落在「理发」细分", a1.sub === "hair", a1.sub);

    var a2 = parse2("洗头20");
    ok("A3 「洗头」也认出来了", a2.cat === "daily" && a2.sub === "hair", a2.cat + "/" + a2.sub);

    var a3 = parse2("吹头5块");
    ok("A4 「吹头」也认", a3.cat === "daily" && a3.sub === "hair", a3.cat + "/" + a3.sub);

    var a4 = parse2("洗发水25");
    ok("A5 「洗发水」没被理发抢走，仍是洗护",
       a4.cat === "daily" && a4.sub === "clean", a4.cat + "/" + a4.sub);

    var a5 = parse2("理发30");
    ok("A6 「理发」照旧", a5.cat === "daily" && a5.sub === "hair", a5.cat + "/" + a5.sub);
  }catch(e){ ok("A 段没抛异常", false, e.message); }

  /* ---- B. 教过的类别对「补记」也要生效 ---- */
  try{
    state.books = [{id: "daily", name: "日常", icon: "🏠", color: "#DE6B45",
                    cat: null, budget: 2000, def: true}];
    state.records = [];
    state.peerRules = {};
    save(); renderAll();

    openAddSheet();
    state.manualCat = null; state.manualSub = null;
    q("qi").value = "吹头发1块"; fire(q("qi"));
    q("btnAdd").click();
    var r1 = state.records[0];
    ok("B1 第一笔记上了", !!r1 && r1.peer === "吹头发", r1 && r1.peer);

    /* 还原用户当时的处境：那一笔当时是未分类（词表还没修的那版记的），
       他去待分类里手动改成「洗护」，并勾了「以后都算这一类」。 */
    r1.cat = null; r1.sub = ""; save(); renderAll();
    ok("B2 造出待分类", uncatCount() === 1, uncatCount());

    openUc();
    ok("B3 「以后都算这一类」勾选框在", !!q("ucKeep"));
    if(q("ucKeep")) q("ucKeep").checked = true;

    if(q("ucMore")) q("ucMore").click();
    var sb = document.querySelector('#ucBody [data-uc-k="daily"][data-uc-sub="clean"]');
    ok("B4 「洗护」这一颗能找到", !!sb);
    if(sb) sb.click(); else ucPick("daily", "clean");

    ok("B5 规则写进去了", state.peerRules["吹头发"] === "clean", state.peerRules["吹头发"]);
    ok("B6 这一笔改成洗护", state.records[0] && state.records[0].cat === "clean",
       state.records[0] && state.records[0].cat);

    /* 再记一笔一模一样的 —— 这是用户报的那一步：以前必进待分类 */
    openAddSheet();
    state.manualCat = null; state.manualSub = null;
    q("qi").value = "吹头发1块"; fire(q("qi"));
    q("btnAdd").click();
    var r2 = state.records[state.records.length - 1];
    ok("B7 第二笔自动落在洗护", r2 && r2.cat === "clean", r2 && r2.cat);
    ok("B8 不会再冒出待分类", uncatCount() === 0, uncatCount());
    ok("B9 细分也跟着走", r2 && r2.sub === "clean", r2 && r2.sub);

    /* 面板上手选的分类优先级最高，不能被教过的规则盖掉 */
    openAddSheet();
    state.manualCat = "food"; state.manualSub = null;
    q("qi").value = "吹头发1块"; fire(q("qi"));
    q("btnAdd").click();
    var r3 = state.records[state.records.length - 1];
    ok("B10 面板上手选分类优先于记住的规则", r3 && r3.cat === "food", r3 && r3.cat);
  }catch(e){ ok("B 段没抛异常", false, e.message); }

  /* ---- C. 「＋ 更多」跟选中态不能撞色 ---- */
  try{
    var add = rule(".cat-chip.cat-add");
    ok("C1 「更多」改成虚线边框", add.indexOf("dashed") >= 0, add.slice(0, 140));
    ok("C2 「更多」不再用选中态那套淡底", add.indexOf("--brandSoft") < 0, add);

    var on = rule(".cat-chip.on");
    ok("C3 选中态还是原来的淡底（没被改坏）", on.indexOf("--brandSoft") >= 0, on);

    openAddSheet();
    state.manualCat = null; state.manualSub = null;
    var chips = document.querySelectorAll("#catChips .cat-chip");
    for(var i = 0; i < chips.length; i++){
      if((chips[i].textContent || "").indexOf("服饰") >= 0){ chips[i].click(); break; }
    }
    var onChip = document.querySelector("#catChips .cat-chip.on");
    var addChip = q("chipMore");
    ok("C4 选中一颗后能找到选中态", !!onChip);
    ok("C5 两者底色实测不同", !!(onChip && addChip) &&
       getComputedStyle(onChip).backgroundColor !== getComputedStyle(addChip).backgroundColor,
       (onChip ? getComputedStyle(onChip).backgroundColor : "-") + " vs " +
       (addChip ? getComputedStyle(addChip).backgroundColor : "-"));
    ok("C6 「更多」计算出来的边框是虚线", !!addChip &&
       getComputedStyle(addChip).borderTopStyle === "dashed",
       addChip ? getComputedStyle(addChip).borderTopStyle : "-");
    if(typeof closeSheets === "function") closeSheets();
  }catch(e){ ok("C 段没抛异常", false, e.message); }

  /* ---- D. 单笔挑图标 ---- */
  try{
    if(typeof closeSheets === "function") closeSheets();
    state.books = [{id: "daily", name: "日常", icon: "🏠", color: "#DE6B45",
                    cat: null, budget: 2000, def: true}];
    state.records = []; state.peerRules = {};
    save(); renderAll();

    openAddSheet();
    ok("D1 「自动识别」勾选框在", !!q("qiAutoIc"));
    ok("D2 默认是勾上的", !!q("qiAutoIc") && q("qiAutoIc").checked === true);

    var lbl = document.querySelector("#sheetAdd .ic-auto");
    ok("D13 勾选框排在分类标签前面", !!lbl && !!q("catChips") &&
       (lbl.compareDocumentPosition(q("catChips")) & 4) > 0);

    state.manualCat = null; state.manualSub = null;
    q("qi").value = "咖啡12"; fire(q("qi"));
    q("btnAdd").click();
    ok("D3 勾着的时候不弹挑图标面板", !q("sheetIc").classList.contains("on"));
    ok("D4 这一笔没有自定义图标", !state.records[0].ic, state.records[0].ic);

    openAddSheet();
    q("qiAutoIc").checked = false;
    state.manualCat = null; state.manualSub = null;
    q("qi").value = "奶茶8"; fire(q("qi"));
    q("btnAdd").click();
    ok("D5 不勾之后直接换成挑图标面板",
       q("sheetIc").classList.contains("on") && !q("sheetAdd").classList.contains("on"));

    var cells = document.querySelectorAll("#icPick [data-ic]");
    ok("D6 面板里有图标可选", cells.length >= 30, cells.length);

    var pick = null;
    for(var i = 0; i < cells.length; i++){
      if(cells[i].dataset.ic === "🧋"){ pick = cells[i]; break; }
    }
    ok("D7 能找到想要的图案", !!pick);
    if(pick) pick.click();
    var rr = state.records[state.records.length - 1];
    ok("D8 图标存进这一笔了", !!rr && rr.ic === "🧋", rr && rr.ic);
    ok("D9 面板上它变成选中态", !!pick && pick.classList.contains("on"));

    goto("flow"); renderFlow();
    var rowIc = document.querySelector(".sw .it-ic");
    ok("D10 明细行画的是这个图案",
       !!rowIc && (rowIc.textContent || "").indexOf("🧋") >= 0,
       rowIc ? rowIc.textContent : "-");

    /* 存档一轮 —— 读档是字段白名单，不放行的话重开就没了（最容易漏的一步） */
    save(); load(); renderAll();
    var back = state.records.filter(function(x){ return x.ic; });
    ok("D11 重新读档后图标还在", back.length === 1 && back[0].ic === "🧋",
       back.length ? back[0].ic : "没有");

    state.records.push({id: "zz", amt: 1, type: "expense", cat: "other", sub: "",
      peer: "测试", note: "", ts: Date.now(), book: "daily", src: "manual",
      ic: "<img onerror=alert(1)>"});
    save(); load();
    var zz = state.records.filter(function(x){ return x.id === "zz"; })[0];
    ok("D12 带标签的图标被丢掉，不进页面", !!zz && zz.ic === "", zz && zz.ic);

    if(typeof closeSheets === "function") closeSheets();
  }catch(e){ ok("D 段没抛异常", false, e.message); }

  p("ERR", (window.__errs || []).length ? window.__errs.join(" | ") : "none");
  document.title = all + "/" + all + " || " +
    (bad ? R.filter(function(x){ return x.charAt(0) === "N"; }).join(" | ") : "全过");
})();
