/* 1.6.13 首页预算入口
   A. 首页右上角是能按的按钮，不再是一句死文字
   B. 点开 → 每个账本一行输入框（含 App 自带的「日常」）
   C. 填完存 → 首页立刻从「本月已花」变「本月还能花」，且落库、重启还在
   D. 全填 0 → 回到「本月已花」，不留一个假预算 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  function $id(id){ return document.getElementById(id); }
  function fire(el, t){ el.dispatchEvent(new Event(t, { bubbles: true })); }

  setTimeout(function(){
    try{
      var old = { books: JSON.parse(JSON.stringify(state.books)), book: state.book };

      /* ===== 先回到"一个预算都没有"的状态 ===== */
      state.books.forEach(function(b){ b.budget = 0; });
      save(); renderHome();

      /* ===== A. 首页那地方本身就能点 ===== */
      var hb = $id("hmBud");
      ok("首页预算位置是个按钮", !!hb && hb.tagName === "BUTTON");
      ok("没设预算时写「＋ 设置预算」", hb.textContent.indexOf("设置预算") >= 0);
      ok("没设预算时带 todo 样式(虚线圈)", hb.className.indexOf("todo") >= 0);
      /* 只看看得见的文字：直接查 body.innerHTML 会把测试脚本自己也算进去 */
      ok("首页上再也看不到「没设预算」这句话",
         $id("pg-home").textContent.indexOf("没设预算") < 0);
      ok("按钮绑了点击", typeof hb.onclick === "function");

      /* ===== B. 点开面板 ===== */
      hb.onclick();
      ok("预算面板弹出来了", $id("sheetBudget").className.indexOf("on") >= 0);
      ok("遮罩也跟着亮了", $id("mask").className.indexOf("on") >= 0);

      var rows = $id("budBody").querySelectorAll("input.bd-in");
      eq("每个账本一行输入框", rows.length, state.books.length);
      var ids = [].map.call(rows, function(i){ return i.dataset.id; });
      ok("App 自带的「日常」也能设预算了", ids.indexOf("daily") >= 0);
      eq("默认一个都没填", rows[0].value, "");

      /* 新结构（1.6.16）：一行只有账本名 + 减 + 输入 + 加。
         以前那两段"按账本分开填…""1 本合计"太挤，用户不知道该看哪儿。 */
      var steps = $id("budBody").querySelectorAll(".bd-step");
      eq("每个账本一个减加胶囊", steps.length, state.books.length);
      eq("每行两个按钮(减/加)",
         $id("budBody").querySelectorAll(".bd-step button").length, state.books.length * 2);
      ok("不再有那段长解释", !$id("sheetBudget").querySelector(".sh-sub"));
      ok("不再有「本合计」那一行", $id("sheetBudget").textContent.indexOf("本合计") < 0);
      ok("标题右边留了合计位", !!$id("budTotal"));
      ok("没设时合计写「还没设」", $id("budTotal").textContent === "还没设");

      /* 加减真的能动：预算本来就是"往上抬一点、往下压一点" */
      $id("budBody").querySelector(".bd-step .bd-inc").click();
      eq("点一次加号 = ¥100", $id("budBody").querySelector("input.bd-in").value, "100");
      ok("合计跟着变 ¥100", $id("budTotal").textContent.indexOf("100") >= 0);
      $id("budBody").querySelector(".bd-step .bd-dec").click();
      eq("点一次减号回到空", $id("budBody").querySelector("input.bd-in").value, "");
      $id("budBody").querySelector(".bd-step .bd-dec").click();
      eq("空着再减也不会变负数", $id("budBody").querySelector("input.bd-in").value, "");

      /* ===== C. 填 1200 并保存 ===== */
      rows[0].value = "1200";
      fire(rows[0], "input");
      ok("标题右边实时算出合计 ¥1,200",
         $id("budTotal").textContent.indexOf("1,200") >= 0);

      saveBudget();
      eq("存进了账本数据", +state.books[0].budget, 1200);
      ok("存完面板自动收起", $id("sheetBudget").className.indexOf("on") < 0);
      eq("首页标题变「本月还能花」", $id("hmLb").textContent, "本月还能花");
      ok("首页显示「预算 ¥1,200」",
         $id("hmBud").textContent.indexOf("1,200") >= 0);
      ok("设完之后换成虚线底(set)", $id("hmBud").className.indexOf("set") >= 0);
      ok("大数字变成还能花的数(不再是已花)",
         $id("hmLeft").textContent === (1200 - monthOutSum() < 0 ? "-" : "") + money(1200 - monthOutSum()));

      /* 落库：直接读存档，确认 budget 真的写进去了 */
      var raw = localStorage.getItem(KEY);
      var saved = raw ? JSON.parse(raw) : null;
      ok("存档里带 budget", !!saved && +saved.books[0].budget === 1200);

      /* 模拟重启：清内存 → load() → 预算还在 */
      state.books = []; load(); renderHome();
      eq("重启后预算还在", +state.books[0].budget, 1200);
      eq("重启后首页还是「本月还能花」", $id("hmLb").textContent, "本月还能花");

      /* 再点一次还能改（不是只能用一次） */
      $id("hmBud").onclick();
      eq("第二次点开读到的是已存的值",
         $id("budBody").querySelector("input.bd-in").value, "1200");

      /* ===== D. 全清空 → 回到本月已花 ===== */
      var all = $id("budBody").querySelectorAll("input.bd-in");
      [].forEach.call(all, function(i){ i.value = "0"; });
      fire(all[0], "input");
      saveBudget();
      eq("清空后攒的预算=0", +state.books[0].budget, 0);
      eq("首页回到「本月已花」", $id("hmLb").textContent, "本月已花");
      ok("又变回「＋ 设置预算」", $id("hmBud").textContent.indexOf("设置预算") >= 0);
      ok("又变回虚线 todo 样式", $id("hmBud").className.indexOf("todo") >= 0);

      /* 负数/乱填不许进来 */
      $id("hmBud").onclick();
      var bad = $id("budBody").querySelector("input.bd-in");
      bad.value = "-500";
      fire(bad, "input");
      saveBudget();
      eq("负数当 0 处理，不会被记成负预算", +state.books[0].budget, 0);

      /* 新建账本面板里的预算输入还在（没被这次改动碰坏） */
      ok("新建账本里的预算输入还在", !!$id("nbBud"));

      /* 收尾：还原原来的账本数据，别把测试值留给后面的用例 */
      state.books = old.books;
      state.book = old.book;
      save(); renderHome(); renderBooks();

      document.title = "fix13 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
        " | " + log.join(" | ");
    }catch(e){
      document.title = "fix13 ERR: " + e.message + " | " + log.join(" | ");
    }
  }, 420);

  // 本月支出合计（跟首页一个口径，避免测试自己另算一套）
  function monthOutSum(){
    var s = 0;
    monthRecs().forEach(function(r){ if(r.type !== "income") s += r.amt; });
    return s;
  }
})();
