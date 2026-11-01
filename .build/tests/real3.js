/* real3：第三批 —— 用手机上「通知原文长什么样就怎么喂」，一行不删。
   真机的通知比测试里写的脏得多：多行凭证、订单号、卡号尾号、余额、
   优惠/运费/实付三个数字、渠道词混在正文里。
   这一批专挑这种脏原文，看识别会不会被杂字带偏。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[记成" + got + " 想要" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "real3 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }

  setTimeout(function(){
  try{
  var T0 = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 12, 0, 0).getTime();
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
  function view(r){
    var d = document.createElement("div");
    d.innerHTML = itemHTML(r);
    var q = function(s){ var e = d.querySelector(s); return e ? e.textContent.trim() : ""; };
    var ic = d.querySelector(".it-ic");
    return { title: q(".it-n"), sub: q(".it-s"), amt: q(".it-a"),
      icon: ic ? (ic.querySelector("img") ? "[logo]" :
        /* 2026-10-30 起分类图标是自绘线条 SVG，textContent 是空的，
           不认 svg 就会被当成"没有图标"。 */
        (ic.querySelector("svg") ? "[icon]" : ic.textContent.trim())) : "(无)" };
  }
  var CHANNEL = /^(微信|微信支付|支付宝|云闪付|QQ|短信|银行卡|银联|花呗|余额宝|零钱)$/;
  function catName(r){ var c = r.cat ? catOf(r.cat) : null; return c ? c.n : "待分类"; }
  function shown(r){
    return "记成[商户" + (r.peer || "空") + " 渠道" + (r.from || "空") + " ¥" + money(r.amt) +
           " " + (r.type === "income" ? "收入" : "支出") + " " + catName(r) + " 图标" + view(r).icon + "]";
  }
  function scene(id, label, list, want){
    want = want || {};
    var recs = feed(list);
    var wantN = want.n == null ? 1 : want.n;
    if(recs.length !== wantN){
      ok(id + " " + label + " 应记" + wantN + "笔，实际" + recs.length + "笔" +
         (recs.length ? " " + shown(recs[0]) : "（一条没记）"), false);
      return;
    }
    if(wantN === 0){ ok(id + " " + label + " 正确地没记", true); return; }
    var r = recs[0], s = shown(r);
    if(want.amt != null) eq(id + " " + label + " 金额", r.amt, want.amt);
    if(want.peer != null) eq(id + " " + label + " 商户", r.peer, want.peer);
    if(want.peerHas != null) ok(id + " " + label + " 商户要带「" + want.peerHas + "」" + s,
        String(r.peer || "").indexOf(want.peerHas) >= 0);
    if(want.cat != null) eq(id + " " + label + " 分类", r.cat, want.cat);
    if(want.in != null) eq(id + " " + label + " 收支方向", r.type === "income", want.in);
    ok(id + " " + label + " 商户不能是付款渠道 " + s, !CHANNEL.test(String(r.peer || "")));
    var v = view(r);
    ok(id + " " + label + " 图标不是问号 " + s, v.icon && v.icon !== "(无)" && v.icon.indexOf("❓") < 0);
    ok(id + " " + label + " 落在真实账本里", !!r.book && state.books.some(function(b){ return b.id === r.book; }));
  }

  /* ========== 一、微信支付凭证（手机上就是这几行） ========== */
  scene("201", "微信支付凭证(多行+支付方式)", [
    N("微信","微信支付","微信支付凭证\n付款金额 ¥23.50\n收款方 张记麻辣烫\n支付方式 招商银行储蓄卡(1234)\n支付时间 今天 12:03")
  ], {amt:23.5, peer:"张记麻辣烫", cat:"food"});

  scene("202", "支付宝付款成功(带付款方式)", [
    N("支付宝","支付宝","支付宝成功付款23.50元\n收款方 张记麻辣烫\n付款方式 余额宝")
  ], {amt:23.5, peer:"张记麻辣烫"});

  scene("203", "建行短信(卡号尾号+余额+商户)", [
    N("短信","","【中国建设银行】尊敬的客户，您尾号1234的龙卡通于10月24日12:23向 美团外卖 支付人民币38.50元，活期余额1,234.56元。")
  ], {amt:38.5, peerHas:"美团"});

  scene("204", "京东短信(订单号+金额)", [
    N("短信","","【京东】您已付款成功，订单号12345678901，金额¥129.00，感谢您的购买！")
  ], {amt:129, peerHas:"京东"});

  scene("205", "拼多多实付", [
    N("拼多多","拼多多","您的订单已支付成功\n实付 ¥9.90\n预计明天发货")
  ], {amt:9.9, peer:"拼多多"});

  scene("206", "中国移动充值(带余额)", [
    N("短信","","【中国移动】您已成功充值50.00元，当前余额68.30元。")
  ], {amt:50, cat:"comm"});

  scene("207", "云闪付付款", [
    N("云闪付","付款成功","云闪付付款成功12.00元 商户 沃尔玛")
  ], {amt:12, peerHas:"沃尔玛", cat:"daily"});

  /* ========== 二、容易和「还款」搞混的（是消费，不是还款） ========== */
  scene("208", "花呗付款买东西(不是还款)", [
    N("支付宝","支付宝","花呗支付成功 ¥99.00 收款方 得物")
  ], {amt:99, peerHas:"得物"});

  scene("209", "信用卡刷卡消费(不是还款)", [
    N("招商银行","消费提醒","您尾号1234信用卡消费人民币68.00元 商户 海底捞")
  ], {amt:68, peerHas:"海底捞", cat:"food"});

  scene("210", "零钱支付", [
    N("微信","微信支付","零钱支付 ¥12.00 收款方 老王水果店")
  ], {amt:12, peerHas:"水果"});

  /* ========== 三、退回来 / 退掉的钱 ========== */
  scene("211", "转给别人的钱被退还", [
    N("微信","微信支付","好友转账超时已退还 ¥200.00")
  ], {amt:200, in:true, cat:"refund"});

  scene("212", "火车票退票退款到账", [
    N("铁路12306","退票成功","退票成功，已退款 ¥53.00")
  ], {amt:53, in:true, cat:"refund"});

  scene("213", "钱还没退回来(只是说会退)", [
    N("淘宝","退款","退款申请已提交，款项将原路退回 ¥30.00")
  ], {n:0});

  /* ========== 四、其他 App ========== */
  scene("214", "医院挂号", [
    N("微医","挂号成功","挂号费 支付成功 ¥15.00")
  ], {amt:15, cat:"med"});

  scene("215", "数字人民币付款", [
    N("数字人民币","支付成功","支付成功 ¥20.00 商户 全家便利店")
  ], {amt:20, peerHas:"全家"});

  scene("216", "抖音月付", [
    N("抖音","月付账单","抖音月付 支付成功 ¥39.90")
  ], {amt:39.9});

  /* ========== 五、金额形态 ========== */
  scene("217", "¥ 后面有空格", [
    N("微信","微信支付","微信支付凭证 付款金额 ¥ 23.50 收款方 张记麻辣烫")
  ], {amt:23.5});

  scene("218", "一个数字两个写法(实付/运费/订单金额)", [
    N("微信","微信支付","订单金额 ¥50.00 运费 ¥8.00 实付 ¥58.00")
  ], {amt:58});

  scene("219", "金额后面跟「元」和句号", [
    N("短信","","【工商银行】您尾号1234卡消费128.00元。")
  ], {amt:128});

  scene("220", "超长商户名(要截断)", [
    N("微信","微信支付","微信支付凭证 付款金额 ¥30.00 收款方 北京市海淀区中关村大街某某某超市有限责任公司")
  ], {amt:30});

  /* ========== 六、别把两笔算成一笔 / 一笔算成两笔 ========== */
  scene("221", "一天8杯奶茶(同价不同时间，8笔真账)", [
    N("微信","微信支付","支付成功 ¥6.00 收款方 蜜雪冰城", 0),
    N("微信","微信支付","支付成功 ¥6.00 收款方 蜜雪冰城", 60),
    N("微信","微信支付","支付成功 ¥6.00 收款方 蜜雪冰城", 120),
    N("微信","微信支付","支付成功 ¥6.00 收款方 蜜雪冰城", 180),
    N("微信","微信支付","支付成功 ¥6.00 收款方 蜜雪冰城", 240),
    N("微信","微信支付","支付成功 ¥6.00 收款方 蜜雪冰城", 300),
    N("微信","微信支付","支付成功 ¥6.00 收款方 蜜雪冰城", 360),
    N("微信","微信支付","支付成功 ¥6.00 收款方 蜜雪冰城", 420)
  ], {n:8});

  scene("222", "隔10分钟两条(一边报商户，同一笔)", [
    N("微信","微信支付","微信支付凭证 付款金额 ¥5.75", 0),
    N("拼多多","拼多多","支付成功 ¥5.75", 10)
  ], {n:1, amt:5.75, peer:"拼多多"});

  scene("223", "30秒内两家店同价(两笔)", [
    N("微信","微信支付","支付成功 ¥6.00 收款方 蜜雪冰城", 0),
    N("微信","微信支付","支付成功 ¥6.00 收款方 茶百道", 0.5)
  ], {n:2});

  /* ========== 七、抓屏 / 短信 两个来源 ========== */
  scene("224", "抓屏：支付成功页", [
    N("抓屏","","支付成功\n¥38.50\n美团外卖", 0, "screen")
  ], {amt:38.5});

  scene("225", "抓屏：银行短信页", [
    N("抓屏","","【招商银行】您账户1234消费人民币23.50元", 5, "screen")
  ], {amt:23.5});

  /* ========== 八、一整天 20 条混合（看整体） ========== */
  (function(){
    var day = [
      N("微信","微信支付","微信支付凭证 付款金额 ¥8.50 收款方 学校二食堂", 0),
      N("微信","微信支付","美团外卖 蜜雪冰城 支付成功 ¥8.00", 25),
      N("支付宝","支付宝","支付宝成功付款12.80元 收款方 便利蜂", 55),
      N("短信","","【招商银行】您账户1234消费人民币23.50元", 90),
      N("微信","微信支付","李四向你转账 ¥200.00", 120),
      N("支付宝","支付宝","支付成功 ¥259.00 收款方 优衣库", 150),
      N("滴滴出行","行程结束","行程结束，已支付 ¥32.00", 185),
      N("中国移动","充值成功","话费充值成功 ¥50.00", 220),
      N("微信","微信支付","转账给房东王姐 ¥1500.00 备注 房租", 260),
      N("腾讯视频","扣款成功","连续包月 扣款成功 ¥15.00", 300),
      N("微信","微信支付","退款成功 ¥30.00 商户 优衣库", 340),
      N("招商银行","还款成功","信用卡还款成功 ¥1,000.00", 380),
      N("短信","","【工商银行】您尾号1234卡于ATM取款人民币500.00元", 420),
      N("微信","微信支付","微信支付凭证 付款金额 ¥0.01", 460),
      N("拼多多","拼多多","您的订单已支付成功 实付 ¥9.90", 500),
      N("短信","","【京东】您已付款成功，订单号12345678901，金额¥129.00", 540)
    ];
    var recs = feed(day);
    /* 16 条里：还款、ATM 取款不该记 → 14 笔 */
    ok("226 一天16条通知记了" + recs.length + "笔（还款/取款不该记）", recs.length === 14);
    var noIcon = recs.filter(function(r){
      var v = view(r); return !v.icon || v.icon === "(无)" || v.icon.indexOf("❓") >= 0; });
    ok("227 每笔都有图标且不是问号", noIcon.length === 0);
    var chn = recs.filter(function(r){ return CHANNEL.test(String(r.peer || "")); });
    ok("228 没把付款渠道当商户", chn.length === 0);
    var bad = recs.filter(function(r){ return !(r.amt > 0); });
    ok("229 没有 0 元或负数的账", bad.length === 0);
    var out = recs.filter(function(r){ return r.type !== "income"; }).reduce(function(s,r){ return s + r.amt; }, 0);
    /* 8.5+8+12.8+23.5+259+32+50+1500+15+0.01+9.9+129 = 2047.71 */
    ok("230 支出合计 ¥" + money(out) + "（该是 2047.71）", Math.abs(out - 2047.71) < 0.01);
    var inc = recs.filter(function(r){ return r.type === "income"; }).reduce(function(s,r){ return s + r.amt; }, 0);
    /* 转账200 + 退款30 = 230 */
    ok("231 收入合计 ¥" + money(inc) + "（该是 230）", Math.abs(inc - 230) < 0.01);
    var html = recs.map(function(r){ return itemHTML(r); }).join("");
    ok("232 渲染结果里没有 undefined/NaN", html.indexOf("undefined") < 0 && html.indexOf("NaN") < 0);
    var d = document.createElement("div"); d.innerHTML = html;
    var subs = [].map.call(d.querySelectorAll(".it-s"), function(e){ return e.textContent.trim(); });
    ok("233 小字里没把余额/卡号念出来（实际 " + subs.slice(0,2).join(" / ") + "）",
        subs.join(" ").indexOf("余额") < 0 && subs.join(" ").indexOf("1234") < 0);
  })();

  }catch(e){
    log.push("N 抛异常: " + (e && e.message ? e.message : e));
  }
  report();
  }, 900);
})();
