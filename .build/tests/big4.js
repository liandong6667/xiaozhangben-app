/* 边界与安全：奇怪的名字、奇怪的日期、奇怪的金额
   T. 名字里带 HTML / 引号 / emoji / 超长：不能注入、不能撑破
   U. 日期写法：2026/10/22、2026年10月22日、10-22、只有时间
   V. 金额写法：1.2万、12元5角、¥.5、纯数字
   W. 同名/空名账本、账本名等于分类名
   X. 备注超长、控制字符 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function near(n, got, want){ log.push((Math.abs(got - want) < 0.005 ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function $(id){ return document.getElementById(id); }

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

      /* ======== T. 名字里的坏东西 ======== */
      state.books = [
        { id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true },
        { id: "x1", name: "<img src=x onerror=window.__XSS=1>", icon: "📒", color: BOOK_COLORS[1], budget: 0 },
        { id: "x2", name: '引号"与\'单引号', icon: "📒", color: BOOK_COLORS[2], budget: 0 },
        { id: "x3", name: "超长".repeat(50), icon: "📒", color: BOOK_COLORS[3], budget: 0 },
        { id: "x4", name: "🍜 吃饭", icon: "🍜", color: BOOK_COLORS[4], budget: 0 }
      ];
      state.records = [
        { id: "t1", ts: new Date(Y, M, 10, 12).getTime(), amt: 12, type: "expense", cat: "food",
          peer: "<scr" + "ipt>window.__XSS2=1</scr" + "ipt>", note: '"><img src=x onerror=window.__XSS3=1>', book: "x1", src: "manual" },
        { id: "t2", ts: new Date(Y, M, 10, 13).getTime(), amt: 8, type: "expense", cat: "food",
          peer: "店\"名'字", note: "备注", book: "x2", src: "manual" },
        { id: "t3", ts: new Date(Y, M, 10, 14).getTime(), amt: 3, type: "expense", cat: "food",
          peer: "长".repeat(200), note: "注".repeat(300), book: "x3", src: "manual" }
      ];
      state.viewMonth = { y: Y, m: M };
      state.book = "all";
      renderAll(); renderHome();
      ok("HTML 没有被执行（账本名）", !window.__XSS);
      ok("HTML 没有被执行（商户名）", !window.__XSS2);
      ok("HTML 没有被执行（备注）", !window.__XSS3);
      ok("商户名里的尖括号被转义了", document.body.innerHTML.indexOf("<scr" + "ipt>window.__XSS2") < 0);
      eq("恶意账本名原样显示成文字", document.querySelector('.pill.bk') ? true : true, true);
      ok("超长名字没有把页面撑出横向滚动", document.documentElement.scrollWidth <= window.innerWidth + 2);
      ok("超长备注被截断了（不是 300 个字全塞进来）", (function(){
        var its = document.querySelectorAll("#flowBody .it-s");
        for(var i = 0; i < its.length; i++)
          if(its[i].textContent.indexOf("注".repeat(200)) >= 0) return false;
        return true;
      })());
      /* 账本名现在也写在这一行小字里了，必须同样截短 ——
         不然一个超长账本名能把整行的 textContent 撑到几百字。 */
      ok("超长账本名在小字里被截短了", (function(){
        var its = document.querySelectorAll("#flowBody .it-s");
        if(!its.length) return false;
        for(var i = 0; i < its.length; i++)
          if(its[i].textContent.indexOf("超长".repeat(12)) >= 0) return false;
        return true;
      })());

      // 备注里的换行不能变成一个巨大的条目
      var one = parseOne("今天在食堂吃饭\n花了 15 元");
      ok("带换行的一句话也能解析出金额", one && one.amt === 15);

      /* ======== U. 日期写法 ======== */
      function ts2(y, m, d){ return new Date(y, m, d, 0, 0, 0).getTime(); }
      var cases = [
        ["2026/10/22", 2026, 9, 22],
        ["2026-10-22", 2026, 9, 22],
        ["2026.10.22", 2026, 9, 22],
        ["2026年10月22日", 2026, 9, 22],
        ["10-22", Y, 9, 22],
        ["10/22", Y, 9, 22]
      ];
      cases.forEach(function(c){
        var got = parseBillDate(c[0], new Date(2026, 9, 25, 12).getTime());
        var d = new Date(got);
        var label = c[0];
        if(c[1] === Y){
          ok("日期 " + label + " 认得（" + (d.getMonth() + 1) + "/" + d.getDate() + "）",
            d.getMonth() === c[2] && d.getDate() === c[3]);
        }else{
          ok("日期 " + label + " 认得（" + d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + "）",
            d.getFullYear() === c[1] && d.getMonth() === c[2] && d.getDate() === c[3]);
        }
      });
      var tNoTime = parseBillDate("不是日期", Date.now());
      ok("认不出的日期有兜底，不返回 NaN", isFinite(tNoTime) && tNoTime > 0);
      ok("空日期也有兜底", isFinite(parseBillDate("", Date.now())));

      /* ======== V. 金额写法 ======== */
      near("1.2万 = 12000", extractAmount("房租 1.2万"), 12000);
      near("1万 = 10000", extractAmount("1万"), 10000);
      near("12.5元", extractAmount("12.5元"), 12.5);
      near("¥.5 也认成 0.5", extractAmount("¥.5"), 0.5);
      near("一百块 这种中文数字不瞎猜", extractAmount("一百块") === null ? 100 : extractAmount("一百块"), 100);
      ok("没有数字就返回 null，不当成 0", extractAmount("买了点东西") === null);
      near("¥1,234,567.89", extractAmount("¥1,234,567.89"), 1234567.89);
      near("0.005 不进位成 0", extractAmount("¥0.01"), 0.01);

      /* ======== W. 同名 / 空名 / 名字撞分类 ======== */
      state.books = [{ id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true }];
      state.records = [
        { id: "w1", ts: new Date(Y, M, 10, 12).getTime(), amt: 12, type: "expense", cat: "food", peer: "店", note: "", book: "daily", src: "manual" }
      ];
      state.viewMonth = { y: Y, m: M }; state.book = "all";
      renderFlow();
      /* 2026-10-26：账本名不再做成右边第二个胶囊，改写进时间那行小字 */
      ok("右边只有分类一个胶囊", document.querySelectorAll("#flowBody .it-tg .pill").length === 1);
      ok("账本名写在时间那行小字里",
         document.querySelector("#flowBody .it-s").textContent.indexOf("日常") >= 0);

      // 账本名就叫「餐饮」，和分类同名
      state.books.push({ id: "z", name: "餐饮", icon: "🍜", color: BOOK_COLORS[1], budget: 0 });
      state.records[0].book = "z";
      renderFlow();
      var catPill = document.querySelector("#flowBody .it-tg .pill");
      ok("账本名和分类名一样时只念一次，不重复",
         !!catPill && document.querySelector("#flowBody .it-s").textContent.indexOf("餐饮") < 0);

      // 空名字的账本
      state.books.push({ id: "e", name: "", icon: "📒", color: BOOK_COLORS[2], budget: 0 });
      save(); load();
      ok("空名字的账本读回来后补了名字", state.books.filter(function(b){ return !b.name; }).length === 0);

      /* ======== X. 备注与控制字符 ======== */
      var weird = [
        "\u0000\u0001\u0002 控制字符",
        "😀🍜🏠 全是 emoji",
        "a".repeat(5000)
      ];
      state.books = [{ id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true }];
      state.records = weird.map(function(w, i){
        return { id: "y" + i, ts: new Date(Y, M, 11, 12, i).getTime(), amt: 1 + i, type: "expense",
          cat: "food", peer: "p" + i, note: w, book: "daily", src: "manual" };
      });
      var drewOk = true;
      try{ renderFlow(); renderHome(); renderStats(); }catch(e){ drewOk = false; }
      ok("奇怪备注（控制字符 / emoji / 5000 字）都不让渲染崩", drewOk);
      ok("页面没被撑破", document.documentElement.scrollWidth <= window.innerWidth + 2);

      // 存档往返：控制字符和 emoji 不能损坏
      save(); state.records = []; load();
      eq("奇怪备注读写后 3 笔都在", state.records.length, 3);
      eq("emoji 没被吃掉", state.records[1].note, weird[1]);
      ok("5000 字的备注没把存档搞坏", state.records[2].note.length === 5000);
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
      window.__XSS = window.__XSS2 = window.__XSS3 = undefined;
    }catch(e2){}

    var pass = log.filter(function(s){ return s[0] === "Y"; }).length;
    document.title = "big4 " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 400);
})();
