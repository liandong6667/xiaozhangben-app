/* fix26：账本卡片右下角「设置」→ 进去改名字/图标/绑定/预算
   用户原话：第一个缺口只用在账本的右下角搞一个设置按钮就行了，然后用户点进去可以再进行修改。
   复用了新建账本那个面板（_nbEditId 区分新建 / 修改），所以要重点守住：
   ① 点设置不能顺手把页面切走、不能触发长按删除（冒泡）
   ② 改的时候字段要预填成这个账本现在的样子
   ③ 名字一个字没改也能保存（查重要把自己排除）
   ④ 改完再点「新建」，面板必须变回新建的样子（标题/按钮/说明 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix26 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }

  setTimeout(function(){
    try{
      /* ===== A. 卡片右下角有设置按钮 ===== */
      goto("books");
      renderBooks();
      var nBooks = state.books.length;   // 种子数据可能只有 1 个账本，别写死
      var cards = $("bookGrid").querySelectorAll("[data-bid]");
      ok("A1 有账本卡片", cards.length > 0);
      var sets = $("bookGrid").querySelectorAll("[data-bset]");
      eq("A2 每张账本卡片都有设置按钮", sets.length, cards.length);
      ok("A3 设置按钮在卡片右下角（CSS 里 absolute 到 right/bottom）", (function(){
        for(var i = 0; i < document.styleSheets.length; i++){
          var rules = null;
          try{ rules = document.styleSheets[i].cssRules; }catch(e){ continue; }
          if(!rules) continue;
          for(var j = 0; j < rules.length; j++){
            var r = rules[j];
            if((r.selectorText || "").indexOf(".bcard .bset") === 0){
              var s = r.style;
              if(s.position === "absolute" && s.right && s.bottom) return true;
            }
          }
        }
        return false;
      })());
      ok("A4 新建那个「＋」卡片没有设置按钮", !$("btnNewBook").querySelector("[data-bset]"));

      /* ===== B. 点设置 = 打开面板，字段预填 ===== */
      var b0 = state.books[0];
      var sets0 = $("bookGrid").querySelector('[data-bset="' + b0.id + '"]');
      var before = state.book;
      sets0.click();
      ok("B1 面板打开了", $("sheetNewBook").classList.contains("on"));
      eq("B2 标题变成「改账本」", $("nbTitle").textContent, "改账本");
      eq("B3 按钮变成「保存」", $("nbOk").textContent, "保存");
      eq("B4 名字预填成现在的", $("nbName").value, b0.name);
      eq("B5 图标预填成现在的", _nbIcon, b0.icon);
      eq("B6 绑定预填成现在的", _nbCat, b0.cat || "");
      eq("B7 预算预填成现在的", $("nbBud").value, b0.budget > 0 ? String(b0.budget) : "");
      eq("B8 改账本时不显示那句说明（没人看）", $("nbSub").style.display, "none");
      eq("B9 点设置不会把页面切走", state.book, before);

      /* ===== C. 改名字 + 换图标 + 保存 ===== */
      $("nbName").value = "改过的名字";
      $("nbCats").querySelector('[data-icchip="🚦"]').click();     // 交通
      $("nbBud").value = "300";
      $("nbOk").click();
      var b1 = state.books.find(function(x){ return x.id === b0.id; });
      eq("C1 名字改了", b1.name, "改过的名字");
      eq("C2 图标改了", b1.icon, "🚦");
      eq("C3 绑定改了", b1.cat, "transport");
      eq("C4 预算改了", b1.budget, 300);
      eq("C5 没有多出一个账本", state.books.length, nBooks);
      ok("C6 面板关了", !$("sheetNewBook").classList.contains("on"));
      ok("C7 卡片上名字跟着变", $("bookGrid").innerHTML.indexOf("改过的名字") >= 0);

      /* ===== D. 关键：名字一个字没改也能保存（查重要排除自己） ===== */
      $("bookGrid").querySelector('[data-bset="' + b0.id + '"]').click();
      eq("D1 再进来还是预填好的", $("nbName").value, "改过的名字");
      $("toast").textContent = "";        // 清掉上一次的提示，好判断这次到底弹了什么
      $("nbOk").click();
      var b2 = state.books.find(function(x){ return x.id === b0.id; });
      eq("D2 名字没改也能保存成功", b2.name, "改过的名字");
      ok("D3 提示的是「改好了」而不是「已经有同名账本了」",
         $("toast").textContent.indexOf("改好了") >= 0);

      /* ===== E. 真重名还是要拦（先另建一个账本，再撞它的名字） ===== */
      openNewBook();
      $("nbName").value = "撞名专用";
      $("nbOk").click();
      var other = state.books.find(function(x){ return x.name === "撞名专用"; });
      ok("E0 第二个账本建出来了", !!other);
      $("bookGrid").querySelector('[data-bset="' + b0.id + '"]').click();
      $("toast").textContent = "";
      $("nbName").value = "撞名专用";
      $("nbOk").click();
      eq("E1 撞别人名字会被拦（名字没被改掉）",
         state.books.find(function(x){ return x.id === b0.id; }).name, "改过的名字");
      ok("E2 弹的是重名提示", $("toast").textContent.indexOf("已经有同名账本了") >= 0);
      ok("E3 面板没关（等着你改）", $("sheetNewBook").classList.contains("on"));

      /* ===== F. 落库：改完重启读得回来 ===== */
      var saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      var inFile = (saved.books || []).find(function(x){ return x.id === b0.id; });
      ok("F1 改动进了存档", !!inFile && inFile.name === "改过的名字" && inFile.icon === "🚦");

      /* ===== G. 改完再点「新建」，面板要变回新建的样子 ===== */
      closeSheets();
      openNewBook();
      eq("G1 标题回到新建", $("nbTitle").textContent, "新建小账本");
      eq("G2 按钮回到建好了", $("nbOk").textContent, "建好了");
      ok("G3 说明回来了", $("nbSub").style.display !== "none");
      eq("G4 名字清空", $("nbName").value, "");
      eq("G5 不再处于修改态", _nbEditId, "");
      ok("G6 新建时图标也是空的（单选）", _nbIcon === "");

      /* ===== H. 点设置不该触发卡片的长按删除 ===== */
      var n0 = state.books.length;
      var s2 = $("bookGrid").querySelector('[data-bset="' + b0.id + '"]');
      s2.dispatchEvent(new MouseEvent("mousedown", {bubbles: true}));
      s2.click();
      eq("H1 长按删除没被误触发（账本数没变）", state.books.length, n0);

    }catch(e){
      log.push("N 抛异常: " + (e && e.message ? e.message : e));
    }
    report();
  }, 900);
})();
