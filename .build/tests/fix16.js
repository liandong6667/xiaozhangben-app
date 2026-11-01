/* 1.6.16 预算面板重做
   A. 月预算：一行只有「账本 + 减 + 加」，长解释和"本合计"都没了；减不出负数
   B. 日预算默认面板：打开就是一个大数字（今天），加减 / 敲字都当场落库
   C. 点日历换天：选中态跟着走，大数字换成那天，改的也是那天
   D. 最下面那行小字「修改设置方式」：三选一，选完回到日预算面板并记住
   E. 一键铺满 / 按星期 / 清除本月（弹框确认）
   F. 持久化：重启后 dayMode / dayWeek / dayBud 都还在，坏值回默认 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  function $(id){ return document.getElementById(id); }
  function fire(el, t){ el.dispatchEvent(new Event(t, { bubbles: true })); }
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function mi(){
    var now = new Date();
    return { y: now.getFullYear(), m: now.getMonth(), days: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() };
  }

  setTimeout(async function(){
    var back = { records: state.records.slice(), books: JSON.parse(JSON.stringify(state.books)) };
    var snap = {
      dayBud: JSON.parse(JSON.stringify(state.dayBud || {})),
      dayMode: state.dayMode,
      dayWeek: JSON.parse(JSON.stringify(state.dayWeek || [])),
      book: state.book
    };
    try{
      state.dayBud = {};
      state.dayMode = 1;
      state.dayWeek = [0, 0, 0, 0, 0, 0, 0];
      save(); renderAll(); renderHome();

      /* ===== A. 月预算：只留账本 + 加减 ===== */
      ok("首页预算位还是按钮", $("hmBud") && $("hmBud").tagName === "BUTTON");
      $("hmBud").onclick();
      ok("月预算面板打开", $("sheetBudget").className.indexOf("on") >= 0);
      eq("每个账本一行", $("budBody").querySelectorAll(".bd-row").length, state.books.length);
      eq("每行一个减加胶囊", $("budBody").querySelectorAll(".bd-step").length, state.books.length);
      ok("没有那段长解释", !$("sheetBudget").querySelector(".sh-sub"));
      ok("没有「本合计」那一行", $("sheetBudget").textContent.indexOf("本合计") < 0);
      ok("标题右边有合计位", !!$("budTotal"));
      ok("没设时合计写「还没设」", $("budTotal").textContent === "还没设");

      var inc = $("budBody").querySelector(".bd-inc");
      var dec = $("budBody").querySelector(".bd-dec");
      var inp = $("budBody").querySelector("input.bd-in");
      inc.click();
      eq("加一下 = 100", inp.value, "100");
      ok("合计同步成 100", $("budTotal").textContent.indexOf("100") >= 0);
      inc.click();
      eq("再加一下 = 200", inp.value, "200");
      dec.click(); dec.click();
      eq("减回空（0 不写成 \"0\"）", inp.value, "");
      dec.click();
      eq("空着再减也不会负数", inp.value, "");
      inp.value = "300";
      fire(inp, "input");
      ok("敲字也同步合计", $("budTotal").textContent.indexOf("300") >= 0);
      saveBudget();
      eq("存进了账本", +state.books[0].budget, 300);
      ok("存完面板收起", $("sheetBudget").className.indexOf("on") < 0);

      /* ===== B. 日预算：打开就是一个大数字 ===== */
      $("hdBud").onclick();
      ok("日预算面板打开", $("sheetDayBud").className.indexOf("on") >= 0);
      ok("默认显示「一天一个数」那块", $("dbHero1").hidden === false);
      ok("一键铺满那块默认藏着", $("dbHero2").hidden === true);
      ok("按星期那块默认藏着", $("dbHero3").hidden === true);
      eq("今天还没设 → 输入框是空的", $("dbDayIn").value, "");
      ok("标题右边写「本月还没设」", $("dbTally").textContent.indexOf("还没设") >= 0);
      eq("上面那行写的是今天", $("dbPickLb").textContent.indexOf("今天") >= 0, true);

      $("dbDayIn").value = "120";
      fire($("dbDayIn"), "input");
      eq("敲 120 当场落库", dayBudOf(todayK()), 120);
      var raw0 = JSON.parse(localStorage.getItem(KEY) || "{}");
      ok("存档里立刻有了", raw0.dayBud && +raw0.dayBud[todayK()] === 120);

      var plus = $("dbHero1").querySelector('.db-pm[data-d="1"]');
      var minus = $("dbHero1").querySelector('.db-pm[data-d="-1"]');
      plus.click();
      eq("点加号 +10", dayBudOf(todayK()), 130);
      eq("输入框同步成 130", $("dbDayIn").value, "130");
      minus.click();
      eq("点减号 -10", dayBudOf(todayK()), 120);
      ok("统计跟着变成「本月已设 1 天」", $("dbTally").textContent.indexOf("1 天") >= 0);

      /* ===== C. 点日历换一天 ===== */
      var info = mi();
      var other = ymdKey(info.y, info.m, 1) === todayK() ? ymdKey(info.y, info.m, 2) : ymdKey(info.y, info.m, 1);
      eq("日历格子数 = 本月天数", $("dbCal").querySelectorAll(".cd:not(.cd-x)").length, info.days);
      ok("格子里没有任何输入框（不再塞 31 个 input）", $("dbCal").querySelectorAll("input").length === 0);
      var cell = $("dbCal").querySelector('.cd[data-k="' + other + '"]');
      ok("那格是个按钮", !!cell && cell.tagName === "BUTTON");
      cell.click();
      ok("点完带上选中态", cell.className.indexOf("pick") >= 0);
      eq("大数字换成了那天（没设 → 空）", $("dbDayIn").value, "");
      ok("上面那行改成「已选」", $("dbPickLb").textContent.indexOf("已选") >= 0);
      $("dbDayIn").value = "88";
      fire($("dbDayIn"), "input");
      eq("改的是选中那天", dayBudOf(other), 88);
      eq("今天没被顺手改掉", dayBudOf(todayK()), 120);
      ok("格子高亮了", cell.className.indexOf("has") >= 0);
      ok("格子里的数也变了", cell.querySelector(".cd-v").textContent === "88");
      ok("统计变成 2 天", $("dbTally").textContent.indexOf("2 天") >= 0);

      /* ===== D. 修改设置方式 ===== */
      ok("最下面有「修改设置方式」", $("dbModeBtn") && $("dbModeBtn").textContent.indexOf("修改设置方式") >= 0);
      ok("它和「清除本月」同一行小字", $("dbClear") && $("dbClear").textContent.indexOf("清除本月") >= 0);
      $("dbModeBtn").click();
      ok("方式面板打开", $("sheetDayMode").className.indexOf("on") >= 0);
      eq("三种填法都在", $("dmList").querySelectorAll(".dm-opt").length, 3);
      ok("默认高亮第一种", $("dmList").querySelector('.dm-opt[data-mode="1"]').className.indexOf("on") >= 0);
      var t1 = $("dmList").textContent;
      ok("写了「每天自己填」", t1.indexOf("每天自己填") >= 0);
      ok("写了「一键铺满每天」", t1.indexOf("一键铺满") >= 0);
      ok("写了「按星期设」", t1.indexOf("按星期") >= 0);

      $("dmList").querySelector('.dm-opt[data-mode="3"]').click();
      await wait(320);
      eq("选完存进 state", state.dayMode, 3);
      ok("选完自动回到日预算面板", $("sheetDayBud").className.indexOf("on") >= 0);
      ok("方式面板已经收了", $("sheetDayMode").className.indexOf("on") < 0);
      ok("按星期那块显示出来了", $("dbHero3").hidden === false);
      ok("一天一个数那块藏起来", $("dbHero1").hidden === true);
      eq("七行对应周一到周日", $("dbWeek7").querySelectorAll(".bd-row").length, 7);

      /* ===== E. 三种批量动作 ===== */
      setDayMode(2);
      await wait(320);
      ok("一键铺满那块显示出来", $("dbHero2").hidden === false);
      $("dbAll").value = "150";
      fire($("dbAll"), "input");
      $("dbAllGo").click();
      eq("1 号铺成 150", dayBudOf(ymdKey(info.y, info.m, 1)), 150);
      eq("最后一天也铺成 150", dayBudOf(ymdKey(info.y, info.m, info.days)), 150);
      ok("统计写满了整月", $("dbTally").textContent.indexOf(info.days + " 天") >= 0);

      setDayMode(3);
      await wait(320);
      var winp = $("dbWeek7").querySelectorAll("input.wk-in");
      eq("星期表七个输入", winp.length, 7);
      winp[0].value = "70";          // 周一
      winp[5].value = "260";         // 周六
      fire(winp[0], "input");
      ok("改星期值顺手存了", +state.dayWeek[0] === 70 && +state.dayWeek[5] === 260);
      $("dbWeek7").querySelectorAll(".bd-step")[0].querySelector(".bd-inc").click();
      eq("星期一那行也能点加号", state.dayWeek[0], 80);
      $("dbWeekGo").click();
      var monHit = 0, satHit = 0, bad = 0;
      for(var d = 1; d <= info.days; d++){
        var wd = (new Date(info.y, info.m, d).getDay() + 6) % 7;
        var v = dayBudOf(ymdKey(info.y, info.m, d));
        if(wd === 0){ if(v === 80) monHit++; else bad++; }
        else if(wd === 5){ if(v === 260) satHit++; else bad++; }
      }
      ok("每个月都按星期铺到了（周一 80）", monHit > 0 && bad === 0);
      ok("周六是 260", satHit > 0);

      // 清除本月：点一下弹确认框，不玩"同一个地方点两下"
      var before = Object.keys(state.dayBud).length;
      $("dbClear").click();
      eq("点一下先不动数据", Object.keys(state.dayBud).length, before);
      ok("点一下就弹出确认框", $("askBox").classList.contains("on"));
      ok("框里说清了要清几天", /\d+\s*天/.test($("askBody").textContent));
      ok("确定键跟主按钮一样是橙色", $("askYes").className.indexOf("btn-main") >= 0);
      ok("确定键不是那个红色删除", $("askYes").className.indexOf("btn-danger") < 0);
      ok("确定键文案说人话", $("askYes").textContent.indexOf("确定") >= 0);
      $("askNo").click();
      eq("点取消不清数据", Object.keys(state.dayBud).length, before);
      ok("点取消后框关掉", !$("askBox").classList.contains("on"));
      // 再点一次，这回确定
      $("dbClear").click();
      $("askYes").click();
      eq("点确定才真清空", Object.keys(state.dayBud).length, 0);
      ok("清完框也关掉", !$("askBox").classList.contains("on"));

      /* ===== F. 重启还在 ===== */
      state.dayMode = 3;
      state.dayWeek = [80, 0, 0, 0, 0, 260, 0];
      state.dayBud = {}; state.dayBud[ymdKey(info.y, info.m, 3)] = 66;
      save();
      load();
      eq("重启后填法还在", state.dayMode, 3);
      eq("重启后星期值还在", +state.dayWeek[0], 80);
      eq("重启后日预算还在", dayBudOf(ymdKey(info.y, info.m, 3)), 66);

      // 坏值不许把面板搞空
      state.dayMode = 1; state.dayWeek = [0,0,0,0,0,0,0];
      save();
      var rawBad = JSON.parse(localStorage.getItem(KEY) || "{}");
      rawBad.dayMode = 9;
      rawBad.dayWeek = [1, -2, "x", 3];
      localStorage.setItem(KEY, JSON.stringify(rawBad));
      load();
      eq("坏 dayMode 回默认 1", state.dayMode, 1);
      eq("星期值里的正数留着", +state.dayWeek[0], 1);
      eq("负数当 0", +state.dayWeek[1], 0);
      eq("乱码当 0", +state.dayWeek[2], 0);
    }catch(e){
      log.push("NERR:" + e.message);
    }
    /* 收尾：把账目和设置恢复成进来时的样子 */
    state.records = back.records;
    state.books = back.books;
    state.dayBud = snap.dayBud;
    state.dayMode = snap.dayMode;
    state.dayWeek = snap.dayWeek;
    state.book = snap.book;
    save(); renderAll(); renderHome(); closeSheets();
    document.title = "fix16 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
      " | " + log.join(" | ");
  }, 420);
})();
