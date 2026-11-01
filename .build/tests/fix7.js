/* 商户头像：连锁/平台用品牌色块，小商户保留分类图标 + 品类词
   验证点：
     1. 认得出的大品牌都显示对（蜜雪/古茗/美团/拼多多/淘宝/得物/微信）
     2. 美团里点的蜜雪冰城，显示蜜雪冰城而不是美团
     3. 街边小店（老张热干面、学校二食堂）不给品牌，保持分类图标
     4. 小商户的通知里含"微信支付"也不会被顶成微信头像（这是最容易踩的坑）
     5. 微信转账这种没有商户名的，才显示微信
     6. 小字里补品类词（面食/食堂/理发）
     7. 品牌表本身没写错（有颜色、字不长、渠道垫底） */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  function rec(o){
    var r = { id: "t" + (rec._i = (rec._i || 0) + 1), amt: 10, type: "expense",
              cat: "food", peer: "", note: "", ts: Date.now(), src: "notify", book: "" };
    for(var k in o) r[k] = o[k];
    return r;
  }
  function ch(r){
    var b = brandOf(r);
    return b ? b.ch : "-";
  }

  try{
    /* ===== 1. 大品牌直接认 ===== */
    eq("蜜雪冰城", ch(rec({ peer: "蜜雪冰城" })), "雪");
    eq("古茗", ch(rec({ peer: "古茗" })), "古");
    eq("美团", ch(rec({ peer: "美团" })), "美");
    eq("拼多多", ch(rec({ peer: "拼多多" })), "拼");
    eq("淘宝", ch(rec({ peer: "淘宝" })), "淘");
    eq("得物", ch(rec({ peer: "得物" })), "得");
    eq("京东", ch(rec({ peer: "京东" })), "京");
    eq("瑞幸", ch(rec({ peer: "瑞幸咖啡" })), "瑞");
    eq("星巴克", ch(rec({ peer: "星巴克" })), "星");
    eq("肯德基", ch(rec({ peer: "肯德基" })), "K");
    eq("麦当劳", ch(rec({ peer: "麦当劳" })), "M");
    eq("饿了么", ch(rec({ peer: "饿了么" })), "饿");
    eq("滴滴", ch(rec({ peer: "滴滴出行" })), "滴");

    /* ===== 2. 平台上点的连锁，连锁优先 ===== */
    eq("美团里的蜜雪显示蜜雪",
       ch(rec({ peer: "美团外卖", note: "您的外卖已送达 蜜雪冰城（万达店）", from: "美团" })), "雪");
    eq("淘宝里的古茗显示古茗",
       ch(rec({ peer: "淘宝", note: "古茗奶茶 一杯 已发货", from: "淘宝" })), "古");
    // 只是美团本身（没提到具体哪家）还是显示美团
    eq("纯美团还是美团",
       ch(rec({ peer: "美团外卖", note: "您的外卖订单已送达", from: "美团" })), "美");

    /* ===== 3. 小店不给品牌 ===== */
    ok("热干面无品牌", brandOf(rec({ peer: "老张热干面", note: "微信支付 你已支付 ¥9.00 收款方：老张热干面" })) === null);
    ok("食堂无品牌", brandOf(rec({ peer: "学校二食堂", note: "微信支付 你已支付 ¥14.00" })) === null);
    eq("食堂品类", kindOf(rec({ peer: "学校二食堂" })), "食堂");
    eq("热干面品类", kindOf(rec({ peer: "老张热干面" })), "面食");
    eq("理发店品类", kindOf(rec({ peer: "小王理发店" })), "理发");
    eq("奶茶店品类", kindOf(rec({ peer: "街角奶茶铺" })), "饮品");
    eq("药房品类", kindOf(rec({ peer: "同仁大药房" })), "药品");

    /* ===== 4. 关键回归：渠道词不许冒充品牌 ===== */
    ok("小商户通知含微信也不变微信",
       brandOf(rec({ peer: "学校二食堂", note: "微信支付 你已支付 ¥14.00 收款方：学校二食堂", from: "微信" })) === null);
    ok("小商户通知含支付宝也不算支付宝",
       brandOf(rec({ peer: "楼下水果摊", note: "支付宝 付款成功 ¥8.00", from: "支付宝" })) === null);
    // 但 stripChannel 只挖渠道词，不能把真品牌一起挖掉
    eq("挖掉渠道后仍认得出蜜雪",
       stripChannel("微信支付 蜜雪冰城 ¥6.00").indexOf("蜜雪冰城") >= 0, true);

    /* ===== 5. 只有转账/兜底时渠道才出面 ===== */
    eq("微信转账给张三", ch(rec({ peer: "张三", note: "微信支付 你已成功转账给张三 ¥100.00", from: "微信" })), "微");
    eq("发红包", ch(rec({ peer: "相亲相爱一家人", note: "微信支付 你已发出红包 ¥50.00", from: "微信" })), "微");
    /* 2026-10-23 改了：连"根本不知道商户"这种情况也不再用渠道头像。
       用户原话「不能为了懒省事直接都搞成微信的」—— 满屏微信头像会让人以为
       钱都花在微信上。现在认不出就回分类图标（iconHTML 里 c.e 那个 emoji）。
       转账/红包仍然显示渠道，因为那时候"微信"本身就是准确信息。 */
    ok("一笔支出+微信 不再顶成微信头像", brandOf(rec({ peer: "一笔支出", note: "你已支付 ¥12.00", from: "微信" })) === null);
    ok("一笔支出+支付宝 也不再顶成支付宝", brandOf(rec({ peer: "一笔支出", note: "付款成功 ¥12.00", from: "支付宝" })) === null);
    // 普通商户名 + from=微信，不该变成微信头像
    ok("有商户名就不退化成微信",
       brandOf(rec({ peer: "王记小炒", note: "你已支付 ¥22.00", from: "微信" })) === null);

    /* ===== 6. 退款也认品牌 ===== */
    eq("退款来自拼多多", ch(rec({ type: "income", cat: "refund", peer: "拼多多", note: "退款到账 ¥29.90", from: "拼多多" })), "拼");

    /* ===== 7. 渲染出来的 HTML ===== */
    var r1 = rec({ peer: "蜜雪冰城", note: "微信支付 ¥6.00" });
    var h1 = itemHTML(r1);
    ok("有图品牌加 has-img 类", h1.indexOf('class="it-ic br has-img"') >= 0);
    ok("品牌块有渐变底当垫底", h1.indexOf("linear-gradient(145deg,#F5453F,#D8140F)") >= 0);
    ok("有图就不写字，直接上 img", h1.indexOf('<img src="data:image/jpeg;base64,') >= 0 && h1.indexOf(">雪<") < 0);
    var r2 = rec({ peer: "老张热干面", note: "收款 ¥9.00" });
    var h2 = itemHTML(r2);
    /* 没收录 logo 的小店：用图案，不放汉字，也不放占位符
       （1.6.52 曾用店名首字做头像，2026-10-26 用户明确改成 q 版图案） */
    ok("小店用图案（emo 号），不是品牌块也不再用汉字头像",
       h2.indexOf('class="it-ic emo"') >= 0 && h2.indexOf('class="it-ic av"') < 0 && h2.indexOf("it-ic br") < 0);
    /* 没细分时挂的是**大类**图案（餐饮的碗），以前 food 和 noodle 的 emoji 都是 🍜
         分不出来，现在碗和面碗是两张图，这里跟着大类走。 */
    ok("小店图标是餐饮碗，不是「老」", h2.indexOf(gicon("food")) >= 0 && h2.indexOf(">老</div>") < 0);
    ok("小店小字有面食", h2.indexOf("面食") >= 0);
    var r3 = rec({ peer: "美团外卖", note: "黄焖鸡米饭 ¥21.00", cat: "food" });
    var h3 = itemHTML(r3);
    ok("美团也走图片", h3.indexOf("has-img") >= 0);
    /* 没有官方图的品牌必须退回字块，不能出空 img。
       注意：**别写死"哪家没图"**。1.6.30 给华莱士、古茗、茶百道这些补了图，
       原来写死"华莱士没图"的断言当场就错了 —— 补充图标本来就是要它变成有图。
       所以这里扫整张品牌表，只钉两条不会被时间推翻的不变式：
         · 有图 → src 必须是完整的 base64（不许半截、不许空串）
         · 没图 → 必须吐出品牌那个字，不许留一个空壳方块 */
    var imgEmpty = [], noFallback = [];
    BRANDS.forEach(function(b){
      if(b.p === 2) return;                       // 渠道只在转账红包时出面，另有专门断言
      var cat = (b.cat === "*") ? "food" : b.cat; // 用品牌自己的分类，否则会被"图标要和分类对得上"拦掉
      var h = itemHTML(rec({ peer: b.k[0], cat: cat, note: "微信支付 ¥18.00" }));
      if(h.indexOf("has-img") >= 0){
        if(!/src="data:image\/(jpeg|png);base64,[A-Za-z0-9+\/=]{800,}"/.test(h)) imgEmpty.push(b.k[0]);
      }else if(!/class="it-ic[^"]*"[^>]*>(?:[^<]|<svg)/.test(h)){
        /* 2026-10-26 起，没收录 logo 的品牌退回**分类图案**（不再吐品牌首字）；
           图案的形式变过三次（emoji → 线条 svg → 彩色圆点 → emoji），
           所以这里不再认某一种具体写法，只认「方块里确实有东西」：
           emoji 是文本节点，自绘的火锅是一段 <svg>，两种都算数。 */
        noFallback.push(b.k[0]);
      }
    });
    eq("有图就必须真有图（不许空 img）", imgEmpty.length, 0);
    eq("没图就一定吐图案（不许空白格）", noFallback.length, 0);

    /* ===== 8. 品牌表本身体检 ===== */
    var badColor = BRANDS.filter(function(b){ return !b.c1 || !b.c2; });
    eq("每个品牌都有两个色", badColor.length, 0);
    var badCh = BRANDS.filter(function(b){ return !b.ch || b.ch.length > 2; });
    eq("图标字不超过2字符", badCh.length, 0);
    var badKey = BRANDS.filter(function(b){ return !b.k || !b.k.length; });
    eq("每个品牌都有匹配词", badKey.length, 0);
    var chans = BRANDS.slice(-4).map(function(b){ return b.ch; }).join("");
    eq("渠道垫底", chans, "微支云银");
    ok("品牌数量够用", BRANDS.length >= 50);
    // 重复匹配词会让后写的那个永远命中不了
    var seen = {}, dup = [];
    BRANDS.forEach(function(b){ b.k.forEach(function(k){ if(seen[k]) dup.push(k); seen[k] = 1; }); });
    eq("没有重复的匹配词", dup.length, 0);

    /* ===== 9. LOGOS 表体检（官方图标的 base64） ===== */
    ok("LOGOS 存在", typeof LOGOS === "object" && LOGOS !== null);
    var lk = Object.keys(LOGOS);
    ok("图标数量像样", lk.length >= 40);
    /* png 也允许：淘宝那张换成了真·logo 的圆角 png（2026-10-25），
       断言别写死 jpeg —— 要挡的是"不是图片"和"不是 base64"，不是格式 */
    var badPrefix = lk.filter(function(k){ return !/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(LOGOS[k]); });
    eq("全是 base64 图片", badPrefix.length, 0);
    var tooSmall = lk.filter(function(k){ return LOGOS[k].length < 800; });
    eq("没有空图/坏图", tooSmall.length, 0);
    /* LOGOS 的键必须是某个 BRANDS 条目 k[0]，否则这张图永远显示不出来 */
    var prim = {};
    BRANDS.forEach(function(b){ prim[b.k[0]] = 1; });
    var orphan = lk.filter(function(k){ return !prim[k]; });
    eq("没有对不上品牌的孤儿图", orphan.length, 0);
    /* 反过来：有图的品牌，brandOf 必须能认出来，不然也是死图 */
    var dead = lk.filter(function(k){
      var b = matchBrand(k);
      return !b || b.k[0] !== k;
    });
    eq("每张图都能被识别到", dead.length, 0);

    /* 失败的放最前面：结果文件有长度上限，以前失败项被截在后面根本看不到。 */
    var bad = log.filter(function(s){ return s[0] === "N"; });
    document.title = "fix7 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
      " || " + (bad.length ? "FAIL: " + bad.join(" | ") + " || " : "") + log.join(" ");
  }catch(e){
    document.title = "fix7 ERROR: " + e.message;
  }
})();
