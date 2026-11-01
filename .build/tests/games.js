/* 游戏图标组：手游 / 游戏平台
   用户 2026-10-23 的原话：
     「游戏的图标的app你加上没?」
     「如果没加上的话，把各类大型游戏都加上；如果加上的话，你自己跑一遍看有没有 bug」

   背景：刚给"没有独立 App 的连锁店"补完图标，游戏这块还没动过 ——
   BRANDS 里原本只有「米哈游 / 腾讯游戏 / 网易游戏 / taptap」四个泛品牌，后三个还没图。
   真实账单里出现的是"王者荣耀""原神"这些具体游戏名，所以这一组盯的是：

     A. 各类热门手游认得出来，且**有真图标**（这一轮的核心）
     B. 「腾讯游戏-王者荣耀」这种：具体游戏要压过泛品牌
     C. 全角冒号「崩坏：星穹铁道」、间隔号「光·遇」这些真实写法不能漏
     D. 别名只用全名，不许留「王者」「梦幻」这种两字简称 ——
        街上的「王者通讯」「梦幻照相馆」不能被顶成游戏
     E. 同厂两款游戏不能串（崩坏3 / 崩坏星穹铁道）
     F. 兜底：认不出的游戏照旧走分类图标，不瞎猜 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  function pn(app, text){
    return parseNotify({ app: app, title: "", text: text, ts: Date.now() });
  }
  function bn(r){ var b = brandOf(r); return b ? b.k[0] : "-"; }
  function hasImg(r){ return itemHTML(r).indexOf("has-img") >= 0; }
  function findBrand(name){
    for(var i = 0; i < BRANDS.length; i++){ if(BRANDS[i].k[0] === name) return BRANDS[i]; }
    return null;
  }

  /* 完整的游戏清单（顺序与 BRANDS 里的插入顺序一致，方便对照） */
  var GAMES = ["王者荣耀","和平精英","原神","崩坏星穹铁道","绝区零","崩坏3","未定事件簿",
    "鸣潮","战双帕弥什","明日方舟","光遇","碧蓝航线","蔚蓝档案","尘白禁区","恋与深空","光与夜之恋",
    "无限暖暖","蛋仔派对","元梦之星","第五人格","金铲铲之战","英雄联盟手游","无畏契约","穿越火线",
    "使命召唤手游","三角洲行动","暗区突围","火影忍者","天涯明月刀","逆水寒","永劫无间",
    "明日之后","倩女幽魂","剑网3","燕云十六声","梦幻西游","阴阳师","率土之滨","三国志战略版",
    "三国谋定天下","万国觉醒","部落冲突","皇室战争","荒野乱斗","qq炫舞","qq飞车",
    "欢乐斗地主","欢乐麻将","开心消消乐","球球大作战","迷你世界","我的世界","元气骑士",
    "植物大战僵尸2","羊了个羊"];
  var PLATFORM = ["steam","epic","xbox"];

  try{
    /* ---------- A. 真通知文本 ---------- */
    var a1 = pn("微信", "王者荣耀-点券充值 支付成功 ¥68.00");
    eq("A1 王者荣耀认出来了", bn(a1), "王者荣耀");
    ok("A2 王者荣耀有真图标", hasImg(a1));
    eq("A3 钱从微信出，来源记微信", a1 && a1.from, "微信");
    eq("A4 归到娱乐分类", extractCat("王者荣耀-点券充值 支付成功 ¥68.00"), "fun");

    eq("A5 和平精英", bn(pn("支付宝", "和平精英 点券购买 ¥30.00")), "和平精英");
    eq("A6 原神", bn(pn("微信", "原神-创世结晶 ¥98.00")), "原神");
    eq("A7 蛋仔派对", bn(pn("微信", "蛋仔派对 盲盒 ¥12.00")), "蛋仔派对");
    eq("A8 金铲铲之战", bn(pn("微信", "金铲铲之战 点券 ¥45.00")), "金铲铲之战");
    eq("A9 第五人格", bn(pn("支付宝", "第五人格 ¥6.00")), "第五人格");
    eq("A10 我的世界", bn(pn("微信", "我的世界 minecraft ¥18.00")), "我的世界");
    eq("A11 三角洲行动", bn(pn("微信", "三角洲行动 通行证 ¥68.00")), "三角洲行动");
    eq("A12 无畏契约", bn(pn("微信", "无畏契约 源能行动 ¥88.00")), "无畏契约");
    eq("A13 鸣潮", bn(pn("支付宝", "鸣潮 月相连锁 ¥30.00")), "鸣潮");
    eq("A14 恋与深空", bn(pn("微信", "恋与深空 钻石 ¥88.00")), "恋与深空");
    eq("A15 三国志战略版（没写中点）", bn(pn("微信", "三国志战略版 ¥128.00")), "三国志战略版");
    eq("A16 部落冲突", bn(pn("微信", "部落冲突 宝石 ¥30.00")), "部落冲突");
    eq("A17 欢乐斗地主", bn(pn("微信", "欢乐斗地主 欢乐豆 ¥6.00")), "欢乐斗地主");
    eq("A18 剑网3", bn(pn("微信", "剑网3 通宝 ¥58.00")), "剑网3");
    eq("A19 荒野乱斗", bn(pn("微信", "荒野乱斗 宝石 ¥30.00")), "荒野乱斗");
    eq("A20 倩女幽魂", bn(pn("微信", "倩女幽魂 灵玉 ¥98.00")), "倩女幽魂");

    /* ---------- B. 具体游戏压过泛品牌 ---------- */
    /* 充值中心的账单常写成「腾讯游戏-王者荣耀」，两个品牌都能命中 */
    var b1 = pn("微信", "腾讯游戏-王者荣耀 点券 ¥648.00");
    eq("B1 腾讯游戏下面认到具体那款", bn(b1), "王者荣耀");
    ok("B2 认到的是王者荣耀的图，不是腾讯游戏的色块", hasImg(b1));
    eq("B3 网易游戏下面的逆水寒", bn(pn("微信", "网易游戏-逆水寒 ¥30.00")), "逆水寒");
    eq("B4 米哈游自家的原神（父品牌同样让位）", bn(pn("微信", "米哈游-原神 ¥30.00")), "原神");

    /* ---------- C. 全角冒号 / 间隔号 / 大小写 ---------- */
    eq("C1 崩坏：星穹铁道（全角冒号）", bn(pn("支付宝", "崩坏：星穹铁道 ¥128.00")), "崩坏星穹铁道");
    eq("C2 崩坏星穹铁道（不带冒号）", bn(pn("支付宝", "崩坏星穹铁道 列车补给 ¥30.00")), "崩坏星穹铁道");
    eq("C3 崩铁（玩家真会这么写）", bn(pn("微信", "崩铁 月卡 ¥30.00")), "崩坏星穹铁道");
    eq("C4 光·遇（间隔号）", bn(pn("微信", "光·遇 蜡烛 ¥30.00")), "光遇");
    eq("C5 QQ飞车大小写都认", bn(pn("微信", "QQ飞车 点券 ¥20.00")), "qq飞车");
    eq("C6 云顶之弈（同一家的另一款）", bn(pn("微信", "云顶之弈 ¥45.00")), "金铲铲之战");
    eq("C7 STEAM PURCHASE（全大写英文）", bn(pn("支付宝", "STEAM PURCHASE ¥128.00")), "steam");
    eq("C8 平台：epic", bn(pn("支付宝", "Epic Games ¥59.00")), "epic");
    eq("C9 平台：xbox", bn(pn("支付宝", "Xbox Game Pass ¥68.00")), "xbox");
    eq("C10 平台：taptap", bn(pn("微信", "taptap 充值 ¥18.00")), "taptap");

    /* ---------- E. 同厂两款不能串 ---------- */
    eq("E1 崩坏3 不等于崩坏星穹铁道", bn(pn("微信", "崩坏3 补给卡 ¥30.00")), "崩坏3");
    eq("E2 崩坏：星穹铁道 不等于崩坏3", bn(pn("微信", "崩坏：星穹铁道 星琼 ¥30.00")), "崩坏星穹铁道");
    eq("E3 皇室战争 不等于部落冲突", bn(pn("微信", "皇室战争 宝石 ¥30.00")), "皇室战争");
    eq("E4 部落冲突：皇室战争 归皇室战争", bn(pn("微信", "部落冲突：皇室战争 ¥30.00")), "皇室战争");

    /* ---------- D. 不许用两字通用简称（防止把饭钱认成游戏） ---------- */
    var BAN = ["王者","梦幻","球球","云顶","飞车","暗区","火影","皇室"];
    var bad = [];
    var noLogo = [];
    GAMES.concat(PLATFORM).forEach(function(name){
      var b = findBrand(name);
      if(!b){ bad.push(name + "不在品牌表"); return; }
      if(!LOGOS[name]) noLogo.push(name);
      b.k.forEach(function(k){
        if(BAN.indexOf(k) >= 0) bad.push(name + "用了通用简称:" + k);
      });
      if(String(b.ch || "").length !== 1) bad.push(name + "兜底字不是1个:" + b.ch);
    });
    ok("D1 全部游戏都在品牌表且别名合规", bad.length === 0);
    if(bad.length) log.push("D1detail:" + bad.join("/"));
    ok("D2 每一款都有真图标", noLogo.length === 0);
    if(noLogo.length) log.push("D2detail:" + noLogo.join("/"));

    /* 平台类必须 p:1 + cat:"*"（在哪买的，不是某一类消费） */
    var pbad = [];
    PLATFORM.forEach(function(name){
      var b = findBrand(name);
      if(!b) return;
      if(b.p !== 1) pbad.push(name + "缺 p:1");
      if(b.cat !== "*") pbad.push(name + "cat 不是 *");
    });
    ok("D3 平台类标成 p:1 / cat:*", pbad.length === 0);
    if(pbad.length) log.push("D3detail:" + pbad.join("/"));

    /* 游戏必须是娱乐分类（不然左边图标和右边标签对不上） */
    var cbad = [];
    GAMES.forEach(function(name){
      var b = findBrand(name);
      if(b && b.cat !== "fun") cbad.push(name + "(" + b.cat + ")");
    });
    ok("D4 游戏都挂在娱乐分类下", cbad.length === 0);
    if(cbad.length) log.push("D4detail:" + cbad.join("/"));

    /* 真·误伤回归：这几条都是普通消费，一条都不许被认成游戏 */
    eq("D5 王者通讯（手机店）不是王者荣耀", bn(pn("微信", "王者通讯 话费充值 ¥50.00")), "-");
    eq("D6 梦幻照相馆不是梦幻西游", bn(pn("微信", "梦幻照相馆 证件照 ¥25.00")), "-");
    eq("D7 球球玩具店不是球球大作战", bn(pn("微信", "球球玩具店 ¥18.00")), "-");
    eq("D8 云顶餐厅不是金铲铲", bn(pn("微信", "云顶餐厅 ¥88.00")), "-");
    eq("D9 火影动漫店不是火影忍者", bn(pn("微信", "火影动漫周边 ¥35.00")), "-");

    /* ---------- F. 不认识的照旧不猜 ---------- */
    var f1 = pn("微信", "某小游戏 道具 ¥6.00");
    ok("F1 陌生游戏不硬认成某个牌子", bn(f1) === "-" || bn(f1) === "腾讯游戏");
    eq("F2 但分类还是娱乐（有「游戏」两个字）", extractCat("某小游戏 道具 ¥6.00"), "fun");

    /* ---------- G. 图标数据本身 ---------- */
    var tiny = [];
    GAMES.concat(PLATFORM).forEach(function(name){
      var u = LOGOS[name] || "";
      if(u.indexOf("data:image/jpeg;base64,") !== 0) tiny.push(name + "不是内嵌JPEG");
      else if(u.length < 2500) tiny.push(name + "(仅" + u.length + "字符)");
    });
    ok("G1 图标都是内嵌 JPEG 且不是残图", tiny.length === 0);
    if(tiny.length) log.push("G1detail:" + tiny.join("/"));

    ok("G2 游戏+平台至少 58 个", GAMES.length + PLATFORM.length >= 58);
    ok("G3 图标总数 ≥ 198（141 原有 + 这批）", Object.keys(LOGOS).length >= 198);
    /* taptap 的品牌条目原表里就有，这一轮只给它补图 —— 不能新建第二遍，
       同名两条会有一条永远命不中（fix7 的「没有重复的匹配词」盯的就是这个）。 */
    ok("G4 taptap 只补图、不重复建品牌", (function(){
      var n = 0;
      BRANDS.forEach(function(b){ if(b.k[0] === "taptap") n++; });
      return n === 1 && !!LOGOS["taptap"];
    })());
    /* 「coc」这种两字母别名会抢走 coco（都可奶茶）—— 已经删了，这条守着别再写回来 */
    ok("G5 没有 coc 这类会抢别人名字的超短别名", (function(){
      var bad = [];
      BRANDS.forEach(function(b){
        b.k.forEach(function(k){ if(k === "coc" || k === "cf") bad.push(b.k[0]); });
      });
      return bad.length === 0;
    })());

  }catch(err){
    ok("XX 抛异常:" + (err && err.message), false);
  }

  var fails = log.filter(function(s){ return s[0] === "N"; });
  var detail = log.filter(function(s){ return s[0] !== "Y" && s[0] !== "N"; }).join(" | ");
  var pass = log.filter(function(s){ return s[0] === "Y"; }).length;
  /* 结果文件有长度上限，失败明细必须靠前；但 runtests 靠 "x/y" 这组数字判定，
     所以数字仍打头阵，后面才是明细。 */
  document.title = pass + "/" + log.length +
    (fails.length ? " FAIL:" + fails.join(" | ") + " >> " + detail : " ALL OK");
  /* 不要自己 POST /__result —— 那个文件是 runtests 的 REPORTER 在用，
     两边一起写会把内容变成 JSON 数组，parse_title 直接认不出来（踩过一次）。 */
})();
