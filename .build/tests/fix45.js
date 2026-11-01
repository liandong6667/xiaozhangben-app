/* fix45：走查报出来的六个问题（2026-11-01 用户拍板全改）
   ① 商户名尾巴挂着动词：「中午食堂吃饭15」记成「食堂吃饭」
   ② 预览卡不说认成哪家店
   ③ 记一笔底部的「＋ 更多」白底黑字，跟旁边分类一模一样
   ④ 明细行灰色小字塞六段，必被省略号截断，备注常常看不到
   ⑤ 添加器两行空着却都打着勾
   ⑥ 账本卡片右下角的改账本按钮又小又淡，还压在预算进度条上 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix45 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }
  function fire(el, ev){ el.dispatchEvent(new Event(ev || "input")); }
  function css(){
    var s = "";
    for(var i = 0; i < document.styleSheets.length; i++){
      try{ s += Array.prototype.slice.call(document.styleSheets[i].cssRules)
              .map(function(r){ return r.cssText || ""; }).join("\n"); }catch(e){}
    }
    return s.replace(/\s+/g, "");
  }
  function rule(sel){
    var s = css(), i = s.indexOf(sel + "{");
    return i < 0 ? "" : s.slice(i, s.indexOf("}", i));
  }

  setTimeout(function(){
    try{
      localStorage.removeItem("xiaozhangben.v3");
      load(); renderAll(); renderHome();

      /* ===== A. 商户名不再挂着「吃饭」 ===== */
      eq("A1 食堂吃饭 → 食堂", extractNote("中午食堂吃饭15", "food"), "食堂");
      eq("A2 面馆吃饭 → 面馆", extractNote("晚上面馆吃饭 22", "food"), "面馆");
      eq("A3 吃了饭也剥", extractNote("食堂吃了饭18", "food"), "食堂");
      ok("A4 「小吃」不能被切成「小」", extractNote("小吃 8", "food").indexOf("小吃") >= 0);
      ok("A5 「好吃」也不动", extractNote("好吃点 5", "food").indexOf("好吃") >= 0);
      ok("A6 只写「吃饭」不会变空", (extractNote("吃饭15", "food") || "").length > 0);

      /* ===== B. 预览卡把店名念出来 ===== */
      openAddSheet();
      var q = document.getElementById("qi");
      q.value = "中午食堂吃饭15";
      fire(q);
      previewManual();
      var pvP = document.getElementById("pvPeer");
      ok("B1 预览里有商户这一格", !!pvP);
      ok("B2 商户写着「食堂」且不是「食堂吃饭」",
         (pvP.textContent || "").indexOf("食堂") >= 0 &&
         (pvP.textContent || "").indexOf("食堂吃饭") < 0);
      ok("B3 认出来时是显示的", pvP.style.display !== "none");
      q.value = "15";                      // 纯金额，没有店名
      fire(q); previewManual();
      ok("B4 认不出店名就不占位", pvP.style.display === "none" ||
         !(pvP.textContent || "").trim());
      if(typeof closeSheet === "function") closeSheet();
      document.getElementById("sheetAdd").classList.remove("on");

      /* ===== C. 「＋ 更多」是入口不是分类 ===== */
      openAddSheet();
      var more = document.getElementById("chipMore");
      ok("C1 那个按钮还在", !!more);
      var addRule = rule(".cat-chip.cat-add");
      /* 2026-11-01 第二轮：上一版的"淡品牌底"跟**选中态**撞了 ——
         .cat-chip.on 的 background 和 color 跟它一模一样，只差一个边框，
         用户看到的是"更多跟选中的图标重叠"。这次改用**形状**区分：
         透明底 + 品牌色虚线。断言跟着事实改，别再守着旧配色。 */
      ok("C2 改成透明底，不再跟选中态共用淡品牌底",
         addRule.indexOf("background:transparent") >= 0 &&
         addRule.indexOf("background:var(--brandSoft)") < 0);
      ok("C3 用品牌深字，不是白字", addRule.indexOf("color:var(--brandInk)") >= 0);
      ok("C4 用品牌色虚线描边（靠形状区分，不是继续调颜色）",
         addRule.indexOf("dashed") >= 0 && addRule.indexOf("--brand") >= 0);
      ok("C5 不再需要深色模式单独一套（--brandSoft 本身就是深底亮字）",
         css().indexOf('html[data-dark="1"].cat-chip.cat-add') < 0);
      document.getElementById("sheetAdd").classList.remove("on");

      /* ===== D. 明细行小字不再塞六段 ===== */
      state.records.push({
        id: "fix45r1", amt: 12.5, type: "expense", cat: "food", sub: "",
        ts: Date.now(), peer: "茶百道", note: "和室友拼的，第二杯半价",
        src: "manual", book: state.books[0].id, from: "微信"
      });
      save(); goto("flow"); renderFlow();
      var tms = Array.prototype.slice.call(document.querySelectorAll(".it-s .tm"));
      ok("D1 明细行画出来了", tms.length > 0);
      var joined = tms.map(function(x){ return x.textContent || ""; }).join(" || ");
      ok("D2 不再出现「手动」这一项", joined.indexOf("手动") < 0);
      var longest = tms.reduce(function(a, x){
        var t = (x.textContent || "");
        return t.length > a.length ? t : a;
      }, "");
      ok("D3 最长那行也在 30 字以内（不再靠省略号兜）[" + longest.length + "][" + longest + "]", longest.length <= 30);
      ok("D4 备注还是看得到", joined.indexOf("和室友拼的") >= 0);

      /* ===== E. 添加器：空框不打勾 ===== */
      openNewBook();
      document.getElementById("nbMore").click();
      /* 添加器要先点那个「＋」才展开 —— openIcAdd 里才会挂上 bindAdder，
         不点它的话 icAddRow 还是 display:none，输入事件根本没绑（测试自己踩过）。 */
      document.getElementById("icGrid").querySelector("[data-addic]").click();
      var box = document.getElementById("icAddRow");
      var cks = box.querySelectorAll("[data-adck]");
      ok("E1 一打开，两个圈都是空的",
         !cks[0].classList.contains("on") && !cks[1].classList.contains("on"));
      var ti = box.querySelector('[data-adin="txt"]');
      ti.value = "狗粮"; fire(ti);

      ok("E2 填了字，那一行自己亮 val=[" + ti.value + "] cls=[" + box.querySelector('[data-adck="txt"]').className + "]", box.querySelector('[data-adck="txt"]').classList.contains("on"));
      ok("E3 另一行没填，仍然是空的",
         !box.querySelector('[data-adck="pic"]').classList.contains("on"));
      ti.value = ""; fire(ti);
      ok("E4 清空之后勾也灭掉",
         !box.querySelector('[data-adck="txt"]').classList.contains("on"));
      document.getElementById("sheetNewBook").classList.remove("on");

      /* ===== F. 账本卡片的改账本按钮 ===== */
      goto("stats"); renderBooks();
      var bset = document.querySelector("#bookGrid [data-bset]");
      ok("F1 按钮还在", !!bset);
      /* 2026-11-01 用户退回：「这个改动我不喜欢，要原来的那版」——
         回到灰底小齿轮、卡片不加高。断言整体反转。 */
      ok("F2 回到 ⚙️ 表情（不再自绘铅笔）",
         !bset.querySelector("svg") && (bset.textContent || "").indexOf("⚙") >= 0);
      var r1 = rule(".bcard.bset"), r2 = rule(".bcard.pbar"), r3 = rule(".bcard");
      ok("F3 回到灰底灰字", r1.indexOf("background:var(--card2)") >= 0 &&
         r1.indexOf("color:var(--ink3)") >= 0);
      ok("F4 回到 22px", r1.indexOf("width:22px") >= 0);
      ok("F5 卡片不再加高（padding 回到 12px）",
         r3.indexOf("padding:12px;") >= 0 && r3.indexOf("12px16px") < 0);
      ok("F6 进度条给按钮让位的宽度也回到 26px", r2.indexOf("margin-right:26px") >= 0);
    }catch(e){
      log.push("N例外:" + (e && e.message));
    }
    report();
  }, 700);
})();
