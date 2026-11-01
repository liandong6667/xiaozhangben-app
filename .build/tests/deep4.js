/* deep4：恢复出厂 / 备份恢复 / 账本选择面板 / 待分类流程 / 真实账单
   M. 恢复出厂：日预算、填法、星期、卡片顺序都得回默认，重启不许复活
   N. 备份恢复：跳到恢复进来的月份、不重不漏、账本跟着回来、坏文件要拦住
   O. 账本选择面板：怪 id / 怪图标不能把行点错
   P. 待分类：批量分完徽标归零、跳过、单笔改金额
   Q. 小数精度：0.1 + 0.2 不能变成 0.30000000000000004
   R. 真实微信账单：引号里的逗号、转账跳过、已退款行不乱记 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function $(id){ return document.getElementById(id); }

  setTimeout(function(){
    var snap = {
      records: state.records, books: state.books, dayBud: state.dayBud,
      dayMode: state.dayMode, dayWeek: state.dayWeek, order: state.order,
      viewMonth: state.viewMonth, book: state.book, filter: state.filter,
      peerRules: state.peerRules, _storeCount: state._storeCount, _extra: state._extra,
      _flowKey: state._flowKey, _flowAll: state._flowAll
    };
    var Y = new Date().getFullYear(), M = new Date().getMonth();

    try{
      /* ================= M. 恢复出厂 ================= */
      state.records = [{id: "w1", ts: new Date(Y, M, 2, 9, 0, 0).getTime(), amt: 10,
        type: "expense", cat: "food", peer: "店", book: "daily", src: "manual"}];
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 300, def: true}];
      state.dayBud = {}; state.dayBud[ymdKey(Y, M, 1)] = 100; state.dayBud[ymdKey(Y, M, 2)] = 100;
      state.dayMode = 2; state.dayWeek = [10, 20, 30, 40, 50, 60, 70];
      state.order = {home: ["day", "month"], flow: ["day", "sum"], books: ["total"]};
      state._extra = {futureField: 1};
      save();
      wipeAll();
      $("askInp").value = "恢复出厂";
      $("askInp").dispatchEvent(new Event("input"));
      $("askYes").click();
      eq("恢复出厂：账目清空", state.records.length, 0);
      eq("恢复出厂：日预算清空", Object.keys(state.dayBud).length, 0);
      eq("恢复出厂：填法回默认", state.dayMode, 1);
      eq("恢复出厂：星期表归零", state.dayWeek.join(","), "0,0,0,0,0,0,0");
      eq("恢复出厂：卡片顺序回默认", (state.order.home || []).join(","), "month,day");
      eq("恢复出厂：账本只剩默认那本", state.books.length, 1);
      eq("恢复出厂：账本预算归零", state.books[0].budget, 0);
      eq("恢复出厂：不认识的旧字段也丢掉", Object.keys(state._extra || {}).length, 0);
      load();   // 模拟重启
      eq("恢复出厂后重启：日预算没复活", Object.keys(state.dayBud).length, 0);
      eq("恢复出厂后重启：填法还是默认", state.dayMode, 1);
      eq("恢复出厂后重启：账目还是空的", state.records.length, 0);

      /* ================= N. 备份恢复 ================= */
      var old = new Date(Y - 1, 2, 15, 12, 0, 0).getTime();   // 去年 3 月
      var bk = {
        v: 4, records: [
          {id: "k1", ts: old, amt: 25, type: "expense", cat: "food", peer: "老店", note: "", book: "b9", src: "import"},
          {id: "k2", ts: old + 86400000, amt: 3000, type: "income", cat: "pay", peer: "工资", note: "", book: "b9", src: "import"}
        ],
        books: [{id: "b9", name: "旧账本", icon: "📦", color: "#3B6FD4", budget: 500, def: false}],
        dayBud: {}, dayMode: 3, dayWeek: [1, 2, 3, 4, 5, 6, 7]
      };
      var res = applyBackup(bk);
      eq("恢复：记了 2 笔", res.n, 2);
      eq("恢复：带回 1 个账本", res.nb, 1);
      eq("恢复后跳到恢复数据那个月", state.viewMonth.y + "-" + state.viewMonth.m, (Y - 1) + "-2");
      ok("恢复后明细里看得到那两笔", $("flowBody").textContent.indexOf("老店") >= 0);
      eq("恢复：账本结构带回来了", state.books.filter(function(b){ return b.id === "b9"; }).length, 1);
      eq("恢复：那笔账落在旧账本", (state.records.filter(function(r){ return r.id === "k1"; })[0] || {}).book, "b9");
      eq("恢复：填法跟着回来", state.dayMode, 3);
      eq("恢复：星期表跟着回来", state.dayWeek[6], 7);
      applyBackup(bk);
      eq("同一个备份再恢复一次：一笔不多", state.records.length, 2);
      var okBad = false;
      try{ applyBackup({books: []}); }catch(e){ okBad = true; }
      ok("不是备份的文件会被拦住（抛错），不会把库写坏", okBad);
      eq("坏文件没动账目", state.records.length, 2);

      /* ================= O. 账本选择面板 ================= */
      state.books = [
        {id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true},
        {id: 'q"z', name: "带引号", icon: '<b>x</b>', color: "#2E8C63", budget: 0}
      ];
      state.records = [{id: "o1", ts: new Date(Y, M, 2, 9, 0, 0).getTime(), amt: 5,
        type: "expense", cat: "food", peer: "店", book: 'q"z', src: "manual"}];
      state.book = "all"; state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      renderAll();
      openBookPicker();
      var picks = $("pickBody").querySelectorAll("[data-pick]");
      eq("选择面板列出 3 行（总账本 + 2 本）", picks.length, 3);
      eq("带引号的账本 id 没被切断", picks[2] ? picks[2].dataset.pick : "", 'q"z');
      /* 图标位自己的 <b class="pp"> 是本系统的结构，不算；这里要挡的是
         账本 icon 里那句 «<b>x</b>» 被当标签解析（1.6.97 起图标位改用 <b> 画图案）。 */
      eq("怪图标没被当成标签渲染（只有图标位自己的 b.pp）",
         $("pickBody").querySelectorAll(".pick b:not(.pp)").length, 0);
      ok("怪图标没被当文字显示", ($("pickBody").textContent || "").indexOf("<b>x") < 0);
      picks[2].click();
      eq("点它就切到这本", state.book, 'q"z');
      ok("切过来这笔账看得见", document.querySelectorAll("#flowBody .item").length === 1);
      openBookPickerFor("o1");
      var mvs = $("pickBody").querySelectorAll("[data-mv]");
      eq("改账本面板也是 2 本", mvs.length, 2);
      eq("改账本面板的 id 也没被切断", mvs[1] ? mvs[1].dataset.mv : "", 'q"z');
      closeSheets();

      /* ================= P. 待分类 ================= */
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true}];
      state.book = "all"; state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      state.peerRules = {};
      state.records = [
        {id: "u1", ts: new Date(Y, M, 2, 9, 0, 0).getTime(), amt: 11, type: "expense", cat: null, peer: "甲店", book: "daily", src: "import"},
        {id: "u2", ts: new Date(Y, M, 3, 9, 0, 0).getTime(), amt: 22, type: "expense", cat: null, peer: "乙店", book: "daily", src: "import"},
        {id: "u3", ts: new Date(Y, M, 4, 9, 0, 0).getTime(), amt: 33, type: "expense", cat: null, peer: "丙店", book: "daily", src: "import"}
      ];
      renderAll(); renderHome();
      eq("3 笔待分类，徽标是 3", $("tabBadge").textContent, "3");
      openUc();
      eq("排队 3 笔", ucQ.length, 3);
      ucPick("food");
      eq("分完一笔还剩 2 笔待分类", uncatCount(), 2);
      ucSkip();
      eq("跳过不分类，仍剩 2 笔", uncatCount(), 2);
      ucPick("daily");
      eq("跳过的那笔留在待分类里", uncatCount(), 1);
      ok("跳过过就不说「都归好类了」，如实说还剩几笔",
        $("ucBody").textContent.indexOf("还有 1 笔没分") >= 0);
      eq("徽标和弹窗说的是同一个数", $("tabBadge").textContent, "1");
      // 再进去把跳过那笔分掉
      openUc();
      eq("第二次进来只剩 1 笔", ucQ.length, 1);
      ucPick("study");
      eq("这回真分完了", uncatCount(), 0);
      ok("这次才是「都归好类了」", $("ucBody").textContent.indexOf("都归好类了") >= 0);
      ok("待分类清空后徽标藏起来", $("tabBadge").style.display === "none");

      /* 单笔改金额：18.76 → 20.5 */
      state.records = [{id: "s1", ts: new Date(Y, M, 5, 9, 0, 0).getTime(), amt: 18.76,
        type: "expense", cat: "food", peer: "丁店", book: "daily", src: "manual"}];
      renderAll();
      openCatFor("s1");
      var ai = $("ucAmt");
      ok("单笔模式有金额输入框", !!ai);
      if(ai){
        ai.focus();
        ai.value = "20.50";
        ai.dispatchEvent(new Event("input"));
        ai.blur();
        eq("金额改成了 20.5", state.records[0].amt, 20.5);
        eq("明细跟着变", $("flowBody").textContent.indexOf("20.50") >= 0, true);
        ai = $("ucAmt"); ai.focus(); ai.value = "abc"; ai.blur();
        eq("乱填金额不会把账改坏", state.records[0].amt, 20.5);
      }
      closeSheets();

      /* ================= Q. 小数精度 ================= */
      state.records = [
        {id: "f1", ts: new Date(Y, M, 6, 9, 0, 0).getTime(), amt: 0.1, type: "expense", cat: "food", peer: "a", book: "daily", src: "manual"},
        {id: "f2", ts: new Date(Y, M, 6, 10, 0, 0).getTime(), amt: 0.2, type: "expense", cat: "food", peer: "b", book: "daily", src: "manual"}
      ];
      state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      renderAll();
      eq("0.1 + 0.2 显示 0.30", $("sOut").textContent, "¥0.30");
      eq("money 自己也会进位", money(99.999), "100.00");

      /* ================= R. 真实微信账单 ================= */
      state.records = []; state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true}];
      state.book = "all"; state.peerRules = {}; state._flowKey = null;
      var csv = [
        "微信支付账单明细,,,,,,,,,,",
        "微信昵称：[小张],,,,,,,,,,",
        "起始时间：[2026-09-01 00:00:00] 终止时间：[2026-09-30 23:59:59],,,,,,,,,,",
        ",,,,,,,,,,",
        "交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注",
        "2026-09-01 08:12:00,商户消费,蜜雪冰城,\"冰鲜柠檬水,大杯\",支出,¥6.00,零钱,支付成功,1001,M1,",
        "2026-09-02 12:00:00,商户消费,食堂,午饭,支出,13.50,零钱,支付成功,1002,M2,",
        "2026-09-03 09:00:00,转账,张三,转账,不计收支,200.00,零钱,转账成功,1003,M3,",
        "2026-09-04 10:00:00,商户消费,某商店,退货商品,支出,20.00,零钱,已全额退款,1004,M4,"
      ].join("\n");
      var pr = parseBill(csv, new Date(Y, M, 20).getTime());
      eq("账单解析出 3 行（转账那行跳过）", pr.records.length, 3);
      eq("引号里的逗号没把商品切断", pr.records[0].note, "冰鲜柠檬水,大杯");
      eq("金额带 ¥ 也读得对", pr.records[0].amt, 6);
      eq("已退款行被标成待核对", pr.records[2].refundOf, true);
      eq("退款行分类是退款", pr.records[2].cat, "refund");
      eq("跳过 1 行（转账）", pr.skipped, 1);
      var ing1 = ingest(pr.records, pr.skipped, pr.refunds);
      eq("第一次导入记 2 笔（退款无原账不记）", ing1.added, 2);
      eq("导入跳到账单所在月 9 月", state.viewMonth.m, 8);
      eq("导入后明细是 2 行", document.querySelectorAll("#flowBody .item").length, 2);
      var ing2 = ingest(parseBill(csv, new Date(Y, M, 20).getTime()).records, 0, 0);
      eq("同一份账单再导一次：一笔不加", ing2.added, 0);
      eq("再导一次：2 笔全判重", ing2.dup, 2);
      eq("再导一次后总数还是 2", state.records.length, 2);
    }catch(e){
      log.push("N脚本异常:" + (e && e.message));
    }

    try{
      state.records = snap.records; state.books = snap.books;
      state.dayBud = snap.dayBud; state.dayMode = snap.dayMode; state.dayWeek = snap.dayWeek;
      state.order = snap.order; state.viewMonth = snap.viewMonth; state.book = snap.book;
      state.filter = snap.filter; state.peerRules = snap.peerRules; state._extra = snap._extra;
      state._storeCount = snap._storeCount; state._flowKey = snap._flowKey; state._flowAll = snap._flowAll;
      closeSheets(); save(); renderAll(); renderHome();
    }catch(e2){}

    var pass = log.filter(function(s){ return s[0] === "Y"; }).length;
    document.title = "deep4 " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 400);
})();
