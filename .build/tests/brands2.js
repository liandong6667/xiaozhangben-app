/* 商户识别第二组：小程序 / 平台下的具体店 / 不知道不猜
   用户 2026-10-23 的原话：
     「像微信小程序这种的你也要记录一下，不能为了懒省事直接都搞成微信的，
       我的目的是为了方便用户，但是你不知道的就一定不要猜。」

   这一组盯的就是这三句话，逐条钉死：
     A. 通知里写了小程序名 → 记小程序名（不是"微信"）
     B. 通知里既写平台又写店名 → 记店名（美团里的蜜雪要显示蜜雪）
     C. 只写平台没写店名 → 记平台，不编店名
     D. 什么都不知道 → "一笔支出" + 分类图标，绝不显示微信头像
     E. 品牌表本身：cat 合法、字不长、平台排在店后面、没有容易误伤的短关键词 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  function pn(app, text, title){
    return parseNotify({ app: app, title: title || "", text: text, ts: Date.now() });
  }
  function ch(r){ var b = brandOf(r); return b ? b.ch : "-"; }

  try{
    /* ---------- A. 小程序 ---------- */
    /* 微信里点蜜雪小程序，通知正文真写着"蜜雪冰城小程序" */
    var a1 = pn("微信", "蜜雪冰城小程序 | 支付成功 ¥9.90", "微信支付");
    ok("A1 小程序通知被解析出来了", !!a1);
    eq("A2 商户是小程序名，不是微信", a1 && a1.peer, "蜜雪冰城");
    eq("A3 来源仍然是微信（钱从哪出的）", a1 && a1.from, "微信");
    eq("A4 小程序的品牌认得出来", ch(a1), "雪");

    /* 小程序名写在后面：「小程序：古茗 支付成功」 */
    var a2 = pn("微信", "小程序：古茗 支付成功 ¥12.00");
    eq("A5 名字在小程序后面也能抓", a2 && a2.peer, "古茗");

    /* 小程序是我们不认识的店：记名字，但**不给品牌图标**（不乱认） */
    var a3 = pn("微信", "「校园洗衣」小程序 支付成功 ¥3.00");
    eq("A6 陌生小程序也记下名字", a3 && a3.peer, "校园洗衣");
    eq("A7 陌生小程序不猜品牌", ch(a3), "-");

    /* 只提到"微信小程序"四个字、没有店名：不能把"微信"当商户 */
    var a4 = pn("微信", "微信小程序 支付成功 ¥5.00");
    ok("A8 抽不出名字时不硬凑", a4 && a4.peer !== "微信");
    eq("A9 抽不出来就留在兜底词上", a4 && a4.peer, "一笔支出");

    /* ---------- B/C. 平台与平台里的店 ---------- */
    var b1 = pn("美团", "蜜雪冰城(万达店) 订单已支付 ¥15.00");
    eq("B1 美团里点的蜜雪记成蜜雪", b1 && b1.peer, "蜜雪冰城");
    eq("B2 图标也是蜜雪", ch(b1), "雪");
    eq("B3 来源记美团（在哪下的单）", b1 && b1.from, "美团");

    var b2 = pn("美团外卖", "支付成功 ¥30.00");
    eq("B4 只写平台就老实记平台", b2 && b2.peer, "美团");
    eq("B5 平台自己的图标照常显示", ch(b2), "美");

    var b3 = pn("淘宝", "安踏官方旗舰店 交易成功 ¥299.00");
    eq("B6 淘宝里的安踏记成安踏", b3 && b3.peer, "安踏");
    eq("B7 安踏的图标对得上", ch(b3), "安");

    var b4 = pn("淘宝", "交易成功 ¥58.00");
    eq("B8 淘宝只写自己时记淘宝", b4 && b4.peer, "淘宝");

    /* 平台 + 平台：手机充值这种「支付宝给移动交话费」，不该被升级成别的东西 */
    var b5 = pn("支付宝", "中国移动 话费充值 成功 ¥30.00");
    eq("B9 给移动交话费记移动", b5 && b5.peer, "中国移动");

    /* ---------- D. 不知道就不猜 ---------- */
    var d1 = pn("微信", "你已支付 ¥12.00");
    eq("D1 不知道商户就是一笔支出", d1 && d1.peer, "一笔支出");
    eq("D2 不知道就不给微信头像", ch(d1), "-");
    ok("D3 但来源照记，用户知道钱是从微信出的", d1 && d1.from === "微信");

    var d2 = pn("微信支付", "你已支付 ¥8.00 收款方：老张热干面");
    eq("D4 抓到商户名就用商户名", d2 && d2.peer, "老张热干面");
    eq("D5 小店不给品牌图标", ch(d2), "-");

    /* 转账/红包：这里"微信"本身就是准确信息，仍然该显示 */
    var d3 = { peer: "张三", note: "微信支付 你已成功转账给张三 ¥100.00", from: "微信", type: "expense", cat: "other" };
    eq("D6 转账给个人仍显示微信", ch(d3), "微");
    /* 但"转账给李宁"不能因为有个运动品牌叫李宁就贴李宁的头像 */
    var d4 = { peer: "李宁", note: "微信 转账给李宁 ¥200.00", from: "微信", type: "expense", cat: "other" };
    eq("D7 转账给同名的人不贴品牌", ch(d4), "微");

    /* 容易误伤的短词：备注里出现"小米辣""红旗路"，不能认成小米/红旗 */
    var d5 = { peer: "老王炒菜", note: "小米辣炒肉 一份", from: "", type: "expense", cat: "food" };
    eq("D8 小米辣不算小米", ch(d5), "-");
    var d6 = { peer: "红旗路便利店", note: "买水 ¥3.00", from: "", type: "expense", cat: "daily" };
    eq("D9 红旗路不算红旗连锁", ch(d6), "-");

    /* ---------- E. 品牌表自检 ---------- */
    var CATS = { food: 1, daily: 1, transport: 1, study: 1, fun: 1, cloth: 1, med: 1, comm: 1, house: 1, social: 1, other: 1, "*": 1 };
    var badCat = BRANDS.filter(function(b){ return !CATS[b.cat]; });
    eq("E1 每个品牌都写了合法分类", badCat.length, 0);
    var badCh = BRANDS.filter(function(b){ return !b.ch || b.ch.length > 2; });
    eq("E2 图标字 1~2 个字符", badCh.length, 0);
    var shortK = [];
    BRANDS.forEach(function(b){
      b.k.forEach(function(k){ if(k.length < 2) shortK.push(k); });
    });
    eq("E3 没有单字关键词（最容易误伤）", shortK.length, 0);

    /* 顺序：所有具体商家都必须排在第一个电商平台（美团）之前，否则美团会盖住蜜雪。
       顶部那两个校园平台（慧生活798 / 完美校园）不在这个约束里 ——
       它们没有"平台下的连锁店"这层关系，放最前面是为了先认出"这是校园消费"。 */
    var idxMeituan = -1, firstPlat = -1;
    BRANDS.forEach(function(b, i){
      if(b.k[0] === "美团") idxMeituan = i;
      if(firstPlat < 0 && b.p === 1) firstPlat = i;
    });
    var shopAfter = BRANDS.filter(function(b, i){ return !b.p && i > idxMeituan; });
    eq("E4 美团之前不许夹具体商家（否则蜜雪会被美团盖掉）", shopAfter.length, 0);
    ok("E5 第一个平台在很前面（校园类先认）", firstPlat < 3);

    /* 渠道必须真的垫底 */
    var tail = BRANDS.slice(-4).filter(function(b){ return b.p === 2; });
    eq("E6 最后四个就是支付渠道", tail.length, 4);
    ok("E7 渠道里没有夹具体店", BRANDS[BRANDS.length - 1].p === 2);

    /* 慧生活798：校园消费平台，必须有它自己的一格（图标拿得到就用真图） */
    var hui = BRANDS.filter(function(b){ return b.k[0] === "慧生活798"; });
    eq("E8 慧生活798 在品牌表里", hui.length, 1);
    eq("E9 慧生活798 归为平台（不知道具体档口时不冒充）", hui[0] && hui[0].p, 1);

    /* ---------- F. LOGOS 表自检 ----------
       2026-10-23 用户："像古茗、霸王茶姬这种大型连锁店，虽然没有自带 App，
       但你也要拿到 logo 图案或图标呀，灵活一点！"
       于是图标来源从「只认 App Store」扩到「图片搜索 + 官网 favicon + 小程序」。
       来源一多就容易出三种事故，这里各钉一条：
         F1 写了个 BRANDS 里没有的键 —— 图存进去了但永远不显示（静默白干）
         F2 存了半截/空白图 —— 那格会变成一块糊
         F3 后来有人重跑 embed.py 把非 App Store 的图洗掉 —— 连锁店集体退回字块 */
    var LOGOS_ = (typeof LOGOS !== "undefined") ? LOGOS : {};
    var heads = {};
    BRANDS.forEach(function(b){ heads[b.k[0]] = 1; });
    var orphan = Object.keys(LOGOS_).filter(function(k){ return !heads[k]; });
    eq("F1 LOGOS 没有 BRANDS 里不存在的键", orphan.length, 0);

    var thin = Object.keys(LOGOS_).filter(function(k){
      var v = LOGOS_[k];
      return !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]{800,}$/.test(v);
    });
    eq("F2 每个图标都是完整的内嵌图", thin.length, 0);

    /* 这些是"没有独立 App、只有小程序/门店"的连锁，全部必须有图。
       漏一个就意味着用户在这家店消费时看到的是一块纯色字块。 */
    var NOAPP = ["古茗","茶百道","沪上阿姨","茶颜悦色","书亦烧仙草","益禾堂","快乐柠檬",
                 "7分甜","华莱士","塔斯汀","张亮麻辣烫","杨国福","周黑鸭","煌上煌",
                 "85度c","鲍师傅","爸爸糖","名创优品","美宜佳","唐久","南城香",
                 "紫燕百味鸡","九毛九","和府捞面","萨莉亚","胖东来"];
    var miss = NOAPP.filter(function(k){ return !LOGOS_[k]; });
    eq("F3 没 App 的连锁店也有图", miss.length, 0);
    ok("F4 图库够厚（≥120）", Object.keys(LOGOS_).length >= 120);

    var bad = log.filter(function(s){ return s[0] === "N"; });
    document.title = "brands2 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
      " || " + (bad.length ? "FAIL: " + bad.join(" | ") + " || " : "") + log.join(" ");
  }catch(e){
    document.title = "brands2 ERROR: " + e.message;
  }
})();
