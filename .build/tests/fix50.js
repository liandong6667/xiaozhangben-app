/* 1.6.106 走查：三件用户报的事
   ① 关掉「自动识别图标」之后，图标得自己挑，没挑不许记；
   ② 左滑的「编辑」换成「备注」（分类点图标就能改，编辑是重复入口）；
   ③ 「以后都算这一类」连细分一起记 —— 吹头发改成洗护，下一笔别再回理发。 */
(function(){
  var R = [], all = 0, bad = 0;
  function p(k, v){ R.push(k + "=" + v); }
  function ok(name, cond, extra){ all++; if(!cond) bad++; p((cond ? "Y" : "N") + name, extra || ""); }
  function q(id){ return document.getElementById(id); }
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

  /* ================= A. 图标：关掉自动识别就得自己挑 =================
     2026-11-01 用户把交互最终敲定成这样：
       · 面板里**不摆任何常驻入口**（那行虚线「点这里挑一个图标」被要求删掉）；
       · 没挑图标点「记上」→ 不记账，底部飘一行淡色小字「请选择一个图标」，几秒自己淡掉；
       · 同时把挑图标的面板推出来（光提示不给去处，用户不知道去哪挑）。 */
  try{
    seed();
    openAddSheet();
    ok("A1 默认勾着自动识别", q("qiAutoIc").checked === true);
    ok("A2 面板里没有那行虚线框", !q("qiIcBtn") && !q("qiIcNeed") && !q("qiIcBox"));

    q("qiAutoIc").checked = false; fire(q("qiAutoIc"), "change");
    ok("A3 取消勾选后面板保持原样", !q("qiIcBtn") && !q("qiIcNeed"));

    /* 没挑就点「记上」 */
    var n0 = state.records.length;
    typeIn("吹头发 1");
    q("btnAdd").click();
    ok("A4 没挑图标不让记", state.records.length === n0, state.records.length + "/" + n0);
    ok("A5 底部飘出「请选择一个图标」", q("qiToast").classList.contains("on") &&
       (q("qiToast").textContent || "").indexOf("请选择一个图标") >= 0, q("qiToast").textContent);
    ok("A6 补记面板还开着", q("sheetAdd").classList.contains("on"));
    /* 2026-11-01 用户：别再弹那个画面；下方小字只是提醒，不弹面板、不当入口 */
    ok("A7 挑图标面板不再自动弹", !q("sheetIc").classList.contains("on"));
    ok("A8 飘字不可点（纯提醒）", getComputedStyle(q("qiToast")).pointerEvents === "none",
       getComputedStyle(q("qiToast")).pointerEvents);
    ok("A9 面板里没有常驻的挑图标入口", !q("qiIcBtn") && !document.querySelector(".ic-pick-row"));
    /* 入口就是预览里那个分类图案：取消勾选时它带一圈虚线（表示能点），点了才开面板 */
    ok("A10 取消勾选后预览图案变成可点", q("pvCat").classList.contains("ic-pickable"));
    q("pvCat").click();
    ok("A11 点预览图案才开面板", q("sheetIc").classList.contains("on") && icPickMode === "manual",
       icPickMode);
    closeSheets();

    openIcPick("", "manual");
    ok("A9b 勾着自动识别时预览图案不可点", !q("pvCat").classList.contains("ic-pickable"));
    ok("A9c 标题是「给这一笔挑个图标」", (q("icTitle").textContent || "").indexOf("给这一笔") === 0,
       q("icTitle").textContent);
    var cell = document.querySelector('#icPick [data-ic="🧴"]');
    ok("A10 面板里能选到洗护那个图案", !!cell);
    if(cell) cell.click();
    ok("A11 挑的存进了待记的那一笔", state.manualIc === "🧴", state.manualIc);

    q("icDone").click();
    ok("A12 「用这个图标」回到补记面板", q("sheetAdd").classList.contains("on"));
    ok("A13 挑图标那张收起来了", !q("sheetIc").classList.contains("on"));
    ok("A14 刚打的字还在", q("qi").value === "吹头发 1", q("qi").value);
    ok("A15 落脚话「图标选好了」", (q("qiToast").textContent || "").indexOf("图标选好了") >= 0,
       q("qiToast").textContent);

    q("btnAdd").click();
    ok("A16 这回记上了", state.records.length === n0 + 1, state.records.length);
    var last = state.records[state.records.length - 1];
    ok("A17 图标挂到这一笔上了", last && last.ic === "🧴", last && last.ic);
    ok("A18 记完把手挑的清掉", state.manualIc === "", state.manualIc);

    /* 勾回去：手挑的作废 */
    q("qiAutoIc").checked = true; fire(q("qiAutoIc"), "change");
    ok("A19 勾回来手挑的清空", state.manualIc === "");

    /* 勾着的时候记一笔：图标留空，交给程序认 */
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

    /* 面板两种模式说两种话 —— 以前同一个面板同一句话，用户以为"根本没变化" */
    var a2 = q("qiAutoIc"); a2.checked = false; fire(a2, "change");
    openIcPick("", "manual");
    ok("D4 手动模式标题是「给这一笔挑个图标」",
       (q("icTitle").textContent || "").indexOf("给这一笔") === 0, q("icTitle").textContent);
    ok("D5 副标题带上那句话", (q("icSub").textContent || "").indexOf("吹头发") >= 0, q("icSub").textContent);
    ok("D6 按钮换成「用这个图标」", q("icDone").textContent === "用这个图标", q("icDone").textContent);
    q("icDone").click();
    ok("D7 点完回到补记面板", q("sheetAdd").classList.contains("on") &&
       !q("sheetIc").classList.contains("on"));
    ok("D8 挑图标那张收掉了", !q("sheetIc").classList.contains("on"));

    /* 给已有账目换图标时，面板得保持原来那套话 */
    openIcPick("r1");
    ok("D9 换图标模式标题还是「挑个图标」", q("icTitle").textContent === "挑个图标", q("icTitle").textContent);
    ok("D10 按钮是「好了」", q("icDone").textContent === "好了", q("icDone").textContent);
    closeSheets();
  }catch(e){ ok("D 段没抛异常", false, e.message); }

  p("VER", VER.name);
  p("ERR", (window.__errs || []).length ? window.__errs.join(" | ") : "none");
  document.title = all + "/" + all + " || " + (bad ? R.filter(function(x){ return x.charAt(0) === "N"; }).join(" | ") : "全过");
})();
