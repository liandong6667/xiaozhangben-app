/* 左边图标和右边分类标签必须说同一件事
   验证点：
     1. 品牌和分类对得上 → 用品牌图标（雪王 / 拼多多logo）
     2. 品牌和分类对不上 → 退回分类图标（👕 / 💊），不能挂着雪王写「服饰」
     3. 平台类的品牌（淘宝、拼多多、微信）买什么都行，不受分类限制
     4. 还没分类的时候，品牌照常显示
     5. 小店的小字品类词也得跟分类一致，服饰下面不该冒「面食」
     6. 回退时底色用分类色，不是品牌色 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  var _i = 0;
  function rec(o){
    var r = { id: "u" + (++_i), amt: 10, type: "expense", cat: "food",
              peer: "", note: "", ts: Date.now(), src: "notify", book: "" };
    for(var k in o) r[k] = o[k];
    return r;
  }
  /* 2026-10-30：分类图标改成自绘线条 SVG（GL），不再是 emoji。
     这里直接吐渲染用的那段 SVG，断言跟着"渲染出来的是什么"走。 */
  function catIcon(k){ return gicon(k); }

  setTimeout(function(){
    try{
      /* ===== 1. 对得上 → 用品牌 ===== */
      var h1 = itemHTML(rec({ peer: "蜜雪冰城", cat: "food" }));
      ok("餐饮里的蜜雪冰城用品牌块", h1.indexOf('class="it-ic br') >= 0);
      ok("用品牌时不补品类词", h1.indexOf("饮品") < 0);

      /* ===== 2. 对不上 → 退回分类图标 ===== */
      var h2 = itemHTML(rec({ peer: "蜜雪冰城", cat: "cloth" }));
      ok("服饰里的蜜雪冰城不能挂雪王", h2.indexOf('class="it-ic br') < 0);
      ok("退回衣服图标", h2.indexOf(catIcon("cloth")) >= 0);
      ok("右边的分类还是服饰", h2.indexOf("服饰") >= 0);
      ok("也没有雪王那个字", h2.indexOf(">雪<") < 0);
      ok("底色改成分类色", h2.indexOf("#F2A93B") >= 0 || h2.indexOf("242,169,59") >= 0);

      var h3 = itemHTML(rec({ peer: "瑞幸咖啡", cat: "study" }));
      ok("学习里的瑞幸退回书本", h3.indexOf(catIcon("study")) >= 0 && h3.indexOf('class="it-ic br') < 0);

      var h4 = itemHTML(rec({ peer: "美团外卖", cat: "med" }));
      ok("医疗里的美团退回药丸", h4.indexOf(catIcon("med")) >= 0);

      var h5 = itemHTML(rec({ peer: "中国移动", cat: "transport" }));
      ok("交通里的移动退回公交", h5.indexOf(catIcon("transport")) >= 0);

      /* ===== 3. 平台类不受限 ===== */
      var h6 = itemHTML(rec({ peer: "拼多多", cat: "cloth" }));
      ok("拼多多买衣服照样是拼多多", h6.indexOf('class="it-ic br') >= 0);
      var h7 = itemHTML(rec({ peer: "淘宝", cat: "cloth" }));
      ok("淘宝买衣服照样是淘宝", h7.indexOf('class="it-ic br') >= 0);
      var h8 = itemHTML(rec({ peer: "京东", cat: "study" }));
      ok("京东买文具照样是京东", h8.indexOf('class="it-ic br') >= 0);

      /* ===== 4. 还没分类 → 品牌照常 ===== */
      var h9 = itemHTML(rec({ peer: "蜜雪冰城", cat: "" }));
      ok("待分类时品牌还在", h9.indexOf('class="it-ic br') >= 0);
      ok("待分类显示待分类按钮", h9.indexOf("待分类") >= 0);

      /* ===== 5. 品类词也守分类 ===== */
      var h10 = itemHTML(rec({ peer: "老张热干面", cat: "food" }));
      ok("餐饮里补面食", h10.indexOf("面食") >= 0);
      var h11 = itemHTML(rec({ peer: "老张热干面", cat: "cloth" }));
      ok("服饰里不补面食", h11.indexOf("面食") < 0);
      ok("服饰里还是衣服图标", h11.indexOf(catIcon("cloth")) >= 0);

      var h12 = itemHTML(rec({ peer: "学校大药房", cat: "med" }));
      ok("医疗里补药品", h12.indexOf("药品") >= 0);
      var h13 = itemHTML(rec({ peer: "学校大药房", cat: "daily" }));
      ok("日用里不补药品", h13.indexOf("药品") < 0);

      /* ===== 5b. 收入/退款不约束品牌 ===== */
      var h14 = itemHTML(rec({ peer: "美团", cat: "refund", type: "income" }));
      ok("退款那笔仍显示美团", h14.indexOf('class="it-ic br') >= 0);
      ok("退款那笔右边写退款", h14.indexOf("退款") >= 0);
      var h15 = itemHTML(rec({ peer: "蜜雪冰城", cat: "refund", type: "income" }));
      ok("蜜雪退款仍显示雪王", h15.indexOf('class="it-ic br') >= 0);

      /* ===== 6. 品牌表 / 品类词表每一项都写了分类 ===== */
      var noCat = 0, badCat = 0;
      var VALID = { food: 1, daily: 1, transport: 1, study: 1, fun: 1, cloth: 1,
                    med: 1, comm: 1, house: 1, gift: 1, other: 1 };
      BRANDS.forEach(function(b){
        if(!b.cat) noCat++;
        else if(b.cat !== "*" && !VALID[b.cat]) badCat++;
      });
      eq("每条品牌都标了分类", noCat, 0);
      eq("分类名都是真的", badCat, 0);

      var noKindCat = 0;
      KINDS.forEach(function(p){ if(!p[2]) noKindCat++; });
      eq("每条品类词都标了分类", noKindCat, 0);

      /* ===== 7. 全品牌 × 全分类扫一遍 ===== */
      var wrong = [];
      var KEYS = ["food", "daily", "transport", "study", "fun", "cloth", "med", "comm"];
      BRANDS.forEach(function(b){
        KEYS.forEach(function(ck){
          var html = itemHTML(rec({ peer: b.k[0], cat: ck }));
          var usesBrand = html.indexOf('class="it-ic br') >= 0;
          /* 支付渠道（p:2）不靠"商户名"出面：peer 写着"微信"也不算商户，只显示分类图标。
             渠道只在转账 / 红包时出现（brands2 的 D6 专门盯着这条）。
             2026-10-23 用户要求："不能为了懒省事直接都搞成微信的"。 */
          var wantBrand = b.p === 2 ? false : (b.cat === "*" || b.cat === ck);
          if(usesBrand !== wantBrand) wrong.push(b.k[0] + "/" + ck);
          else if(!wantBrand && html.indexOf(catIcon(ck)) < 0) wrong.push(b.k[0] + "/" + ck + "图标");
        });
      });
      eq("全品牌全分类都对得上", wrong.length, 0);

      /* 出错清单放最前面：结果文件有长度上限，放末尾会被截掉，看不到到底哪几个不对 */
      document.title = "fix10 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
        (wrong.length ? " || 错(" + wrong.length + "): " + wrong.slice(0, 10).join(",") : "") +
        " | " + log.join(" | ");
    }catch(e){
      document.title = "fix10 ERR: " + e.message + " | " + log.join(" | ");
    }
  }, 700);
})();
