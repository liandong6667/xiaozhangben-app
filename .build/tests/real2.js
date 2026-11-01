/* real2：第二批真实订单场景 —— 补 real.js 没覆盖到的生活类型。
   real.js 已经有 47 个场景，这里换一批「一个月里真会碰到的钱」：
   打车 / 火车票 / 加油 / 单车 / 话费 / 水电 / 会员 / 游戏 / 看病 / 超市 / 房租 /
   工资 / 助学金 / 红包 / 退款到账，以及那些「看着像消费、其实不是」的通知
   （信用卡还款、提现、ATM 取款、余额宝转入、待付款、支付失败）。
   每条断言都把实际记成什么带在名字里。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[记成" + got + " 想要" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "real2 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
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
  var BANK = /银行$/;
  function catName(r){ var c = r.cat ? catOf(r.cat) : null; return c ? c.n : "待分类"; }
  function shown(r){
    return "记成[商户" + (r.peer || "空") + " 渠道" + (r.from || "空") + " ¥" + money(r.amt) +
           " " + (r.type === "income" ? "收入" : "支出") + " " + catName(r) +
           " 图标" + view(r).icon + "]";
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
    var r = recs[0];
    var s = shown(r);
    if(want.amt != null) eq(id + " " + label + " 金额", r.amt, want.amt);
    if(want.peer != null) eq(id + " " + label + " 商户", r.peer, want.peer);
    if(want.peerHas != null) ok(id + " " + label + " 商户要带「" + want.peerHas + "」" + s,
        String(r.peer || "").indexOf(want.peerHas) >= 0);
    if(want.cat != null) eq(id + " " + label + " 分类", r.cat, want.cat);
    if(want.in != null) eq(id + " " + label + " 收支方向", r.type === "income", want.in);
    /* 通用体检 */
    if(want.noName !== true) ok(id + " " + label + " 商户不能是付款渠道 " + s,
        !CHANNEL.test(String(r.peer || "")) && !BANK.test(String(r.peer || "")));
    var v = view(r);
    ok(id + " " + label + " 图标不能为空/问号 " + s,
        v.icon && v.icon !== "(无)" && v.icon.indexOf("❓") < 0);
    ok(id + " " + label + " 金额显示得出来 " + s, v.amt.length > 0);
    ok(id + " " + label + " 落在真实账本里", !!r.book && state.books.some(function(b){ return b.id === r.book; }));
  }

  /* ========== 一、出门在路上的钱 ========== */
  scene("101", "滴滴打车", [
    N("滴滴出行","行程结束","行程结束，已支付 ¥32.00")
  /* 「滴滴出行」记成「滴滴」是有意的：和「美团外卖→美团」同一套，
     去掉尾巴才能命中品牌表、左边显示真的滴滴图标 */
  ], {amt:32, peer:"滴滴", cat:"transport"});

  scene("102", "12306买火车票", [
    N("铁路12306","购票成功","购票成功 ¥263.50")
  ], {amt:263.5, cat:"transport"});

  scene("103", "加油站加油", [
    N("中石化","加油","加油 支付成功 ¥300.00")
  ], {amt:300, cat:"transport"});

  scene("104", "哈啰单车", [
    N("哈啰出行","骑行结束","骑行结束 支付 ¥2.50")
  ], {amt:2.5, cat:"transport"});

  scene("105", "停车费", [
    N("微信","停车缴费","停车费 支付成功 ¥8.00")
  ], {amt:8, cat:"transport"});

  /* ========== 二、每月固定要交的钱 ========== */
  scene("106", "充话费", [
    N("中国移动","充值成功","话费充值成功 ¥50.00")
  ], {amt:50, cat:"comm"});

  scene("107", "交电费", [
    N("网上国网","电费扣款","您本期电费已扣款 ¥120.35")
  ], {amt:120.35, cat:"house"});

  scene("108", "交水费", [
    N("微信","生活缴费","水费 缴费成功 ¥45.60")
  ], {amt:45.6, cat:"house"});

  scene("109", "视频会员连续包月", [
    N("腾讯视频","扣款成功","连续包月 扣款成功 ¥15.00")
  ], {amt:15, cat:"fun"});

  scene("110", "校园网网费", [
    N("微信","校园网","校园网月费 支付成功 ¥30.00")
  ], {amt:30, cat:"comm"});

  /* ========== 三、日常花销 ========== */
  scene("111", "超市买日用品", [
    N("微信","微信支付","微信支付凭证 付款金额 ¥86.40 收款方 永辉超市")
  ], {amt:86.4, peer:"永辉超市", cat:"daily"});

  scene("112", "买衣服", [
    N("支付宝","支付宝","支付成功 ¥259.00 收款方 优衣库")
  ], {amt:259, peer:"优衣库", cat:"cloth"});

  scene("113", "看病挂号缴费", [
    N("微信","医疗健康","门诊缴费成功 ¥280.00 收款方 市中心医院")
  ], {amt:280, peerHas:"医院", cat:"med"});

  scene("114", "点外卖(饿了么+店名)", [
    N("饿了么","订单已完成","张亮麻辣烫 支付成功 ¥26.00")
  ], {amt:26, peerHas:"麻辣烫", cat:"food"});

  scene("115", "喝咖啡", [
    N("星巴克","订单完成","订单已完成 ¥35.00")
  ], {amt:35, cat:"food"});

  scene("116", "买游戏点券", [
    N("王者荣耀","充值成功","点券充值成功 ¥6.00")
  ], {amt:6, cat:"fun"});

  scene("117", "看电影", [
    N("猫眼","出票成功","电影票 支付成功 ¥78.00")
  ], {amt:78, cat:"fun"});

  scene("118", "理发", [
    N("微信","微信支付","扫码支付 付款金额 ¥35.00 收款方 潮流理发店")
  ], {amt:35, cat:"daily"});

  scene("119", "健身月卡", [
    N("微信","微信支付","健身月卡 支付成功 ¥199.00")
  ], {amt:199, cat:"fun"});

  scene("120", "寄快递", [
    N("顺丰速运","已寄出","运费 支付 ¥18.00")
  ], {amt:18, peerHas:"顺丰"});

  scene("121", "交学杂费", [
    N("微信","微信支付","学杂费 缴费成功 ¥298.00")
  ], {amt:298, cat:"study"});

  scene("122", "交房租(转账给房东)", [
    N("微信","微信支付","转账给房东王姐 ¥1500.00 备注 房租")
  ], {amt:1500, peerHas:"房东", cat:"house"});

  /* ========== 四、进账 ========== */
  scene("123", "发工资", [
    N("短信","","【工商银行】您尾号1234账户 代发工资 入账人民币5000.00元")
  ], {amt:5000, in:true, cat:"salary"});

  scene("124", "助学金到账", [
    N("短信","","【中国银行】助学金 入账人民币2000.00元")
  ], {amt:2000, in:true});

  scene("125", "收到微信红包", [
    N("微信","微信支付","收到红包 ¥5.00")
  ], {amt:5, in:true});

  scene("126", "兼职稿费转账进来", [
    N("微信","微信支付","王五向你转账 ¥300.00 备注 稿费")
  ], {amt:300, in:true, peer:"王五"});

  scene("127", "退款到账", [
    N("微信","微信支付","退款成功 ¥30.00 商户 优衣库")
  ], {amt:30, in:true, cat:"refund", peerHas:"优衣库"});

  scene("128", "退款写成负数(-¥20.00)", [
    N("微信","微信支付","退款成功 -¥20.00 商户 优衣库")
  ], {amt:20, in:true});

  /* ========== 五、看着像消费、其实不是（不该记） ========== */
  scene("129", "还信用卡", [
    N("招商银行","还款成功","信用卡还款成功 ¥1,000.00")
  ], {n:0});

  scene("130", "零钱提现", [
    N("微信","微信支付","零钱提现成功 ¥100.00")
  ], {n:0});

  scene("131", "还花呗", [
    N("支付宝","支付宝","花呗还款成功 ¥500.00")
  ], {n:0});

  scene("132", "转入余额宝", [
    N("支付宝","支付宝","余额宝转入成功 ¥1000.00")
  ], {n:0});

  scene("133", "ATM 取现金", [
    N("短信","","【工商银行】您尾号1234卡于ATM取款人民币500.00元")
  ], {n:0});

  scene("134", "下单了还没付钱", [
    N("拼多多","拼多多","订单已提交，请在15分钟内完成支付 ¥88.00")
  ], {n:0});

  scene("135", "支付失败", [
    N("微信","微信支付","支付失败 ¥30.00")
  ], {n:0});

  scene("136", "验证码短信", [
    N("短信","","【京东】验证码123456，请勿泄露给他人")
  ], {n:0});

  scene("137", "银行结息", [
    N("短信","","【工商银行】您账户本季度结息人民币3.20元")
  ], {amt:3.2, in:true});

  /* ========== 六、金额和形态的边界 ========== */
  scene("138", "一分钱", [
    N("微信","微信支付","微信支付凭证 付款金额 ¥0.01")
  ], {amt:0.01});

  scene("139", "十万块（千分位）", [
    N("微信","微信支付","微信支付凭证 付款金额 ¥100,000.00")
  ], {amt:100000});

  scene("140", "银行短信里带余额（只取消费额）", [
    N("短信","","【建设银行】您尾号1234的储蓄卡消费人民币68.00元，余额1,234.56元")
  ], {amt:68});

  scene("141", "App Store 美元订阅", [
    N("App Store","订阅","订阅 扣款 $12.00")
  ], {amt:12});

  scene("142", "通知只有标题有金额", [
    N("微信","支付成功 ¥9.90","")
  ], {amt:9.9});

  scene("143", "通知里带 emoji", [
    N("微信","微信支付","🎉 支付成功 ¥9.90 收款方 老乡鸡")
  ], {amt:9.9, peerHas:"老乡鸡"});

  scene("144", "店名带分店（蜜雪冰城(万达店)）", [
    N("微信","微信支付","微信支付凭证 付款金额 ¥8.00 收款方 蜜雪冰城(万达店)")
  ], {amt:8, peerHas:"蜜雪冰城"});

  scene("145", "收款方写着「个人」", [
    N("微信","微信支付","微信支付凭证 付款金额 ¥6.00 收款方 个人")
  ], {n:1, amt:6});

  /* ========== 七、几条通知说的是同一笔钱 ========== */
  scene("146", "微信+拼多多+银行短信（三通通知一笔账）", [
    N("微信","微信支付","微信支付凭证 付款金额 ¥38.50", 0),
    N("拼多多","拼多多","支付成功 ¥38.50", 1),
    N("短信","","【招商银行】您尾号1234账户消费人民币38.50元", 2)
  ], {n:1, amt:38.5, peer:"拼多多"});

  scene("147", "同一分钟两笔不同金额（两笔真账）", [
    N("微信","微信支付","微信支付凭证 付款金额 ¥12.00", 0),
    N("微信","微信支付","微信支付凭证 付款金额 ¥30.00", 0)
  ], {n:2});

  scene("148", "先平台后渠道（商户/渠道不能串味）", [
    N("拼多多","拼多多","支付成功 ¥5.75", 0),
    N("微信","微信支付","微信支付凭证 付款金额 ¥5.75", 1)
  ], {n:1, amt:5.75, peer:"拼多多"});

  /* ========== 八、连着一个月（整体看有没有串味） ========== */
  (function(){
    var month = [
      N("微信","微信支付","微信支付凭证 付款金额 ¥8.50 收款方 学校二食堂", 0),
      N("滴滴出行","行程结束","行程结束，已支付 ¥32.00", 120),
      N("中国移动","充值成功","话费充值成功 ¥50.00", 300),
      N("短信","","【工商银行】您尾号1234账户 代发工资 入账人民币5000.00元", 500),
      N("网上国网","电费扣款","您本期电费已扣款 ¥120.35", 700),
      N("微信","微信支付","转账给房东王姐 ¥1500.00 备注 房租", 900),
      N("支付宝","支付宝","支付成功 ¥259.00 收款方 优衣库", 1200),
      N("腾讯视频","扣款成功","连续包月 扣款成功 ¥15.00", 1500),
      N("微信","微信支付","微信支付凭证 付款金额 ¥6.00 收款方 蜜雪冰城", 1800),
      N("美团","美团外卖","美团外卖 支付成功 ¥38.50", 2100),
      N("微信","微信支付","退款成功 ¥30.00 商户 优衣库", 2400),
      N("招商银行","还款成功","信用卡还款成功 ¥1,000.00", 2700)
    ];
    var recs = feed(month);
    /* 12 条通知里最后一笔是还款，不该记，所以是 11 笔 */
    ok("149 一个月12条通知记了" + recs.length + "笔（还款那条不该记）", recs.length === 11);
    var noIcon = recs.filter(function(r){
      var v = view(r); return !v.icon || v.icon === "(无)" || v.icon.indexOf("❓") >= 0;
    });
    ok("150 每笔都有图标且不是问号", noIcon.length === 0);
    var chn = recs.filter(function(r){ return CHANNEL.test(String(r.peer || "")) || BANK.test(String(r.peer || "")); });
    ok("151 没有把付款渠道/银行当商户", chn.length === 0);
    var noBook = recs.filter(function(r){
      return !r.book || !state.books.some(function(b){ return b.id === r.book; });
    });
    ok("152 每笔都写了真实账本", noBook.length === 0);
    var out = recs.filter(function(r){ return r.type !== "income"; }).reduce(function(s,r){ return s + r.amt; }, 0);
    var inc = recs.filter(function(r){ return r.type === "income"; }).reduce(function(s,r){ return s + r.amt; }, 0);
    /* 8.5+32+50+120.35+1500+259+15+6+38.5 = 2029.35（最后一笔还款不记） */
    ok("153 支出合计 ¥" + money(out) + "（该是 2029.35）", Math.abs(out - 2029.35) < 0.01);
    ok("154 收入合计 ¥" + money(inc) + "（该是 5030）", Math.abs(inc - 5030) < 0.01);
    var cats = {};
    recs.forEach(function(r){ cats[catName(r)] = (cats[catName(r)] || 0) + 1; });
    ok("155 没出现「待分类」", !cats["待分类"]);
  })();

  /* ========== 九、界面上真能看见（渲染不炸） ========== */
  (function(){
    var recs = feed([
      N("微信","微信支付","微信支付凭证 付款金额 ¥8.50 收款方 学校二食堂", 0),
      N("滴滴出行","行程结束","行程结束，已支付 ¥32.00", 30),
      N("短信","","【工商银行】您尾号1234账户 代发工资 入账人民币5000.00元", 60)
    ]);
    var html = recs.map(function(r){ return itemHTML(r); }).join("");
    ok("156 三笔账渲染出来都有金额", (html.match(/it-a/g) || []).length === 3);
    ok("157 渲染结果里没有 undefined/NaN", html.indexOf("undefined") < 0 && html.indexOf("NaN") < 0);
    var d = document.createElement("div"); d.innerHTML = html;
    var amts = [].map.call(d.querySelectorAll(".it-a"), function(e){ return e.textContent.trim(); });
    ok("158 金额格式对（¥8.50/¥32.00/¥5000.00 实际 " + amts.join(",") + "）",
        amts.length === 3 && amts.every(function(s){ return /^[-+]?[¥￥]?\s?[0-9]/.test(s); }));
    var subs = [].map.call(d.querySelectorAll(".it-s"), function(e){ return e.textContent.trim(); });
    ok("159 小字里没有把余额念出来（实际 " + subs.join(" / ") + "）",
        subs.join(" ").indexOf("余额") < 0);
  })();

  }catch(e){
    log.push("N 抛异常: " + (e && e.message ? e.message : e));
  }
  report();
  }, 900);
})();
