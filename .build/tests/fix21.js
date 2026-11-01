/* fix21：账单上「在哪买的」和「用什么付的」必须分开
   2026-10-23 用户问：「我在拼多多上买东西用微信支付，跳转到微信里付，
   这一笔算微信的还是算拼多多的？不要搞混，实际来源按你在哪里买东西。」

   规则（这次锁死，别再改回去）：
     peer = 在哪买的（拼多多 / 淘宝 / 美团）—— 账记在它头上
     from = 用什么付的（微信 / 支付宝 / 云闪付）—— 只当付款方式显示
   以前合并两条通知时拿平台把渠道顶掉了，于是"这钱是微信付的"这条信息消失。
   顺带修了窗口：拼多多跳微信付款，两条通知隔五六分钟很正常，
   2 分钟的窗口会让同一笔钱记两遍。
*/
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    /* 失败项排最前，方便一眼看到 */
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix21 " + pass + "/" + log.length + " || " +
      bad.concat(good).join("|") + " || ERR none";
  }

  var T0 = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 19, 0, 0).getTime();
  function N(app, title, text, min){
    return { app: app, title: title, text: text, ts: T0 + (min || 0) * 60000 };
  }
  function fresh(){
    state.books = [{id:"daily", name:"日常", icon:"🏠", color:BOOK_COLORS[0], budget:1500, def:true}];
    state.records = [];
    state.peerRules = {};
    state.viewMonth = {y: new Date().getFullYear(), m: new Date().getMonth()};
    state.book = "daily"; state.filter = "all";
  }
  /* 照真实路径喂通知：parseNotify → addFromNotify（和 App 里一模一样） */
  function feed(list){
    fresh();
    list.forEach(function(it){
      var p = parseNotify(it);
      if(p) addFromNotify(p, true);
    });
    return state.records;
  }
  function only(list, label){
    var r = feed(list);
    if(r.length !== 1) log.push("N" + label + "笔数[" + r.length + "!=1]");
    return r[0] || {};
  }

  setTimeout(function(){
    try{
      /* ================= A. 在哪买的 压过 用什么付的 ================= */

      /* 用户描述的那个场景：拼多多下单 → 跳微信 → 微信先弹凭证 → 拼多多后弹 */
      var a = feed([
        N("微信", "微信支付", "微信支付凭证\n付款金额 ¥5.75", 0),
        N("拼多多", "拼多多", "支付成功 ¥5.75", 1)
      ]);
      eq("A1 拼多多+微信付款：只记一笔（不是两笔）", a.length, 1);
      eq("A2 账记在拼多多头上，不是微信", a[0] && a[0].peer, "拼多多");
      eq("A3 付款方式仍是微信（渠道没被平台顶掉）", a[0] && a[0].from, "微信");

      /* 反过来：拼多多先弹、微信凭证后弹 */
      var b = feed([
        N("拼多多", "拼多多", "支付成功 ¥5.75", 0),
        N("微信", "微信支付", "微信支付凭证 ¥5.75", 1)
      ]);
      eq("A4 顺序反过来也只记一笔", b.length, 1);
      eq("A5 顺序反过来商户仍是拼多多", b[0] && b[0].peer, "拼多多");
      eq("A6 顺序反过来仍记下微信付款", b[0] && b[0].from, "微信");

      /* 只有一条微信通知，但正文写着拼多多 */
      var c = only([N("微信", "微信支付", "拼多多 | 支付成功 ¥5.75", 0)], "A7");
      eq("A7 正文写着拼多多 → 商户是拼多多", c.peer, "拼多多");
      eq("A8 同时记下微信付款", c.from, "微信");

      /* 美团外卖 */
      var d = only([
        N("微信", "微信支付", "你已支付 ¥38.50", 0),
        N("美团", "美团外卖", "您的订单已支付 ¥38.50", 1)
      ], "A9");
      eq("A9 美团外卖+微信付 → 商户是美团", d.peer, "美团");
      eq("A10 付款方式微信", d.from, "微信");

      /* 淘宝 + 支付宝 */
      var e = only([N("支付宝", "支付宝", "淘宝 | 支付成功 ¥129.00", 0)], "A11");
      eq("A11 淘宝+支付宝 → 商户淘宝", e.peer, "淘宝");
      eq("A12 付款方式支付宝", e.from, "支付宝");

      /* 微信通知里直接写"交易商户：京东" */
      var f = only([N("微信", "微信支付", "交易商户：京东 ¥79.00", 0)], "A13");
      eq("A13 交易商户写京东 → 商户京东", f.peer, "京东");

      /* ================= B. 不知道就不猜 ================= */

      var g = only([N("微信", "微信支付", "你已支付 ¥12.00", 0)], "B1");
      ok("B1 一个字的线索都没有 → 商户不写微信（宁可空着）", g.peer !== "微信" && /^一笔/.test(String(g.peer)));
      eq("B2 但付款方式是知道的，照样写微信", g.from, "微信");

      /* 全表扫：渠道名绝不能出现在 peer 里 */
      var leak = [];
      ["微信","微信支付","支付宝","云闪付","QQ","招行","建行","工行","银行卡"].forEach(function(ch){
        var r = feed([N(ch, ch, "你已支付 ¥6.00", 0)]);
        if(r[0] && r[0].peer === ch) leak.push(ch);
      });
      ok("B3 任何渠道 App 的通知都不会把渠道名记成商户[" + leak.join(",") + "]", leak.length === 0);

      /* ================= C. 判重窗口（同一笔别记两遍） ================= */

      eq("C1 两条通知隔 6 分钟（输密码/等验证码）→ 仍是一笔",
         feed([N("微信","微信支付","你已支付 ¥5.75",0), N("拼多多","拼多多","支付成功 ¥5.75",6)]).length, 1);
      eq("C2 隔 40 分钟 → 当两笔（时间差太远，不敢合）",
         feed([N("微信","微信支付","你已支付 ¥5.75",0), N("拼多多","拼多多","支付成功 ¥5.75",40)]).length, 2);
      eq("C3 两家不同的店、同价、隔 1 分钟 → 两笔真消费",
         feed([N("微信","微信支付","蜜雪冰城 支付成功 ¥8.00",0), N("微信","微信支付","瑞幸咖啡 支付成功 ¥8.00",1)]).length, 2);
      eq("C4 两条都说不出商户、隔 10 分钟 → 两笔（不能乱合）",
         feed([N("微信","微信支付","你已支付 ¥12.00",0), N("微信","微信支付","你已支付 ¥12.00",10)]).length, 2);

      /* ================= D. 明细行怎么念 ================= */

      var rr = only([N("微信","微信支付","拼多多 | 支付成功 ¥5.75",0)], "D");
      rr.book = "daily"; rr.id = "t1";
      state.book = "all";
      var html = itemHTML(rr);
      ok("D1 大字是「拼多多」，不是「微信」[" + esc(rr.peer) + "]", html.indexOf("拼多多") >= 0 && html.indexOf("一笔支出") < 0);
      ok("D2 小字写「微信支付」，不写「来自 微信」", html.indexOf("微信支付") >= 0 && html.indexOf("来自 微信") < 0);
      ok("D3 渠道名没被塞进主标题", !/class="it-n">[^<]*微信/.test(html));

      /* 平台当 from 时：认不出商户就把平台名直接顶到大字上（1.6.50 改的，
         以前写「一笔支出」+ 小字「来自 拼多多」，那种空壳名字没信息量） */
      var r2 = {id:"t2", ts:T0, amt:20, type:"expense", cat:null, peer:"一笔支出", from:"拼多多", note:"", book:"daily"};
      var h2 = itemHTML(r2);
      ok("D4 「一笔支出」+ 来源拼多多 → 大字直接写拼多多", /class="it-n">拼多多/.test(h2));
      ok("D4b 不再写「一笔支出」这种空话", h2.indexOf("一笔支出") < 0);

      /* 右边那两个胶囊：账本 + 分类 */
      state.books = [
        {id:"daily", name:"日常", icon:"🏠", color:BOOK_COLORS[0], budget:1500, def:true},
        {id:"study", name:"学习", icon:"📚", color:BOOK_COLORS[2], budget:300}
      ];
      var r3 = {id:"t3", ts:T0, amt:26, type:"expense", cat:"study", peer:"学校书店", from:"", note:"", book:"study"};
      var h3 = itemHTML(r3);
      ok("D5 账本名和分类名相同时只念一次（不写两遍「学习」）",
         (h3.match(/学习/g) || []).length === 1);
      var r4 = {id:"t4", ts:T0, amt:26, type:"expense", cat:"food", peer:"学校书店", from:"", note:"", book:"study"};
      var h4 = itemHTML(r4);
      /* 2026-10-26：账本名不再做成右边的胶囊，改写进时间那行小字 */
      ok("D6 换一本账（学习）就显示「学习」，不是永远写「日常」",
         h4.indexOf("学习") > h4.indexOf('class="it-s"') && h4.indexOf("日常") < 0);
      state.book = "daily";
      var h5 = itemHTML(r4);
      ok("D7 只看单本账本时不重复显示账本名", h5.indexOf("学习") < 0);

      /* ================= E. 退款不受影响 ================= */

      var rf = feed([
        N("支付宝", "支付宝", "淘宝 | 支付成功 ¥129.00", 0),
        N("支付宝", "支付宝", "淘宝 退款已原路退回 ¥129.00", 30)
      ]);
      eq("E1 淘宝退款：一笔支出 + 一笔退款收入", rf.length, 2);
      var inc = rf.filter(function(r){ return r.type === "income"; })[0];
      eq("E2 退款那笔记成「退款」分类", inc && inc.cat, "refund");
      eq("E3 原支出没有被改掉", rf.filter(function(r){ return r.type === "expense"; }).length, 1);

      /* ================= F. 小字里的备注别重复念 ================= */
      /* 付款渠道已经写在小字里了，「微信支付凭证 付款金额 ¥5.75」再念一遍
         就是同一句话说两次；手动记的备注一个字都不能动。 */
      function noteOf(peer, from, note, src){
        return noteFor({peer: peer, from: from, note: note, src: src || "notify"});
      }
      eq("F1 微信凭证那串废话不重复念", noteOf("拼多多", "微信", "微信支付凭证 付款金额 ¥5.75"), "");
      eq("F2 「支付成功 ¥5.75」也没多说什么", noteOf("拼多多", "微信", "支付成功 ¥5.75"), "");
      eq("F3 正文就是商户名本身，不重复念", noteOf("拼多多", "微信", "拼多多 | 支付成功 ¥5.75"), "");
      eq("F4 「您的订单已支付」说的是支付这件事，不念", noteOf("美团", "微信", "您的订单已支付 ¥38.50"), "");
      eq("F5 但「你已支付¥12」这种一句废话就整条不显示", noteOf("一笔支出", "微信", "你已支付¥12.00"), "");
      ok("F6 原文里真多了信息（在哪消费）就照念", noteOf("超市", "微信", "你在学校超市消费 ¥23.50").indexOf("学校超市") >= 0);
      eq("F7 手动记的备注一个字不动", noteOf("学校书店", "", "买了两本专业书", "manual"), "买了两本专业书");
      eq("F8 手动记的「水果 12 块」也不动", noteOf("宿舍小卖部", "", "水果 12 块", "manual"), "水果 12 块");

      /* 整行渲染出来，「微信支付」只该出现一次 */
      var rn = {id:"t9", ts:T0, amt:5.75, type:"expense", cat:null, peer:"拼多多", from:"微信",
                note:"微信支付凭证 付款金额 ¥5.75", book:"daily", src:"notify"};
      var hn = itemHTML(rn);
      eq("F9 小字里「微信支付」只念一遍", (hn.match(/微信支付/g) || []).length, 1);
      ok("F10 主标题里没有微信", !/class="it-n">[^<]*微信/.test(hn));

      /* ================= F. 小字里的备注别重复念 ================= */
      /* 付款渠道已经写在小字里了，「微信支付凭证 付款金额 ¥5.75」再念一遍
         就是同一句话说两次；手动记的备注一个字都不能动。 */
      function noteOf(peer, from, note, src){
        return noteFor({peer: peer, from: from, note: note, src: src || "notify"});
      }
      eq("F1 微信凭证那串废话不重复念", noteOf("拼多多", "微信", "微信支付凭证 付款金额 ¥5.75"), "");
      eq("F2 「支付成功 ¥5.75」也没多说什么", noteOf("拼多多", "微信", "支付成功 ¥5.75"), "");
      eq("F3 正文就是商户名本身，不重复念", noteOf("拼多多", "微信", "拼多多 | 支付成功 ¥5.75"), "");
      eq("F4 「您的订单已支付」说的是支付这件事，不念", noteOf("美团", "微信", "您的订单已支付 ¥38.50"), "");
      eq("F5 但「你已支付¥12」这种一句废话就整条不显示", noteOf("一笔支出", "微信", "你已支付¥12.00"), "");
      ok("F6 原文里真多了信息（在哪消费）就照念", noteOf("超市", "微信", "你在学校超市消费 ¥23.50").indexOf("学校超市") >= 0);
      eq("F7 手动记的备注一个字不动", noteOf("学校书店", "", "买了两本专业书", "manual"), "买了两本专业书");
      eq("F8 手动记的「水果 12 块」也不动", noteOf("宿舍小卖部", "", "水果 12 块", "manual"), "水果 12 块");

      /* 整行渲染出来，「微信支付」只该出现一次 */
      var rn = {id:"t9", ts:T0, amt:5.75, type:"expense", cat:null, peer:"拼多多", from:"微信",
                note:"微信支付凭证 付款金额 ¥5.75", book:"daily", src:"notify"};
      var hn = itemHTML(rn);
      eq("F9 小字里「微信支付」只念一遍", (hn.match(/微信支付/g) || []).length, 1);
      ok("F10 主标题里没有微信", !/class="it-n">[^<]*微信/.test(hn));

      report();
    }catch(err){
      document.title = "fix21 ERR " + (err && err.message);
    }
  }, 400);
})();
