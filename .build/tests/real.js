/* real：真实消费 / 收入场景的端到端模拟。
   把手机上真会出现的通知原文（微信、支付宝、银行短信、抓屏、各 App）一条条喂进
   完整链路 parseNotify → addFromNotify → itemHTML，然后逐笔检查用户真会抱怨的 5 件事：
     ① 漏账：该记的没记上
     ② 信息不明：商户空着、金额抓错
     ③ 图标：没图标 / 画成问号 / 张冠李戴
     ④ 商户名字不对：把「微信支付」「支付宝」这种付款渠道当成了商户
     ⑤ 分类不对
   每条断言都把「实际记成了什么」带在名字里，跑完一眼能看出哪里不对。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "real " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }

  setTimeout(function(){
  try{
  var T0 = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 19, 0, 0).getTime();
  function N(app, title, text, min, src){
    var o = { app: app, title: title, text: text, ts: T0 + (min || 0) * 60000 };
    if(src) o.src = src;
    return o;
  }
  function fresh(){
    state.books = [{id:"daily", name:"日常", icon:"🏠", color:BOOK_COLORS[0], budget:1500, def:true}];
    state.records = []; state.peerRules = {}; state.hide = {};
    state.viewMonth = {y:new Date().getFullYear(), m:new Date().getMonth()};
    state.book = "all"; state.filter = "all";
  }
  function feed(list){
    fresh();
    list.forEach(function(it){ var p = parseNotify(it); if(p) addFromNotify(p, true); });
    return state.records;
  }
  /* 把「用户真正看到的那几块」从渲染结果里抠出来 */
  function view(r){
    var d = document.createElement("div");
    d.innerHTML = itemHTML(r);
    var q = function(s){ var e = d.querySelector(s); return e ? e.textContent.trim() : ""; };
    var ic = d.querySelector(".it-ic");
    return {
      title: q(".it-n"), sub: q(".it-s"), amt: q(".it-a"), pill: q(".it-tg"),
      icon: ic ? (ic.querySelector("img") ? "[logo]" :
        /* 2026-10-30 起分类图标是自绘线条 SVG，textContent 是空的，
           不认 svg 就会被当成"没有图标"。 */
        (ic.querySelector("svg") ? "[icon]" : ic.textContent.trim())) : "(无)"
    };
  }
  var CHANNEL = /^(微信|微信支付|支付宝|云闪付|QQ|短信|银行卡|银联|花呗|余额宝|零钱)$/;
  function catName(r){ var c = r.cat ? catOf(r.cat) : null; return c ? c.n : "待分类"; }
  function shown(r){
    return "记成[商户" + (r.peer || "空") + " 渠道" + (r.from || "空") + " ¥" + money(r.amt) +
           " " + (r.type === "income" ? "收入" : "支出") + " " + catName(r) +
           " 图标" + view(r).icon + "]";
  }

  /* ==================================================================
     逐场景检查。want 里写什么就查什么：
       n=应记几笔(默认1)  amt=金额  peer=商户  cat=分类  in=收入
     ================================================================== */
  function scene(id, label, list, want){
    want = want || {};
    var recs = feed(list);
    var wantN = want.n == null ? 1 : want.n;
    if(recs.length !== wantN){
      ok(id + " " + label + " 应记" + wantN + "笔，实际" + recs.length + "笔", false);
      return;
    }
    if(wantN === 0) { ok(id + " " + label + " 正确地没记", true); return; }
    var r = recs[0];
    var s = shown(r);
    if(want.amt != null) eq(id + " " + label + " 金额 " + s, r.amt, want.amt);
    if(want.peer != null) eq(id + " " + label + " 商户 " + s, r.peer, want.peer);
    if(want.cat != null) eq(id + " " + label + " 分类 " + s, r.cat, want.cat);
    if(want.in != null) eq(id + " " + label + " 收支方向 " + s, r.type === "income", want.in);
    /* 通用体检：不管场景是什么，这几条都不能破 */
    if(want.noName !== true) ok(id + " " + label + " 商户不能是付款渠道 " + s,
        !CHANNEL.test(String(r.peer || "")));
    var v = view(r);
    ok(id + " " + label + " 图标不能为空/问号 " + s,
        v.icon && v.icon !== "(无)" && v.icon.indexOf("❓") < 0);
    ok(id + " " + label + " 金额显示得出来 " + s, v.amt.length > 0);
    ok(id + " " + label + " 必须落在真实账本里（防全落日常）",
        !!r.book && state.books.some(function(b){ return b.id === r.book; }));
  }

  /* ========== 一、微信支付 ========== */
  scene("01", "微信扫码付麻辣烫(有收款方)", [
    N("微信","微信支付","微信支付凭证\n付款金额 ¥23.50\n收款方 张记麻辣烫")
  ], {amt:23.5, peer:"张记麻辣烫", cat:"food"});

  scene("02", "微信付款但没写商户", [
    N("微信","微信支付","微信支付凭证\n付款金额 ¥12.00")
  ], {amt:12, noName:true});

  scene("03", "拼多多下单跳微信付款(两条通知)", [
    N("微信","微信支付","微信支付凭证\n付款金额 ¥5.75", 0),
    N("拼多多","拼多多","支付成功 ¥5.75", 8)
  ], {amt:5.75, peer:"拼多多"});

  /* 「美团外卖」记成「美团」是有意的：平台名后面的尾巴不算新信息，
     去掉才能命中品牌表、显示真的美团图标（见 cleanNotifyPeer 上方的说明） */
  scene("04", "美团外卖via微信", [
    N("微信","微信支付","美团外卖 | 支付成功 ¥38.50")
  ], {amt:38.5, peer:"美团", cat:"food"});

  scene("05", "蜜雪冰城", [
    N("微信","微信支付","美团外卖 蜜雪冰城 支付成功 ¥8.00")
  ], {amt:8, peer:"蜜雪冰城", cat:"food"});

  scene("06", "转账给朋友(支出)", [
    N("微信","微信支付","转账给李四 ¥200.00")
  ], {amt:200, in:false});

  scene("07", "朋友转账给我(收入)", [
    N("微信","微信支付","李四向你转账 ¥200.00")
  ], {amt:200, in:true});

  scene("08", "发红包(支出)", [
    N("微信","微信","你发了一个红包 ¥66.00")
  ], {amt:66, in:false});

  scene("09", "收到红包(收入)", [
    N("微信","微信","你收到了一个红包 ¥8.88")
  ], {amt:8.88, in:true});

  scene("10", "零钱提现(内部转账,不该记)", [
    N("微信","微信支付","提现已到账 ¥100.00")
  ], {n:0});

  scene("11", "话费充值", [
    N("微信","微信支付","话费充值成功 ¥50.00")
  ], {amt:50, cat:"comm"});

  scene("12", "免密支付扣款", [
    N("微信","微信支付","免密支付 扣款 ¥15.00")
  ], {amt:15});

  /* ========== 二、支付宝 ========== */
  scene("13", "支付宝付便利店", [
    N("支付宝","支付宝","支付成功 12.80元\n收款方 便利蜂")
  ], {amt:12.8, peer:"便利蜂"});

  scene("14", "花呗付款", [
    N("支付宝","支付宝","花呗付款成功 ¥30.00")
  ], {amt:30});

  scene("15", "余额宝收益(不是一笔账)", [
    N("支付宝","支付宝","余额宝昨日收益 0.13元")
  ], {n:0});

  scene("16", "淘宝via支付宝", [
    N("支付宝","支付宝","淘宝 支付成功 ¥129.00")
  ], {amt:129, peer:"淘宝"});

  scene("17", "饿了么", [
    N("支付宝","支付宝","饿了么 订单已支付 ¥26.80")
  ], {amt:26.8, peer:"饿了么", cat:"food"});

  /* ========== 三、银行短信 ========== */
  scene("18", "招行消费短信", [
    N("短信","", "【招商银行】您账户1234于10月23日19:32消费人民币23.50元，余额1024.10元")
  ], {amt:23.5});

  scene("19", "建行收入短信", [
    N("短信","", "【建设银行】您尾号1234的储蓄卡10月23日收入人民币5000.00元，活期余额6000元")
  ], {amt:5000, in:true});

  scene("20", "工行工资到账", [
    N("短信","", "【工商银行】您尾号8888账户10月23日工资收入人民币6,800.00元")
  ], {amt:6800, in:true});

  scene("21", "邮储动账短信(没有金额)", [
    N("短信","", "【邮储银行】您有一笔新的动账信息，请登录手机银行查看")
  ], {n:0});

  /* ========== 四、抓屏 / 短信通道 ========== */
  scene("22", "抓屏:微信付款成功页", [
    {app:"微信", title:"", text:"支付成功 ¥23.50 星巴克", ts:T0, src:"screen"}
  ], {amt:23.5, peer:"星巴克", cat:"food"});

  scene("23", "抓屏:支付宝付款成功页", [
    {app:"支付宝", title:"", text:"付款成功 ¥6.00 蜜雪冰城", ts:T0, src:"screen"}
  ], {amt:6, peer:"蜜雪冰城", cat:"food"});

  scene("24", "短信通道:建行动账", [
    {app:"短信", title:"", text:"【建设银行】您尾号1234的储蓄卡消费人民币88.00元", ts:T0, src:"sms"}
  ], {amt:88});

  /* ========== 五、各 App 自己的通知 ========== */
  scene("25", "12306买火车票", [
    N("铁路12306","铁路12306","购票成功 订单金额 ¥553.00")
  ], {amt:553, cat:"transport"});

  scene("26", "滴滴打车", [
    N("滴滴出行","滴滴出行","行程结束，本次支付 ¥28.60")
  ], {amt:28.6, cat:"transport"});

  scene("27", "猫眼电影票", [
    N("猫眼","猫眼电影","购票成功 ¥76.00")
  ], {amt:76, cat:"fun"});

  scene("28", "星巴克", [
    N("星巴克","星巴克","支付成功 ¥33.00")
  ], {amt:33, peer:"星巴克", cat:"food"});

  scene("29", "云闪付加油", [
    N("云闪付","云闪付","支付成功 ¥45.00 收款方 中国石化")
  ], {amt:45, peer:"中国石化", cat:"transport"});

  scene("30", "医院缴费", [
    N("微信","微信支付","支付成功 ¥180.00 收款方 市第一人民医院")
  ], {amt:180, cat:"med"});

  scene("31", "交学费", [
    N("支付宝","支付宝","支付成功 ¥3,200.00 收款方 学校财务")
  ], {amt:3200});

  scene("32", "交房租(转账只是动作,用途是住房)", [
    N("微信","微信支付","转账-房租 ¥1,500.00")
  ], {amt:1500, cat:"house"});

  scene("33", "买衣服", [
    N("支付宝","支付宝","支付成功 ¥259.00 收款方 优衣库")
  ], {amt:259, peer:"优衣库", cat:"cloth"});

  scene("34", "超市买日用品", [
    N("微信","微信支付","支付成功 ¥67.30 收款方 大润发")
  ], {amt:67.3, peer:"大润发"});

  /* ========== 六、退款 ========== */
  scene("35", "退款申请中(钱没回来,不该记)", [
    N("支付宝","支付宝","退款申请已提交 ¥30.00，正在处理中")
  ], {n:0});

  scene("36", "同一条通知推两遍(只能记一笔)", [
    N("微信","微信支付","微信支付凭证 付款金额 ¥12.00", 0),
    N("微信","微信支付","微信支付凭证 付款金额 ¥12.00", 0)
  ], {n:1, amt:12});

  scene("37", "两家不同店同价相隔1分钟(两笔真账)", [
    N("微信","微信支付","微信支付凭证 付款金额 ¥12.00 收款方 张记麻辣烫", 0),
    N("微信","微信支付","微信支付凭证 付款金额 ¥12.00 收款方 李记面馆", 1)
  ], {n:2});

  scene("38", "同一家店连买两杯", [
    N("微信","微信支付","支付成功 ¥12.00 收款方 蜜雪冰城", 0),
    N("微信","微信支付","支付成功 ¥12.00 收款方 蜜雪冰城", 3)
  ], {n:2});

  /* ========== 七、金额识别 ========== */
  scene("39", "原价/优惠/实付三个金额(取实付)", [
    N("微信","微信支付","订单金额 ¥15.00 优惠 ¥5.10 实付 ¥9.90")
  ], {amt:9.9});

  scene("40", "千分位金额", [
    N("微信","微信支付","支付成功 ¥1,200.00")
  ], {amt:1200});

  scene("41", "元字写法", [
    N("微信","微信支付","支付成功 38.90元 收款方 大润发")
  ], {amt:38.9, peer:"大润发"});

  /* ========== 八、连着来一整天（整体看有没有串味） ========== */
  (function(){
    var day = [
      N("微信","微信支付","微信支付凭证 付款金额 ¥8.50 收款方 学校二食堂", 0),
      N("微信","微信支付","美团外卖 蜜雪冰城 支付成功 ¥8.00", 30),
      N("支付宝","支付宝","支付成功 12.80元 收款方 便利蜂", 60),
      N("短信","", "【招商银行】您账户1234消费人民币23.50元", 120),
      N("微信","微信支付","李四向你转账 ¥200.00", 200),
      N("支付宝","支付宝","支付成功 ¥259.00 收款方 优衣库", 240)
    ];
    var recs = feed(day);
    ok("42 一整天6条通知都记上了(实际" + recs.length + "笔)", recs.length === 6);
    var noBook = recs.filter(function(r){
      return !r.book || !state.books.some(function(b){ return b.id === r.book; });
    });
    ok("43 每笔都写了真实账本(漏写会全落日常)", noBook.length === 0);
    var noIcon = recs.filter(function(r){
      var v = view(r); return !v.icon || v.icon === "(无)" || v.icon.indexOf("❓") >= 0;
    });
    ok("44 每笔都有图标且不是问号", noIcon.length === 0);
    var chn = recs.filter(function(r){ return CHANNEL.test(String(r.peer || "")); });
    ok("45 没有把付款渠道当商户", chn.length === 0);
    var sum = recs.reduce(function(s,r){ return s + (r.type === "income" ? 0 : r.amt); }, 0);
    ok("46 支出合计算得出来(¥" + money(sum) + ")", sum > 0);
    ok("47 收入那笔被认成收入", recs.some(function(r){ return r.type === "income"; }));
  })();

  }catch(e){
    log.push("N 抛异常: " + (e && e.message ? e.message : e));
  }
  report();
  }, 900);
})();
