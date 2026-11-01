/* fix25：2026-10-24 用户新建账本 / 图标面板的多轮反馈
   ① 新建账本弹窗里图标点不动 —— 根因：点击加的是 .on，样式表里只有 .pick，.on 根本没定义
   ② 图标行和绑定行各放一遍图标，重复 → 合成一行大胶囊
   ③ 行尾「⋯」→ 全部图标面板 → 末尾「＋」用输入法自定义 emoji（customIcons 落库+进备份）
   ④ ⋯胶囊上不带图标；图标库精简且每个带名字；「＋」光杆；输入框没废话提示
   ⑤ 内外对应：面板前 10 个 = 绑定行 10 个分类图标，表情名字一字不差（人情改握手🤝）
   ⑥ 勾选机制：面板里每个图标右上角有圈，勾上自动出现在绑定行（state.pinIcons 落库+进备份）；
      点图标 = 选用 + 自动勾上（修「点了返回外面没显示」）；面板顶部的灰字说明删除 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix25 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }

  setTimeout(function(){
    try{
      /* ===== A. 选中样式真的存在（第一次 bug 的根子，锁死防回归） ===== */
      var hasOn = false;
      for(var i = 0; i < document.styleSheets.length && !hasOn; i++){
        var rules = null;
        try{ rules = document.styleSheets[i].cssRules; }catch(e){ continue; }
        if(!rules) continue;
        for(var j = 0; j < rules.length; j++){
          var t = (rules[j].selectorText || "");
          if(t.indexOf(".cg-mini.on") >= 0) hasOn = true;
        }
      }
      ok("A1 .cg-mini.on 选中样式存在（点得动的根子）", hasOn);

      /* ===== B. 绑定行 = 不绑 + 10 个默认勾选图标 + ⋯ ===== */
      openNewBook();
      var chips = $("nbCats").querySelectorAll("button");
      eq("B1 一行 12 个（不绑 + 10 勾选 + ⋯）", chips.length, 12);
      eq("B2 其中图标胶囊 10 个", $("nbCats").querySelectorAll("[data-icchip]").length, 10);
      ok("B3 行尾有「⋯」换图标入口", !!$("nbMore"));
      ok("B4 默认「不绑」高亮", $("nbCats").querySelector('[data-cat=""]').classList.contains("on"));
      ok("B5 旧的两行图标没了（nbIcons 已删）", !$("nbIcons"));
      ok("B6 大胶囊类挂上了", $("nbCats").querySelector('[data-icchip="🍽️"]').classList.contains("cg-book"));

      /* ===== C. 点图标胶囊 = 图标绑定一起定，且是单选 ===== */
      $("nbCats").querySelector('[data-icchip="🍽️"]').click();
      eq("C1 绑定到餐饮", _nbCat, "food");
      eq("C2 图标就是它", _nbIcon, "🍽️");
      ok("C3 高亮跟着走",
         $("nbCats").querySelector('[data-icchip="🍽️"]').classList.contains("on") &&
         !$("nbCats").querySelector('[data-cat=""]').classList.contains("on"));
      $("nbCats").querySelector('[data-cat=""]').click();
      ok("C4 点不绑：什么都不亮、图标也清空",
         _nbIcon === "" && _nbCat === "" &&
         $("nbCats").querySelector('[data-cat=""]').classList.contains("on") &&
         !$("nbCats").querySelector('[data-icchip="🍽️"]').classList.contains("on"));

      /* ===== D. ⋯ → 图标面板：内外对应 + 勾选圈 ===== */
      $("nbMore").click();
      ok("D1 图标面板打开", $("sheetIcons").classList.contains("on"));
      var n = $("icGrid").querySelectorAll("[data-ic]").length;
      ok("D2 图标库精简过（25~50 个）", n >= 25 && n <= 50);
      eq("D3 加上「＋」正好多一个", $("icGrid").querySelectorAll("button").length, n + 1);
      var noLabel = 0;
      $("icGrid").querySelectorAll("[data-ic]").forEach(function(b){ if(!b.querySelector("em")) noLabel++; });
      ok("D4 每个图标都带名字", noLabel === 0);
      var noCk = 0;
      $("icGrid").querySelectorAll("[data-ic]").forEach(function(b){ if(!b.querySelector(".icck")) noCk++; });
      ok("D5 每个图标右上角都有勾选圈", noCk === 0);
      eq("D6 分类图标默认勾了 10 个", $("icGrid").querySelectorAll(".icck.on").length, 10);
      ok("D7 内外对应：🍜在面板里叫「餐饮」",
         $("icGrid").querySelector('[data-ic="🍽️"] em').textContent === "餐饮");
      ok("D8 人情是握手🤝（不是礼物🎁）",
         $("icGrid").querySelector('[data-ic="🤝"] em').textContent === "人情" &&
         !$("icGrid").querySelector('[data-ic="🎁"]'));
      ok("D9 面板顶部没有灰字说明了", !$("sheetIcons").querySelector(".sh-sub"));
      ok("D10 「＋」就是光杆加号（没有「自己挑」字样）",
         $("icGrid").querySelector("[data-addic]").textContent.indexOf("自己挑") < 0);
      ok("D11 输入行默认藏着（点了＋才出现）", $("icAddRow").style.display === "none");

      /* ===== E. 勾选圈：勾上就出现在外面那行 ===== */
      $("icGrid").querySelector('[data-pin="✈️"]').click();
      ok("E1 勾上✈️后外面那行有了它", !!$("nbCats").querySelector('[data-icchip="✈️"]'));
      eq("E2 pinIcons 记住了", (state.pinIcons || []).indexOf("✈️") >= 0, true);
      $("icGrid").querySelector('[data-pin="✈️"]').click();
      ok("E3 取消勾后外面那行没了它", !$("nbCats").querySelector('[data-icchip="✈️"]'));
      eq("E4 pinIcons 也删掉了", (state.pinIcons || []).indexOf("✈️") < 0, true);

      /* ===== F. 点图标只预选，「确定」才生效，取消当没点 ===== */
      var mv = $("icGrid").querySelector('[data-ic="🎬"]');
      ok("F1 列表里有🎬（电影，默认没勾）", !!mv && !mv.querySelector(".icck").classList.contains("on"));
      mv.click();
      ok("F2 点了只预选：面板还开着、🎬亮着",
         $("sheetIcons").classList.contains("on") &&
         $("icGrid").querySelector('[data-ic="🎬"]').classList.contains("pick"));
      ok("F2b 还没确定，外面那行没有🎬", !$("nbCats").querySelector('[data-icchip="🎬"]'));
      $("icGrid").querySelector('[data-ic="👶"]').click();   // 改主意选娃
      $("icOk").click();                                     // 点确定
      eq("F3 确定后图标用上了", _nbIcon, "👶");
      ok("F4 回到新建面板", $("sheetNewBook").classList.contains("on"));
      ok("F5 外面那行立刻有娃（自动勾上）", !!$("nbCats").querySelector('[data-icchip="👶"]'));
      $("nbMore").click();                                   // 再进面板，试取消
      $("icGrid").querySelector('[data-ic="🎬"]').click();
      $("sheetIcons").querySelector(".btn-ghost").click();   // 取消
      eq("F6 取消后图标还是娃", _nbIcon, "👶");
      ok("F7 外面那行也没有🎬", !$("nbCats").querySelector('[data-icchip="🎬"]'));

      /* ===== G. 「＋」两行添加器（2026-10-31 定版）
         两行（表情 / 文字）+ 每行一个圆圈 + 只有「添加 / 取消」。
         表情 → 图案；文字 → 名字（卡片上印白纸）。 */
      $("nbMore").click();
      $("icGrid").querySelector("[data-addic]").click();
      ok("G1 点＋出现添加器", $("icAddRow").style.display !== "none");
      ok("G2 输入框没有废话提示",
         ($("icAddRow").querySelector('[data-adin="pic"]').placeholder || "") === "");
      ok("G2b 添加时底下的取消/确定藏起来（只剩添加和取消）",
         $("icBtnRow").style.display === "none");
      var gpic = $("icAddRow").querySelector('[data-adin="pic"]');
      gpic.value = "🛸";
      gpic.dispatchEvent(new Event("input"));
      $("icAddRow").querySelector("[data-adok]").click();
      ok("G3 自定义图标入了库", (state.customIcons || []).indexOf("🛸") >= 0);
      ok("G4 添加完面板关了（不拖泥带水）", !$("sheetIcons").classList.contains("on"));
      eq("G5 图标当场就换成它", _nbIcon, "🛸");
      ok("G6 外面那行也挂上了", !!$("nbCats").querySelector('[data-icchip="🛸"]'));
      ok("G7 回到新建面板", $("sheetNewBook").classList.contains("on"));

      /* 汉字 = 名字，不进图案列表 */
      $("nbMore").click();
      $("icGrid").querySelector("[data-addic]").click();
      var gtxt = $("icAddRow").querySelector('[data-adin="txt"]');
      gtxt.focus(); gtxt.value = "美甲"; gtxt.dispatchEvent(new Event("input"));
      $("icAddRow").querySelector("[data-adok]").click();
      ok("G8 汉字不进图案列表", (state.customIcons || []).indexOf("美甲") < 0);
      eq("G9 汉字当名字存着", _nbIcon, "文:美甲");
      eq("G10 图案位让开（卡片印白纸）",
         splitIc(_nbIcon).p, "");

      /* 文字框只收字：粘进来的表情当场被剔掉 */
      $("nbMore").click();
      $("icGrid").querySelector("[data-addic]").click();
      var g2 = $("icAddRow").querySelector('[data-adin="txt"]');
      g2.focus(); g2.value = "🍜家"; g2.dispatchEvent(new Event("input"));
      ok("G11 文字框把表情剔掉，只留字", g2.value === "家");
      $("icAddRow").querySelector("[data-adcancel]").click();

      /* ===== H. 点图标 → 名字自动填上（改不改都行）+ 单选互斥 ===== */
      openNewBook();
      $("nbCats").querySelector('[data-icchip="🚦"]').click();
      eq("H1 点交通名字自动填上", $("nbName").value, "交通");
      $("nbCats").querySelector('[data-icchip="🍽️"]').click();
      eq("H2 自动填的能被下一个分类覆盖", $("nbName").value, "餐饮");
      $("nbName").value = "我的早餐";   // 用户亲手打字
      $("nbName").dispatchEvent(new Event("input"));
      $("nbCats").querySelector('[data-icchip="🚦"]').click();
      eq("H3 用户打过的名字不被覆盖", $("nbName").value, "我的早餐");
      ok("H4 非分类图标不动已选绑定", _nbCat === "transport");
      $("nbCats").querySelector('[data-icchip="👶"]').click();
      ok("H5 点非分类图标：绑定不动、不绑不亮",
         _nbCat === "transport" && !$("nbCats").querySelector('[data-cat=""]').classList.contains("on"));

      /* ===== I. 先来后到：重新勾上的图标排在行尾 ===== */
      $("nbMore").click();
      $("icGrid").querySelector('[data-pin="🍽️"]').click();   // 取消勾餐饮
      $("icGrid").querySelector('[data-pin="🍽️"]').click();   // 再勾回来
      var icchips = $("nbCats").querySelectorAll("[data-icchip]");
      eq("I1 重新勾上的餐饮排在行尾", icchips[icchips.length - 1].dataset.icchip, "🍽️");

      /* ===== J. 建出来 + 落库（含 pinIcons）+ 重启读回 ===== */
      $("icGrid").querySelector('[data-ic="🛸"]').click();
      $("icOk").click();
      $("nbName").value = "测试本";
      createBook();
      eq("I1 账本图标就是自定义那个", state.books[state.books.length - 1].icon, "🛸");
      save();
      var payload = JSON.parse(localStorage.getItem(KEY) || "{}");
      ok("I2 customIcons 落了库", (payload.customIcons || []).indexOf("🛸") >= 0);
      ok("I3 pinIcons 落了库（含👶）", (payload.pinIcons || []).indexOf("👶") >= 0);
      state.customIcons = [];
      load();
      ok("I4 customIcons 重启读得回来", (state.customIcons || []).indexOf("🛸") >= 0);
      ok("I5 pinIcons 重启读得回来", (state.pinIcons || []).indexOf("👶") >= 0);
      var bk = (state.books || []).filter(function(b){ return b.name === "测试本"; })[0];
      ok("I6 账本也读回来了", !!bk && bk.icon === "🛸");

      report();
    }catch(e){
      document.title = "fix25 ERR " + e.message;
    }
  }, 300);
})();
