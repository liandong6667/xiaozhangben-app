/* ============================================================
   深跑脚本 第 1 轮：装成真 App 走一遍完整流程
   只做"用户会做的动作"，不直接改 state（除了读断言）
   ============================================================ */
(function(){
  var L = [], errs = [];
  window.onerror = function(m){ errs.push("onerror:" + m); };
  window.addEventListener("unhandledrejection", function(e){
    errs.push("reject:" + ((e.reason && e.reason.message) || e.reason));
  });
  var ce = console.error;
  console.error = function(){ errs.push("cerr:" + [].slice.call(arguments).join(" ")); ce.apply(console, arguments); };
  function ok(n, c){ L.push((c ? "Y" : "N") + n); }
  function type(el, v){ el.value = v; el.dispatchEvent(new Event("input")); }

  setTimeout(function(){
    try{
      /* ---------- 0. 装成第一次打开 ---------- */
      try{ localStorage.removeItem("xiaozhangben.v3"); localStorage.removeItem("xzb.theme"); }catch(e){}
      load(); applyTheme(); renderAll(); renderHome();
      ok("初始0笔", state.records.length === 0);
      ok("默认账本1个", state.books.length === 1);

      /* ---------- 1. 手动记一笔（走 UI） ---------- */
      openAddSheet();
      type($("qi"), "今天中午吃饭花了15");
      ok("预览认出15", ($("pvAmt").textContent || "").indexOf("15") >= 0);
      $("btnAdd").click();
      ok("记上1笔", state.records.length === 1);
      ok("金额对", state.records[0] && Math.abs(state.records[0].amt - 15) < 0.01);
      ok("是支出", state.records[0] && state.records[0].type === "expense");
      ok("落日常", state.records[0] && state.records[0].book === "daily");

      /* ---------- 2. 收入一笔 ---------- */
      openAddSheet();
      document.querySelector('#segType [data-t="income"]').click();
      type($("qi"), "收到生活费2000");
      $("btnAdd").click();
      ok("收入也进", state.records.filter(function(r){ return r.type === "income"; }).length === 1);

      /* ---------- 3. 新建账本（绑餐饮）+ 在里面记账 ---------- */
      openNewBook();
      type($("nbName"), "吃饭");
      var chip = document.querySelector('#nbCats [data-icchip="🍽️"]');
      if(chip) chip.click();
      createBook();
      var nb = state.books.filter(function(b){ return b.name === "吃饭"; })[0];
      ok("账本建好", !!nb);
      ok("绑了餐饮", nb && nb.cat === "food");
      if(nb){
        state.book = nb.id; renderFlow();
        openAddSheet();
        type($("qi"), "奶茶12");
        $("btnAdd").click();
        var last = state.records[state.records.length - 1];
        ok("记进当前账本", last && last.book === nb.id);
      }

      /* ---------- 4. 账本选择器切回总账本 ---------- */
      openBookPicker();
      var allPick = document.querySelector('#pickBody [data-pick="all"]');
      ok("选择器有总账本", !!allPick);
      if(allPick) allPick.click();
      ok("切回总账本", state.book === "all");

      /* ---------- 5. 导入粘贴账单 ---------- */
      openSheet("sheetImp");
      $("pasteArea").value = [
        "2026-10-20 12:30:00  美团外卖  支出  25.00",
        "2026-10-19 08:10:00  中国移动  支出  50.00",
        "2026-10-18 20:00:00  收到生活费  收入  2000.00"
      ].join("\n");
      var before = state.records.length;
      $("btnParsePaste").click();
      ok("导入进账", state.records.length > before);
      ok("导入后天数", state.records.length - before === 3);

      /* ---------- 6. 重复导入应被去重 ---------- */
      openSheet("sheetImp");
      $("pasteArea").value = "2026-10-20 12:30:00  美团外卖  支出  25.00";
      var mid = state.records.length;
      $("btnParsePaste").click();
      ok("重复不入", state.records.length === mid);

      /* ---------- 7. 四个 tab 都能进 ---------- */
      ["home", "flow", "stats", "me"].forEach(function(t){
        document.querySelector('.tab[data-tab="' + t + '"]').click();
        var on = document.querySelector("#pg-" + t).classList.contains("on");
        ok("tab-" + t, on);
      });

      /* ---------- 8. 待分类筛选 + 统计展开 ---------- */
      document.querySelector('.tab[data-tab="flow"]').click();
      state.filter = "uncat"; renderFlow();
      ok("待分类不炸", $("flowBody").innerHTML.length > 0);
      state.filter = "all"; renderFlow();
      document.querySelector('.tab[data-tab="stats"]').click();
      $("btnStats").click();
      ok("报表展开", $("statsBody").style.display === "block");
      ok("报表有内容", $("statsBody").innerHTML.length > 50);
      $("btnStats").click();

      /* ---------- 9. 月份前后翻 ---------- */
      var m0 = state.viewMonth.m;
      document.querySelector('.monthnav [data-m="-1"]').click();
      ok("上个月", state.viewMonth.m !== m0);
      document.querySelector('.monthnav [data-m="1"]').click();
      ok("回到本月", state.viewMonth.m === m0);

      /* ---------- 10. 改一笔分类（走面板） ---------- */
      document.querySelector('.tab[data-tab="flow"]').click();
      var target = state.records.filter(function(r){ return r.type === "expense"; })[0];
      if(target){
        openCatFor(target.id);
        var btns = [].slice.call(document.querySelectorAll("#ucBody [data-k]"));
        ok("分类面板有按钮", btns.length > 0);
        // 故意挑一个跟当前不一样的分类，否则"没变化"不能算 bug
        var pick = btns.filter(function(b){ return b.dataset.k !== target.cat; })[0];
        if(pick) pick.click();
        var after = state.records.filter(function(r){ return r.id === target.id; })[0];
        ok("分类改掉了", !!pick && after.cat === pick.dataset.k);
        closeSheets();
      }

      /* ---------- 11. 删除要确认，且取消真的不删 ---------- */
      var cnt = state.records.length;
      openCatFor(state.records[0].id);
      var dl = $("ucDel");
      ok("单笔删要确认", !!dl);
      if(dl){ dl.click(); ok("弹窗出来了", $("askBox").classList.contains("on")); $("askNo").click(); }
      ok("取消后没删", state.records.length === cnt);

      /* ---------- 12. 六个配色 × 三档明暗 ---------- */
      var skins = ["orange", "green", "blue", "purple", "rose", "ink"];
      var skinOk = true;
      skins.forEach(function(k){
        setSkin(k);
        if(document.documentElement.getAttribute("data-skin") !== k) skinOk = false;
      });
      ok("六色都切换", skinOk);
      var bg1 = getComputedStyle(document.body).backgroundColor;
      setMode("dark");
      var bg2 = getComputedStyle(document.body).backgroundColor;
      setMode("light");
      var bg3 = getComputedStyle(document.body).backgroundColor;
      ok("深浅色真的变了", bg1 !== bg2 && bg2 !== bg3);
      setSkin("orange"); setMode("auto");

      /* ---------- 13. 导出不报错 ---------- */
      try{ doExport(); ok("导出没炸", true); }catch(e){ ok("导出没炸", false); }

      /* ---------- 14. 重启前记下账本数 ---------- */
      ok("最后笔数", state.records.length >= 6);
      try{ localStorage.setItem("deep.expect", JSON.stringify({
        n: state.records.length, books: state.books.length,
        sum: state.records.reduce(function(a, r){ return a + (r.type === "income" ? 0 : r.amt); }, 0)
      })); }catch(e){}
    }catch(e){ errs.push("脚本错误:" + e.message + "@" + (e.stack || "").split("\n")[1]); }
    document.title = "RUN1 " + L.join(" | ") + " || ERR " + (errs.length ? errs.join(" ; ") : "none");
  }, 600);
})();
