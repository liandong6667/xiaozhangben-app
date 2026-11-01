/* 边界场景补充模拟：上一轮 40 个场景之外，再挑一批真实但形态刁钻的通知 */
(function(){
  var T = Date.now();
  var out = [];
  function fresh(){
    state.books = [{id:"daily", name:"日常", icon:"🏠", color:BOOK_COLORS[0], budget:1500, def:true}];
    state.records = [];
    state.peerRules = {};
    state.viewMonth = {y: new Date().getFullYear(), m: new Date().getMonth()};
    state.book = "daily"; state.filter = "all"; state.hide = {};
  }
  function N(app, title, text, minOffset){
    return { app: app, title: title, text: text, ts: T - (minOffset || 0) * 60000 };
  }
  function show(rec){
    var d = document.createElement("div");
    d.innerHTML = itemHTML(rec);
    var n = d.querySelector(".it-n"), s = d.querySelector(".it-s"),
        a = d.querySelector(".it-a"), ic = d.querySelector(".it-ic");
    return (n ? n.textContent : "") + " │ " + (s ? s.textContent : "") +
           " │ " + (a ? a.textContent : "") +
           " │ 图标" + (ic && ic.querySelector("img") ? "[logo]" : (ic ? ic.textContent.trim() : ""));
  }
  function scene(name, list, extra){
    fresh();
    var cnt = 0, first = null;
    list.forEach(function(it){
      var p = parseNotify(it);
      if(p && addFromNotify(p, true)){
        cnt++;
        if(!first) first = state.records[state.records.length - 1];
      }
    });
    out.push("");
    out.push("── " + name + "  → " + cnt + " 笔");
    var recs = state.records.slice(-cnt);
    if(!cnt) out.push("   （什么都没记）");
    recs.forEach(function(r){
      var b = brandOf(r);
      out.push("   peer=" + r.peer + " from=" + (r.from || "") + " ¥" + r.amt.toFixed(2) +
               " " + (r.type === "income" ? "收" : "支") + " cat=" + (r.cat || "∅") +
               (r.ref ? " ref→有" : "") + (b ? " 品牌=" + b.k[0] : ""));
      out.push("     显示│" + show(r));
    });
    if(extra) out.push("   " + extra());
  }

  /* 1. 红包没人领被退回 —— 先前发过一笔 66，应记一笔收入冲回去 */
  scene("1 红包退回（先发过 66）", [
    N("微信", "微信支付", "你发了一个红包 ¥66.00", 0),
    N("微信", "微信支付", "红包退回 ¥66.00 未领取", -0.1)
  ]);

  /* 2. 群收款/AA 收款到账 */
  scene("2 群收款到账", [
    N("微信", "微信支付", "群收款已到账 ¥50.00 来自 王五", 0)
  ]);

  /* 3. 收款码收款（摆摊/AA 常见） */
  scene("3 收款码收款", [
    N("支付宝", "支付宝", "你收到一笔收款 ¥12.00 付款方 张三", 0)
  ]);

  /* 4. 部分退款（金额和原支出不一样，找不到整笔匹配） */
  scene("4 部分退款 ¥5.00（原支出 38.5）", [
    N("微信", "微信支付", "美团外卖 | 支付成功 ¥38.50", 0),
    N("微信", "微信支付", "部分退款 ¥5.00 美团", -0.1)
  ]);

  /* 5. 优惠券通知（不该记） */
  scene("5 满100减20优惠券", [
    N("淘宝", "淘宝", "你有一张满100减20优惠券待领取", 0)
  ]);

  /* 6. 余额宝转入（自己的钱挪窝） */
  scene("6 转入余额宝 ¥1000", [
    N("支付宝", "支付宝", "转入余额宝成功 ¥1000.00", 0)
  ]);

  /* 7. 信用卡消费短信（银行 App 推送） */
  scene("7 招行信用卡消费", [
    N("招商银行", "招商银行", "您的信用卡尾号1234消费人民币128.00元", 0)
  ]);

  /* 8. 亲属卡消费 */
  scene("8 微信亲属卡消费", [
    N("微信", "微信支付", "亲属卡消费 ¥35.00 商户：永辉超市", 0)
  ]);

  /* 9. 退款到账但金额带千分位 */
  scene("9 大额退款 ¥1,200.00（先买过）", [
    N("微信", "微信支付", "京东商城 | 支付成功 ¥1,200.00", 0),
    N("微信", "微信支付", "退款到账 ¥1,200.00 京东", -0.1)
  ]);

  /* 10. 缴费（水电燃气，运营商） */
  scene("10 水费缴费成功", [
    N("微信", "微信支付", "缴费成功 ¥86.50 缴费项目：水费", 0)
  ]);

  /* 11. 自动续费扣款（视频会员） */
  scene("11 自动续费 腾讯视频会员", [
    N("微信", "微信支付", "自动扣费 ¥30.00 商户：腾讯视频VIP会员", 0)
  ]);

  /* 12. 工资到账（企业微信） */
  scene("12 企业微信代发工资", [
    N("企业微信", "企业微信", "工资已到账 ¥6,500.00", 0)
  ]);

  /* 13. 信用卡分期提醒（没动钱，不该记） */
  scene("13 分期账单提醒", [
    N("招商银行", "招商银行", "您的信用卡10月账单已出，本期应还1280.00元，最低还款128元", 0)
  ]);

  /* 14. 转账被退回 */
  scene("14 转账被对方退回", [
    N("微信", "微信支付", "转账给李四 ¥200.00", 0),
    N("微信", "微信支付", "转账退回 ¥200.00 对方未收取", -0.1)
  ]);

  /* 15. 数字人民币 */
  scene("15 数字人民币消费", [
    N("数字人民币", "数字人民币", "消费支出 ¥23.00 商户：瑞幸咖啡", 0)
  ]);

  /* 16. 同一条通知 App 先后弹两遍但改了几个字（系统重投递） */
  scene("16 微信重投递（文案微差）", [
    N("微信", "微信支付", "支付成功 ¥23.50 收款方 张记麻辣烫", 0),
    N("微信", "微信支付", "微信支付凭证 支付成功 ¥23.50 收款方 张记麻辣烫", -0.05)
  ]);

  return out.join("\n");
})()
