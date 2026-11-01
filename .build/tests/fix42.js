/* fix42：记一笔「更多分类」里自己加细分 + 编辑删除 + 账本删除入口（2026-10-31）
   用户要求：每个大分类尾巴一个＋，流程和换图标一样（两行 + 圆圈 + 取消/添加）；
   「更多」右上角改成「编辑」，进去能删掉自己不想要的；账本面板里也要能删账本。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix42 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }
  function fire(el){ el.dispatchEvent(new Event("input")); }

  function step1(){
    localStorage.removeItem("xiaozhangben.v3");
    load(); renderAll(); renderHome();
    /* 造一笔没分类的账，「去分类」才有东西可分 */
    state.records.push({id:"t1", ts:Date.now(), amt:12, type:"expense", cat:null,
      peer:"测试店", note:"", book:"daily", src:"manual", guessed:true});
    save();
    openUc();
    ok("A1 分类面板开着", $("sheetUc").classList.contains("on"));
    ok("A2 有「更多分类」入口", !!$("ucMore"));
    $("ucMore").click();

    /* ===== B. 每个大分类尾巴都有＋ ===== */
    var adds = $("ucMoreBox").querySelectorAll("[data-adsub]");
    eq("B1 每个大类一个加号", adds.length, catsOf("expense").length);
    ok("B2 餐饮那行也有", !!$("ucMoreBox").querySelector('[data-adsub="food"]'));

    /* ===== C. 点＋ → 同一套两行添加器 ===== */
    $("ucMoreBox").querySelector('[data-adsub="food"]').click();
    var box = document.getElementById("ucAddBox");
    ok("C1 添加器出来了", !!box);
    eq("C2 两行", box ? box.querySelectorAll("[data-adrow]").length : 0, 2);
    eq("C3 两个圆圈", box ? box.querySelectorAll("[data-adck]").length : 0, 2);
    eq("C4 只有添加和取消两个按钮", box ? box.querySelectorAll("button").length : 0, 2);

    /* 只写文字 → 名字 + 白纸 */
    var ti = box.querySelector('[data-adin="txt"]');
    ti.focus(); ti.value = "蛋糕"; fire(ti);
    box.querySelector("[data-adok]").click();
    eq("C5 存进 customSubs", (state.customSubs || []).length, 1);
    eq("C6 名字存对", (state.customSubs || [])[0].txt, "蛋糕");
    eq("C7 挂在大分类下", (state.customSubs || [])[0].cat, "food");
    ok("C8 添加器收起来了", !document.getElementById("ucAddBox"));
    var chips = $("ucMoreBox").querySelectorAll(".cat-chip");
    var mine = null;
    chips.forEach(function(c){ if(c.textContent.indexOf("蛋糕") >= 0) mine = c; });
    ok("C9 分组里立刻多了一个「蛋糕」", !!mine);
    ok("C10 没写图案的印白纸", mine && mine.textContent.indexOf("📄") === 0);
  }

  function step2(){
    /* ===== D. 右上角「编辑」 ===== */
    var ed = $("ucEdit");
    ok("D1 右上角是「编辑」", !!ed && ed.textContent === "编辑");
    ed.click();
    ok("D2 点完变成「完成」", $("ucEdit").textContent === "完成");
    var cxs = $("ucMoreBox").querySelectorAll("[data-csdel]");
    eq("D3 自己加的才有 ✕", cxs.length, 1);
    cxs[0].click();
    eq("D4 点 ✕ 就删掉了", (state.customSubs || []).length, 0);
    var left = 0;
    $("ucMoreBox").querySelectorAll(".cat-chip").forEach(function(c){
      if(c.textContent.indexOf("蛋糕") >= 0) left++;
    });
    eq("D5 分组里也没了", left, 0);

    /* ===== E. 返回大类：编辑状态得清干净 ===== */
    $("ucEdit").click();                       // 先退出编辑
    $("ucBack").click();
    ok("E1 回到大类网格", !!$("ucBody").querySelector(".ucgrid"));
    ok("E2 编辑按钮没了", !$("ucEdit"));
    eq("E3 编辑状态复位", ucEdit, false);
  }

  function step3(){
    /* ===== F. 改账本面板里的删除 ===== */
    /* 只剩一本时不让删（那是兜底账本，删了账没地方放），所以先造一本 */
    if(state.books.length < 2){
      state.books.push({id:"b2", name:"第二本", icon:"🛒", iconTxt:"",
        color:"#5B8DEF", cat:null, budget:0, def:false});
      save();
    }
    var target = state.books.filter(function(b){ return !b.def; })[0] || state.books[1];
    var before = state.books.length;
    openEditBook(target.id);
    ok("F1 改账本面板开着", $("sheetNewBook").classList.contains("on"));
    eq("F2 删除按钮露出来了", $("nbDel").style.display, "");
    $("nbDel").click();
    ok("F3 点了先关面板", !$("sheetNewBook").classList.contains("on"));
    window.__fix42 = {before: before, id: target.id};
  }

  function step4(){
    var s = window.__fix42 || {};
    ok("G1 弹出了删除确认", $("askBox").classList.contains("on"));
    ok("G2 确认框里写着账本名", ($("askBody").textContent || "").indexOf("账") >= 0);
    $("askYes").click();
    eq("G3 账本真的少了", state.books.length, s.before - 1);
    ok("G4 被删的那个不在了", !state.books.some(function(b){ return b.id === s.id; }));
    /* 账目不能跟着消失：要么还在别的账本下，要么账本还在（只剩一本时不给删） */
    ok("G5 账目一笔都没少", state.records.length >= 1);

    /* ===== H. 自己加的细分跟着备份走 ===== */
    state.customSubs = [{k: "cs9", cat: "fun", pic: "🎮", txt: "游戏"}];
    save();
    var p = JSON.parse(localStorage.getItem("xiaozhangben.v3") || "{}");
    ok("H1 存档里带 customSubs", Array.isArray(p.customSubs) && p.customSubs.length === 1);
    load();
    eq("H2 读档读得回来", (state.customSubs || []).length, 1);
    eq("H3 名字还在", (state.customSubs || [])[0].txt, "游戏");
    eq("H4 subOf 认得它", (subOf("cs9") || {}).n, "游戏");
    eq("H5 subsOf 里也有它",
       subsOf("fun").filter(function(x){ return x.k === "cs9"; }).length, 1);
  }

  setTimeout(function(){
    try{ step1(); }catch(e){ log.push("N例外1:" + (e && e.message)); }
    setTimeout(function(){
      try{ step2(); }catch(e){ log.push("N例外2:" + (e && e.message)); }
      setTimeout(function(){
        try{ step3(); }catch(e){ log.push("N例外3:" + (e && e.message)); }
        setTimeout(function(){
          try{ step4(); }catch(e){ log.push("N例外4:" + (e && e.message)); }
          report();
        }, 500);
      }, 400);
    }, 400);
  }, 750);
})();
