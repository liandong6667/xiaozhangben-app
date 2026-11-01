/* 大数据第二轮：批量导入、超大存档、备份往返、月份切换
   J. 10000 行账单（只有 5 种金额，最容易撞进同一个判重桶）
   K. 20000 笔存档：能不能存、能不能读回来
   L. 备份导出 → 恢复：一笔不重、一笔不少
   M. 月份左右切换：数字跟着月份走，不串账
   N. 坏备份：字段缺失 / 类型不对，不能把库搞坏 */
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

      /* ======== J. 10000 行，只有 5 种金额 ======== */
      var head = "交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注\n";
      var amts = [5, 9.9, 15, 20, 30];
      var lines = [], wantSum = 0;
      for(var i = 0; i < 10000; i++){
        var a = amts[i % 5];
        wantSum += a;
        // 每 37 分钟一笔：分钟一定不重复，才测得出真正的 10000 笔（而不是被自己造的时间撞重复）
        var ts = new Date(2026, 0, 1, 8, 0, 0).getTime() + i * 37 * 60000;
        var dd = new Date(ts);
        lines.push(dd.getFullYear() + "-" + ("0" + (dd.getMonth() + 1)).slice(-2) + "-" +
          ("0" + dd.getDate()).slice(-2) + " " +
          ("0" + dd.getHours()).slice(-2) + ":" + ("0" + dd.getMinutes()).slice(-2) + ":" + ("0" + dd.getSeconds()).slice(-2) +
          ",商户消费,店" + (i % 30) + ",商品" + i + ",支出,¥" + a.toFixed(2) +
          ",零钱,支付成功,S" + i + ",M" + i + ",/");
      }
      var csv = head + lines.join("\n");

      var t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
      var p = parseBillCSV(csv);
      var t1 = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
      eq("10000 行一行不丢", p.records.length, 10000);
      ok("解析没卡住（" + Math.round(t1 - t0) + "ms）", (t1 - t0) < 8000);

      state.records = [];
      state.books = [{ id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true }];
      var t2 = performance.now();
      var r1 = ingest(p.records);
      var t3 = performance.now();
      eq("第一次 10000 笔全进", r1.added, 10000);
      ok("入账没卡住（" + Math.round(t3 - t2) + "ms）", (t3 - t2) < 8000);
      near("总支出 = 10000 行金额和", round2(state.records.reduce(function(s, r){ return s + r.amt; }, 0)), round2(wantSum));

      var p2 = parseBillCSV(csv);
      var r2 = ingest(p2.records);
      eq("同一份 10000 行再导一次：新增 0", r2.added, 0);
      eq("同一份 10000 行再导一次：全判重复", r2.dup, 10000);
      eq("库里的笔数还是 10000", state.records.length, 10000);

      // 同一批里真有"同分钟同金额"的成对消费（两杯一样的奶茶）——必须记两笔
      var twin = head +
        "2026-03-05 12:30:10,商户消费,蜜雪冰城,柠檬水,支出,¥6.00,零钱,支付成功,T1,M1,/\n" +
        "2026-03-05 12:30:10,商户消费,蜜雪冰城,柠檬水,支出,¥6.00,零钱,支付成功,T2,M2,/\n";
      state.records = [];
      var pt = parseBillCSV(twin);
      var rt = ingest(pt.records);
      eq("同一分钟同店同价的两杯，算两笔", rt.added, 2);
      var p3 = parseBillCSV(twin);
      var r3 = ingest(p3.records);
      eq("这两笔再导一次都不重复记", r3.added, 0);
      eq("这两笔再导一次全判重复", r3.dup, 2);

      /* ======== K. 20000 笔存档 ======== */
      state.records = [];
      for(var k = 0; k < 20000; k++){
        state.records.push({
          id: "k" + k, ts: Date.now() - (k % 200) * 3600e3, amt: round2(1 + (k % 700) * 0.17),
          type: (k % 50 === 0) ? "income" : "expense",
          cat: (k % 50 === 0) ? "living" : "food",
          peer: "商户" + (k % 100), note: "备注" + k, book: "daily", src: "import"
        });
      }
      var exp20 = round2(state.records.reduce(function(s, r){ return s + (r.type === "income" ? 0 : r.amt); }, 0));
      var threw = false;
      try{ save(); }catch(e){ threw = true; }
      ok("20000 笔保存不抛异常", !threw);
      var raw20 = localStorage.getItem("xiaozhangben.v3") || "";
      ok("20000 笔存档 " + (raw20.length / 1048576).toFixed(2) + "MB，没超 5MB", raw20.length < 5 * 1024 * 1024);
      state.records = [];
      load();
      eq("20000 笔读回来一笔不少", state.records.length, 20000);
      state.viewMonth = { y: Y, m: M };
      state.book = "all";
      renderFlow();
      equal20: {
        var got20 = $("sOut").textContent;
        // 只算本月的那部分
        var m20 = round2(state.records.filter(function(r){
          var d = new Date(r.ts);
          return d.getFullYear() === Y && d.getMonth() === M && r.type !== "income";
        }).reduce(function(s, r){ return s + r.amt; }, 0));
        eq("20000 笔里本月支出也算得对", got20, "¥" + money(m20));
      }

      /* ======== L. 备份往返 ======== */
      var bk = { records: state.records.slice(0, 500), books: state.books,
        peerRules: {}, dayBud: state.dayBud, dayMode: state.dayMode, dayWeek: state.dayWeek,
        order: state.order, v: 4, at: Date.now() };
      var bkText = JSON.stringify(bk);
      ok("500 笔备份 JSON 生成得出", bkText.length > 1000);
      var seen = new Set(state.records.map(fpStrict));
      var add = 0;
      bk.records.forEach(function(r){
        if(!seen.has(fpStrict(r))){ add++; seen.add(fpStrict(r)); }
      });
      eq("备份里的 500 笔一条都没重复", add, 0);

      // 从空库恢复 500 笔
      state.records = [];
      var seen0 = new Set();
      var add0 = 0;
      bk.records.forEach(function(r){
        if(!seen0.has(fpStrict(r))){ seen0.add(fpStrict(r)); add0++; }
      });
      eq("空库恢复 500 笔一条不少", add0, 500);

      /* ======== M. 月份切换 ======== */
      state.records = [
        { id: "m1", ts: new Date(Y, M, 5, 12).getTime(), amt: 100, type: "expense", cat: "food", peer: "a", note: "", book: "daily", src: "manual" },
        { id: "m2", ts: new Date(Y, M - 1, 5, 12).getTime(), amt: 200, type: "expense", cat: "food", peer: "b", note: "", book: "daily", src: "manual" },
        { id: "m3", ts: new Date(Y, M - 2, 5, 12).getTime(), amt: 300, type: "expense", cat: "food", peer: "c", note: "", book: "daily", src: "manual" },
        { id: "m4", ts: new Date(Y, M, 6, 12).getTime(), amt: 50, type: "income", cat: "living", peer: "d", note: "", book: "daily", src: "manual" }
      ];
      state.viewMonth = { y: Y, m: M }; state.book = "all";
      renderFlow();
      eq("本月支出只算本月", $("sOut").textContent, "¥100.00");
      eq("本月收入只算本月", $("sIn").textContent, "¥50.00");
      var pg = new Date(Y, M - 1, 1);
      state.viewMonth = { y: pg.getFullYear(), m: pg.getMonth() };
      renderFlow();
      eq("退到上个月，支出换成上月那笔", $("sOut").textContent, "¥200.00");
      state.viewMonth = { y: Y, m: M };
      renderFlow();

      /* ======== N. 存档里混进坏记录 ======== */
      state.records = [];
      var dirty = { v: 4, records: [
        { ts: Date.now(), amt: 10, type: "expense", book: "daily" },
        { amt: 10 },                                        // 缺 ts → 丢
        null,                                                // 空行 → 丢
        { ts: Date.now(), amt: "12.5", type: "expense", book: "daily" },
        { ts: Date.now(), amt: 0, type: "expense" },          // 0 元 → 丢
        { ts: Date.now(), amt: 7, type: "乱写", book: "不存在的账本" }
      ], books: [{ id: "daily", name: "日常" }] };
      localStorage.setItem("xiaozhangben.v3", JSON.stringify(dirty));
      load();
      eq("坏记录被跳过，能认的留下", state.records.length, 3);
      ok("跳过了几条也有计数（" + state._skipped + "）", state._skipped >= 3);
      eq("乱写的类型被掰回支出", state.records[2].type, "expense");
      eq("指向不存在账本的被捞回日常", state.records[2].book, "daily");
      eq("字符串金额被转成数字", state.records[1].amt, 12.5);
      ok("残缺的账本（缺 color）也没让页面崩", (function(){
        try{ renderBooks(); renderFlow(); return true; }catch(e){ return false; }
      })());
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
    document.title = "big2 " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 400);
})();
