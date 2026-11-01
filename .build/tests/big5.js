/* App 通知自动记账的压力测试（网页版拿不到通知，但解析和入库是同一套代码）
   Y1. 1000 条支付通知：一条一笔，重复投递不重复记
   Y2. 微信 + 拼多多 双通知：不重复记，但要把来源升级成拼多多
   Y3. 100 条退款通知：冲回原来那笔支出，一笔只冲一次
   Y4. 噪声（验证码/取件码/优惠券/聊天转账）：一条都不许记
   Y5. 大额/小额边界：0 元、100 万以上、负数 */
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
      state.books = [{ id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true }];
      state.records = [];
      var BASE = new Date(Y, M, 12, 8, 0, 0).getTime();

      /* ===== Y1. 1000 条支付通知 ===== */
      var made = 0;
      for(var i = 0; i < 1000; i++){
        var amt = Math.round((1 + (i % 100) * 0.37) * 100) / 100;
        var it = {
          app: "微信", title: "微信支付",
          text: "微信支付 向 店" + (i % 40) + " 支付成功 ¥" + amt.toFixed(2),
          ts: BASE + i * 60000
        };
        var p = parseNotify(it);
        if(p && addFromNotify(p, true)) made++;
      }
      eq("1000 条通知记成 1000 笔", made, 1000);
      eq("库里正好 1000 笔", state.records.length, 1000);
      var noPeer = state.records.filter(function(r){ return /^一笔支出$/.test(r.peer); }).length;
      ok("商户名抓不到时才叫「一笔支出」（不是 1000 条全叫这个，实际 " + noPeer + "）", noPeer < 1000);
      ok("微信没被当成商户名", state.records.filter(function(r){ return r.peer === "微信" || r.peer === "微信支付"; }).length === 0);
      eq("1000 笔全是支出", state.records.filter(function(r){ return r.type === "expense"; }).length, 1000);

      // 同一条通知重复投递 3 遍
      var before = state.records.length;
      for(var j = 0; j < 1000; j++){
        var amt2 = Math.round((1 + (j % 100) * 0.37) * 100) / 100;
        var it2 = { app: "微信", title: "微信支付",
          text: "微信支付 向 店" + (j % 40) + " 支付成功 ¥" + amt2.toFixed(2), ts: BASE + j * 60000 };
        addFromNotify(parseNotify(it2), true);
        addFromNotify(parseNotify(it2), true);
      }
      eq("重复投递 2000 次，一笔都没多", state.records.length, before);

      /* ===== Y2. 微信 + 拼多多 双通知 ===== */
      state.records = [];
      var upg = 0;
      for(var k = 0; k < 100; k++){
        var a3 = Math.round((20 + k * 0.5) * 100) / 100;
        var ts3 = BASE + k * 90000;
        var lenBefore = state.records.length;
        // 第一条：微信，只知道扣款
        var p1 = parseNotify({ app: "微信", title: "微信支付",
          text: "微信支付 扣款 ¥" + a3.toFixed(2), ts: ts3 });
        addFromNotify(p1, true);
        // 四十秒后：拼多多的通知，带了平台名
        var p2 = parseNotify({ app: "拼多多", title: "拼多多",
          text: "拼多多 支付成功 ¥" + a3.toFixed(2), ts: ts3 + 40000 });
        addFromNotify(p2, true);
        if(state.records.length - lenBefore === 1) upg++;
      }
      eq("双通知 100 组只记 100 笔", state.records.length, 100);
      eq("每一组都只有一笔", upg, 100);
      /* 2026-10-23 改：这 100 组是「拼多多下单、微信付款」。
         商户必须全是拼多多（在哪买的），付款渠道必须全是微信（用什么付的）。
         以前这里断言"来源升级成拼多多"—— 那正好是用户说的"搞混"。 */
      var peerPdd = state.records.filter(function(r){ return r.peer === "拼多多"; }).length;
      eq("100 笔商户都是拼多多（在哪买的）", peerPdd, 100);
      var fromWx = state.records.filter(function(r){ return r.from === "微信"; }).length;
      eq("100 笔都记着微信付款（用什么付的）", fromWx, 100);
      ok("没有一笔把微信当成商户", state.records.filter(function(r){ return r.peer === "微信"; }).length === 0);

      /* ===== Y3. 100 条退款通知 ===== */
      state.records = [];
      for(var q = 0; q < 100; q++){
        state.records.push({
          id: "spend" + q, ts: BASE + q * 300000, amt: 30, type: "expense",
          cat: "food", peer: "店" + q, note: "", book: "daily", src: "notify"
        });
      }
      var back = 0;
      for(var q2 = 0; q2 < 100; q2++){
        /* 退款通知里必须能看出是哪家店，才允许把 ref 指回去。
           2026-10-23 起的规定：退款通知里没写商户时，同金额的支出如果不止一笔，
           就不许硬认（38.5 的奶茶退款会把 38.5 的洗发水冲掉）。
           真实退款通知大多带「收款方 / 商户」，这里按真实形态写。 */
        var pr = parseNotify({ app: "微信", title: "微信支付",
          text: "微信支付 退款到账 ¥30.00 收款方 店" + q2, ts: BASE + q2 * 300000 + 86400000 });
        if(pr && addFromNotify(pr, true)) back++;
      }
      eq("100 条退款都记成收入", back, 100);
      var rfs = state.records.filter(function(r){ return r.cat === "refund"; });
      eq("退款 100 笔", rfs.length, 100);
      eq("每笔退款都指回原支出", rfs.filter(function(r){ return !!r.ref; }).length, 100);
      eq("100 笔指向 100 个不同支出", new Set(rfs.map(function(r){ return r.ref; })).size, 100);
      eq("原支出一笔没被改", state.records.filter(function(r){ return r.id.indexOf("spend") === 0; }).length, 100);
      // 再投一遍同样的退款通知
      for(var q3 = 0; q3 < 100; q3++){
        addFromNotify(parseNotify({ app: "微信", title: "微信支付",
          text: "微信支付 退款到账 ¥30.00 收款方 店" + q3, ts: BASE + q3 * 300000 + 86400000 }), true);
      }
      eq("退款通知重投一遍，还是 100 笔", state.records.filter(function(r){ return r.cat === "refund"; }).length, 100);

      /* ===== Y4. 噪声 ===== */
      state.records = [];
      var noise = [
        { app: "短信", title: "验证码", text: "您的验证码是 123456，5 分钟内有效", ts: BASE },
        { app: "菜鸟", title: "取件码", text: "您的包裹已到站，取件码 8-3-2025", ts: BASE + 1000 },
        { app: "淘宝", title: "优惠券", text: "满 100 减 20 优惠券即将过期", ts: BASE + 2000 },
        { app: "微信", title: "张三", text: "张三: [转账]100.00元", ts: BASE + 3000 },
        { app: "微信", title: "李四", text: "李四: 转账给你 500.00元", ts: BASE + 4000 },
        { app: "支付宝", title: "余额宝", text: "昨日收益 0.52 元", ts: BASE + 5000 },
        { app: "微信", title: "提醒", text: "你有 3 条新消息", ts: BASE + 6000 },
        { app: "美团", title: "订单", text: "正在派送，预计 20 分钟送达", ts: BASE + 7000 },
        { app: "微信", title: "微信支付", text: "退款申请已提交，处理中 ¥30.00", ts: BASE + 8000 },
        { app: "微信", title: "微信支付", text: "退款失败 ¥30.00", ts: BASE + 9000 }
      ];
      var hitNoise = 0;
      noise.forEach(function(it){
        var p = parseNotify(it);
        if(p && addFromNotify(p, true)) hitNoise++;
      });
      eq("10 条噪声一条都没记（实际记了 " + hitNoise + "）", hitNoise, 0);

      /* ===== Y5. 金额边界 ===== */
      state.records = [];
      eq("0 元通知不记", parseNotify({ app: "微信", title: "微信支付", text: "支付成功 ¥0.00", ts: BASE }), null);
      var big = parseNotify({ app: "微信", title: "微信支付", text: "支付成功 ¥1,000,001.00", ts: BASE });
      ok("超过 100 万的通知不记（防止取到卡号）", big === null);
      var normal = parseNotify({ app: "微信", title: "微信支付", text: "支付成功 ¥9999.99", ts: BASE });
      ok("一万以内的正常记", normal && normal.amt === 9999.99);
      var tiny = parseNotify({ app: "微信", title: "微信支付", text: "支付成功 ¥0.01", ts: BASE + 1 });
      ok("一分钱也记", tiny && tiny.amt === 0.01);
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
    document.title = "big5 " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 400);
})();
