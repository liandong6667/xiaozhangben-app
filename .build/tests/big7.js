/* 明细「先画 800 行」的保护（1.6.18 新加）
   AA. 799 笔：全画，不出现按钮
   AB. 900 笔：只画到 800 上下，底下写明还剩多少
   AC. 点开：全画出来，按钮消失
   AD. 换月份 / 换账本 / 换筛选：收回成 800（不然保护就白设了）
   AE. 页面的合计数字不受影响（画多少行都只算一次） */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }

  setTimeout(function(){
    var snap = {
      records: state.records, books: state.books, dayBud: state.dayBud,
      dayMode: state.dayMode, dayWeek: state.dayWeek, order: state.order,
      viewMonth: state.viewMonth, book: state.book, filter: state.filter,
      _storeCount: state._storeCount, _extra: state._extra, _flowKey: state._flowKey, _flowAll: state._flowAll
    };
    function $(id){ return document.getElementById(id); }
    function rows(){ return document.querySelectorAll("#flowBody .item").length; }

    try{
      var Y = new Date().getFullYear(), M = new Date().getMonth();
      state.books = [{ id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true }];
      state.book = "all"; state.filter = "all";
      state.viewMonth = { y: Y, m: M };
      state._flowKey = null; state._flowAll = false;

      function build(n){
        state.records = [];
        for(var i = 0; i < n; i++){
          // 一天 40 笔，这样跨天分组：笔数越多天数越多
          state.records.push({
            id: "q" + i, ts: new Date(Y, M, 1 + ((i / 40) | 0), 8 + (i % 12), (i % 60), 0).getTime(),
            amt: 1, type: "expense", cat: "food", peer: "店" + (i % 30), note: "", book: "daily", src: "manual"
          });
        }
      }

      /* ===== AA. 799 笔 ===== */
      build(799);
      renderFlow();
      eq("799 笔全部画出来", rows(), 799);
      ok("799 笔时不出现「还有多少笔」按钮", !$("btnMoreFlow"));
      eq("合计还是 799 元", $("sOut").textContent, "¥799.00");

      /* ===== AB. 900 笔（每天 40 笔，一天不能被劈成两半，允许超出一天） ===== */
      build(900);
      renderFlow();
      var r801 = rows();
      ok("900 笔时只画到 800 上下（实际 " + r801 + " 行，最多多一整天）", r801 >= 800 && r801 <= 840);
      ok("出现了「还有 N 笔」按钮", !!$("btnMoreFlow"));
      ok("按钮上写着还剩多少", /还有\s*\d+\s*笔/.test($("btnMoreFlow").textContent));
      eq("合计仍然是 900 元（画多少行不影响算法）", $("sOut").textContent, "¥900.00");
      eq("笔数提示仍然写 900 笔", $("sCnt").textContent.indexOf("900") >= 0, true);

      /* ===== AC. 点开看全部 ===== */
      $("btnMoreFlow").click();
      eq("点开后 900 笔全画出来", rows(), 900);
      ok("点开后按钮消失", !$("btnMoreFlow"));

      /* ===== AD. 换月份收回 ===== */
      var prev = new Date(Y, M - 1, 1);
      state.viewMonth = { y: prev.getFullYear(), m: prev.getMonth() };
      renderFlow();
      eq("换到上个月：没有账，0 行", rows(), 0);
      state.viewMonth = { y: Y, m: M };
      renderFlow();
      ok("换回本月：又收回成 800 行（实际 " + rows() + "）", rows() >= 800 && rows() <= 840);
      ok("按钮又出现了", !!$("btnMoreFlow"));

      // 换账本也要收回（先造第二本账本）
      state.books.push({ id: "other", name: "另一本", icon: "📒", color: BOOK_COLORS[1], budget: 0 });
      state.records.forEach(function(r){ r.book = "other"; });
      state.book = "other";
      renderFlow();
      state.book = "all";
      renderFlow();
      ok("换回总账本后也收着（实际 " + rows() + "）", rows() >= 800 && rows() <= 840);
      ok("按钮在", !!$("btnMoreFlow"));

      /* ===== AE. 待分类筛选 ===== */
      state.filter = "uncat";
      renderFlow();
      eq("待分类筛选下没有未分类的账，显示空态", rows(), 0);
      ok("空态提示「都分类好了」", $("flowBody").textContent.indexOf("都分类好了") >= 0);
      state.filter = "all";
      renderFlow();
      ok("切回全部后又有按钮", !!$("btnMoreFlow"));
      ok("切回全部后仍然收着（实际 " + rows() + "）", rows() >= 800 && rows() <= 840);

      // 数据不因为只画 800 行而少算：统计页也要是 801
      renderStats();
      ok("统计页的支出还是 900", $("statsBody").textContent.indexOf("900") >= 0);
    }catch(e){
      var st = ((e && e.stack) || "").split("\n").slice(1, 3).join(" < ");
      log.push("NERR:" + (e && e.message) + " @" + st);
    }

    try{
      state.records = snap.records;
      state.books = snap.books;
      state.dayBud = snap.dayBud;
      state.dayMode = snap.dayMode;
      state.dayWeek = snap.dayWeek;
      state.order = snap.order;
      state.viewMonth = snap.viewMonth;
      state.book = snap.book;
      state.filter = snap.filter;
      state._extra = snap._extra;
      state._storeCount = snap._storeCount;
      state._flowKey = snap._flowKey;
      state._flowAll = snap._flowAll;
      save(); renderAll(); renderHome(); closeSheets();
    }catch(e2){}

    var pass = log.filter(function(s){ return s[0] === "Y"; }).length;
    document.title = "big7 " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 400);
})();
