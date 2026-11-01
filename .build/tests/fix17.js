/* 1.6.17 —— 三件事
   A. 清除本月：点一下弹确认框（确定是橙色，不是红色删除键），不再"同一个地方点两下"
   B. 填法 2 / 3 套用完之后，日历还能单独改某一天（以前只能看不能改）
   C. 去掉面板里的灰色解释文字：选填法只剩加粗标题
   D. 别处的灰字也压短了，没有长段落 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  function $(id){ return document.getElementById(id); }
  function fire(el, t){ el.dispatchEvent(new Event(t, { bubbles: true })); }
  function mi(){
    var now = new Date();
    return { y: now.getFullYear(), m: now.getMonth(), days: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() };
  }
  function cellOf(y, m, d){ return document.querySelector('#dbCal .cd[data-k="' + ymdKey(y, m, d) + '"]'); }

  setTimeout(function(){
    var snap = {
      dayBud: JSON.parse(JSON.stringify(state.dayBud || {})),
      dayMode: state.dayMode,
      dayWeek: JSON.parse(JSON.stringify(state.dayWeek || [])),
      book: state.book
    };
    var info = mi();
    try{
      /* ============ A. 清除本月 = 确认框 ============ */
      state.dayBud = {}; state.dayMode = 1; state.dayWeek = [0,0,0,0,0,0,0];
      for(var d = 1; d <= 5; d++) state.dayBud[ymdKey(info.y, info.m, d)] = 100;
      save(); openDayBud();

      ok("平时没有确认框", !$("askBox").classList.contains("on"));
      $("dbClear").click();
      ok("点一下就弹出确认框", $("askBox").classList.contains("on"));
      eq("弹框时数据一动没动", Object.keys(state.dayBud).length, 5);
      ok("框里说清了清几天", /\d+\s*天/.test($("askBody").textContent));
      ok("确定键走主体橙色", $("askYes").className.indexOf("btn-main") >= 0);
      ok("确定键不是红色删除键", $("askYes").className.indexOf("btn-danger") < 0);
      ok("确定键文案是「确定清除」", $("askYes").textContent.indexOf("确定") >= 0);
      ok("取消键文案是「先不清」", $("askNo").textContent.indexOf("先不清") >= 0);

      $("askNo").click();
      ok("点取消把框关掉", !$("askBox").classList.contains("on"));
      eq("点取消不清数据", Object.keys(state.dayBud).length, 5);

      // 这回确定
      $("dbClear").click();
      $("askYes").click();
      eq("点确定才真清空", Object.keys(state.dayBud).length, 0);
      ok("清完框自己关掉", !$("askBox").classList.contains("on"));

      // 本来就没设过：只提示，不要弹个空框
      openDayBud();
      $("dbClear").click();
      ok("没设过就不弹框", !$("askBox").classList.contains("on"));

      /* ============ B. 填法 2：铺满后单改 ============ */
      state.dayMode = 2;
      state.dayBud = {};
      openDayBud();
      ok("填法2 有单日编辑条", $("dbPickRow").hidden === false);
      ok("填法2 不显示填法1的大数字", $("dbHero1").hidden === true);

      $("dbAll").value = "50";
      $("dbAllGo").click();
      eq("铺满后每天都 50", dayBudOf(ymdKey(info.y, info.m, 7)), 50);

      var c7 = cellOf(info.y, info.m, 7);
      c7.click();
      ok("点某天它亮起来", c7.className.indexOf("pick") >= 0);
      eq("编辑条跟着显示那天", $("dbPickIn").value, "50");
      ok("编辑条写明是哪天", $("dbPickLb2").textContent.indexOf("7日") >= 0);

      $("dbPickRow").querySelector(".bd-inc").click();
      eq("点加号 = 60", dayBudOf(ymdKey(info.y, info.m, 7)), 60);
      eq("日历那格同步成 60", c7.querySelector(".cd-v").textContent, "60");
      eq("别的日子没被带偏", dayBudOf(ymdKey(info.y, info.m, 8)), 50);

      $("dbPickIn").value = "88";
      fire($("dbPickIn"), "input");
      eq("直接敲数字也落库", dayBudOf(ymdKey(info.y, info.m, 7)), 88);

      $("dbPickRow").querySelector(".bd-dec").click();
      eq("点减号 = 78", dayBudOf(ymdKey(info.y, info.m, 7)), 78);

      /* ============ C. 填法 3：套用后单改 ============ */
      state.dayMode = 3;
      state.dayWeek = [80, 80, 80, 80, 80, 260, 260];
      state.dayBud = {};
      openDayBud();
      ok("填法3 也有单日编辑条", $("dbPickRow").hidden === false);
      eq("七行步进器都在", $("dbWeek7").querySelectorAll(".bd-row").length, 7);

      $("dbWeekGo").click();
      ok("按星期套用上了", dayBudOf(ymdKey(info.y, info.m, 1)) > 0);
      ok("套用完编辑条还在", $("dbPickRow").hidden === false);

      var c3 = cellOf(info.y, info.m, 3);
      c3.click();
      ok("套用后还能选中某天", c3.className.indexOf("pick") >= 0);
      $("dbPickIn").value = "7";
      fire($("dbPickIn"), "input");
      eq("套用后单改生效", dayBudOf(ymdKey(info.y, info.m, 3)), 7);
      ok("旁边那天还是按星期的数", dayBudOf(ymdKey(info.y, info.m, 4)) > 0 &&
        dayBudOf(ymdKey(info.y, info.m, 4)) !== 7);

      // 填法 1 不该同时出现两个编辑入口
      state.dayMode = 1;
      openDayBud();
      ok("填法1 时这条藏起来（用大数字改）", $("dbPickRow").hidden === true);
      ok("填法1 的大数字在", $("dbHero1").hidden === false);

      /* ============ D. 灰色解释文字 ============ */
      ok("选填法面板没有灰字说明", !$("sheetDayMode").querySelector(".sh-sub"));
      eq("还是三个选项", $("dmList").querySelectorAll(".dm-opt").length, 3);
      eq("选项里一个灰色小字都没有", $("dmList").querySelectorAll(".dm-opt span").length, 0);
      eq("三个加粗标题都在", $("dmList").querySelectorAll(".dm-opt b").length, 3);
      ok("勾选标记还在", $("dmList").querySelectorAll(".dm-tick").length === 3);

      ok("导入面板那段说明没了", !$("sheetImp").querySelector(".sh-sub"));
      ok("换肤面板那句没了", !$("sheetTheme").querySelector(".sh-sub"));
      ok("补记面板那句（和输入框提示重复）没了", !$("sheetAdd").querySelector(".sh-sub"));
      ok("账本面板那句压短了", $("sheetBook").querySelector(".sh-sub").textContent.length <= 20);
      ok("新建账本那句压短了", $("sheetNewBook").querySelector(".sh-sub").textContent.length <= 22);
      /* 2026-10-30 用户要求把「截图记账」整个删掉，所以这里从「面板文案够短」
         改成「面板确实不在了」—— 以后谁再加回来会立刻红。 */
      ok("截图记账面板已删除", !document.getElementById("sheetShot"));
      ok("首页没有截图记账按钮", !document.getElementById("btnShot"));
      ok("导入面板的「从哪来」教程还在", !!$("sheetImp").querySelector(".howto"));

      // 全 App 不再有超过 40 字的灰色说明
      var longSub = [];
      document.querySelectorAll(".sh-sub").forEach(function(el){
        if(el.textContent.length > 40) longSub.push(el.textContent.slice(0, 12));
      });
      eq("没有超过 40 字的灰字说明", longSub.length, 0);
    }catch(e){
      log.push("NERR:" + e.message);
    }
    state.dayBud = snap.dayBud;
    state.dayMode = snap.dayMode;
    state.dayWeek = snap.dayWeek;
    state.book = snap.book;
    save(); renderAll(); renderHome(); closeSheets();
    if($("askBox")) $("askBox").classList.remove("on");
    document.title = "fix17 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
      " | " + log.join(" | ");
  }, 420);
})();
