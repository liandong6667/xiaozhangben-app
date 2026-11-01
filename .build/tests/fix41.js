/* fix41：图标 = 两行添加器（2026-11-01 定版）
   用户原话：「这个表情和文字都可以填，然后填完之后排版搞成上边那样子的，
   就是上边图案下边文字，但是用户也可以选择不把图案和文字都填完，
   文字没填你就将文字默认成未命名，没写图案的话…（白纸）」。
   所以这一版验的是：
     ① 两行都能填，也能只填一行、也能只填另一行；
     ② 图标位是「图案在上、文字在下」；
     ③ 少文字 → 列表里叫「未命名」；少图案 → 印一张白文件纸。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix41 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }
  function fire(el){ el.dispatchEvent(new Event("input")); }

  setTimeout(function(){
    try{
      localStorage.removeItem("xiaozhangben.v3");
      load(); renderAll(); renderHome();

      /* ===== A. 面板：只有一个＋ ===== */
      openNewBook();
      $("nbMore").click();
      ok("A1 没有「图案 / 文字」那排标签", !document.getElementById("icTabPic"));
      ok("A2 添加器默认藏着", $("icAddRow").style.display === "none");

      /* ===== B. 点＋：两行 + 两个圈 + 只有添加/取消 ===== */
      $("icGrid").querySelector("[data-addic]").click();
      var box = $("icAddRow");
      ok("B1 添加器出来了", box.style.display !== "none");
      eq("B2 正好两行", box.querySelectorAll("[data-adrow]").length, 2);
      eq("B3 每行尾巴一个圆圈", box.querySelectorAll("[data-adck]").length, 2);
      /* 2026-11-01 改：空输入框本来就不该打勾（用户报"两行都空着却都打着勾"） */
      ok("B4 两行默认都不打勾",
         !box.querySelector('[data-adck="pic"]').classList.contains("on") &&
         !box.querySelector('[data-adck="txt"]').classList.contains("on"));
      ok("B4b 哪行填了字，哪行才自己打勾", (function(){
        var pi = box.querySelector('[data-adin="pic"]');
        pi.value = "🐱"; fire(pi);
        var lit = box.querySelector('[data-adck="pic"]').classList.contains("on") &&
                  !box.querySelector('[data-adck="txt"]').classList.contains("on");
        pi.value = ""; fire(pi);            // 清空 → 勾也该跟着灭
        return lit && !box.querySelector('[data-adck="pic"]').classList.contains("on");
      })());
      ok("B5 底下的取消 / 确定藏起来了", $("icBtnRow").style.display === "none");
      eq("B6 一共只有两个按钮", box.querySelectorAll("button").length, 2);
      ok("B7 是「添加」和「取消」",
         box.querySelector("[data-adok]").textContent === "添加" &&
         box.querySelector("[data-adcancel]").textContent === "取消");
      ok("B8 一个都不填就点添加 → 不落地（面板还开着）",
         (function(){ box.querySelector("[data-adok]").click();
                      return $("sheetIcons").classList.contains("on"); })());

      /* ===== C. 两行都填：图案在上、文字在下 ===== */
      var cp = box.querySelector('[data-adin="pic"]');
      var ct = box.querySelector('[data-adin="txt"]');
      cp.value = "🐱"; fire(cp);
      ct.value = "猫粮"; fire(ct);
      box.querySelector("[data-adok]").click();
      eq("C1 两样合成一个 key", _nbIcon, "🐱|猫粮");
      ok("C2 添加完面板就关了", !$("sheetIcons").classList.contains("on"));
      ok("C3 进了「我的」列表", (state.customIcons || []).indexOf("🐱|猫粮") >= 0);

      $("nbName").value = "猫粮本";
      createBook();
      var nb = state.books[state.books.length - 1];
      eq("C4 图案落进 icon", nb.icon, "🐱");
      eq("C5 文字落进 iconTxt", nb.iconTxt, "猫粮");
      renderBooks();
      var card = $("bookGrid").querySelector('[data-bid="' + nb.id + '"] .bi');
      eq("C6 卡片上排是图案", (card.querySelector(".pp").textContent || "").trim(), "🐱");
      eq("C7 卡片下排是文字", (card.querySelector(".tt").textContent || "").trim(), "猫粮");
      ok("C8 两行用 bi2 这个类（上下排）", card.classList.contains("bi2"));

      /* ===== D. 只写文字：白纸 + 那两个字 ===== */
      openNewBook();
      $("nbMore").click();
      $("icGrid").querySelector("[data-addic]").click();
      var dt = $("icAddRow").querySelector('[data-adin="txt"]');
      dt.value = "美甲"; fire(dt);
      $("icAddRow").querySelector("[data-adok]").click();
      eq("D1 只有文字时 key 是「文:美甲」", _nbIcon, "文:美甲");
      $("nbName").value = "美甲本";
      createBook();
      var nb2 = state.books[state.books.length - 1];
      eq("D2 图案位留空", nb2.icon, "");
      eq("D3 名字落进 iconTxt", nb2.iconTxt, "美甲");
      renderBooks();
      var c2 = $("bookGrid").querySelector('[data-bid="' + nb2.id + '"] .bi');
      eq("D4 没图案就印一张白文件纸",
         (c2.querySelector(".pp").textContent || "").trim(), "📄");
      eq("D5 白纸下面还是那两个字",
         (c2.querySelector(".tt").textContent || "").trim(), "美甲");

      /* ===== E. 只写表情：列表里叫「未命名」 ===== */
      openNewBook();
      $("nbMore").click();
      $("icGrid").querySelector("[data-addic]").click();
      var ep = $("icAddRow").querySelector('[data-adin="pic"]');
      ep.value = "🛸"; fire(ep);
      $("icAddRow").querySelector("[data-adok]").click();
      eq("E1 表情当图案", _nbIcon, "🛸");
      ok("E2 网格里看得见它", !!$("icGrid").querySelector('[data-ic="🛸"]'));
      eq("E3 没填文字的小标题是「未命名」",
         $("icGrid").querySelector('[data-ic="🛸"] em').textContent, "未命名");

      /* ===== F. 取消：什么都不改，按钮行回来 ===== */
      $("icGrid").querySelector("[data-addic]").click();
      var ft = $("icAddRow").querySelector('[data-adin="txt"]');
      ft.value = "不做数"; fire(ft);
      $("icAddRow").querySelector("[data-adcancel]").click();
      ok("F1 取消后添加器收起", $("icAddRow").style.display === "none");
      ok("F2 底下按钮回来了", $("icBtnRow").style.display !== "none");
      ok("F3 没留下任何东西", (state.customIcons || []).indexOf("文:不做数") < 0);
      eq("F4 当前图标还是刚才那个", _nbIcon, "🛸");

      /* ===== G. 圈是「这一项要不要」：关掉一行就不带它 ===== */
      $("icGrid").querySelector("[data-addic]").click();
      var gp = $("icAddRow").querySelector('[data-adin="pic"]');
      var gt = $("icAddRow").querySelector('[data-adin="txt"]');
      gp.value = "🐱"; fire(gp);
      gt.value = "狗粮"; fire(gt);
      $("icAddRow").querySelector('[data-adck="pic"]').click();   // 关掉图案那行
      ok("G1 关掉一行，圈变空",
         !$("icAddRow").querySelector('[data-adck="pic"]').classList.contains("on"));
      eq("G2 关掉那行的字被清掉",
         $("icAddRow").querySelector('[data-adin="pic"]').value, "");
      $("icAddRow").querySelector("[data-adok]").click();
      eq("G3 只剩文字那份", _nbIcon, "文:狗粮");

      /* ===== H. 老数据：汉字存在 icon 上的那种 ===== */
      var d = JSON.parse(localStorage.getItem("xiaozhangben.v3") || "{}");
      d.books[0].icon = "美甲";
      delete d.books[0].iconTxt;
      localStorage.setItem("xiaozhangben.v3", JSON.stringify(d));
      load(); renderBooks();
      eq("H1 读档时汉字挪进 iconTxt", state.books[0].iconTxt, "美甲");
      eq("H2 icon 不再存汉字", state.books[0].icon, "");
      var c3 = $("bookGrid").querySelector(".bi");
      eq("H3 老账本也印白纸 + 那两个字",
         (c3.textContent || "").trim(), "📄美甲");

      /* ===== I. 备份读得到 iconTxt ===== */
      save();
      var p = JSON.parse(localStorage.getItem("xiaozhangben.v3") || "{}");
      ok("I1 存档里带 iconTxt",
         (p.books || []).some(function(b){ return b.iconTxt === "美甲"; }));
      ok("I2 两样都有的那条也存着",
         (p.books || []).some(function(b){ return b.icon === "🐱" && b.iconTxt === "猫粮"; }));
    }catch(e){
      log.push("N例外:" + (e && e.message));
    }
    report();
  }, 700);
})();
