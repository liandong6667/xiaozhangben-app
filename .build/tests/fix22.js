/* fix22：拿"手机上真会收到的通知原文"整条链路跑一遍，把账记错的地方全部堵上
   2026-10-23 用户要求「看一下源代码还有哪里有问题，每次都要模拟真实情况看 App 的反馈」。
   这一轮用 41 组真实通知做体检，查出 12 个会直接算错钱的问题：

   A. 金额算错
      · 「订单金额 ¥15.00 优惠 ¥5.10 实付 ¥9.90」记成 15.00（每笔用券多记钱）
      · 「1.2万元」记成 1.20（差一万倍）
   B. 收支方向错
      · 「李四向你转账 ¥200」记成支出
      · 「收入人民币5000元」的银行短信记成支出
   C. 不该记的记了（账面凭空多钱）
      · 信用卡还款 / 花呗自动还款 / 零钱提现 —— 自己的钱换口袋
      · 账单待还款 / 本期应还 —— 催款提醒，钱还没付
      · 支付失败 / 订单已取消（退款将原路退回）—— 钱没动
   D. 记错对象
      · 「转账给李四」只写"一笔支出"，不知道给了谁
      · 退款通知没写商户时，按金额随便认了另一家店（38.5 的奶茶退款冲掉 38.5 的洗发水）
      · 银行名（招商银行）被当成商户
   E. 显示重复 / 废话
      · 小字念「凭证 付款金额 ¥23.50 收款方 张记麻辣烫」，商户名说三遍
      · 「来自 短信」
*/
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function near(n, got, want){ log.push((Math.abs(got - want) < 0.005 ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix22 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
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
    state.book = "daily"; state.filter = "all"; state.hide = {};
  }
  function feed(list){
    fresh();
    list.forEach(function(it){
      var p = parseNotify(it);
      if(p) addFromNotify(p, true);
    });
    return state.records;
  }
  function one(list){ var r = feed(list); return r.length === 1 ? r[0] : {cnt: r.length}; }

  setTimeout(function(){
    try{
      /* ============ A. 金额 ============ */
      var a1 = one([N("微信", "微信支付", "订单金额 ¥15.00 优惠 ¥5.10 实付 ¥9.90")]);
      near("A1 用券后按实付记（不是原价）", a1.amt, 9.9);
      var a2 = one([N("微信", "微信支付", "支付成功 1.2万元")]);
      near("A2 「1.2万元」= 12000", a2.amt, 12000);
      var a3 = one([N("微信", "微信支付", "房租 1.2万元 已付")]);
      near("A3 房租 1.2万 = 12000", a3.amt, 12000);
      var a4 = one([N("微信", "微信支付", "支付成功 ¥1,200.00")]);
      near("A4 千分位照旧", a4.amt, 1200);
      /* 没有「实付」字样时不能瞎优先，¥ 符号仍然是主证据 */
      var a5 = one([N("微信", "微信支付", "微信支付凭证 付款金额 ¥5.75")]);
      near("A5 普通凭证照旧", a5.amt, 5.75);

      /* ============ B. 收支方向 ============ */
      var b1 = one([N("微信", "微信支付", "李四向你转账 ¥200.00")]);
      eq("B1 「X向我转账」是收入", b1.type, "income");
      eq("B2 而且知道是谁转的", b1.peer, "李四");
      var b2 = one([N("短信", "", "【建设银行】您尾号1234的储蓄卡10月23日收入人民币5000.00元")]);
      eq("B3 银行短信「收入人民币」是收入", b2.type, "income");
      near("B4 金额 5000", b2.amt, 5000);
      var b3 = one([N("短信", "", "【招商银行】您账户1234于10月23日19:32消费人民币23.50元，余额1024.10元")]);
      eq("B5 银行短信「消费」仍是支出", b3.type, "expense");
      eq("B6 发卡行进 from（写在付款方式那一格）", b3.from, "招商银行");
      ok("B7 发卡行绝不能当商户", b3.peer !== "招商银行");
      ok("B8 余额那句不进备注", String(b3.note).indexOf("1024") < 0);

      /* ============ C. 不该记的 ============ */
      eq("C1 信用卡还款不记（自己的钱换口袋）",
         feed([N("微信", "微信支付", "信用卡还款成功 ¥1,200.00")]).length, 0);
      eq("C2 花呗自动还款不记",
         feed([N("支付宝", "支付宝", "花呗自动还款成功 ¥520.00")]).length, 0);
      eq("C3 零钱提现到银行卡不记",
         feed([N("微信", "微信支付", "提现已到账 ¥100.00")]).length, 0);
      eq("C4 账单待还款不记（钱还没付）",
         feed([N("微信", "服务通知", "你有一笔账单待还款 1200.00元")]).length, 0);
      eq("C5 本期应还不记",
         feed([N("微信", "招商银行", "信用卡账单 本期应还 3200.00元")]).length, 0);
      eq("C6 支付失败不记",
         feed([N("支付宝", "支付宝", "支付失败 ¥12.00")]).length, 0);
      eq("C7 订单取消+退款将原路退回，不记（钱没回来）",
         feed([N("拼多多", "拼多多", "您的订单已取消，退款将原路退回 ¥19.90")]).length, 0);
      eq("C8 交易关闭不记",
         feed([N("微信", "微信支付", "交易关闭 ¥8.00")]).length, 0);

      /* ============ D. 记错对象 ============ */
      var d1 = one([N("微信", "微信支付", "转账给李四 ¥200.00")]);
      eq("D1 「转账给李四」商户就是李四", d1.peer, "李四");
      eq("D2 转账是支出", d1.type, "expense");
      var d2 = one([N("支付宝", "支付宝", "转账成功 给张三 ¥100.00")]);
      eq("D3 「转账成功 给张三」也认得出来", d2.peer, "张三");

      /* 退款没写商户时：同金额的支出有两笔 → 不许认，只记一笔退款 */
      var d3 = feed([
        N("微信", "微信支付", "支付成功 ¥38.50 收款方 一点点", 0),
        N("微信", "微信支付", "支付成功 ¥38.50 收款方 文具店", 10),
        N("微信", "微信支付", "退款到账 ¥38.50", 60)
      ]);
      eq("D4 两笔同价支出时，退款不硬认其中一笔", d3.length, 3);
      var rf1 = d3[2];
      eq("D5 认不准就不写 ref", rf1.ref, "");
      ok("D6 也不能把商户名安到退款头上", String(rf1.peer || "").indexOf("笔") >= 0);

      /* 同金额的支出只有一笔 → 可以认，图标和标题要跟原来那笔对得上 */
      var d4 = feed([
        N("微信", "微信支付", "美团外卖 | 支付成功 ¥38.50", 0),
        N("微信", "微信支付", "退款到账 ¥38.50", 60)
      ]);
      eq("D7 只有一笔能对上时可以认", d4.length, 2);
      eq("D8 退款记成收入", d4[1].type, "income");
      eq("D9 分类是退款", d4[1].cat, "refund");
      ok("D10 ref 指回原来那笔", d4[1].ref === d4[0].id);
      eq("D11 退款行商户跟原支出一致（图标不打架）", d4[1].peer, d4[0].peer);
      ok("D12 备注不重复念店名", String(d4[1].note).indexOf("美团") < 0);
      ok("D13 备注说清冲的是哪天", /\d+月\d+日/.test(String(d4[1].note)));

      /* ============ E. 显示 ============ */
      function subOf(rec){
        var d = document.createElement("div");
        d.innerHTML = itemHTML(rec);
        var e = d.querySelector(".it-s");
        return e ? e.textContent : "";
      }
      function titleOf(rec){
        var d = document.createElement("div");
        d.innerHTML = itemHTML(rec);
        var e = d.querySelector(".it-n");
        return e ? e.textContent : "";
      }
      var e1 = one([N("微信", "微信支付", "微信支付凭证\n付款金额 ¥23.50\n收款方 张记麻辣烫")]);
      var s1 = subOf(e1);
      ok("E1 小字不再念「凭证 付款金额 收款方」", !/凭证|付款金额|收款方/.test(s1));
      eq("E2 主标题是店名", titleOf(e1), "张记麻辣烫");
      ok("E3 小字只念一次付款方式", (s1.match(/微信支付/g) || []).length === 1);

      var e2 = {id:"e2", amt:26.8, type:"expense", cat:"food", peer:"饿了么", from:"支付宝",
                note:"饿了么 订单已支付 ¥26.80", ts:T0, src:"notify", book:"daily"};
      eq("E4 备注里只剩商户名（「了」是店名的一部分）", noteFor(e2), "");
      var e3 = {id:"e3", amt:8, type:"expense", cat:"food", peer:"蜜雪冰城", from:"微信",
                note:"美团外卖 蜜雪冰城 支付成功 ¥8.00", ts:T0, src:"notify", book:"daily"};
      eq("E5 平台名+店名都进主标题了，小字不重复", noteFor(e3), "");
      /* 真多了信息就要念出来 */
      var e4 = {id:"e4", amt:23.5, type:"expense", cat:"food", peer:"学校超市", from:"微信",
                note:"你在学校北门的超市买了东西", ts:T0, src:"notify", book:"daily"};
      ok("E6 真信息照念", noteFor(e4).length > 0);
      eq("E7 手动记的备注一个字不动",
         noteFor({id:"e7", amt:12, type:"expense", cat:"food", peer:"宿舍小卖部", from:"",
                  note:"水果 12 块", ts:T0, src:"manual", book:"daily"}), "水果 12 块");
      /* 短信渠道没有付款方式可念，就不要写「来自 短信」 */
      var e5 = {id:"e5", amt:23.5, type:"expense", cat:null, peer:"一笔支出", from:"短信",
                note:"您账户1234消费人民币23.50元", ts:T0, src:"notify", book:"daily"};
      ok("E8 不出现「来自 短信」", subOf(e5).indexOf("来自 短信") < 0);
      var e6 = {id:"e6", amt:28.6, type:"expense", cat:"transport", peer:"滴滴", from:"滴滴出行",
                note:"", ts:T0, src:"notify", book:"daily"};
      ok("E9 平台名照旧念「来自 滴滴出行」", subOf(e6).indexOf("来自 滴滴出行") >= 0);
      /* 银行流水短信是流水线套话，字段一个不落但一个也不提供新信息 */
      var bk1 = {id:"bk1", amt:23.5, type:"expense", cat:null, peer:"一笔支出", from:"短信",
                 note:"您账户1234于10月23日19:32消费人民币23.50元，余额1024.10元",
                 ts:T0, src:"notify", book:"daily"};
      eq("E10 银行消费短信整条不念（.fields全是套话）", noteFor(bk1), "");
      var bk2 = {id:"bk2", amt:6800, type:"income", cat:"salary", peer:"一笔收入", from:"工商银行",
                 note:"您尾号8888账户10月23日工资收入人民币6,800.00元", ts:T0, src:"notify", book:"daily"};
      eq("E11 工资短信只剩「工资」也不念（右边已经写着工资 +¥6,800）", noteFor(bk2), "");
      var bk3 = {id:"bk3", amt:76, type:"expense", cat:"fun", peer:"猫眼", from:"猫眼",
                 note:"购票成功 ¥76.00", ts:T0, src:"notify", book:"daily"};
      eq("E12 正文里那个金额不再念第二遍", noteFor(bk3), "购票成功");
      var bk4 = {id:"bk4", amt:9.9, type:"expense", cat:null, peer:"一笔支出", from:"微信",
                 note:"订单金额 ¥15.00 优惠 ¥5.10 实付 ¥9.90", ts:T0, src:"notify", book:"daily"};
      eq("E13 原价/优惠/实付三个金额整条不念", noteFor(bk4), "");
      var bk5 = {id:"bk5", amt:12, type:"expense", cat:"food", peer:"学校北门超市", from:"微信",
                 note:"买了 3 箱牛奶付了 ¥12.00", ts:T0, src:"notify", book:"daily"};
      ok("E14 真信息照样留下（件数没被当金额删掉）", /3/.test(noteFor(bk5)) &&
         noteFor(bk5).indexOf("¥12") < 0);

      /* ============ F. 钱数要对得上 ============ */
      /* 手机上一个月的真实流水：有花有收有还款有退款，最后核总数 */
      fresh();
      [
        N("微信", "微信支付", "美团外卖 | 支付成功 ¥38.50", 0),
        N("拼多多", "拼多多", "支付成功 ¥5.75", 5),
        N("支付宝", "支付宝", "支付成功 12.80元 收款方 便利蜂", 10),
        N("微信", "微信支付", "信用卡还款成功 ¥1,200.00", 20),
        N("支付宝", "支付宝", "花呗自动还款成功 ¥520.00", 30),
        N("微信", "微信支付", "转账给李四 ¥200.00", 40),
        N("短信", "", "【建设银行】您尾号1234的储蓄卡10月23日收入人民币5000.00元", 50),
        N("微信", "微信支付", "退款到账 ¥38.50", 90),
        N("支付宝", "支付宝", "账单已出，本期应还 3200.00元", 120)
      ].forEach(function(it){ var p = parseNotify(it); if(p) addFromNotify(p, true); });
      var recs = state.records;
      var outSum = recs.filter(function(r){ return r.type !== "income"; })
                       .reduce(function(s, r){ return s + r.amt; }, 0);
      var inSum = recs.filter(function(r){ return r.type === "income"; })
                      .reduce(function(s, r){ return s + r.amt; }, 0);
      eq("F1 9 条通知里只有 6 笔是真正的收支（4 支 + 2 收）", recs.length, 6);
      near("F2 支出合计 = 38.5+5.75+12.8+200", outSum, 257.05);
      near("F3 收入合计 = 5000+38.5（退款冲回）", inSum, 5038.5);
      var mSum = curMonthRecs().reduce(function(s, r){ return s + (r.type === "income" ? 0 : r.amt); }, 0);
      near("F4 首页「本月已花」和明细一致", mSum, 257.05);
      ok("F5 还款/提现/应还一笔都没进明细", !recs.some(function(r){
        return /还款|提现|应还/.test(String(r.note));
      }));

      /* ============ G. 导账单：转账给朋友 = 人情（和通知一个口径） ============ */
      fresh();
      var WT = "交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商家单号,备注\n" +
        "2026-09-29 09:00:00,转账,李四,/,支出,¥200.00,零钱,转账成功,4200010,0,转账给朋友\n" +
        "2026-09-29 10:00:00,转账,李四,/,不计收支,¥100.00,零钱,提现已到账,4200011,0,零钱提现\n" +
        "2026-09-29 11:00:00,转账,零钱,/,支出,¥100.00,零钱,转账成功,4200012,0,转入零钱通\n";
      var wr = parseBillCSV(WT, Date.now()).records;
      var tr = wr.filter(function(r){ return String(r.peer) === "李四"; })[0];
      ok("G1 账单里的「转账」行留下", !!tr);
      eq("G2 转给朋友记人情，不是「其他」", tr && tr.cat, "social");
      var AT = "交易时间,交易分类,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注\n" +
        "2026-09-27 12:00:00,转账,张三,138****8000,/,支出,100.00,余额宝,交易成功,4400001,0,转账\n";
      var ar = parseBillCSV(AT, Date.now()).records;
      eq("G3 支付宝账单同上（「交易分类」那一列也读得到）", ar[0] && ar[0].cat, "social");

      /* ============ H. 挪钱不算账 / 状态词不当商户 ============ */
      var h1 = parseNotify(N("支付宝", "支付宝", "转入余额宝成功 ¥1000.00"));
      ok("H1 转入余额宝是挪钱，不记账", !h1);
      var h2 = parseNotify(N("微信", "微信支付", "零钱通转入 ¥500.00 成功"));
      ok("H2 零钱通转入同样不算", !h2);
      var h3 = parseNotify(N("支付宝", "支付宝", "从余额宝转出 ¥300.00 到银行卡"));
      ok("H3 余额宝转出也不算", !h3);
      /* 余额宝买基金不能误伤：真消费里带「余额宝」字样（用余额宝付款）要照记 */
      var h4 = one([N("支付宝", "支付宝", "支付成功 ¥26.80 收款方 便利蜂 余额宝付款")]);
      ok("H4 用余额宝付款是真消费，照记", h4 && h4.amt === 26.8);
      /* 「转账退回 ¥200.00 对方未收取」—— "未收取"是状态不是人名，
         且这笔退回应挂回原转账（同额、一边是兜底名） */
      var h5 = feed([
        N("微信", "微信支付", "转账给李四 ¥200.00", 0),
        N("微信", "微信支付", "转账退回 ¥200.00 对方未收取", 10)
      ]);
      eq("H5 转账 + 退回 = 两笔", h5.length, 2);
      var h5b = h5[1];
      eq("H6 退回那笔的对方还是李四（不是「未收取」）", h5b.peer, "李四");
      ok("H7 退回指回原转账", h5b.ref === h5[0].id);
      /* 「京东商城 | 支付成功 ¥1,200.00」：平台名+金额都在大字里了，小字不念 */
      var h6 = one([N("微信", "微信支付", "京东商城 | 支付成功 ¥1,200.00")]);
      eq("H8 「京东商城 | 支付成功」整条不念", noteFor(h6), "");

      report();
    }catch(err){
      document.title = "fix22 ERR " + (err && err.message);
    }
  }, 400);
})();
