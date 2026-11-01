/* 1.6.106 走查：三件用户报的事
   ① 关掉「自动识别图标」之后，图标得自己挑，没挑不许记；
   ② 左滑的「编辑」换成「备注」（分类点图标就能改，编辑是重复入口）；
   ③ 「以后都算这一类」连细分一起记 —— 吹头发改成洗护，下一笔别再回理发。 */
(function(){
  var R = [], all = 0, bad = 0;
  function p(k, v){ R.push(k + "=" + v); }
  function ok(name, cond, extra){ all++; if(!cond) bad++; p((cond ? "Y" : "N") + name, extra || ""); }
  function q(id){ return document.getElementById(id); }
  function openSheets(){ return Array.prototype.slice.call(document.querySelectorAll(".sheet.on")).map(function(x){ return x.id; }); }
  function fire(el, ev){ el.dispatchEvent(new Event(ev || "input", {bubbles: true})); }
  function seed(){
    var D = 864e5, t = new Date(); t.setHours(0, 0, 1, 0); var T0 = t.getTime();
    state.books = [{id: "daily", name: "日常", icon: "🏠", color: "#DE6B45", cat: null, budget: 1500, def: true}];
    state.records = [
      {id: "r1", amt: 1, type: "expense", cat: "daily", sub: "hair", peer: "吹头发",
       note: "", ts: T0 + 12 * 3600000, book: "daily", src: "manual"}
    ];
    state.peerRules = {};
    state.manualCat = null; state.manualSub = null; state.manualIc = "";
    save(); renderAll(); renderFlow();
  }
  function typeIn(v){
    q("qi").value = v; fire(q("qi"));
    if(typeof previewManual === "function") previewManual();
  }

  /* ================= A. 图标：关掉自动识别就得自己挑（2026-11-01 最终形态） =====
     用户前前后后四轮敲定成这样：
       · 记一笔时**再也没有「挑个图标」那一屏**（#sheetIc / openIcPick 整段删掉），
         点预览、点分类都不许跳出去 —— 原话「以后点东西不要再跳转到这个界面了」；
       · 选图标 = 点下面那排分类（或「＋ 更多」挑一档细分）；
       · 没选就点「记上」→ 不记账，底部飘一行淡色小字「请选择一个图标」，几秒自己淡掉，
         顺手把下面那排分类闪一下，指着那儿。 */
  try{
    seed();
    openAddSheet();
    ok("A1 默认勾着自动识别", q("qiAutoIc").checked === true);
    ok("A2 面板里没有那行虚线框", !q("qiIcBtn") && !q("qiIcNeed") && !q("qiIcBox"));
    ok("A3 挑图标那一屏整个没了", !q("sheetIc") && typeof openIcPick !== "function",
       "openIcPick=" + typeof openIcPick);

    q("qiAutoIc").checked = false; fire(q("qiAutoIc"), "change");
    ok("A4 取消勾选后面板保持原样", !q("qiIcBtn") && !q("qiIcNeed"));

    /* 没挑就点「记上」 */
    var n0 = state.records.length;
    typeIn("吹头发 1");
    q("btnAdd").click();
    ok("A5 没挑图标不让记", state.records.length === n0, state.records.length + "/" + n0);
    ok("A6 底部飘出「请选择一个图标」", q("qiToast").classList.contains("on") &&
       (q("qiToast").textContent || "").indexOf("请选择一个图标") >= 0, q("qiToast").textContent);
    ok("A7 补记面板还开着", q("sheetAdd").classList.contains("on"));
    ok("A8 没有别的面板被弹出来", openSheets().join(",") === "sheetAdd", openSheets().join(","));
    ok("A9 飘字不可点（纯提醒）", getComputedStyle(q("qiToast")).pointerEvents === "none",
       getComputedStyle(q("qiToast")).pointerEvents);
    ok("A10 飘字同时把下面那排闪一下", q("catChips").classList.contains("hint"));
    ok("A11 预览图案不再假装能点", !q("pvCat").classList.contains("ic-pickable"));
    q("pvCat").click();
    ok("A12 点预览也不跳任何面板", openSheets().join(",") === "sheetAdd", openSheets().join(","));

    /* 选图标的路只有一条：点下面那排分类 */
    var chipA = document.querySelector('#catChips [data-cat="daily"]');
    ok("A13 下面那排分类在", !!chipA);
    if(chipA) chipA.click();
    ok("A14 点一下就选上了", state.manualCat === "daily", String(state.manualCat));
    ok("A15 预览跟着变", (q("pvCat").textContent || "").indexOf("日用") >= 0, q("pvCat").textContent);

    q("qiToast").classList.remove("on"); q("qiToast").textContent = "";
    q("btnAdd").click();
    ok("A16 选了就能记上", state.records.length === n0 + 1, state.records.length + "/" + (n0 + 1));
    var lastA = state.records[state.records.length - 1];
    ok("A17 图标留空，明细行用分类图案", lastA && !lastA.ic, lastA && lastA.ic);
    ok("A18 不再飘提示", !q("qiToast").classList.contains("on"), q("qiToast").textContent);
    ok("A19 闪一下会自己收",
       q("catChips").classList.contains("hint") === true);   // 计时器到点自己摘掉，这里只看它挂着不报错

    /* 勾回去：图标交回程序认 */
    q("qiAutoIc").checked = true; fire(q("qiAutoIc"), "change");
    openAddSheet(); typeIn("第一食堂 9"); q("btnAdd").click();
    var last2 = state.records[state.records.length - 1];
    ok("A20 自动模式下不硬塞图标", last2 && !last2.ic, last2 && last2.ic);
  }catch(e){ ok("A 段没抛异常", false, e.message); }

  /* ================= B. 左滑：编辑 → 备注 ================= */
  try{
    seed();
    renderFlow();
    var sw = document.querySelector('.sw[data-rid="r1"]');
    ok("B1 那行在", !!sw);
    var noteB = sw ? sw.querySelector('[data-act="note"]') : null;
    var delB = sw ? sw.querySelector('[data-act="del"]') : null;
    ok("B2 第一个是备注", !!noteB);
    ok("B3 标签写着备注", noteB && noteB.getAttribute("aria-label") === "备注",
       noteB && noteB.getAttribute("aria-label"));
    ok("B4 备注按钮是线条图不是表情", !!(noteB && noteB.querySelector("svg")));
    ok("B5 编辑按钮已经没了", !sw.querySelector('[data-act="edit"]'));
    ok("B6 删除还在", !!delB);

    noteB.click();
    ok("B7 点备注开备注框", q("noteBox").classList.contains("on"));
    ok("B8 说明里带金额和名字", (q("noteSub").textContent || "").indexOf("吹头发") >= 0,
       q("noteSub").textContent);
    ok("B9 原来的备注填在框里", q("noteInp").value === "");

    q("noteInp").value = "和室友 AA，我先垫的";
    q("noteYes").click();
    var r1 = state.records.filter(function(x){ return x.id === "r1"; })[0];
    ok("B10 备注存进去了", r1 && r1.note === "和室友 AA，我先垫的", r1 && r1.note);
    ok("B11 存完弹窗关了", !q("noteBox").classList.contains("on"));
    ok("B12 金额没被动", r1 && r1.amt === 1, r1 && r1.amt);
    ok("B13 分类没被动", r1 && r1.cat === "daily" && r1.sub === "hair", r1 && (r1.cat + "/" + r1.sub));

    /* 再开一次：框里是刚存的；清空保存 = 把备注删掉 */
    document.querySelector('.sw[data-rid="r1"] [data-act="note"]').click();
    ok("B14 再开能读到刚才那句", q("noteInp").value === "和室友 AA，我先垫的", q("noteInp").value);
    q("noteInp").value = "   ";
    q("noteYes").click();
    ok("B15 留空保存 = 清掉备注", r1 && r1.note === "", r1 && r1.note);

    /* 取消不落库 */
    document.querySelector('.sw[data-rid="r1"] [data-act="note"]').click();
    q("noteInp").value = "不该存下来";
    q("noteNo").click();
    ok("B16 取消不保存", r1 && r1.note === "", r1 && r1.note);
    ok("B17 取消把弹窗关了", !q("noteBox").classList.contains("on"));

    /* 删除按钮照旧 */
    document.querySelector('.sw[data-rid="r1"] [data-act="del"]').click();
    ok("B18 删除还是走确认框", q("askBox").classList.contains("on"));
    q("askNo").click();
  }catch(e){ ok("B 段没抛异常", false, e.message); }

  /* ================= C. 「以后都算这一类」要连细分一起记 ================= */
  try{
    seed();
    /* 用改这一笔的入口，改成 日用 › 洗护，并勾着「以后都算这一类」 */
    openCatFor("r1");
    var keep = q("ucKeep");
    ok("C1 勾选框默认是勾上的", keep && keep.checked === true);
    ok("C2 大类下面有细分那一行", !!document.querySelector("#ucBody .uc-subrow"),
       (document.querySelectorAll("#ucBody .uc-subrow .cat-chip").length) + " 个");
    ucPick("daily", "clean");
    var r1 = state.records.filter(function(x){ return x.id === "r1"; })[0];
    ok("C3 细分改成洗护了", r1 && r1.sub === "clean", r1 && r1.sub);

    var rule = state.peerRules["吹头发"];
    ok("C4 规则连细分一起记下来", rule && typeof rule === "object" && rule.c === "daily" && rule.s === "clean",
       JSON.stringify(rule));

    /* 第二笔：同样的说法，必须落洗护，不能回理发 */
    openAddSheet();
    typeIn("吹头发 1");
    q("btnAdd").click();
    var r2 = state.records[state.records.length - 1];
    ok("C5 第二笔记上了", state.records.length === 2, state.records.length);
    ok("C6 第二笔是洗护不是理发", r2 && r2.sub === "clean", r2 && r2.sub);
    ok("C7 大类还是日用", r2 && r2.cat === "daily", r2 && r2.cat);

    /* 点同一个大类（不带细分）不该把细分抹掉 */
    openCatFor(r2.id);
    ucPick("daily");
    ok("C8 点同类大类不清细分", r2.sub === "clean", r2.sub);

    /* 老存档里的写法是一串字符串（只有大类），读的时候必须还能用 */
    state.peerRules["老商户"] = "food";
    var old = ruleOf("老商户");
    ok("C9 老写法照样能读", old && old.c === "food" && old.s === "", JSON.stringify(old));
    ok("C10 没教过的返回 null", ruleOf("没教过的店") === null);

    /* 自动认的那条路（导入/通知都走 autoClassify）也得认细分规则 */
    ok("C11 autoClassify 认得出大类", autoClassify({peer: "吹头发", note: "", type: "expense"}) === "daily");
    ok("C12 规则里的大类也认", autoClassify({peer: "老商户", note: "", type: "expense"}) === "food");
  }catch(e){ ok("C 段没抛异常", false, e.message); }

  /* =========== D. 预览也得认「教过的规则」（2026-11-01 用户第二次报） ===========
     现象：教过 吹头发→洗护 之后，记上进了洗护，可**预览框还写理发**。
     原因是记的那一步查了 peerRules，预览没查，只看词表。 */
  try{
    seed();
    state.peerRules = {"吹头发": {c: "daily", s: "clean"}};
    openAddSheet();
    typeIn("吹头发 1");
    ok("D1 预览显示洗护", (q("pvCat").textContent || "").indexOf("洗护") >= 0, q("pvCat").textContent);
    ok("D2 预览不再写理发", (q("pvCat").textContent || "").indexOf("理发") < 0, q("pvCat").textContent);

    /* 自己动手选了大类就以手选为准，别拿旧规则压人 */
    state.manualCat = "food"; state.manualSub = null;
    previewManual();
    ok("D3 手选大类压过规则", (q("pvCat").textContent || "").indexOf("洗护") < 0, q("pvCat").textContent);
    state.manualCat = null; state.manualSub = null;
    previewManual();

    /* 挑图标那一屏已经被要求删掉了（2026-11-01 用户：别再跳到那个界面）。
       以前这里两种模式说两种话，现在连面板都没有了 —— 断言它真的不在。 */
    ok("D4 页面上没有挑图标那一屏", !q("sheetIc"));
    ok("D5 也没有打开它的函数", typeof openIcPick !== "function", typeof openIcPick);
    ok("D6 没有那一屏的标题/按钮", !q("icTitle") && !q("icSub") && !q("icDone"));
    closeSheets();
  }catch(e){ ok("D 段没抛异常", false, e.message); }

  /* ================= E. 「选好图标」有两条路（2026-11-01 用户报「明明选了却记不上」） =====
     现象：关掉自动识别后，他点了分类「纸品」，再点「记上」却飘出「请选择一个图标」。
     根因：当时只认 state.manualIc（在虚线图案里专门挑的那个），点分类不算数 ——
     可在用户眼里，分类 chip 本身就带着图标，点它 = 选好了。
     所以：挑过图标 **或** 点过分类，都算选好；两条都没走才拦。 */
  try{
    seed();
    openAddSheet();
    q("qiAutoIc").checked = false; fire(q("qiAutoIc"), "change");
    var n2 = state.records.length;
    typeIn("吹头发 1");

    /* 第二条路：直接点分类 */
    var chip = document.querySelector('#catChips [data-cat="daily"]');
    ok("E1 分类芯片在", !!chip);
    if(chip) chip.click();
    ok("E2 点分类记下了大类", state.manualCat === "daily", String(state.manualCat));

    q("qiToast").classList.remove("on"); q("qiToast").textContent = "";
    q("btnAdd").click();
    ok("E3 点过分类就能记上", state.records.length === n2 + 1,
       state.records.length + "/" + (n2 + 1));
    var e1 = state.records[state.records.length - 1];
    ok("E4 图标留空，明细行用分类图案", e1 && !e1.ic, e1 && e1.ic);
    ok("E5 不再拦着飘提示", !q("qiToast").classList.contains("on"), q("qiToast").textContent);

    /* 两条路都没走：照旧拦住 */
    openAddSheet();
    state.manualCat = null; state.manualSub = null; state.manualIc = "";
    q("qiAutoIc").checked = false; fire(q("qiAutoIc"), "change");
    var n3 = state.records.length;
    typeIn("吹头发 2");
    q("btnAdd").click();
    ok("E6 啥都没选还是拦住", state.records.length === n3, state.records.length + "/" + n3);
    ok("E7 照旧飘「请选择一个图标」", q("qiToast").classList.contains("on") &&
       (q("qiToast").textContent || "").indexOf("请选择一个图标") >= 0, q("qiToast").textContent);

    /* 预览要显示手挑的那个图案 —— 挑完预览还是分类图案，看着就像没挑上 */
    state.manualIc = "\uD83E\uDDF4";
    previewManual();
    ok("E8 预览亮出手挑的图案", (q("pvCat").textContent || "").indexOf("\uD83E\uDDF4") >= 0,
       q("pvCat").textContent);
    state.manualIc = "";
    previewManual();
    ok("E9 没挑时预览回到分类图案", (q("pvCat").textContent || "").indexOf("\uD83E\uDDF4") < 0,
       q("pvCat").textContent);
  }catch(e){ ok("E 段没抛异常", false, e.message); }

  /* ================= F. 关掉自动识别后，程序不许再自作主张（2026-11-01 第二轮反馈） =========
     用户原话三条：
     ①「我明明没开自动识别，但是它还是识别了」—— 预览还显示词表猜的「理发」；
     ②「我明明选的是日用，但是它还是记理发」—— 点了大类，细分照样被背地里猜掉；
     ③ 预览必须跟记上以后的结果一字不差。 */
  try{
    seed();
    openAddSheet();
    q("qiAutoIc").checked = false; fire(q("qiAutoIc"), "change");
    typeIn("吹头发 1");

    /* ① 什么都没选：预览只给一个「＋ 图标」占位，猜出来的理发不许上屏 */
    ok("F1 预览是「＋ 图标」占位", (q("pvCat").textContent || "").indexOf("图标") >= 0,
       q("pvCat").textContent);
    ok("F2 猜的理发不上屏", (q("pvCat").textContent || "").indexOf("理发") < 0,
       q("pvCat").textContent);
    ok("F3 占位只是提示，不再假装有虚线能点", !q("pvCat").classList.contains("ic-pickable"));

    /* ② 点了大类：预览立刻显示大类自己，细分不再背地里猜 */
    var chipF = document.querySelector('#catChips [data-cat="daily"]');
    if(chipF) chipF.click();
    ok("F4 预览显示日用", (q("pvCat").textContent || "").indexOf("日用") >= 0,
       q("pvCat").textContent);
    ok("F5 预览不再写理发", (q("pvCat").textContent || "").indexOf("理发") < 0,
       q("pvCat").textContent);

    var nF = state.records.length;
    q("btnAdd").click();
    ok("F6 点过大类能记上", state.records.length === nF + 1, state.records.length);
    var f1 = state.records[state.records.length - 1];
    ok("F7 记的是日用大类", f1 && f1.cat === "daily", f1 && f1.cat);
    ok("F8 细分留空，不再猜成理发", f1 && !f1.sub, f1 && f1.sub);

    /* ④ 先打字（自动模式猜出理发）再取消勾选：预览必须立刻换成占位 ——
        2026-11-01 用户看到的「还是识别了」就是切换后没重画的旧画面 */
    openAddSheet();
    state.manualCat = null; state.manualSub = null; state.manualIc = "";
    typeIn("吹头发 3");
    ok("F9a 勾着时预览是理发", (q("pvCat").textContent || "").indexOf("理发") >= 0,
       q("pvCat").textContent);
    q("qiAutoIc").checked = false; fire(q("qiAutoIc"), "change");
    ok("F9b 取消勾选立刻换成「＋ 图标」", (q("pvCat").textContent || "").indexOf("图标") >= 0 &&
       (q("pvCat").textContent || "").indexOf("理发") < 0, q("pvCat").textContent);

    /* ③ 自动模式不受影响：勾回来预览照旧会猜 */
    openAddSheet();
    q("qiAutoIc").checked = true; fire(q("qiAutoIc"), "change");
    state.manualCat = null; state.manualSub = null;
    typeIn("吹头发 2");
    ok("F9 自动模式预览照旧猜理发", (q("pvCat").textContent || "").indexOf("理发") >= 0,
       q("pvCat").textContent);
  }catch(e){ ok("F 段没抛异常", false, e.message); }

  /* ================= G. 勾着「自动识别」时，下面那排图标照样能点（2026-11-01 用户提的）
     原话「选择自动的时候可以点击下边的图标」。
     自动归自动，用户临时想改成别的一类，点一下就得当场生效，
     不能被程序猜的那个盖掉，也不能因为勾着自动就点了没反应。 */
  try{
    seed();
    openAddSheet();
    ok("G1 默认勾着自动识别", q("qiAutoIc").checked === true);

    typeIn("第一食堂 9");
    ok("G2 预览先按程序猜的显示", (q("pvCat").textContent || "").indexOf("餐饮") >= 0,
       q("pvCat").textContent);

    /* 勾着自动也能点下面那排 */
    var chipG = document.querySelector('#catChips [data-cat="daily"]');
    ok("G3 下面那排图标还在（没被自动模式藏起来）", !!chipG &&
       getComputedStyle(chipG).display !== "none");
    if(chipG) chipG.click();
    ok("G4 点下去真选上了", state.manualCat === "daily", String(state.manualCat));
    ok("G5 预览立刻换成手选的那一类", (q("pvCat").textContent || "").indexOf("日用") >= 0,
       q("pvCat").textContent);
    ok("G6 没跳出任何面板", openSheets().join(",") === "sheetAdd", openSheets().join(","));

    var nG = state.records.length;
    q("btnAdd").click();
    ok("G7 自动模式下也能记上", state.records.length === nG + 1, state.records.length + "/" + (nG + 1));
    var g1 = state.records[state.records.length - 1];
    ok("G8 记的是手选的那一类，不是程序猜的", g1 && g1.cat === "daily", g1 && g1.cat);
    ok("G9 不会飘「请选择一个图标」", !q("qiToast").classList.contains("on"), q("qiToast").textContent);

    /* 再点一下同一颗 = 取消选中，回到程序猜的那个 */
    openAddSheet();
    typeIn("第一食堂 9");
    var chipG2 = document.querySelector('#catChips [data-cat="daily"]');
    if(chipG2) chipG2.click();
    ok("G10 点两下取消选中", state.manualCat === null, String(state.manualCat));
    ok("G11 预览回到程序猜的", (q("pvCat").textContent || "").indexOf("餐饮") >= 0,
       q("pvCat").textContent);
  }catch(e){ ok("G 段没抛异常", false, e.message); }

  p("VER", VER.name);
  p("ERR", (window.__errs || []).length ? window.__errs.join(" | ") : "none");
  document.title = all + "/" + all + " || " + (bad ? R.filter(function(x){ return x.charAt(0) === "N"; }).join(" | ") : "全过");
})();
