/* walkuse：按真人操作顺序把新版点一遍（2026-11-01）。
   不是验某个修复，而是回答"用起来会不会硌手"：
     A. 记一笔：打一句话 → 点「记上」→ 真的落库了吗？金额/分类/商户对不对？
     B. 预览卡有没有把"认成哪家店"告诉用户？
     C. 分类编辑：删一个细分之后，已经记过的老账还认得出它吗？
     D. 添加器只填文字 / 只填表情，各自长什么样？
     E. 新建账本：「预算」框和「名字」框是不是一样宽（以前 number 框会掉回浏览器默认窄框）？
     F. 整个过程有没有 JS 报错。 */
(function(){
  var log = [], errs = [];
  window.onerror = function(m){ errs.push(m); };
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    log.push((errs.length ? "N" : "Y") + "F1 全程无 JS 报错" + (errs.length ? "[" + errs[0] + "]" : ""));
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "walkuse " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }
  function fire(el){ el.dispatchEvent(new Event("input", {bubbles:true})); }
  function last(){ return state.records[state.records.length - 1]; }

  function step1(){
    localStorage.removeItem("xiaozhangben.v3");
    load(); renderAll(); renderHome();

    /* ===== A. 真人记一笔 ===== */
    var n0 = state.records.length;
    openAddSheet();                       // 首页点「记一笔」
    var q = document.getElementById("qi");
    q.value = "中午食堂吃饭15";
    fire(q); previewManual();
    ok("A1 打完字就有预览", document.getElementById("pv").classList.contains("show"));
    ok("A2 预览认成餐饮", (document.getElementById("pvCat").textContent || "").indexOf("餐") >= 0);
    ok("A3 预览金额是 15", (document.getElementById("pvAmt").textContent || "").indexOf("15") >= 0);
    /* 2026-11-01 走查报的两条已经改掉了（fix45 验的是同一件事）：
       ① 预览卡现在会念出认成哪家店；
       ② 商户名尾巴上的「吃饭」不再跟着走。 */
    ok("A4 预览卡上写清了认成哪家店",
       (document.getElementById("pv").textContent || "").indexOf("食堂") >= 0);

    document.getElementById("btnAdd").click();     // 点「记上」
    eq("A5 真落了一笔", state.records.length, n0 + 1);
    eq("A6 金额 15", last().amt, 15);
    eq("A7 分类是餐饮", last().cat, "food");
    eq("A8 商户只留店名，不带「吃饭」", last().peer, "食堂");
    ok("A9 记完面板还开着（方便接着记下一笔）",
       document.getElementById("sheetAdd").classList.contains("on"));
    ok("A10 输入框自己清空了", document.getElementById("qi").value === "");

    /* ===== B. 分类编辑：删一个细分 ===== */
    openAddSheet(); openCatSheet();
    var ce = document.getElementById("catEdit");
    ok("B0 分类面板的「编辑」按钮在", !!ce);
    if(ce) ce.click();
    var cof = null;
    document.getElementById("catGrid").querySelectorAll("[data-sub]").forEach(function(b){
      if(b.dataset.sub === "coffee") cof = b;
    });
    ok("B1 编辑态里咖啡有减号", !!cof && !!cof.querySelector("[data-sdel]"));
    if(cof) cof.querySelector("[data-sdel]").click();
    ok("B2 藏起来了", (state.hideSubs || []).indexOf("food:coffee") >= 0);
    ok("B3 面板里不再列出咖啡",
       !document.getElementById("catGrid").querySelector('[data-sub="coffee"]'));
    ok("B4 老账还认得出咖啡这个名字", (subOf("coffee") || {}).n === "咖啡");

    /* ===== C. 添加器：只填文字 / 只填表情 ===== */
    var addBtn = document.getElementById("catGrid").querySelector('[data-catadd="food"]');
    ok("C0 还停在编辑态（有 ＋ 可点）", !!addBtn);
    if(addBtn) addBtn.click();
    var box = document.getElementById("catAddBox");
    var ti = box.querySelector('[data-adin="txt"]');
    ti.value = "夜宵摊";
    fire(ti);
    box.querySelector("[data-adok]").click();
    eq("C1 只填文字也能加", (state.customSubs || []).length, 1);
    eq("C2 文字存对了", (state.customSubs || [])[0].txt, "夜宵摊");
    eq("C3 图案是空的", (state.customSubs || [])[0].pic, "");

    /* ===== D. 新建账本：预算框宽度 ===== */
    openNewBook();
    var wName = document.getElementById("nbName").getBoundingClientRect().width;
    var wBud = document.getElementById("nbBud").getBoundingClientRect().width;
    ok("D1 预算框跟名字框一样宽（" + Math.round(wName) + " vs " + Math.round(wBud) + "）",
       Math.abs(wName - wBud) < 2);
    var bd = getComputedStyle(document.getElementById("nbBud"));
    ok("D2 预算框没有多余的边框和底色", bd.borderTopWidth === "0px" && bd.backgroundColor === "rgba(0, 0, 0, 0)");
  }

  setTimeout(function(){
    try{ step1(); }catch(e){ log.push("N例外:" + (e && e.message)); }
    report();
  }, 900);
})();
