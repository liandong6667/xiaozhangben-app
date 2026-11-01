/* 记录 id 与去重窗口（1.6.18 的两处修）
   Z1. 存档里两笔同 id：读回来必须拆开，否则删一笔会把两笔都删掉
   Z2. 通知去重窗口：2 分钟内算同一笔，超过 2 分钟算两笔
   Z3. 退款不能被同额收入吞掉
   Z4. 不同店同额 2 分钟内是两笔 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }

  setTimeout(function(){
    var snap = {
      records: state.records, books: state.books, dayBud: state.dayBud,
      dayMode: state.dayMode, dayWeek: state.dayWeek, order: state.order,
      viewMonth: state.viewMonth, book: state.book, filter: state.filter,
      _storeCount: state._storeCount, _extra: state._extra
    };
    try{
      var Y = new Date().getFullYear(), M = new Date().getMonth();

      /* ===== Z1. 同 id ===== */
      state.books = [{ id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true }];
      localStorage.setItem("xiaozhangben.v3", JSON.stringify({
        v: 4, books: state.books,
        records: [
          { id: "same", ts: new Date(Y, M, 5, 12).getTime(), amt: 10, type: "expense", cat: "food", peer: "A", note: "", book: "daily" },
          { id: "same", ts: new Date(Y, M, 5, 13).getTime(), amt: 20, type: "expense", cat: "food", peer: "B", note: "", book: "daily" },
          { id: "same", ts: new Date(Y, M, 5, 14).getTime(), amt: 30, type: "expense", cat: "food", peer: "C", note: "", book: "daily" }
        ]
      }));
      state.records = [];
      load();
      eq("三笔同 id 都读回来了", state.records.length, 3);
      eq("id 已经拆成三个不同的", new Set(state.records.map(function(r){ return r.id; })).size, 3);

      // 删掉其中一笔，另外两笔必须还在
      var victim = state.records[0].id;
      askDelRecord(victim);
      $("askYes").click();
      eq("删一笔只少一笔（不是三笔一起没）", state.records.length, 2);
      ok("剩下的两笔不是被删的那笔", state.records.every(function(r){ return r.id !== victim; }));

      /* ===== Z2. 去重窗口 ===== */
      state.records = [];
      var t0 = new Date(Y, M, 15, 12, 0, 0).getTime();
      // 59 秒后的重复通知
      var a1 = parseNotify({ app: "微信", title: "微信支付", text: "微信支付 向 店甲 支付成功 ¥38.50", ts: t0 });
      addFromNotify(a1, true);
      var a2 = parseNotify({ app: "微信", title: "微信支付", text: "微信支付 向 店甲 支付成功 ¥38.50", ts: t0 + 59 * 1000 });
      addFromNotify(a2, true);
      eq("59 秒后的同一条通知不重复记", state.records.length, 1);

      // 119 秒后
      var a3 = parseNotify({ app: "微信", title: "微信支付", text: "微信支付 向 店甲 支付成功 ¥38.50", ts: t0 + 119 * 1000 });
      addFromNotify(a3, true);
      eq("119 秒后还是不重复", state.records.length, 1);

      // 121 秒后：出了窗口，是两笔
      var a4 = parseNotify({ app: "微信", title: "微信支付", text: "微信支付 向 店甲 支付成功 ¥38.50", ts: t0 + 121 * 1000 });
      addFromNotify(a4, true);
      eq("121 秒后算两笔（窗口是 2 分钟）", state.records.length, 2);

      // 跨分钟边界：12:00:50 与 12:01:10（同一条通知两次）
      state.records = [];
      var cross = new Date(Y, M, 15, 12, 0, 50).getTime();
      addFromNotify(parseNotify({ app: "微信", title: "微信支付", text: "微信支付 向 店乙 支付成功 ¥12.00", ts: cross }), true);
      addFromNotify(parseNotify({ app: "微信", title: "微信支付", text: "微信支付 向 店乙 支付成功 ¥12.00", ts: cross + 20000 }), true);
      eq("跨分钟边界的同一条通知只记一笔", state.records.length, 1);

      /* ===== Z3. 退款 vs 同额收入 ===== */
      state.records = [];
      var t1 = new Date(Y, M, 16, 9, 0, 0).getTime();
      // 先记一笔工资 2000
      addFromNotify(parseNotify({ app: "银行", title: "到账", text: "工资到账 ¥2,000.00 元", ts: t1 }), true);
      eq("工资先记上了", state.records.length, 1);
      // 同一分钟来一笔 2000 的退款
      var ref = parseNotify({ app: "微信", title: "微信支付", text: "微信支付 退款到账 ¥2,000.00 店丙", ts: t1 + 30000 });
      ok("退款通知被识别成退款", ref && ref.refund === true);
      addFromNotify(ref, true);
      eq("退款没被同额工资吞掉", state.records.length, 2);
      eq("库里有一笔退款", state.records.filter(function(r){ return r.cat === "refund"; }).length, 1);
      eq("工资那笔还在", state.records.filter(function(r){ return r.cat !== "refund"; }).length, 1);

      /* ===== Z4. 不同店同额 ===== */
      state.records = [];
      var t2 = new Date(Y, M, 17, 12, 0, 0).getTime();
      addFromNotify(parseNotify({ app: "微信", title: "微信支付", text: "微信支付 向 店丁 支付成功 ¥15.00", ts: t2 }), true);
      addFromNotify(parseNotify({ app: "微信", title: "微信支付", text: "微信支付 向 店戊 支付成功 ¥15.00", ts: t2 + 40000 }), true);
      eq("两家不同的店、同价、隔 40 秒 = 两笔", state.records.length, 2);
      eq("两笔的商户不一样", new Set(state.records.map(function(r){ return r.peer; })).size, 2);
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
      if($("askBox")) $("askBox").classList.remove("on");
    }catch(e2){}

    var pass = log.filter(function(s){ return s[0] === "Y"; }).length;
    document.title = "big6 " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 400);
})();
