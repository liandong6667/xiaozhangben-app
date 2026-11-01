/* deep3：跨页面 / 存储 / 边界值专项（1.6.19 加）
   之前 big1-big7 都在单个功能里打转，这次专挑"两个功能接不上"的地方：
   A. 在记账页翻到上个月 → 回首页，首页说的"本月"到底是谁的月
   B. 详情面板里商户名带尖括号
   C. 存一遍读一遍，字段有没有掉
   D. 金额解析/显示的边界
   E. 月份翻到跨年
   F. 删掉最后一笔之后各处的数
   G. 账本 id 里有引号
   H. 预算框里敲垃圾
   I. 账本页翻到去年 1 月（上月对比要跨年）
   J. 800 笔截断状态下删一笔
   K. 清除本月后日历
   L. 按星期套用，某星期填 0 时旧值还在不在 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function near(n, got, want){ ok(n + "[" + got + "]", Math.abs(got - want) < 0.005); }

  setTimeout(function(){
    var snap = {
      records: state.records, books: state.books, dayBud: state.dayBud,
      dayMode: state.dayMode, dayWeek: state.dayWeek, order: state.order,
      viewMonth: state.viewMonth, book: state.book, filter: state.filter,
      _storeCount: state._storeCount, _extra: state._extra, _flowKey: state._flowKey, _flowAll: state._flowAll
    };
    function $(id){ return document.getElementById(id); }
    function tab(t){ document.querySelector('.tab[data-tab="' + t + '"]').click(); }
    function rows(){ return document.querySelectorAll("#flowBody .item").length; }
    var Y = new Date().getFullYear(), M = new Date().getMonth();
    var PM = (M === 0) ? {y: Y - 1, m: 11} : {y: Y, m: M - 1};

    try{
      /* ================= A. 首页说的是哪个月 ================= */
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true}];
      state.book = "all"; state.filter = "all";
      state.records = [
        {id: "pm1", ts: new Date(PM.y, PM.m, 10, 12, 0, 0).getTime(), amt: 100,
         type: "expense", cat: "food", peer: "上月店", note: "", book: "daily", src: "manual"},
        {id: "pm2", ts: new Date(PM.y, PM.m, 11, 12, 0, 0).getTime(), amt: 7,
         type: "expense", cat: null, peer: "上月没分类", note: "", book: "daily", src: "manual"},
        {id: "cm1", ts: new Date(Y, M, 5, 12, 0, 0).getTime(), amt: 50,
         type: "expense", cat: "food", peer: "本月店", note: "", book: "daily", src: "manual"},
        {id: "cm2", ts: new Date(Y, M, 6, 12, 0, 0).getTime(), amt: 30,
         type: "expense", cat: null, peer: "没分类店", note: "", book: "daily", src: "manual"}
      ];
      state.viewMonth = {y: PM.y, m: PM.m};
      state._flowKey = null;
      renderAll(); renderHome();
      // 记账页停在上个月，这时回首页
      tab("flow"); tab("home");
      eq("翻到上个月再回首页，首页支出仍是本月 80 元", $("hmSpent").textContent, "已花 ¥80.00");
      eq("首页大数字也是本月 80 元", $("hmLeft").textContent, "80.00");
      ok("首页待分类数全部月份（上个月那笔也得算进去）",
        $("hmUc").textContent.indexOf("2 笔") >= 0);
      eq("首页待分类卡和徽标是同一个数", $("tabBadge").textContent, "2");

      /* ================= B. 详情面板里的商户名 ================= */
      state.records = [{id: "x1", ts: Date.now(), amt: 12, type: "expense", cat: "food",
        peer: "<b>坏名</b>", note: "<i>备注</i>", book: "daily", src: "manual"}];
      state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      renderFlow();
      ok("明细行的商户名被转义了", $("flowBody").querySelectorAll(".it-n b").length === 0);
      openInfo("x1");
      eq("详情面板没把商户名当标签渲染", $("infoBody").querySelectorAll(".inf-r b b").length, 0);
      eq("详情面板把商户名原样显示出来", $("infoBody").textContent.indexOf("<b>坏名</b>") >= 0, true);
      closeSheets();

      /* ================= C. 存一遍读一遍 ================= */
      state.records = [
        {id: "p1", ts: Date.now(), amt: 66.5, type: "expense", cat: "food", peer: "店", note: "备注",
         book: "b2", src: "import", ref: "src1", from: "微信", guessed: true}
      ];
      state.books = [
        {id: "b1", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true},
        {id: "b2", name: "吃饭", icon: "🍜", color: BOOK_COLORS[1], budget: 800, cat: "food"}
      ];
      state.dayMode = 3;
      state.dayWeek = [0, 80, 0, 0, 0, 0, 120];
      state.dayBud = {}; state.dayBud[dayKey(Date.now())] = 88;
      state.peerRules = {"某店": "food"};
      state._extra = {"futureField": {a: 1}};
      save();
      load();
      var r0 = state.records[0] || {};
      eq("存档往返：账目数", state.records.length, 1);
      eq("存档往返：金额", r0.amt, 66.5);
      eq("存档往返：账本", r0.book, "b2");
      eq("存档往返：退款指向", r0.ref, "src1");
      eq("存档往返：来源 App", r0.from, "微信");
      eq("存档往返：填法", state.dayMode, 3);
      eq("存档往返：周日的数", state.dayWeek[6], 120);
      eq("存档往返：当天日预算", state.dayBud[dayKey(Date.now())], 88);
      eq("存档往返：账本预算", state.books[1].budget, 800);
      eq("存档往返：商户规则", state.peerRules["某店"], "food");
      eq("存档往返：不认识的字段也带着走", (state._extra.futureField || {}).a, 1);

      /* ================= D. 金额边界 ================= */
      var a1 = parseText("午饭1,200.00", Date.now(), "expense");
      eq("千分位 1,200.00 读成 1200", a1.length ? a1[0].amt : -1, 1200);
      var a2 = extractAmount("¥.5 买水");
      near("¥.5 读成 0.5", a2, 0.5);
      var a3 = extractAmount("工资1.2万");
      near("1.2万 读成 12000", a3, 12000);
      eq("0 元不算一笔", parseText("0 元", Date.now(), "expense").length, 0);
      eq("没有数字不算一笔", parseText("今天天气不错", Date.now(), "expense").length, 0);
      eq("钱数格式化带千分位", money(1234567.89), "1,234,567.89");
      eq("负数记账本钱只给绝对值", money(-12.3), "12.30");

      /* ================= E. 月份跨年 ================= */
      state.viewMonth = {y: Y, m: 0};
      state._flowKey = null;
      document.querySelectorAll("#pg-flow .monthnav button[data-m='-1']")[0].click();
      eq("1 月往前翻是去年 12 月", state.viewMonth.y, Y - 1);
      eq("1 月往前翻的月份是 12", state.viewMonth.m, 11);
      eq("月份标题跟着变", $("mLb1").textContent, (Y - 1) + "年12月");

      /* ================= F. 删掉最后一笔 ================= */
      state.records = [{id: "only", ts: new Date(Y, M, 3, 9, 0, 0).getTime(), amt: 9.9,
        type: "expense", cat: "food", peer: "只此一笔", book: "daily", src: "manual"}];
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true}];
      state.book = "all";
      state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      renderAll(); renderHome();
      eq("删前：支出 9.9", $("sOut").textContent, "¥9.90");
      state.records = [];
      renderAll(); renderHome();
      eq("删光后支出归零", $("sOut").textContent, "¥0.00");
      eq("删光后收入归零", $("sIn").textContent, "¥0.00");
      eq("删光后结余归零", $("sBal").textContent, "¥0.00");
      eq("删光后笔数归零", $("sCnt").textContent, "共 0 笔");
      ok("删光后明细给的是空状态", $("flowBody").textContent.indexOf("还没有流水") >= 0);
      eq("删光后首页回到「本月已花」", $("hmLb").textContent, "本月已花");
      eq("删光后首页大数字 0", $("hmLeft").textContent, "0.00");
      ok("删光后统计页不崩", (renderStats(), true));

      /* ================= G. 账本 id 含引号 ================= */
      state.books = [{id: 'a"b', name: "怪名字", icon: "📒", color: "#DE6B45", budget: 0, def: true}];
      state.records = [{id: "g1", ts: new Date(Y, M, 3, 9, 0, 0).getTime(), amt: 3,
        type: "expense", cat: "food", peer: "店", book: 'a"b', src: "manual"}];
      state.book = "all"; state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      renderAll();
      var first = document.querySelector("#bookGrid .bcard[data-bid]");
      eq("账本卡片记得住带引号的 id", first ? first.dataset.bid : "(无)", 'a"b');
      if(first) first.click();
      eq("点它切到的是这个账本", state.book, 'a"b');
      ok("切过来之后这笔账看得见", rows() === 1);

      /* ================= H. 预算框里的垃圾 ================= */
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true}];
      state.records = [];
      state.book = "all"; state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      openBudget();
      var bi = document.querySelector("#budBody input.bd-in");
      bi.value = "abc"; budTotal(); saveBudget();
      eq("预算框写垃圾 → 存成不限", state.books[0].budget, 0);
      openBudget();
      bi = document.querySelector("#budBody input.bd-in");
      bi.value = "-300"; saveBudget();
      eq("预算写负数 → 存成不限", state.books[0].budget, 0);
      openBudget();
      bi = document.querySelector("#budBody input.bd-in");
      bi.value = "1200"; saveBudget();
      eq("预算 1200 存得进去", state.books[0].budget, 1200);
      eq("首页跟着改看「本月还能花」", $("hmLb").textContent, "本月还能花");

      /* ================= I. 去年 1 月的上月对比 ================= */
      state.records = [{id: "jan", ts: new Date(Y - 1, 0, 8, 10, 0, 0).getTime(), amt: 40,
        type: "expense", cat: "food", peer: "店", book: "daily", src: "manual"}];
      state.viewMonth = {y: Y - 1, m: 0}; state._flowKey = null;
      var okStat = true;
      try{ renderStats(); }catch(e){ okStat = false; }
      ok("去年 1 月的统计页不崩（上月要跨到前一年 12 月）", okStat);
      ok("去年 1 月统计页有数", $("statsBody").textContent.indexOf("40") >= 0);

      /* ================= J. 800 笔截断时删一笔 ================= */
      state.records = [];
      for(var i = 0; i < 900; i++){
        state.records.push({id: "z" + i, ts: new Date(Y, M, 1 + ((i / 40) | 0), 8 + (i % 12), (i % 60), 0).getTime(),
          amt: 1, type: "expense", cat: "food", peer: "店" + (i % 30), note: "", book: "daily", src: "manual"});
      }
      state.book = "all"; state.viewMonth = {y: Y, m: M};
      state._flowKey = null; state._flowAll = false;
      renderFlow();
      ok("900 笔先只画 800 上下", rows() <= 840 && !!$("btnMoreFlow"));
      state.records = state.records.filter(function(r){ return r.id !== "z899"; });
      renderFlow();
      eq("删一笔后合计是 899", $("sOut").textContent, "¥899.00");
      ok("删一笔后截断状态没被重置成全画", rows() <= 840);
      $("btnMoreFlow").click();
      eq("点开看全部还是 899 行", rows(), 899);

      /* ================= K. 清除本月 ================= */
      state.records = [];
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true}];
      state.dayMode = 1; state.dayBud = {};
      var dd = new Date(Y, M + 1, 0).getDate();
      for(var d = 1; d <= dd; d++) state.dayBud[ymdKey(Y, M, d)] = 50;
      openDayBud();
      eq("日历上 31 天的数都在", document.querySelectorAll("#dbCal .cd.has").length, dd);
      clearDayBud();
      $("askYes").click();
      eq("清除后日历一个数都不剩", document.querySelectorAll("#dbCal .cd.has").length, 0);
      eq("清除后合计写「一天都还没设」", $("dbCalSum").textContent, "一天都还没设");
      eq("清除后日预算一块钱都不留", Object.keys(state.dayBud).length, 0);

      /* ================= L. 按星期套用时填 0 的星期 ================= */
      state.dayBud = {};
      for(var d2 = 1; d2 <= dd; d2++) state.dayBud[ymdKey(Y, M, d2)] = 50;
      state.dayMode = 3;
      state.dayWeek = [80, 80, 80, 80, 80, 0, 0];
      setDayMode(3);
      renderWeek7();
      document.querySelectorAll("#dbWeek7 input.wk-in").forEach(function(inp, i){ inp.value = [80,80,80,80,80,0,0][i]; });
      applyWeek();
      var sunday = null;
      for(var d3 = 1; d3 <= dd; d3++){
        if(new Date(Y, M, d3).getDay() === 0){ sunday = d3; break; }
      }
      eq("套用按星期后周日不再是 50（0 表示这天不限，旧值该清掉）",
        sunday ? dayBudOf(ymdKey(Y, M, sunday)) : 0, 0);
      var mon = null;
      for(var d4 = 1; d4 <= dd; d4++){
        if(new Date(Y, M, d4).getDay() === 1){ mon = d4; break; }
      }
      eq("周一是 80", mon ? dayBudOf(ymdKey(Y, M, mon)) : 0, 80);
    }catch(e){
      log.push("N脚本异常:" + (e && e.message));
    }

    try{
      state.records = snap.records; state.books = snap.books;
      state.dayBud = snap.dayBud; state.dayMode = snap.dayMode; state.dayWeek = snap.dayWeek;
      state.order = snap.order; state.viewMonth = snap.viewMonth; state.book = snap.book;
      state.filter = snap.filter; state._extra = snap._extra;
      state._storeCount = snap._storeCount; state._flowKey = snap._flowKey; state._flowAll = snap._flowAll;
      closeSheets(); save(); renderAll(); renderHome();
    }catch(e2){}

    var pass = log.filter(function(s){ return s[0] === "Y"; }).length;
    document.title = "deep3 " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 400);
})();
