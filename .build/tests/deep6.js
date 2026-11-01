/* deep6：同一个数字在多处必须一致
   300 笔随机账（5 个账本、含收入/退款/未分类/上月），然后比对：
   Y. 明细页三格 vs 程序算 vs 账本页 vs 首页
   Z. 各账本卡片金额之和 = 明细总支出（总账本永远是并集）
   AA. 切账本后合计只算那一本；切回来一分不差
   AB. 统计页前 5 类金额之和 = 程序算的前 5 类
   AC. 上个月的数据不能渗进本月任何一个数字
   AD. 退款只进收入、不进支出
   AE. 筛选「待分类」只改列表，不改合计（合计永远全月） */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function near(n, got, want){ log.push((Math.abs(got - want) < 0.005 ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function numOf(s){
    var m = String(s).replace(/[¥,，\s]/g, "").match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }

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
      /* ---------- 造数据：确定性伪随机，跑多少次都一样 ---------- */
      var seed = 20261022;
      function rnd(){ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
      function pick(a){ return a[Math.floor(rnd() * a.length)]; }

      var BOOKS = [
        {id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 800, def: true},
        {id: "food",  name: "吃饭", icon: "🍜", color: BOOK_COLORS[1], budget: 500},
        {id: "study", name: "学习", icon: "📚", color: BOOK_COLORS[2], budget: 0},
        {id: "fun",   name: "玩乐", icon: "🎮", color: BOOK_COLORS[3], budget: 300},
        {id: "big",   name: "大件", icon: "🎧", color: BOOK_COLORS[4], budget: 0}
      ];
      state.books = BOOKS.map(function(b){ return {id: b.id, name: b.name, icon: b.icon, color: b.color, budget: b.budget, def: !!b.def}; });

      var CATS = ["food", "daily", "traffic", "study", "fun", "cloth", "med", "comm", "house", "gift", "other"];
      var recs = [];
      for(var i = 0; i < 300; i++){
        var bk = pick(BOOKS).id;
        var isOld = rnd() < 0.2;                        // 两成记在上个月
        var day = isOld ? (1 + Math.floor(rnd() * 27)) : (1 + Math.floor(rnd() * new Date(Y, M + 1, 0).getDate()));
        var mm = isOld ? (M === 0 ? 11 : M - 1) : M;
        var yy = (isOld && M === 0) ? Y - 1 : Y;
        var r = {id: "d6_" + i, ts: new Date(yy, mm, day, 8 + Math.floor(rnd() * 14), Math.floor(rnd() * 60), 0).getTime(),
          amt: 0, type: "expense", cat: null, peer: "", note: "", book: bk, src: "manual"};
        var kind = rnd();
        if(kind < 0.18){                                 // 收入
          r.type = "income";
          r.cat = pick(["allowance", "salary", "part", "redpacket", "refund"]);
          r.amt = Math.round(rnd() * 200000) / 100;
          r.peer = "收入来源";
        }else{
          r.amt = Math.round((0.01 + rnd() * 5000) * 100) / 100;
          if(rnd() > 0.15) r.cat = pick(CATS);           // 一成半留待分类
          r.peer = pick(["食堂", "超市", "地铁", "书店", "奶茶", "药店", "话费", "房租"]);
        }
        recs.push(r);
      }
      state.records = recs;
      state.book = "all"; state.filter = "all";
      state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      renderAll(); renderHome(); renderBooks();

      /* ---------- 程序侧真值 ---------- */
      function inMonth(r, y, m){ var d = new Date(r.ts); return d.getFullYear() === y && d.getMonth() === m; }
      var cur = recs.filter(function(r){ return inMonth(r, Y, M); });
      var tOut = 0, tIn = 0;
      cur.forEach(function(r){ if(r.type === "income") tIn += r.amt; else tOut += r.amt; });

      /* ---------- Y. 明细页 ---------- */
      near("明细：本月支出和程序算的一致", numOf($("sOut").textContent), tOut);
      near("明细：本月收入和程序算的一致", numOf($("sIn").textContent), tIn);
      eq("明细：笔数是本月全部（含收入）", $("sCnt").textContent, "共 " + cur.length + " 笔");
      near("明细：结余 = 收入 - 支出", numOf($("sBal").textContent), tIn - tOut);
      eq("明细：结余为负时前面带负号",
        (tIn - tOut < 0) === ($("sBal").textContent.indexOf("-") === 0), true);

      /* ---------- Y2. 账本页 ---------- */
      near("账本页：总账本支出和明细一致", numOf($("bbOut").textContent), tOut);
      near("账本页：总账本收入和明细一致", numOf($("bbIn").textContent), tIn);
      eq("账本页：笔数和明细一致", $("bbCnt").textContent, "· 共 " + cur.length + " 笔");

      /* ---------- Z. 各账本卡片之和 = 总支出 ---------- */
      var cardSum = 0, cardCnt = 0;
      Array.prototype.forEach.call(document.querySelectorAll("#bookGrid .bamt"), function(el){
        cardSum += numOf(el.textContent);
      });
      Array.prototype.forEach.call(document.querySelectorAll("#bookGrid .bmeta"), function(el){
        var m2 = /(\d+)\s*笔/.exec(el.textContent);
        if(m2) cardCnt += +m2[1];
      });
      near("五本账本的支出加起来等于总支出（总账本只是并集）", cardSum, tOut);
      eq("五本账本的笔数加起来等于本月支出笔数", cardCnt,
        cur.filter(function(r){ return r.type !== "income"; }).length);
      /* 卡片的笔数是「支出笔数」，记账页那条汇总写的「共 N 笔」是全部笔数。
         同一个「笔」两个口径，用户会以为两边算错了 —— 卡片必须写明「笔支出」。 */
      ok("账本卡片写清是「笔支出」，不和记账页的「共 N 笔」混",
        Array.prototype.every.call(document.querySelectorAll("#bookGrid .bmeta"), function(el){
          return /笔支出/.test(el.textContent);
        }));

      /* ---------- 首页 ---------- */
      near("首页：已花和明细一致（首页不跟账本筛选走）", numOf($("hmSpent").textContent), tOut);
      var budSum = BOOKS.reduce(function(a, b){ return a + b.budget; }, 0);
      /* 2026-10-23 改口径：花超了不写「本月还能花 -479,187.18」，改成「本月超支」+ 正数。
         这里两种状态都覆盖，免得以后改回负数没人发现。 */
      var leftWant = budSum - tOut;
      if(leftWant < 0){
        near("首页：超支金额 = 支出 - 预算（正数显示）", numOf($("hmLeft").textContent), -leftWant);
        eq("首页：超支时标题改说「本月超支」", $("hmLb").textContent, "本月超支");
      }else{
        near("首页：还能花 = 预算合计 - 支出", numOf($("hmLeft").textContent), leftWant);
        eq("首页：标题说的是「本月还能花」", $("hmLb").textContent, "本月还能花");
      }

      /* ---------- AA. 切账本 ---------- */
      state.book = "food"; state._flowKey = null; renderAll(); renderHome();
      var foodOut = 0, foodIn = 0;
      cur.forEach(function(r){
        if(r.book !== "food") return;
        if(r.type === "income") foodIn += r.amt; else foodOut += r.amt;
      });
      near("切到「吃饭」：支出只算这一本", numOf($("sOut").textContent), foodOut);
      near("切到「吃饭」：收入只算这一本", numOf($("sIn").textContent), foodIn);
      eq("切到「吃饭」：笔数只算这一本", $("sCnt").textContent,
        "共 " + cur.filter(function(r){ return r.book === "food"; }).length + " 笔");

      state.book = "all"; state._flowKey = null; renderAll(); renderHome();
      near("切回总账本：一分不差", numOf($("sOut").textContent), tOut);

      /* ---------- AB. 统计页 ---------- */
      if($("btnStats")) $("btnStats").click();
      var barSum = 0, barN = 0;
      Array.prototype.forEach.call(document.querySelectorAll("#statsBody .brow b.num"), function(el){
        barSum += numOf(el.textContent); barN++;
      });
      var byCat = {};
      cur.forEach(function(r){ if(r.type !== "income"){ var k = r.cat || "_none"; byCat[k] = (byCat[k] || 0) + r.amt; } });
      var topArr = Object.keys(byCat).map(function(k){ return byCat[k]; }).sort(function(a, b){ return b - a; }).slice(0, 5);
      var topSum = topArr.reduce(function(a, b){ return a + b; }, 0);
      eq("统计页画了前 5 类（不够 5 类时按实际类数）", barN, Math.min(5, topArr.length));
      near("统计页前 5 类的金额之和 = 程序算的前 5 类", barSum, topSum);

      /* ---------- AC. 上月不能渗进本月 ---------- */
      var oldOut = 0;
      recs.filter(function(r){ return !inMonth(r, Y, M) && r.type !== "income"; })
        .forEach(function(r){ oldOut += r.amt; });
      ok("上个月确实有支出（这组数据才测得出渗漏）", oldOut > 0);
      var allOut = recs.filter(function(r){ return r.type !== "income"; })
        .reduce(function(a, r){ return a + r.amt; }, 0);
      ok("本月支出和全部支出不是同一个数（说明没把上月算进来）",
        Math.abs(allOut - tOut) > 0.01 || oldOut === 0);
      near("本月支出 = 全部支出 - 上月支出", tOut, allOut - oldOut);

      /* ---------- AD. 退款 ---------- */
      var refundRec = {id: "rf1", ts: new Date(Y, M, 15, 12, 0, 0).getTime(), amt: 66.66,
        type: "income", cat: "refund", peer: "退款", note: "", book: "daily", src: "import"};
      state.records.push(refundRec);
      state._flowKey = null; renderAll(); renderHome(); renderBooks();
      near("退款只进收入", numOf($("sIn").textContent), tIn + 66.66);
      near("退款不进支出", numOf($("sOut").textContent), tOut);
      state.records.pop();

      /* ---------- AE. 筛选待分类 ---------- */
      state.book = "all"; state.filter = "uncat"; state._flowKey = null;
      renderAll();
      var uncatN = cur.filter(function(r){ return !r.cat && r.type !== "income"; }).length;
      var shownN = document.querySelectorAll("#flowBody .item").length;
      ok("筛选待分类：列表里只剩没分类的（" + shownN + " / 应 " + uncatN + "）",
        shownN <= uncatN + 1);
      near("筛选待分类：合计还是全月，不跟着筛", numOf($("sOut").textContent), tOut);
      state.filter = "all"; state._flowKey = null; renderAll();
      near("取消筛选：合计没变", numOf($("sOut").textContent), tOut);

    }catch(e){
      log.push("N抛异常:" + (e && e.message ? e.message : e));
    }

    try{
      state.records = snap.records; state.books = snap.books; state.dayBud = snap.dayBud;
      state.dayMode = snap.dayMode; state.dayWeek = snap.dayWeek; state.order = snap.order;
      state.viewMonth = snap.viewMonth; state.book = snap.book; state.filter = snap.filter;
      state.peerRules = snap.peerRules; state._storeCount = snap._storeCount;
      state._extra = snap._extra; state._flowKey = snap._flowKey; state._flowAll = snap._flowAll;
      renderAll(); renderHome();
    }catch(e){}

    var pass = log.filter(function(s){ return s[0] === "Y"; }).length;
    document.title = "deep6 " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 400);
})();
