/* 图标只要 q 版图案，不许把汉字当图标
   ------------------------------------------------------------------
   2026-10-26 用户第一次报：手动记了一笔「喝水 0.20」，左边头像就是一个
   孤零零的「喝」字，问"你就不能搞一个水或者什么好看的图标吗"。
   改成首字 + 词表之后，用户第二次报："图标不要给我直接搞一个大字出来，
   要比较 q 版的图案来代替" —— 于是首字头像整条路删掉，全部走图案表。

   验证点：
     1. 喝水 / 奶茶 / 咖啡 / 饮料 这些词 → 自己的图案
     2. 「水果」不能被当成「喝水」（词表最容易踩的坑）
     3. 学习 / 买书 / 打印资料 → 📖 / 🖨️
     4. 真店名（学校二食堂）也不出汉字，用 🍽️
     5. 19 个常见名字扫一遍，图标里一个汉字都不许有
     6. 有品牌 logo 的（蜜雪冰城）照旧用品牌，词表排在它后面
     7. 「喝水」要能自动归到餐饮，不能落到未分类 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  var _i = 0;
  function rec(o){
    var r = { id: "w" + (++_i), amt: 0.2, type: "expense", cat: "food",
              peer: "", note: "", ts: Date.now(), src: "manual", book: "" };
    for(var k in o) r[k] = o[k];
    return r;
  }

  /* 1.6.90 起分类图标回到 emoji，所以这里直接比方块里那个字符。
     词表（WORD_ICONS）给的 emoji 会被原样显示，不再折算成 SVG。 */
  function hasIcon(h, ch){ return typeof ch === "string" && h.indexOf(ch) >= 0; }

  setTimeout(function(){
    try{
      /* ===== 1. 这些词上图标 ===== */
      var hWater = itemHTML(rec({ peer: "喝水" }));
      ok("喝水用滴水图标", hasIcon(hWater, "💧"));
      ok("喝水不再用「喝」字做头像", hWater.indexOf(">喝<") < 0);
      ok("喝水这行带 emo 类（图标字号放大一档）", hWater.indexOf('class="it-ic emo"') >= 0);

      ok("奶茶用奶茶图标", hasIcon(itemHTML(rec({ peer: "奶茶" })), "🧋"));
      ok("咖啡用咖啡图标", hasIcon(itemHTML(rec({ peer: "咖啡" })), "☕"));
      ok("饮料用饮料图标", hasIcon(itemHTML(rec({ peer: "饮料" })), "🥤"));
      ok("矿泉水也用滴水图标", hasIcon(itemHTML(rec({ peer: "矿泉水" })), "💧"));

      /* ===== 2. 词表边界：别把「水果」当喝水 ===== */
      eq("wordIcon(水果) 是 🍎 而不是 💧", wordIcon("水果"), "🍎");
      eq("wordIcon(喝水杯) 不命中", wordIcon("喝水杯"), "");
      eq("wordIcon(喝水) 命中", wordIcon("喝水"), "💧");
      var hFruit = itemHTML(rec({ peer: "水果", cat: "food" }));
      ok("水果用苹果图标（不是「水」字也不是滴水图标）",
         hasIcon(hFruit, "🍎") && !hasIcon(hFruit, "💧"));

      /* ===== 3. 学习类：书本图案 ===== */
      ok("「学习」用书本图标", hasIcon(itemHTML(rec({ peer: "学习", cat: "study" })), "📖"));
      ok("「买书」用书本图标", hasIcon(itemHTML(rec({ peer: "买书", cat: "study" })), "📖"));
      ok("「打印资料」用打印机图标", hasIcon(itemHTML(rec({ peer: "打印资料", cat: "study" })), "🖨️"));
      eq("wordIcon(学习)", wordIcon("学习"), "📖");

      /* ===== 4. 真店名也不再出汉字，一律图案 ===== */
      var hShop = itemHTML(rec({ peer: "学校二食堂" }));
      ok("「学校二食堂」用餐具图标", hasIcon(hShop, "🍽️"));
      ok("「学校二食堂」不出汉字头像", hShop.indexOf('class="it-ic av"') < 0 && hShop.indexOf(">学</div>") < 0);
      ok("「学校二食堂」没被「水」抢走", !hasIcon(hShop, "💧"));

      /* ===== 5. 一条都不许把汉字当图标（用户 2026-10-26 的硬要求）===== */
      var NAMES = ["喝水", "学习", "学校书店", "学校二食堂", "老张小吃店", "水果",
                   "房租", "话费", "打车", "理发", "猫粮", "便利店", "张三",
                   "李四家的店", "复印", "红烧肉", "买衣服", "看电影", "快递费"];
      var bad = [];
      NAMES.forEach(function(n){
        var h = itemHTML(rec({ peer: n, cat: "food" }));
        var k = h.indexOf('class="it-ic');
        var seg = k < 0 ? "" : h.slice(k, k + 300);
        var icon = seg.indexOf("<img") >= 0 ? "img"
                 : seg.slice(seg.indexOf(">") + 1, seg.indexOf("</div>", seg.indexOf(">")));
        if(!icon) { bad.push(n + "(空)"); return; }
        if(/[\u4e00-\u9fa5]/.test(icon)) bad.push(n + "→" + icon);
      });
      eq("19 个名字的图标里一个汉字都没有", bad.join(","), "");

      /* ===== 6. 有 logo 的品牌排在最前面 ===== */
      var hBrand = itemHTML(rec({ peer: "蜜雪冰城", cat: "food" }));
      ok("蜜雪冰城仍用品牌块", hBrand.indexOf('class="it-ic br') >= 0);

      /* ===== 7. 自动归类：喝水 → 餐饮 ===== */
      eq("「喝水」自动归餐饮", extractCat("喝水", "expense"), "food");
      eq("「奶茶」自动归餐饮", extractCat("奶茶", "expense"), "food");

      document.title = "fix32 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
        " | " + log.join(" | ");
    }catch(e){
      document.title = "fix32 ERR: " + e.message + " | " + log.join(" | ");
    }
  }, 700);
})();
