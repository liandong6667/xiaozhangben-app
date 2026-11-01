/* 1.6.32 —— 补记一笔里查出来的三个真 bug
   A. 照输入框自己的提示语写「今天中午吃饭花了15   昨天收到生活费2000」，
      以前只记下 2000 那一笔，15 块的午饭消失、还粘进商户名。
      原因：只按换行切，提示语却是用三个空格隔开的。
   B. 「1.2万」的备注剩下一个孤零零的「万」，明细行商户名就显示「万」。
   C. 「上个月房租1500」记到今天 —— 本月多 1500、上月少 1500，两头都是错的。
      「3天前」「上周五」同理。
   这三条都必须走真实入口（parseText / 真的点「记上」），
   直接改 state 证明不了用户路径没坏。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  function $(id){ return document.getElementById(id); }
  function md(ts){ var x = new Date(ts); return (x.getMonth() + 1) + "/" + x.getDate(); }
  function sum(rs){ return Math.round(rs.reduce(function(a, r){ return a + r.amt; }, 0) * 100) / 100; }

  setTimeout(function(){
    var beforeN = state.records.length;
    try{
      /* ============ A. 一行两笔：提示语原文 ============ */
      var ph = $("qi") ? $("qi").getAttribute("placeholder") : "";
      ok("A0 输入框提示语里确实有「今天…15   昨天…2000」", ph.indexOf("今天中午吃饭花了15") >= 0);

      var a = parseText("今天中午吃饭花了15   昨天收到生活费2000", Date.now(), "expense");
      eq("A1 一行两笔要分成 2 笔", a.length, 2);
      eq("A2 第一笔是 15 的支出", a[0] && a[0].amt, 15);
      eq("A3 第一笔方向是支出", a[0] && a[0].type, "expense");
      eq("A4 第一笔归类餐饮", a[0] && a[0].cat, "food");
      eq("A5 第二笔是 2000 的收入", a[1] && a[1].amt, 2000);
      eq("A6 第二笔方向是收入", a[1] && a[1].type, "income");
      ok("A7 第一笔备注里没有金额残渣", a[0] && String(a[0].note).indexOf("15") < 0);

      /* ============ B. 换行多笔照旧，单空格/逗号不切 ============ */
      eq("B1 换行三笔", parseText("早餐8\n午餐15\n晚餐20", Date.now(), "expense").length, 3);
      eq("B2 单个空格不切（打车 23.5）", parseText("打车 23.5", Date.now(), "expense").length, 1);
      var c1 = parseText("买2杯奶茶，花了18", Date.now(), "expense");
      eq("B3 逗号不切，还是一笔", c1.length, 1);
      eq("B4 而且金额取 18，不是先冒出个 2 元的假账", c1[0] && c1[0].amt, 18);

      /* ============ C. 备注不留「万 / 千」 ============ */
      var w1 = parseText("1.2万", Date.now(), "expense");
      eq("C1 1.2万 = 12000", w1[0] && w1[0].amt, 12000);
      ok("C2 备注不是「万」", w1[0] && w1[0].note !== "万");
      var w2 = parseText("¥1.2万", Date.now(), "expense");
      eq("C3 ¥1.2万 = 12000", w2[0] && w2[0].amt, 12000);
      ok("C4 ¥1.2万 的备注也不留「万」", w2[0] && w2[0].note !== "万");
      var w3 = parseText("万达广场 35", Date.now(), "expense");
      eq("C5 「万达广场」不能被当金额剥掉", w3[0] && w3[0].note, "万达广场");
      var w4 = parseText("房租1.2万", Date.now(), "expense");
      eq("C6 房租1.2万 的备注是「房租」", w4[0] && w4[0].note, "房租");

      /* ============ D. 往前推的日期 ============ */
      var now = new Date();
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var lm = parseText("上个月房租1500", Date.now(), "expense")[0];
      var expectLm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      ok("D1 上个月不再记到今天", lm && md(lm.ts) !== md(today.getTime()));
      eq("D2 上个月落到上一个月", lm && new Date(lm.ts).getMonth(),
         new Date(today.getFullYear(), today.getMonth() - 1, 1).getMonth());
      eq("D3 上个月金额没被「月」吃掉", lm && lm.amt, 1500);

      var d3 = parseText("3天前理发25", Date.now(), "expense")[0];
      var want3 = new Date(today); want3.setDate(want3.getDate() - 3);
      eq("D4 3天前 = 3 天前那一天", d3 && md(d3.ts), md(want3.getTime()));
      eq("D5 3天前的 3 不被当金额", d3 && d3.amt, 25);

      var lw = parseText("上周五电影60", Date.now(), "expense")[0];
      var wlw = new Date(today);
      var diff = (wlw.getDay() - 5 + 7) % 7; if(diff === 0) diff = 7;
      wlw.setDate(wlw.getDate() - diff);
      eq("D6 上周五 = 上周的周五", lw && md(lw.ts), md(wlw.getTime()));

      /* 3 月 31 日的「上个月」是 2 月，没有 31 号，不能滚到 3 月 3 日 */
      var base331 = new Date(2026, 2, 31, 12, 0, 0).getTime();
      var r331 = parseText("上个月房租1500", base331, "expense")[0];
      eq("D7 3/31 的上个月 = 2/28（不滚到下下月）", r331 && md(r331.ts), "2/28");

      /* 老规则不能被挤掉 */
      eq("D8 昨天照旧", parseText("昨天吃饭20", Date.now(), "expense")[0] &&
         md(parseText("昨天吃饭20", Date.now(), "expense")[0].ts), md(new Date(today.getTime() - 86400000).getTime()));
      eq("D9 前天照旧", parseText("前天打车15", Date.now(), "expense")[0] &&
         md(parseText("前天打车15", Date.now(), "expense")[0].ts), md(new Date(today.getTime() - 172800000).getTime()));

      /* ============ E. 真的点一次「记上」 ============ */
      goto("flow");
      openAddSheet();
      var ta = $("qi");
      ta.value = "今天中午吃饭花了15   昨天收到生活费2000";
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ok("E1 预览显示的是 2 笔", $("pvAmt").textContent.indexOf("2 笔") >= 0);
      /* 一笔支出 + 一笔收入不能相加：15 + 2000 = 2015 这个数没意义，
         点「记上」之后列表里是 -15 和 +2000，用户会觉得预览在骗他 */
      ok("E1b 预览没有把支出和收入加成 2,015", $("pvAmt").textContent.indexOf("2,015") < 0);
      ok("E1c 预览把两个方向分开写了", $("pvAmt").textContent.indexOf("-¥15.00") >= 0 &&
         $("pvAmt").textContent.indexOf("+¥2,000.00") >= 0);
      $("btnAdd").click();
      var added = state.records.slice(beforeN);
      eq("E2 真的进库 2 笔", added.length, 2);
      eq("E3 两笔合计 = 15 + 2000", sum(added), 2015);
      ok("E4 每一笔都写了 book（漏写会静默全落日常）", added.length === 2 && added.every(function(r){
        return typeof r.book === "string" && r.book.length > 0;
      }));
      ok("E5 每笔都有 id 且不重复", added.length === 2 && added[0].id !== added[1].id);
      ok("E6 商户名里不再粘着金额", added.every(function(r){
        return String(r.peer || "").indexOf("15") < 0 && String(r.peer || "").indexOf("2000") < 0;
      }));
      closeSheets();
    }catch(e){
      log.push("NERR:" + e.message);
    }

    /* 清理：把这轮真写进去的账删掉，别影响后面的用例 */
    state.records = state.records.slice(0, beforeN);
    save(); renderAll(); renderHome();

    var pass = log.filter(function(s){ return s[0] === "Y"; }).length;
    document.title = pass + "/" + log.length +
      (pass === log.length ? " ALL OK" : " FAIL:" + log.filter(function(s){ return s[0] !== "Y"; }).join(" | "));
  }, 500);
})();
