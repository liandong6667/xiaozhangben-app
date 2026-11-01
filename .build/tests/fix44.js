/* fix44：「选个分类」面板右上角「编辑」（2026-11-01）
   用户原话：「在这个地方的右上角搞一个编辑，点击之后用户可以删除一些不想要的图标，
   同时每个大分类的最末尾会出现一个加号，这是给用户自己添加图标的选择，
   至于怎么添加搞成昨天晚上和账本图标添加的样式就行了」。
   所以验四件事：
     ① 有「编辑」，点进去才出现 ✕ 和 ＋；
     ② ✕ 把内置细分藏起来（不是真删），点 ↺ 能恢复；
     ③ ＋ 用账本图标那套两行添加器，加完立刻在分组里出现；
     ④ 藏掉的分类：历史账目照样认得出名字，存读档、备份都不丢。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix44 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }
  function fire(el){ el.dispatchEvent(new Event("input")); }
  function grid(){ return document.getElementById("catGrid"); }
  function chipBySub(sub){
    var r = null;
    grid().querySelectorAll("[data-sub]").forEach(function(b){ if(b.dataset.sub === sub) r = b; });
    return r;
  }

  function step1(){
    localStorage.removeItem("xiaozhangben.v3");
    load(); renderAll(); renderHome();
    state.manualType = "expense";
    openCatSheet();

    /* ===== A. 没点编辑之前，干干净净 ===== */
    ok("A1 面板开着", document.getElementById("sheetCat").classList.contains("on"));
    ok("A2 右上角有「编辑」", !!document.getElementById("catEdit"));
    eq("A3 默认写着「编辑」", document.getElementById("catEdit").textContent, "编辑");
    eq("A4 默认没有 ✕", grid().querySelectorAll("[data-sdel]").length, 0);
    eq("A5 默认没有 ＋", grid().querySelectorAll("[data-catadd]").length, 0);
    ok("A6 默认分组里是「咖啡」这种细分", !!chipBySub("coffee"));

    /* ===== B. 点编辑 ===== */
    document.getElementById("catEdit").click();
    eq("B1 点完变成「完成」", document.getElementById("catEdit").textContent, "完成");
    var nCat = catsOf("expense").length;
    eq("B2 每个大类尾巴一个 ＋", grid().querySelectorAll("[data-catadd]").length, nCat);
    var nSub = 0;
    catsOf("expense").forEach(function(c){ nSub += subsOf(c.k).length; });
    eq("B3 每个细分右上角一个 ✕", grid().querySelectorAll("[data-sdel]").length, nSub);
    eq("B4 大类自己那格不给 ✕", grid().querySelectorAll(".sub-main [data-sdel]").length, 0);
    ok("B5 编辑态不顶提示行（免得把分类挤下去）",
       (document.getElementById("catSub").textContent || "") === "" &&
       document.getElementById("catSub").style.display === "none");
    ok("B6 减号是金黄、＋是绿，两种颜色分得开（都不是品牌红）",
       (function(){
         var cx = grid().querySelector(".cx");
         if(!cx) return false;
         var css = Array.prototype.slice.call(document.styleSheets).reduce(function(a, sh){
           try{ return a + Array.prototype.slice.call(sh.cssRules).map(function(r){ return r.cssText; }).join(""); }
           catch(e){ return a; }
         }, "").replace(/\s+/g, "");
         function rule(sel){
           var i = css.indexOf(sel + "{");
           return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
         }
         var cxR = rule(".cat-chip.cx"), addR = rule(".sub-add");
         return cxR.indexOf("--cx") >= 0 && cxR.indexOf("--brand") < 0 &&
                addR.indexOf("--ok") >= 0 && addR.indexOf("--brand") < 0 &&
                (cx.textContent || "").indexOf("−") >= 0;
       })());

    /* ===== C. 藏掉「咖啡」 ===== */
    var cof = chipBySub("coffee");
    ok("C1 咖啡上有个 ✕", !!cof && !!cof.querySelector("[data-sdel]"));
    cof.querySelector("[data-sdel]").click();
    ok("C2 hideSubs 里记下了", (state.hideSubs || []).indexOf("food:coffee") >= 0);
    ok("C3 编辑态里它变成灰的那一格（能点 ↺ 回来）",
       !!grid().querySelector('[data-sres="food:coffee"]'));
    eq("C4 subsOf 不再给出咖啡",
       subsOf("food").filter(function(s){ return s.k === "coffee"; }).length, 0);
    ok("C5 但 subOf 还认得它（老账不会变空白）", (subOf("coffee") || {}).n === "咖啡");
    eq("C6 猜分类也不再猜成咖啡", subGuess("喝咖啡", "food"), "");

    /* 退出编辑：灰格子收起来，咖啡彻底看不见 */
    document.getElementById("catEdit").click();
    eq("C7 退出编辑后没有 ✕", grid().querySelectorAll("[data-sdel]").length, 0);
    eq("C8 也没有恢复用的灰格子", grid().querySelectorAll("[data-sres]").length, 0);
    ok("C9 咖啡真的看不见了", !chipBySub("coffee"));

    /* ===== D. 存读档：藏的还是藏着的 ===== */
    save(); load();
    ok("D1 读档后 hideSubs 还在", (state.hideSubs || []).indexOf("food:coffee") >= 0);
    state.manualType = "expense";
    openCatSheet();
    ok("D2 重开面板咖啡还是看不见", !chipBySub("coffee"));

    /* ===== E. 恢复 ===== */
    document.getElementById("catEdit").click();
    var back = grid().querySelector('[data-sres="food:coffee"]');
    ok("E1 灰格子还在", !!back);
    back.click();
    eq("E2 hideSubs 清空了", (state.hideSubs || []).length, 0);
    ok("E3 咖啡回来了", !!chipBySub("coffee"));
    eq("E4 又能猜出咖啡了", subGuess("喝咖啡", "food"), "coffee");
  }

  function step2(){
    /* ===== F. ＋ 自己加一个细分 ===== */
    /* step1 结束时已经停在编辑态了，别再多点一下把它关掉 */
    if(!document.getElementById("catEdit").classList.contains("on"))
      document.getElementById("catEdit").click();
    var addBtn = grid().querySelector('[data-catadd="food"]');
    ok("F1 餐饮那行有 ＋", !!addBtn);
    addBtn.click();
    var box = document.getElementById("catAddBox");
    ok("F2 添加器出来了", !!box);
    ok("F2b 里面写着「可选择只填其中一项」，还带一句「注」",
       !!box && !!box.querySelector(".ad-tip") &&
       (box.querySelector(".ad-tip").textContent || "").indexOf("可选择只填其中一项") >= 0 &&
       (box.querySelector(".ad-tip").textContent || "").indexOf("两个都填") >= 0);
    ok("F2c 图标面板（新建账本那套）也有同一句提示",
       !!document.getElementById("icAddRow").querySelector(".ad-tip"));
    eq("F3 两行（表情 / 文字）", box ? box.querySelectorAll("[data-adrow]").length : 0, 2);
    eq("F4 两个圈", box ? box.querySelectorAll("[data-adck]").length : 0, 2);
    eq("F5 只有添加和取消两个按钮", box ? box.querySelectorAll("button").length : 0, 2);
    var ti = box.querySelector('[data-adin="txt"]');
    ti.value = "奶茶店"; fire(ti);
    var pi = box.querySelector('[data-adin="pic"]');
    pi.value = "🧋"; fire(pi);
    box.querySelector("[data-adok]").click();
    eq("F6 存进 customSubs", (state.customSubs || []).length, 1);
    eq("F7 挂在大类下", (state.customSubs || [])[0].cat, "food");
    eq("F8 名字存对（4 个字也放得下）", (state.customSubs || [])[0].txt, "奶茶店");
    ok("F9 添加器收起来了", !document.getElementById("catAddBox"));
    var mine = null;
    grid().querySelectorAll(".cat-chip").forEach(function(c){
      if(c.textContent.indexOf("奶茶店") >= 0) mine = c;
    });
    ok("F10 分组里立刻多了一个「奶茶店」", !!mine);
    ok("F11 自己加的也有 ✕", !!mine && !!mine.querySelector("[data-sdel]"));

    /* ===== G. 删自己加的 = 真删 ===== */
    mine.querySelector("[data-sdel]").click();
    eq("G1 customSubs 里没了", (state.customSubs || []).length, 0);
    eq("G2 也没进 hideSubs（它本来就不在列表里）", (state.hideSubs || []).length, 0);
    ok("G3 分组里也没了", !grid().querySelector('[data-sub^="cs"]'));

    /* ===== H. 编辑态点标签不会把分类选跑 ===== */
    var nBefore = state.manualCat;
    var anyChip = grid().querySelector('[data-sub="tea"]') || grid().querySelector("[data-sub]");
    anyChip.click();
    eq("H1 点了还是停在编辑态（没跳回补记）", state.manualCat, nBefore);
    ok("H2 补记那层没被打开", !document.getElementById("sheetAdd").classList.contains("on"));

    /* ===== I. 备份带上 hideSubs ===== */
    state.hideSubs = ["fun:game", "food:coffee"];
    save();
    var src = [].slice.call(document.querySelectorAll("script"))
      .map(function(s){ return s.textContent || ""; }).join("");
    ok("I1 导出备份里写了 hideSubs", src.indexOf("hideSubs: state.hideSubs") >= 0);
    state.hideSubs = [];
    applyBackup({records: [], books: [], peerRules: {},
      hideSubs: ["fun:game", "food:coffee", "乱七八糟"]});
    ok("I2 恢复备份带回了两个", (state.hideSubs || []).length, 2);
    ok("I3 乱七八糟的字符串被丢掉", (state.hideSubs || []).indexOf("乱七八糟") < 0);
  }

  setTimeout(function(){
    try{ step1(); }catch(e){ log.push("N例外1:" + (e && e.message)); }
    setTimeout(function(){
      try{ step2(); }catch(e){ log.push("N例外2:" + (e && e.message)); }
      report();
    }, 400);
  }, 750);
})();
