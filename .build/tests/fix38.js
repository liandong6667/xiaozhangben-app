/* 「更多分类」入口 + 分类面板展开/返回
   ------------------------------------------------------------------
   用户 2026-10-30 原话：
     "你能不能把这个更多分类搞得更明显一点呀？不然用户以为这个地放点不动"

   做法：这一条**从网格下面搬到网格里面**，占第 12 格 ——
     和旁边 11 个分类卡一个形状，实心品牌色 + 白字 + ＋号。
     以前是网格外一条浅虚线透明底，看着像说明文字。

   图标本身在 1.6.90 换回了 emoji（那部分断言在 fix39，别在这儿重复）。
   这里只盯入口和展开/返回的路，以及明细行左右两个图标说的是同一件事。
*/
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }

  setTimeout(function(){
    try{
      var now = Date.now();

      /* 1) 「更多分类」入口：要在网格**里面**，占第 12 格 */
      var rec = {id: "g1", amt: 60, cat: "food", type: "expense", peer: "拌面卤蛋",
                 note: "", ts: now, book: "daily", src: "manual"};
      state.records.unshift(rec);
      openCatFor(rec.id);

      var grid = $("ucBody").querySelector(".ucgrid");
      ok("1有分类网格", !!grid);
      var btns = grid ? grid.querySelectorAll("button") : [];
      eq("1网格里有分类+更多入口", btns.length, catsOf("expense").length + 1);
      var last = btns[btns.length - 1];
      eq("1最后一格是更多分类", last && last.id, "ucMore");
      ok("1它就在网格里面", !!last && last.parentNode === grid);

      /* 外观：实心品牌色 —— 这是"看着能点"的关键，不能退回到透明底 */
      var bgc = window.getComputedStyle ? getComputedStyle(last).backgroundColor : "";
      ok("1是实心底不是透明", /rgb/.test(bgc) && bgc.indexOf("rgba(0, 0, 0, 0)") < 0);
      ok("1带＋号", last && last.querySelector("i") &&
         last.querySelector("i").textContent.indexOf("＋") >= 0);
      var lbl = last ? last.textContent : "";
      ok("1写着更多分类", lbl.indexOf("更多分类") >= 0);
      ok("1白字", /rgb\(255,\s*255,\s*255\)/.test(
        window.getComputedStyle ? getComputedStyle(last.querySelector("b")).color : ""));

      /* 2) 每个分类格子里都有图标（emoji 字符），别出现空白格 */
      var empty = Array.prototype.slice.call(btns).filter(function(b){
        if(b.id === "ucMore") return false;
        var sp = b.querySelector("span");
        return !sp || !String(sp.textContent || "").trim();
      });
      eq("2每格都有图标", empty.length, 0);

      /* 3) 展开：原地换成细分网格，再能返回 */
      ucShowMore();
      ok("3展开后大网格没了", !$("ucBody").querySelector(".ucgrid"));
      ok("3细分盒子出来了", !!$("ucMoreBox"));
      ok("3有返回大类", !!$("ucBack"));
      var chips = $("ucMoreBox").querySelectorAll("[data-uc-sub]");
      ok("3细分按钮不止一个", chips.length > 40);
      var emptyChip = Array.prototype.slice.call(chips).filter(function(b){
        return !String(b.textContent || "").trim();
      });
      eq("3细分每格都有图标", emptyChip.length, 0);
      /* 分组标题（餐饮 / 日用…）也要在 */
      ok("3有分组标题", $("ucMoreBox").querySelectorAll(".sub-t").length >= 8);

      /* 4) 点一个细分：能选中并写进记录 */
      var chipFood = Array.prototype.slice.call(chips).filter(function(b){
        return b.getAttribute("data-uc-sub") === "coffee";
      })[0];
      ok("4有咖啡细分", !!chipFood);
      if(chipFood){
        chipFood.click();
        var rr = state.records.filter(function(x){ return x.id === "g1"; })[0];
        eq("4点了咖啡就记成咖啡", rr && rr.sub, "coffee");
        eq("4主分类还是餐饮", rr && rr.cat, "food");
      }

      /* 5) 返回 */
      closeSheets();
      openCatFor("g1");
      ucShowMore();
      $("ucBack").onclick();
      ok("5返回后网格回来了", !!$("ucBody").querySelector(".ucgrid"));
      ok("5返回后更多入口也回来", !!$("ucMore"));

      /* 6) 明细行：左边大方块和右边小胶囊用同一个图案 */
      closeSheets();
      var r2 = {id: "g2", amt: 23, cat: "food", type: "expense", peer: "麻辣烫",
                note: "", ts: now, book: "daily", src: "manual"};
      r2.sub = subGuess(r2.peer, r2.cat);
      var h = itemHTML(r2);
      ok("6行里有图标方块", h.indexOf('class="it-ic') > 0);
      ok("6行里没有空的图标", h.indexOf("undefined") < 0);
      var pillIcon = h.indexOf("火锅") >= 0 || h.indexOf("🍲") >= 0;
      ok("6麻辣烫认成火锅/菜品一类", pillIcon);

      var bads = log.filter(function(x){ return x.charAt(0) === "N"; });
      document.title = "fix38 " + (log.length - bads.length) + "/" + log.length + " " +
        (bads.length ? bads.join(",") : "");
    }catch(err){
      document.title = "fix38 ERR " + (err && err.message);
    }
  }, 900);
})();
