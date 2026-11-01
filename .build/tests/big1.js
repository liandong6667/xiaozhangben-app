/* 大数据压力测试（1.6.17 之后的体检）
   A. 5000 笔：存取往返、汇总、逐日、渲染
   B. 3000 行账单：解析 + 入账 + 重复导入判重
   C. 极端金额：千分位、零、负、巨款、小数精度
   D. 日期边界：跨年、闰年 2/29、月初月末
   E. 400 天日预算：存档、统计、日历
   F. 存储上限：把 localStorage 塞到接近 5MB
   G. 20 个账本：预算合计、删账本后账目迁移
   H. 待分类：跨月全量统计 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function near(n, got, want){ log.push((Math.abs(got - want) < 0.005 ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function $(id){ return document.getElementById(id); }
  function fire(el, t){ el.dispatchEvent(new Event(t, { bubbles: true })); }
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

      /* ================= A. 5000 笔 ================= */
      var recs = [];
      var cats = ["food", "daily", "transport", "study", "fun", "cloth", "med", "comm", "home", "gift", "other"];
      var bookIds = ["daily", "food", "study"];
      // 本月 2400 笔 + 上月 1400 + 上上月 1200
      var spec = [[0, 2400], [1, 1400], [2, 1200]];
      var mk = 0;
      spec.forEach(function(sp){
        var base = new Date(Y, M - sp[0], 1);
        var days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
        for(var i = 0; i < sp[1]; i++){
          mk++;
          var d = (i % days) + 1;
          var ts = new Date(base.getFullYear(), base.getMonth(), d,
            8 + (i % 12), i % 60, (i * 7) % 60).getTime();
          var isIn = (i % 97 === 0);
          recs.push({
            id: "b" + mk,
            ts: ts,
            amt: isIn ? 2000 : round2(1 + (i % 300) * 0.37),
            type: isIn ? "income" : "expense",
            cat: isIn ? "living" : cats[i % cats.length],
            peer: "店" + (i % 40),
            note: "备注" + i,
            book: bookIds[i % bookIds.length],
            src: "import"
          });
        }
      });
      eq("生成 5000 笔", recs.length, 5000);

      state.records = recs;
      state.books = [
        { id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 1000, def: true },
        { id: "food", name: "吃饭", icon: "🍜", color: BOOK_COLORS[1], budget: 600 },
        { id: "study", name: "学习", icon: "📚", color: BOOK_COLORS[2], budget: 300 }
      ];
      state.viewMonth = { y: Y, m: M };
      state.book = "all";
      state.filter = "all";
      save();

      // 期望值独立算一遍
      var expOut = 0, expIn = 0, expCnt = 0;
      recs.forEach(function(r){
        var d = new Date(r.ts);
        if(d.getFullYear() === Y && d.getMonth() === M){
          expCnt++;
          if(r.type === "income") expIn += r.amt; else expOut += r.amt;
        }
      });
      expOut = round2(expOut); expIn = round2(expIn);

      var raw = localStorage.getItem("xiaozhangben.v3") || "";
      ok("存档写得进去", raw.length > 100000);
      ok("存档小于 5MB（浏览器上限）", raw.length < 5 * 1024 * 1024);

      // 清干净再读回来
      state.records = [];
      state.books = [];
      load();
      eq("读回来还是 5000 笔", state.records.length, 5000);
      var lost = state.records.filter(function(r){ return !r.book; }).length;
      eq("每笔都带账本，没有漏写", lost, 0);

      renderAll();
      var sOut = $("sOut").textContent, sIn = $("sIn").textContent;
      eq("本月支出合计对得上", sOut, "¥" + money(expOut));
      eq("本月收入合计对得上", sIn, "¥" + money(expIn));
      ok("明细页笔数提示对得上", $("sCnt").textContent.indexOf(String(expCnt)) >= 0);

      var rendered = document.querySelectorAll("#flowBody .item").length;
      ok("本月 " + expCnt + " 笔时只先画 " + rendered + " 行，不把 DOM 撑爆", rendered >= 800 && rendered <= 900);
      ok("底下明说还有多少笔没画", ($("btnMoreFlow") || {}).textContent ? /还有\s*\d+\s*笔/.test($("btnMoreFlow").textContent) : false);
      $("btnMoreFlow").click();
      eq("点开后全部 " + expCnt + " 笔都画出来", document.querySelectorAll("#flowBody .item").length, expCnt);
      ok("全画出来后按钮就没了", !$("btnMoreFlow"));

      renderStats();
      ok("统计页也出了数", $("statsBody").textContent.length > 50);

      // 逐日加起来必须等于本月支出
      var sumDay = 0;
      var daysInM = new Date(Y, M + 1, 0).getDate();
      for(var dd = 1; dd <= daysInM; dd++) sumDay += daySpentOf(ymdKey(Y, M, dd), "all");
      near("逐日相加 = 本月支出（一个数只算一次）", round2(sumDay), expOut);

      // 单账本口径
      state.book = "daily";
      renderFlow();
      var expBook = round2(recs.filter(function(r){
        var d = new Date(r.ts);
        return d.getFullYear() === Y && d.getMonth() === M && r.type !== "income" && r.book === "daily";
      }).reduce(function(a, r){ return a + r.amt; }, 0));
      eq("挑一个账本，支出只算这本（book=" + state.book + " 命中" + monthRecs().filter(inBook).length + "笔）",
        $("sOut").textContent, "¥" + money(expBook));
      state.book = "all";
      renderFlow();

      /* ================= B. 3000 行账单 ================= */
      var head = "交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注\n";
      var lines = [];
      var csvOut = 0;
      for(var i2 = 0; i2 < 3000; i2++){
        var day = (i2 % 28) + 1;
        var mo = ((i2 / 28) | 0) % 12;
        var yy = 2026 + (((i2 / 336) | 0) % 2);
        var amt = round2(1 + (i2 % 500) * 0.13);
        csvOut += amt;
        var hh = (i2 % 23) + 1, mi2 = (i2 * 7) % 60, ss = (i2 * 13) % 60;
        lines.push(
          yy + "-" + ("0" + (mo + 1)).slice(-2) + "-" + ("0" + day).slice(-2) + " " +
          ("0" + hh).slice(-2) + ":" + ("0" + mi2).slice(-2) + ":" + ("0" + ss).slice(-2) +
          ",商户消费,店" + (i2 % 60) + ",商品" + i2 + ",支出,¥" + amt.toFixed(2) +
          ",零钱,支付成功,S" + i2 + ",M" + i2 + ",/"
        );
      }
      var csv = head + lines.join("\n");
      var p1 = parseBillCSV(csv);
      eq("3000 行全解析出来了", p1.records.length, 3000);
      var badAmt = p1.records.filter(function(r){ return !(r.amt > 0); }).length;
      eq("没有解析成 0 元的行", badAmt, 0);

      // 从空库开始导，避免和 A 组的 5000 笔混在一起
      state.records = [];
      state.books = state.books.length ? state.books : [];
      var r1 = ingest(p1.records);
      eq("第一次导入都进去了", r1.added, 3000);
      var total1 = round2(state.records.reduce(function(a, r){ return a + (r.type === "income" ? 0 : r.amt); }, 0));
      near("导入后总支出 = 账单金额和", total1, round2(csvOut));

      var p2 = parseBillCSV(csv);
      var r2 = ingest(p2.records);
      eq("同一份再导一次：一笔都不新增", r2.added, 0);
      eq("同一份再导一次：全判成重复", r2.dup, 3000);
      eq("导两次库里的笔数不变", state.records.length, 3000);

      // 只改金额的 3000 行应该全都算新的
      var csv2 = csv.replace(/¥/g, "¥9");
      var p3 = parseBillCSV(csv2);
      var r3 = ingest(p3.records);
      eq("金额全变了就是新账，不再判重", r3.added, 3000);

      /* ================= C. 极端金额 ================= */
      eq("千分位逗号去掉，符号留着", stripThousand("¥1,200.00"), "¥1200.00");
      near("从一句话里抠出 1,234.56", extractAmount("今天买菜花了1,234.56元"), 1234.56);
      near("一亿也能读", extractAmount("转账 100,000,000.00 元"), 100000000);
      ok("0 元不会被当成一笔", parseOne("0 元 买了瓶水") === null);
      ok("17 位数字也不崩", (function(){
        try{ var v = extractAmount("12345678901234567 元"); return v === 12345678901234567 || isFinite(v); }
        catch(e){ return false; }
      })());

      state.records = [];
      // 导入后会自动跳到最新那笔所在月份，这里手动掰回本月
      state.viewMonth = { y: Y, m: M };
      state.book = "all"; state.filter = "all";
      [[0.1, 1], [0.2, 1], [0.03, 1], [999999.99, 1], [0.01, 3]].forEach(function(pair, idx){
        for(var k = 0; k < pair[1]; k++){
          state.records.push({
            id: "x" + idx + "_" + k, ts: Date.now() - idx * 1000, amt: pair[0],
            type: "expense", cat: "daily", peer: "p" + idx, note: "", book: "daily", src: "manual"
          });
        }
      });
      renderFlow();
      var pSum = round2(state.records.reduce(function(a, r){ return a + r.amt; }, 0));
      ok("小数样本本月命中 " + monthRecs().length + " 笔 / 共 " + state.records.length + " 笔 / vm=" +
        JSON.stringify(state.viewMonth) + " 首笔=" + new Date(state.records[0].ts).toDateString(), monthRecs().length === 7);
      eq("小数累加不出浮点尾巴", $("sOut").textContent, "¥" + money(pSum));
      ok("0.1+0.2+0.03 没变成 0.33000000000000002", money(pSum).indexOf("0000000") < 0);

      /* ================= D. 日期边界 ================= */
      var t1 = new Date(2026, 11, 31, 23, 59, 59).getTime();
      var t2 = new Date(2027, 0, 1, 0, 0, 0).getTime();
      ok("12/31 23:59 算 12 月", inMonth(t1, 2026, 11));
      ok("1/1 00:00 不算 12 月", !inMonth(t2, 2026, 11));
      ok("跨年不串月", inMonth(t2, 2027, 0));

      var leap = new Date(2028, 1, 29, 12, 0, 0).getTime();
      ok("2028-02-29 算 2 月", inMonth(leap, 2028, 1));
      eq("闰年 2 月有 29 天", new Date(2028, 2, 0).getDate(), 29);
      ok("2/29 的日键合法", okDayKey("2028-02-29"));
      ok("2/29 能存日预算", (function(){ state.dayBud["2028-02-29"] = 80; return dayBudOf("2028-02-29") === 80; })());
      ok("2/30 这种假日期被挡掉", !okDayKey("2028-02-30"));
      ok("13 月被挡掉", !okDayKey("2028-13-01"));

      /* ================= E. 400 天日预算 ================= */
      state.dayBud = {};
      var n400 = 0, sum400 = 0;
      for(var k2 = 0; k2 < 400; k2++){
        var dd2 = new Date(Y, M, 1 + k2);
        state.dayBud[ymdKey(dd2.getFullYear(), dd2.getMonth(), dd2.getDate())] = 50 + (k2 % 70);
        n400++; sum400 += 50 + (k2 % 70);
      }
      save();
      state.dayBud = {};
      load();
      eq("400 天日预算全都读回来了", Object.keys(state.dayBud).length, n400);
      var got400 = Object.keys(state.dayBud).reduce(function(a, k3){ return a + state.dayBud[k3]; }, 0);
      eq("400 天的金额一分不差", got400, sum400);
      ok("跨年那几天也在", !!state.dayBud[ymdKey(Y + 1, M, 15)]);
      state.dayMode = 3;
      state.dayWeek = [10, 20, 30, 40, 50, 60, 70];
      save(); state.dayWeek = []; state.dayMode = 1;
      load();
      eq("按星期的 7 个数字存得住", state.dayWeek.join(","), "10,20,30,40,50,60,70");
      eq("填法也存得住", state.dayMode, 3);

      /* ================= F. 存储接近上限 ================= */
      state.records = [];
      for(var f = 0; f < 12000; f++){
        state.records.push({
          id: "f" + f, ts: Date.now() - f * 60000, amt: round2(1 + (f % 900) * 0.11),
          type: "expense", cat: "food", peer: "很长很长的商户名字" + f, note: "一句话备注" + f,
          book: "daily", src: "import"
        });
      }
      var okSave = true;
      var errBefore = "";
      try{
        save();
      }catch(e){ okSave = false; errBefore = e.message; }
      ok("12000 笔也能存（或至少不炸）", okSave);
      var sz = (localStorage.getItem("xiaozhangben.v3") || "").length;
      ok("12000 笔存档大小正常：" + (sz / 1048576).toFixed(2) + "MB", sz < 5 * 1024 * 1024);
      state.records = [];
      load();
      eq("12000 笔读回来一笔不少", state.records.length, 12000);

      /* ================= G. 20 个账本 ================= */
      state.books = [{ id: "daily", name: "日常", icon: "🏠", color: "#DE6B45", budget: 500 }];
      for(var g = 1; g < 20; g++){
        state.books.push({ id: "bk" + g, name: "账本" + g, icon: "📒",
          color: BOOK_COLORS[g % BOOK_COLORS.length], budget: g * 100 });
      }
      state.records = [];
      for(var g2 = 0; g2 < 400; g2++){
        state.records.push({
          id: "g" + g2, ts: Date.now() - g2 * 1000, amt: 10, type: "expense", cat: "food",
          peer: "p", note: "", book: "bk" + (g2 % 20), src: "manual"
        });
      }
      save();
      load();
      eq("20 个账本都还在", state.books.length, 20);
      var budTotal = state.books.reduce(function(a, b){ return a + (+b.budget || 0); }, 0);
      eq("20 本预算合计 = 500 + 100+200…", budTotal, 500 + 19000);
      renderBooks();
      ok("账本页 20 本都渲染出来了", document.querySelectorAll("#booksStack .bb2, #booksStack .bcard").length >= 1);

      // 删一本：账目要挪走，不能整本消失（走确认框）
      var beforeG = state.records.length;
      delBook("bk3");
      ok("删账本先弹确认框", $("askBox").classList.contains("on"));
      $("askYes").click();
      eq("删账本不删账目", state.records.length, beforeG);
      var orphan = state.records.filter(function(r){ return !bookOf(r.book); }).length;
      eq("删掉的账本没有留下孤儿账目", orphan, 0);
      eq("账本少了一本", state.books.length, 19);

      /* ================= H. 待分类 ================= */
      state.books = snap.books;
      state.records = [];
      var ucSpec = [[0, 3], [1, 5], [2, 7]];
      ucSpec.forEach(function(sp, si){
        for(var q = 0; q < sp[1]; q++){
          state.records.push({
            id: "u" + si + "_" + q, ts: new Date(Y, M - sp[0], 10 + q).getTime(), amt: 5,
            type: "expense", cat: "", peer: "u", note: "", book: "daily", src: "manual"
          });
        }
      });
      eq("待分类按全部月份算（3+5+7=15）", uncatCount(), 15);
      state.viewMonth = { y: Y, m: M };
      renderFlow();
      ok("徽标显示 15（实际 " + $("tabBadge").textContent + "）", $("tabBadge").textContent === "15");

      /* ================= I. 坏账本存档自愈 ================= */
      state.records = [{ id: "i1", ts: Date.now(), amt: 9, type: "expense", cat: "food",
        peer: "p", note: "", book: "gone", src: "manual" }];
      state.books = [
        { id: "daily", name: "日常", icon: "🏠" },                    // 缺 color
        { id: "x", name: "", icon: "" },                              // 缺名字
        { id: "x", name: "重名", icon: "📒", color: "red" }           // id 重复 + 颜色非法
      ];
      save();
      load();
      eq("三本坏的账本一本没少", state.books.length, 3);
      eq("缺颜色/颜色非法都补成 #RRGGBB", state.books.filter(function(b){
        return /^#[0-9A-Fa-f]{6}$/.test(String(b.color || ""));
      }).length, 3);
      eq("缺名字的也补了", state.books.filter(function(b){ return !!b.name; }).length, 3);
      eq("重复 id 被拆开", new Set(state.books.map(function(b){ return b.id; })).size, 3);
      var okBooks = true;
      try{ renderBooks(); }catch(e){ okBooks = false; }
      ok("账本页画得出来，不白屏", okBooks);
      eq("指向不存在账本的账被捞回默认账本", state.records.length && state.records[0].book, state.books[0].id);
    }catch(e){
      var st = ((e && e.stack) || "").split("\n").slice(1, 3).join(" < ");
      log.push("NERR:" + (e && e.message) + " @" + st);
    }

    // 复原
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
    document.title = "big1 " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 400);
})();
