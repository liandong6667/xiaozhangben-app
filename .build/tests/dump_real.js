/* 真实场景模拟：把手机上真会出现的通知原文，一条条喂进 App 的完整链路
   （parseNotify → addFromNotify → itemHTML），把 App 最后显示成什么样打出来。
   不是断言，是「看一眼到底记成了什么」。 */
(function(){
  var out = [];
  var T0 = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 19, 0, 0).getTime();

  function N(app, title, text, min, ts){
    return { app: app, title: title, text: text, ts: ts || (T0 + (min || 0) * 60000) };
  }
  function fresh(){
    state.books = [{id:"daily", name:"日常", icon:"🏠", color:BOOK_COLORS[0], budget:1500, def:true}];
    state.records = [];
    state.peerRules = {};
    state.viewMonth = {y: new Date().getFullYear(), m: new Date().getMonth()};
    state.book = "daily"; state.filter = "all"; state.hide = {};
  }
  function p2(n){ return (n < 10 ? "0" : "") + n; }
  function feed(list){
    fresh();
    list.forEach(function(it){
      var p = parseNotify(it);
      if(p) addFromNotify(p, true);
    });
    return state.records;
  }

  /* 从 itemHTML 里把「用户真正看到的那几块」抽出来 */
  function view(r){
    var d = document.createElement("div");
    d.innerHTML = itemHTML(r);
    var q = function(sel){ var e = d.querySelector(sel); return e ? e.textContent.trim() : ""; };
    var ic = d.querySelector(".it-ic");
    return {
      title: q(".it-n"),
      sub: q(".it-s"),
      amt: q(".it-a"),
      pill: q(".it-tg"),
      icon: ic ? (ic.querySelector("img") ? "[logo]" : ic.textContent.trim()) : "",
      cls: ic ? ic.className : ""
    };
  }

  function describe(r){
    var c = r.cat ? catOf(r.cat) : null;
    var br = brandOf(r);
    return "peer=" + (r.peer || "∅") + " from=" + (r.from || "∅") +
      " ¥" + money(r.amt) + " " + (r.type === "income" ? "收" : "支") +
      " cat=" + (c ? c.n : "∅") + (r.guessed ? "?" : "") +
      (br ? " 品牌=" + br.k[0] : "");
  }
  function warn(r, exp){
    var w = [];
    if(/^(微信|微信支付|支付宝|云闪付|QQ|短信|银行卡|银联)$/.test(String(r.peer || ""))) w.push("渠道当商户");
    var c = r.cat ? catOf(r.cat) : null, br = brandOf(r);
    if(br && br.cat && br.cat !== "*" && c && c.t === "out" && br.cat !== c.k) w.push("图标(分类)不一致");
    if(!r.peer) w.push("没名字");
    if(exp != null && Math.abs(r.amt - exp) > 0.005) w.push("金额应为" + exp);
    return w.length ? "  ⚠ " + w.join("/") : "";
  }
  function block(label, list, exp){
    var recs = feed(list);
    out.push("");
    out.push("── " + label + "  → " + recs.length + " 笔");
    if(!recs.length){ out.push("   （什么都没记）"); return recs; }
    recs.forEach(function(r){
      var v = view(r);
      out.push("   " + describe(r) + warn(r, recs.length === 1 ? exp : null));
      out.push("     显示│" + v.title + " │ " + v.sub + " │ " + v.amt + " │ 图标" + v.icon);
    });
    return recs;
  }

  /* ============ 一、微信支付各类通知 ============ */
  block("01 微信扫码付给麻辣烫（带收款方）", [
    N("微信", "微信支付", "微信支付凭证\n付款金额 ¥23.50\n收款方 张记麻辣烫")
  ], 23.5);

  block("02 微信付款，通知里没写商户", [
    N("微信", "微信支付", "微信支付凭证\n付款金额 ¥12.00")
  ], 12);

  block("03 拼多多下单→跳微信付款（两条通知）", [
    N("微信", "微信支付", "微信支付凭证\n付款金额 ¥5.75", 0),
    N("拼多多", "拼多多", "支付成功 ¥5.75", 8)
  ], 5.75);

  block("04 美团外卖 via 微信", [
    N("微信", "微信支付", "美团外卖 | 支付成功 ¥38.50")
  ], 38.5);

  block("05 美团里点的蜜雪冰城", [
    N("微信", "微信支付", "美团外卖 蜜雪冰城 支付成功 ¥8.00")
  ], 8);

  block("06 转账给朋友", [
    N("微信", "微信支付", "转账给李四 ¥200.00")
  ], 200);

  block("07 朋友转账给我", [
    N("微信", "微信支付", "李四向你转账 ¥200.00")
  ], 200);

  block("08 发红包", [
    N("微信", "微信", "你发了一个红包 ¥66.00")
  ], 66);

  block("09 收到红包", [
    N("微信", "微信", "你收到了一个红包 ¥8.88")
  ], 8.88);

  block("10 零钱提现到银行卡", [
    N("微信", "微信支付", "提现已到账 ¥100.00")
  ], 100);

  block("11 微信里还信用卡", [
    N("微信", "微信支付", "信用卡还款成功 ¥1,200.00")
  ], 1200);

  block("12 手机话费充值", [
    N("微信", "微信支付", "话费充值成功 ¥50.00")
  ], 50);

  block("13 免密支付扣款", [
    N("微信", "微信支付", "免密支付 扣款 ¥15.00")
  ], 15);

  /* ============ 二、支付宝 ============ */
  block("14 支付宝付便利店", [
    N("支付宝", "支付宝", "支付成功 12.80元\n收款方 便利蜂")
  ], 12.8);

  block("15 支付宝用花呗付", [
    N("支付宝", "支付宝", "花呗付款成功 ¥30.00")
  ], 30);

  block("16 余额宝收益（不是一笔账）", [
    N("支付宝", "支付宝", "余额宝昨日收益 0.13元")
  ]);

  block("17 支付宝转账给张三", [
    N("支付宝", "支付宝", "转账成功 给张三 ¥100.00")
  ], 100);

  block("18 淘宝下单 via 支付宝", [
    N("支付宝", "支付宝", "淘宝 支付成功 ¥129.00")
  ], 129);

  block("19 饿了么订单已支付", [
    N("支付宝", "支付宝", "饿了么 订单已支付 ¥26.80")
  ], 26.8);

  block("20 支付宝花呗自动还款", [
    N("支付宝", "支付宝", "花呗自动还款成功 ¥520.00")
  ], 520);

  /* ============ 三、银行短信 ============ */
  block("21 招行消费短信", [
    N("短信", "", "【招商银行】您账户1234于10月23日19:32消费人民币23.50元，余额1024.10元")
  ], 23.5);

  block("22 建行收入短信", [
    N("短信", "", "【建设银行】您尾号1234的储蓄卡10月23日收入人民币5000.00元，活期余额6000元")
  ], 5000);

  block("23 工行工资到账短信", [
    N("短信", "", "【工商银行】您尾号8888账户10月23日工资收入人民币6,800.00元")
  ], 6800);

  /* ============ 四、其它 App ============ */
  block("24 12306 买票", [
    N("铁路12306", "铁路12306", "购票成功 订单金额 ¥553.00")
  ], 553);

  block("25 滴滴打车", [
    N("滴滴出行", "滴滴出行", "行程结束，本次支付 ¥28.60")
  ], 28.6);

  block("26 猫眼电影票", [
    N("猫眼", "猫眼电影", "购票成功 ¥76.00")
  ], 76);

  block("27 星巴克", [
    N("星巴克", "星巴克", "支付成功 ¥33.00")
  ], 33);

  block("28 学校食堂（无品牌）", [
    N("微信", "微信支付", "微信支付凭证 付款金额 ¥11.00 收款方 学校二食堂")
  ], 11);

  block("29 拼多多先用后付", [
    N("拼多多", "拼多多", "订单已支付 ¥19.90")
  ], 19.9);

  block("30 云闪付扫码", [
    N("云闪付", "云闪付", "支付成功 ¥45.00 收款方 中国石化")
  ], 45);

  /* ============ 五、退款 ============ */
  block("31 美团退款到账（之前买过 38.5）", [
    N("微信", "微信支付", "美团外卖 | 支付成功 ¥38.50", 0),
    N("微信", "微信支付", "退款到账 ¥38.50", 120)
  ]);

  block("32 拼多多退款（之前买过 5.75）", [
    N("拼多多", "拼多多", "支付成功 ¥5.75", 0),
    N("拼多多", "拼多多", "退款成功 ¥5.75", 60)
  ]);

  block("33 没买过的退款", [
    N("支付宝", "支付宝", "退款到账 ¥15.00")
  ], 15);

  block("34 退款申请中（钱没回来）", [
    N("支付宝", "支付宝", "退款申请已提交 ¥30.00，正在处理中")
  ]);

  /* ============ 六、重复与并发 ============ */
  block("35 同一条通知推送两遍", [
    N("微信", "微信支付", "微信支付凭证 付款金额 ¥12.00", 0),
    N("微信", "微信支付", "微信支付凭证 付款金额 ¥12.00", 0)
  ], 12);

  block("36 两家不同店同价、相隔 1 分钟（两笔真消费）", [
    N("微信", "微信支付", "微信支付凭证 付款金额 ¥12.00 收款方 张记麻辣烫", 0),
    N("微信", "微信支付", "微信支付凭证 付款金额 ¥12.00 收款方 李记面馆", 1)
  ]);

  block("37 同一家店连续两杯 12 元", [
    N("微信", "微信支付", "支付成功 ¥12.00 收款方 蜜雪冰城", 0),
    N("微信", "微信支付", "支付成功 ¥12.00 收款方 蜜雪冰城", 3)
  ]);

  block("38 拼多多先弹、微信凭证 6 分钟后弹", [
    N("拼多多", "拼多多", "支付成功 ¥5.75", 0),
    N("微信", "微信支付", "微信支付凭证 付款金额 ¥5.75", 6)
  ], 5.75);

  /* ============ 七、金额识别 ============ */
  block("39 原价/优惠/实付三个金额", [
    N("微信", "微信支付", "订单金额 ¥15.00 优惠 ¥5.10 实付 ¥9.90")
  ], 9.9);

  block("40 千分位金额", [
    N("微信", "微信支付", "支付成功 ¥1,200.00")
  ], 1200);

  block("41 待确认「1.2万」", [
    N("微信", "微信支付", "支付成功 1.2万元")
  ], 12000);

  /* ============ 八、界面整体反馈 ============ */
  fresh();
  [
    N("微信", "微信支付", "美团外卖 | 支付成功 ¥38.50", 0),
    N("拼多多", "拼多多", "支付成功 ¥5.75", 5),
    N("支付宝", "支付宝", "支付成功 12.80元 收款方 便利蜂", 10),
    N("短信", "", "【招商银行】您账户1234于10月23日19:32消费人民币23.50元", 20)
  ].forEach(function(it){ var p = parseNotify(it); if(p) addFromNotify(p, true); });
  renderAll();
  var monthSum = curMonthRecs().reduce(function(s, r){ return s + (r.type === "income" ? 0 : r.amt); }, 0);
  out.push("");
  out.push("── 39 首页与记账页的整体反馈");
  out.push("   本月支出(算出来的) ¥" + money(monthSum) + "   明细条数 " + curMonthRecs().length);
  var hb = document.getElementById("homeStack");
  out.push("   首页可见文字：" + (hb ? hb.innerText.replace(/\s+/g, " ").slice(0, 160) : "(无)"));
  var fb = document.getElementById("flowBody");
  out.push("   记账页首行：" + (fb ? fb.innerText.replace(/\s+/g, " ").slice(0, 120) : "(无)"));
  out.push("   待分类数 " + uncatCount());
  out.push("   页面报错 " + JSON.stringify(window.__errs || []));

  return out.join("\n");
})()
