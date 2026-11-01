/* 分类图标回到 emoji（1.6.90 定版）
   ------------------------------------------------------------------
   用户 2026-10-30 深夜最后一句话：
     "把分类图标换回最开始的版本吧,只不过要加个西餐和其他没有的,
      然后记录机制用最新的就行"

   中间试过两版自绘图标：1.6.87 的细线条、1.6.89 的「彩色实心圆 + 白图标」，
   用户都不满意。定版是 emoji —— 小尺寸下自带颜色和体积感，比线条好认。

   换回去时**必须守住**的两件事（否则又回到"这有些长得都一样"）：
     ① 大类 emoji 不能和它自己的细分撞衫（餐饮🍽️ / 面食🍜 以前都是 🍜）；
     ② 55 个细分之间不能有重复的 emoji。
   还有：后来新加的细分（西餐/菜品/夜宵/外卖/早餐…）一个都不能丢。
*/
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }

  setTimeout(function(){
    try{
      var now = Date.now();

      /* 1) gicon 现在返回 emoji 字符，不再产 svg */
      var hCoffee = gicon("coffee");
      eq("1咖啡是emoji", hCoffee, "☕");
      ok("1不再是svg", hCoffee.indexOf("<svg") < 0);
      ok("1长度很短", hCoffee.length <= 12);   // 组合 emoji（🍽️）会到 4~7 个码元

      /* 2) 17 个大类各有 emoji，且互不相同 */
      var missCat = CATS.filter(function(c){ return !c.e; }).map(function(c){ return c.k; });
      eq("2大类都有emoji", missCat.join(","), "");
      var catEmo = {};
      CATS.forEach(function(c){ (catEmo[c.e] = catEmo[c.e] || []).push(c.n); });
      var dupCat = Object.keys(catEmo).filter(function(e){ return catEmo[e].length > 1; })
        .map(function(e){ return e + ":" + catEmo[e].join("/"); });
      eq("2大类emoji不重复", dupCat.join(","), "");

      /* 3) 55 个细分各有 emoji，且互不相同 —— 撞衫就是"长得都一样"的根源 */
      eq("3细分总数", SUBS.length, 55);
      var missSub = SUBS.filter(function(s){ return !s.e; }).map(function(s){ return s.k; });
      eq("3细分都有emoji", missSub.join(","), "");
      var subEmo = {};
      SUBS.forEach(function(s){ (subEmo[s.e] = subEmo[s.e] || []).push(s.n); });
      var dupSub = Object.keys(subEmo).filter(function(e){ return subEmo[e].length > 1; })
        .map(function(e){ return e + ":" + subEmo[e].join("/"); });
      eq("3细分emoji不重复", dupSub.join(","), "");

      /* 4) 大类不能和自己的细分撞衫（用户就是在分类面板里同时看到它们） */
      var clash = [];
      CATS.forEach(function(c){
        subsOf(c.k).forEach(function(s){
          if(s.e === c.e) clash.push(c.n + "=" + s.n);
        });
      });
      eq("4大类不和自己的细分撞", clash.join(","), "");

      /* 5) 后来的新细分一个都不能丢 */
      ["west", "dish", "night", "takeout", "breakfast", "bbq", "noodle"].forEach(function(k){
        ok("5留着" + k, !!SUB_MAP[k] && !!SUB_MAP[k].e);
      });
      eq("5西餐的emoji", (SUB_MAP.west || {}).e, "🍴");

      /* 6) 分类面板里每格都真的渲染出一个字符（不是空的、不是 undefined） */
      var rec = {id: "c2", amt: 60, cat: "food", type: "expense", peer: "拌面卤蛋",
                 note: "", ts: now, book: "daily", src: "manual"};
      state.records.unshift(rec);
      openCatFor(rec.id);
      var grid = $("ucBody").querySelector(".ucgrid");
      var btns = grid ? Array.prototype.slice.call(grid.querySelectorAll("button")) : [];
      ok("6大类格子有12格", btns.length === 12);
      var badGrid = btns.filter(function(b){
        if(b.id === "ucMore") return false;              // 这一格是＋号，不是图标
        var sp = b.querySelector("span");
        var t = sp ? String(sp.textContent || "").trim() : "";
        return !t || t === "undefined" || t === "null";
      });
      eq("6大类格子都有图标", badGrid.length, 0);

      /* 7) 细分面板同样，而且不能出现 URL/路径/emoji 名 */
      ucShowMore();
      var chips = Array.prototype.slice.call($("ucMoreBox").querySelectorAll("[data-uc-sub]"));
      ok("7细分面板有胶囊", chips.length > 40);
      var badChip = chips.filter(function(b){
        var t = String(b.textContent || "").replace(b.getAttribute("data-uc-sub"), "").trim();
        return !t || /undefined|null|&lt;|&amp;/.test(t);
      });
      eq("7细分胶囊都有图标", badChip.length, 0);
      closeSheets();

      /* 8) emoji 来自用户输入时也要转义，不能原样进 innerHTML */
      var evil = gicon("", "<img src=x onerror=alert(1)>");
      ok("8用户输入被转义", evil.indexOf("<img") < 0 && evil.indexOf("&lt;img") === 0);
      eq("8空值返回空串", gicon("", ""), "");
      eq("8未知key走兜底", gicon("unknown"), "❓");

      /* 9) 火锅仍然是自绘的老式铜锅 —— 这条是用户专门要求做的，别被换回来时顺手删掉。
            它走 wordIcon 直接用，不经过 gicon。 */
      ok("9火锅有自绘铜锅", typeof HOTPOT_SVG === "string" &&
         HOTPOT_SVG.indexOf("<svg") === 0 && HOTPOT_SVG.length > 100);
      eq("9火锅词命中共用一张图", wordIcon("火锅"), wordIcon("铜锅涮肉"));
      ok("9火锅词命中铜锅", wordIcon("火锅") === HOTPOT_SVG);

      /* 10) 明细行左边那块仍然是 41px 方块 + 一个字符，不是 svg 线条 */
      var r1 = {id: "z1", amt: 9, cat: "food", sub: "coffee", type: "expense",
                peer: "瑞幸咖啡", note: "", ts: now, book: "daily", src: "manual"};
      var h1 = itemHTML(r1);
      ok("10明细行有图标类", h1.indexOf('class="it-ic') > 0);
      ok("10明细行不再塞线条svg", h1.indexOf('class="gi"') < 0);
      ok("10明细行有咖啡emoji", h1.indexOf("☕") > 0);

      var bads = log.filter(function(x){ return x.charAt(0) === "N"; });
      document.title = "fix39 " + (log.length - bads.length) + "/" + log.length + " " +
        (bads.length ? bads.join(",") : "");
    }catch(err){
      document.title = "fix39 ERR " + (err && err.message);
    }
  }, 900);
})();
