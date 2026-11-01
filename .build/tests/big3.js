/* 大数据第三轮：退款风暴 + 月份边界 + 预算极端值
   O. 100 笔跨月退款：每笔都要冲回原来那笔，一笔只能冲一次
   P. 退款重导：重启（存档读回）后再导一遍，不能冲第二次
   Q. 月份边界：月末最后一秒 / 下月第一秒 / 31 号月份
   R. 预算极端：支出远超预算、预算为 0、20 本账本合计
   S. 同日 200 笔：按天分组合计要对 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function near(n, got, want){ log.push((Math.abs(got - want) < 0.005 ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function $(id){ return document.getElementById(id); }
  function round2(x){ return Math.round(x * 100) / 100; }

  setTimeout(function(){
    var snap = {
      records: state.records, books: state.books, dayBud: state.dayBud,
      dayMode: state.dayMode, dayWeek: state.dayWeek, order: state.order,
      viewMonth: state.viewMonth, book: state.book, filter: state.filter,
      _storeCount: state._storeCount, _extra: state._extra
    };
    try{
      var now = new Date();
      var Y = now.getFullYear(), M = now.getMonth();
      var HEAD = "交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注\n";
      function dstr(y, m, d, hh, mi, ss){
        return y + "-" + ("0" + (m + 1)).slice(-2) + "-" + ("0" + d).slice(-2) + " " +
          ("0" + hh).slice(-2) + ":" + ("0" + mi).slice(-2) + ":" + ("0" + ss).slice(-2);
      }

      state.books = [{ id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true }];
      state.records = [];

      /* ======== O. 100 笔跨月退款 ======== */
      var N = 100;
      var PREV = new Date(Y, M - 1, 1);   // 上个月的 1 号
      var pvY = PREV.getFullYear(), pvM = PREV.getMonth();
      var pvDays = new Date(pvY, pvM + 1, 0).getDate();
      for(var i = 0; i < N; i++){
        state.records.push({
          id: "old" + i, ts: new Date(pvY, pvM, (i % pvDays) + 1, 12, i % 60, 0).getTime(),
          amt: 15, type: "expense", cat: "food", peer: "店" + i, note: "", book: "daily", src: "import"
        });
      }
      eq("上月 100 笔支出就位", state.records.length, 100);

      var rows = [];
      for(var i2 = 0; i2 < N; i2++){
        rows.push(dstr(Y, M, (i2 % 20) + 1, 10 + (i2 % 10), (i2 * 7) % 60, 0) +
          ",商户消费,店" + i2 + ",商品" + i2 + ",支出,¥15.00,零钱,已退款,R" + i2 + ",M" + i2 + ",/");
      }
      var p = parseBillCSV(HEAD + rows.join("\n"));
      eq("100 行退款都解析出来了", p.records.length, 100);
      eq("100 行都打了退款标记", p.records.filter(function(r){ return r.refundOf; }).length, 100);

      var r1 = ingest(p.records);
      eq("100 笔退款全部冲回", r1.refundBack, 100);
      eq("100 笔退款一笔没漏", r1.refunds, 0);
      var refunds = state.records.filter(function(r){ return r.cat === "refund"; });
      eq("库里多了 100 笔退款收入", refunds.length, 100);
      eq("每笔退款都指回了原支出", refunds.filter(function(r){ return !!r.ref; }).length, 100);
      eq("100 笔指向了 100 个不同的支出", new Set(refunds.map(function(r){ return r.ref; })).size, 100);
      eq("原来的 100 笔支出没被改掉", state.records.filter(function(r){ return r.id.indexOf("old") === 0 && r.type === "expense"; }).length, 100);
      eq("退款收入合计 = 1500", round2(refunds.reduce(function(a, r){ return a + r.amt; }, 0)), 1500);

      /* ======== P. 重启后再导一遍 ======== */
      save();
      state.records = [];
      load();
      eq("重启后 200 笔都还在", state.records.length, 200);
      eq("重启后 ref 字段没丢", state.records.filter(function(r){ return r.ref; }).length, 100);

      var p2 = parseBillCSV(HEAD + rows.join("\n"));
      var r2 = ingest(p2.records);
      eq("重启后再导同一份：新增 0", r2.added, 0);
      eq("重启后再导同一份：全判重复", r2.dup, 100);
      eq("退款没有冲到第二笔", state.records.filter(function(r){ return r.cat === "refund"; }).length, 100);
      eq("原来的支出还是 100 笔", state.records.filter(function(r){ return r.id.indexOf("old") === 0 && r.type === "expense"; }).length, 100);
      var refSet = state.records.filter(function(r){ return r.ref; }).map(function(r){ return r.ref; });
      eq("还是 100 笔支出各自被冲一次", new Set(refSet).size, 100);

      /* ======== Q. 月份边界 ======== */
      var jan31 = new Date(2027, 0, 31, 23, 59, 59).getTime();
      var feb1 = new Date(2027, 1, 1, 0, 0, 0).getTime();
      var apr30 = new Date(2027, 3, 30, 23, 59, 59).getTime();
      var may1 = new Date(2027, 4, 1, 0, 0, 0).getTime();
      ok("1/31 23:59:59 算 1 月", inMonth(jan31, 2027, 0));
      ok("2/1 00:00 不算 1 月", !inMonth(feb1, 2027, 0));
      ok("4/30 23:59:59 算 4 月", inMonth(apr30, 2027, 3));
      ok("5/1 00:00 不算 4 月", !inMonth(may1, 2027, 3));

      state.records = [
        { id: "e1", ts: jan31, amt: 11, type: "expense", cat: "food", peer: "a", note: "", book: "daily", src: "manual" },
        { id: "e2", ts: feb1, amt: 22, type: "expense", cat: "food", peer: "b", note: "", book: "daily", src: "manual" }
      ];
      state.viewMonth = { y: 2027, m: 0 }; state.book = "all";
      renderFlow();
      eq("1 月只算 1 月那 11 元", $("sOut").textContent, "¥11.00");
      state.viewMonth = { y: 2027, m: 1 };
      renderFlow();
      eq("2 月只算 2 月那 22 元", $("sOut").textContent, "¥22.00");
      state.viewMonth = { y: 2027, m: 2 };
      renderFlow();
      eq("3 月没有账就是 0", $("sOut").textContent, "¥0.00");

      // 跨月的"上一月 / 下一月"步进
      state.viewMonth = { y: 2027, m: 0 };
      var prev = new Date(state.viewMonth.y, state.viewMonth.m - 1, 1);
      var next = new Date(state.viewMonth.y, state.viewMonth.m + 1, 1);
      eq("1 月的上一月是 2026 年 12 月", prev.getFullYear() + "-" + (prev.getMonth() + 1), "2026-12");
      eq("1 月的下一月是 2027 年 2 月", next.getFullYear() + "-" + (next.getMonth() + 1), "2027-2");

      /* ======== R. 预算极端值 ======== */
      state.records = [
        { id: "r1", ts: new Date(Y, M, 5, 12).getTime(), amt: 5000, type: "expense", cat: "food", peer: "a", note: "", book: "daily", src: "manual" }
      ];
      state.books = [{ id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 1000, def: true }];
      state.viewMonth = { y: Y, m: M };
      renderHome();
      /* 2026-10-23 改口径：超支时标题写「本月超支」，数字给正数。
         「本月还能花 -4,000.00」负号加"还能花"读不通，和记账页那条「超了 ¥40」也统一了。 */
      eq("花超了标题改说「本月超支」", $("hmLb").textContent, "本月超支");
      eq("花超了显示超支金额（正数）", $("hmLeft").textContent, "4,000.00");
      ok("超支时进度条打满", $("hmBar").style.width === "100%");
      ok("超支时进度条变红", $("hmBar").className.indexOf("over") >= 0);

      state.books[0].budget = 0;
      renderHome();
      eq("没设预算时回到「本月已花」", $("hmLb").textContent, "本月已花");
      eq("没设预算时显示已花金额", $("hmLeft").textContent, "5,000.00");
      ok("没设预算时进度条是 0", $("hmBar").style.width === "0%");

      // 20 本预算合计 + 空账本不拖后腿
      state.books = [];
      for(var g = 0; g < 20; g++){
        state.books.push({ id: "g" + g, name: "本" + g, icon: "📒",
          color: BOOK_COLORS[g % 6], budget: g === 0 ? 0 : 100, def: g === 0 });
      }
      state.records = [];
      renderHome();
      eq("20 本预算合计 = 1900", $("hmLeft").textContent, "1,900.00");
      ok("一本都没花时进度条 0", $("hmBar").style.width === "0%");

      /* ======== S. 同一天 200 笔 ======== */
      state.books = [{ id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true }];
      state.records = [];
      for(var s2 = 0; s2 < 200; s2++){
        state.records.push({
          id: "s" + s2, ts: new Date(Y, M, 15, 8 + (s2 % 12), s2 % 60, 0).getTime(),
          amt: 1, type: "expense", cat: "food", peer: "店" + (s2 % 9), note: "", book: "daily", src: "manual"
        });
      }
      state.viewMonth = { y: Y, m: M }; state.book = "all";
      renderFlow();
      var items = document.querySelectorAll("#flowBody .item").length;
      eq("200 笔都渲染出来了", items, 200);
      eq("当天分组合计 = 200", $("sOut").textContent, "¥200.00");
      var dayBars = document.querySelectorAll("#flowBody .daybar");
      eq("同一天只出现一个日期分组", dayBars.length, 1);
      ok("日期分组写着 200 笔", dayBars[0].textContent.indexOf("200") >= 0);
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
      save(); renderAll(); renderHome(); closeSheets();
    }catch(e2){}

    var pass = log.filter(function(s){ return s[0] === "Y"; }).length;
    document.title = "big3 " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 400);
})();
