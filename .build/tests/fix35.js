/* 首屏不画流水页（2026-10-26，"刚进 app 点加减号卡"）
   ------------------------------------------------------------------
   用户原话："首页的加减号不流畅，一般都出现在用户刚点进去 app 的时候。"

   用 CDP 量出来的（CPU 降速 6 倍，模拟中低端安卓，800 笔账）：
     改前：启动后主线程被三块长任务连着占满  157ms → 635ms
           （208 + 165 + 82ms，脚本执行 / 首屏布局 / 预热）
           用户一看到界面就去点那个 −，点击只能排在后面 —— 那就是"卡"。
     最大那块是 renderFlow：800 笔记录光建 DOM 就要 98ms，
     而用户此刻看的是首页，这些节点他一个都看不见。
     改后：只剩两块固定开销（75 + 141ms，忙到 373ms），
     而且 50 笔和 3000 笔量出来一样（248ms vs 266ms）—— 不再随账目数变长。

   ★ 关键分寸：只跳过"启动那一趟"（_bootLazy），不是永远懒渲染。
     一开始我图省事写成"流水页不可见就不画"，结果 50 多条老测试一起红 ——
     翻月份、导入账单、恢复备份、删账这些地方都靠 renderAll 让明细立刻更新，
     永远跳过就等于让用户切过去看到旧数据。所以这里两头都要守住。

   验证点：
     1. 启动态（_bootLazy）在首页：流水页不画
     2. 但首页的金额、最近列表、待分类小红点必须照常 ——
        这三样原来挂在 renderFlow → renderSum 里，一起省掉会让首页
        变成 "¥0.00 + 空白 + 没有小红点"（这个坑真踩到过，截图确认的）
     3. 启动态下切到流水页，照样画
     4. 启动结束后（_bootLazy=false）renderAll 必须完整渲染 —— 守住"不许懒到永远"
     5. 首页分完类，小红点立刻减（不用等流水页重画） */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  function items(){ return document.querySelectorAll("#flowBody .item").length; }

  setTimeout(function(){
    try{
      var now = new Date();
      var Y = now.getFullYear(), M = now.getMonth();

      var recs = [];
      for(var i = 0; i < 120; i++){
        recs.push({
          id: "f" + i,
          ts: new Date(Y, M, 1 + (i % 20), 9, 0, 0).getTime(),
          amt: 10, type: "expense",
          cat: i < 4 ? null : "food",
          peer: "店" + i, note: "", book: "daily", src: "manual"
        });
      }
      var oldRecs = state.records, oldVm = state.viewMonth;
      state.records = recs;
      state.viewMonth = {y: Y, m: M};
      state._flowKey = null;
      state.book = "all"; state.filter = "all";

      /* ===== 1. 启动态：在首页，流水页不许画 =====
         ★ 这里刻意不用 goto("home")：goto 内部会调 renderHome，
           首页被它顺手刷好，就掩盖掉"renderAll 里忘了调 renderGlobals"这个错。
           真实启动时没有任何 goto，只有一次 renderAll —— 就照那个来。 */
      _bootLazy = true;
      document.querySelectorAll(".page").forEach(function(p){ p.classList.remove("on"); });
      document.getElementById("pg-home").classList.add("on");
      document.getElementById("flowBody").innerHTML = "";
      document.getElementById("hmRecent").innerHTML = "";        // 清空，才能验证真的重画了
      document.getElementById("hmSpent").textContent = "";
      document.getElementById("tabBadge").textContent = "0";
      renderAll();
      eq("1a 启动态在首页：流水页没画（120 条一条都不建）", items(), 0);
      eq("1b 流水页顶部合计也还没刷", document.getElementById("sOut").textContent, "¥0.00");

      /* ===== 2. 首页必须完整 —— 懒渲染最容易砸的地方 ===== */
      ok("2a 首页本月已花不是 0（金额照常算）",
         document.getElementById("hmSpent").textContent.replace(/[¥,\s]/g, "").indexOf("1200") >= 0);
      ok("2b 首页「最近」有内容", document.querySelectorAll("#hmRecent .item").length > 0);
      eq("2c 底部小红点是 4 笔待分类",
         document.getElementById("tabBadge").textContent, "4");

      /* ===== 3. 启动态下切到流水页，照样画 ===== */
      goto("flow");
      ok("3a 切过去就有明细了", items() >= 100);
      ok("3b 合计也刷了", document.getElementById("sCnt").textContent.indexOf("120") >= 0);

      /* ===== 4. 启动结束后：renderAll 必须完整渲染 =====
         这一条是防"懒到永远"的。翻月份 / 导入 / 恢复备份都靠它。 */
      _bootLazy = false;
      /* 回到首页再来一遍：这才是"翻月份 / 导入 / 恢复备份"的真实处境 ——
         数据改了，用户此刻未必站在流水页上，但下一次 renderAll 必须把明细刷对。 */
      goto("home");
      document.getElementById("flowBody").innerHTML = "";
      renderAll();
      ok("4a 启动结束后 renderAll 会画流水页（不再懒）", items() >= 100);
      ok("4b 合计也跟着刷了", document.getElementById("sCnt").textContent.indexOf("120") >= 0);

      /* ===== 5. 首页分完类，小红点立刻减 =====
         刻意在**首页**调 renderFlow：整页渲染可以让路，小红点不行，
         否则在首页分完类，红点还挂着旧数字。 */
      goto("home");
      _bootLazy = true;                    // 故意调回启动态：最难的情况
      var sameNode = document.querySelector("#flowBody .item");
      state.records[0].cat = "food";
      state.records[1].cat = "food";
      renderFlow();
      eq("5a 启动态下在首页也能刷小红点（4 → 2）",
         document.getElementById("tabBadge").textContent, "2");
      ok("5b 但流水页没有被重画（还是同一个节点）",
         sameNode !== null && document.querySelector("#flowBody .item") === sameNode);

      /* ===== 收尾：把状态还回去 ===== */
      _bootLazy = false;
      state.records = oldRecs;
      state.viewMonth = oldVm;
      state._flowKey = null;
      goto("home");
      renderAll();

      document.title = "fix35 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
        " | " + log.join(" | ");
    }catch(e){
      _bootLazy = false;
      document.title = "fix35 ERR: " + e.message + " | " + log.join(" | ");
    }
  }, 700);
})();
