/* 1.6.14 日账本（今天这一格）
   A. 日预算读写：按日期存、填 0 等于删掉、月预算一根手指都不碰
   B. 三处日卡的口径：首页 / 记账页（跟当前账本）/ 账本页
   C. 日历面板：格子数、一键铺满整月、按星期、点格选中单日改、清除弹框确认
   D. 长按换位置：默认顺序、交换后 DOM 和存档都对、坏数据回默认 */
(function(){
  var log = [], finishing = false;
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  function $(id){ return document.getElementById(id); }
  function fire(el, t){ el.dispatchEvent(new Event(t, { bubbles: true })); }
  function near(a, b){ return Math.abs(+a - +b) < 0.005; }

  // 本月天数 / 第 d 天的键
  function monthInfo(){
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    return { y: y, m: m, days: new Date(y, m + 1, 0).getDate() };
  }

  setTimeout(function(){
    try{
      var snap = {
        dayBud: JSON.parse(JSON.stringify(state.dayBud || {})),
        order: JSON.parse(JSON.stringify(state.order || null)),
        dayMode: state.dayMode,
        dayWeek: JSON.parse(JSON.stringify(state.dayWeek || [])),
        book: state.book
      };

      /* ===== A. 数据口径 ===== */
      state.dayBud = {};
      var k = todayK();
      eq("今天的键是 2026-10-22 这种格式", /^\d{4}-\d{2}-\d{2}$/.test(k), true);
      eq("默认一天都没设", Object.keys(state.dayBud).length, 0);

      var budBefore = state.books.reduce(function(a, b){ return a + (+b.budget || 0); }, 0);
      setDayBud(k, "150");
      eq("日预算存进去了", state.dayBud[k], 150);
      eq("月预算没被顺手改掉",
         state.books.reduce(function(a, b){ return a + (+b.budget || 0); }, 0), budBefore);

      setDayBud(k, "0");
      ok("填 0 = 这天不限额（键直接删掉，不存 0 占位）", !(k in state.dayBud));
      setDayBud(k, "abc");
      ok("乱填不进去", !(k in state.dayBud));
      setDayBud(k, "-50");
      ok("负数不进去", !(k in state.dayBud));
      setDayBud(k, "1,200");
      eq("带逗号的 1,200 认得出来", state.dayBud[k], 1200);

      /* 落库 */
      var raw = localStorage.getItem(KEY);
      var saved = raw ? JSON.parse(raw) : null;
      ok("存档里有 dayBud", !!saved && saved.dayBud && +saved.dayBud[k] === 1200);

      /* ===== B. 三处日卡 ===== */
      // 造两笔今天的账：默认账本花 100，另一本花 30
      var back = {
        records: JSON.parse(JSON.stringify(state.records)),
        books: JSON.parse(JSON.stringify(state.books))
      };
      if(!state.books.some(function(b){ return b.id === "tbook"; })){
        state.books.push({ id: "tbook", name: "测试本", icon: "🧪", color: "#666",
                           cat: null, budget: 0, def: false });
      }
      /* 时间戳取「今天 00:01」，不是「一小时前」——
         凌晨 0 点多跑这个测试时，"一小时前"已经是昨天了，于是今天一笔都算不出来。 */
      var D0 = new Date(); D0.setHours(0, 1, 0, 0);
      var tDay = D0.getTime();
      state.records = [
        { id: "d1", ts: tDay, amt: 100, type: "expense", cat: "food",
          peer: "食堂", note: "", book: state.books[0].id, src: "manual" },
        { id: "d2", ts: tDay, amt: 30, type: "expense", cat: "food",
          peer: "小卖部", note: "", book: "tbook", src: "manual" },
        { id: "d3", ts: tDay, amt: 999, type: "income", cat: "living",
          peer: "生活费", note: "", book: state.books[0].id, src: "manual" }
      ];

      setDayBud(k, "200");
      var st = dayStat("all");
      eq("今天花了 130（收入不算）", st.spent, 130);
      eq("还能花 70", st.left, 70);
      eq("进度 65%", st.pct, 65);

      renderHome();
      eq("首页标题「今天还能花」", $("hdLb").textContent, "今天还能花");
      eq("首页大数字是还能花的数", $("hdLeft").textContent, money(70));
      ok("首页按钮写「日预算 ¥200」", $("hdBud").textContent.indexOf("200") >= 0);
      ok("首页按钮是 set 样式（能再点开改）", $("hdBud").className.indexOf("set") >= 0);

      renderFlow();
      eq("记账页日条只显示花掉的钱", $("fdSpent").textContent, "¥" + money(130));
      ok("记账页日条写预算和还能", $("fdRest").textContent.indexOf("还能") >= 0 &&
         $("fdRest").textContent.indexOf("70") >= 0);

      // 记账页切到「测试本」→ 只该看到 30
      state.book = "tbook";
      renderFlow();
      eq("切到某个账本时日条只算这个账本", $("fdSpent").textContent, "¥" + money(30));
      state.book = "all";
      renderFlow();

      renderBooks();
      /* 账本页不放日卡（2026-10-22 用户要求删掉）：那里看的是结构，
         今天的数在首页已经说过一次，再摆一张就成了同一个数字大两次 */
      ok("账本页没有今日卡了", $("booksDay") === null && $("bdSpent") === null);
      eq("账本页只剩总账本一张卡",
         document.querySelectorAll("#booksStack .hm-blk").length, 1);
      ok("账本页容器不再拦拖动", !document.getElementById("booksStack").hasAttribute("data-swap"));

      // 没设预算时：三处都要老实说"没设"
      delete state.dayBud[k];
      paintAllDay();
      eq("没设时首页标题变「今天已花」", $("hdLb").textContent, "今天已花");
      eq("没设时首页大数字是今天花掉的", $("hdLeft").textContent, money(130));
      eq("没设时首页按钮是「＋ 设日预算」", $("hdBud").textContent, "＋ 设日预算");
      ok("没设时按钮回到 todo 样式", $("hdBud").className.indexOf("todo") >= 0);
      eq("没设时记账页日条这么说", $("fdRest").textContent, "没设日预算");

      // 超支
      setDayBud(k, "50");
      paintAllDay();
      eq("超支时大数字带减号", $("hdLeft").textContent, "-" + money(80));
      ok("超支时记账页说「超了」", $("fdRest").textContent.indexOf("超了") >= 0);
      ok("超支时记账页那行变红", $("fdRest").className.indexOf("over") >= 0);
      eq("超支时进度条封顶 100%", $("hdBar").style.width, "100%");
      eq("超支时进度条用红色那档", $("hdBar").className, "over");

      /* ===== C. 日历面板 ===== */
      state.dayBud = {};
      openDayBud();
      ok("日预算面板弹出来了", $("sheetDayBud").className.indexOf("on") >= 0);

      var mi = monthInfo();
      var cells = $("dbCal").querySelectorAll(".cd:not(.cd-x)");
      eq("日历格子数 = 本月天数", cells.length, mi.days);
      ok("面板标题写了年月", $("dbCalLb").textContent.indexOf(mi.y + "年") >= 0);
      eq("一开始一天都没设", $("dbCalSum").textContent, "一天都还没设");

      // 一键铺满
      $("dbAll").value = "80";
      fillDayBud();
      var n80 = 0;
      for(var d = 1; d <= mi.days; d++) if(dayBudOf(ymdKey(mi.y, mi.m, d)) === 80) n80++;
      eq("整月铺满：每天都是 80", n80, mi.days);
      ok("面板底部统计更新了", $("dbCalSum").textContent.indexOf(String(mi.days)) >= 0);

      // 按星期（1.6.16 把"只铺周末"改成更通用的按星期）：一到五 80，周末 300
      state.dayMode = 3;
      renderDayPanel();
      var wkVals = [80, 80, 80, 80, 80, 300, 300];
      var winp = $("dbWeek7").querySelectorAll("input.wk-in");
      eq("按星期面板有七行", winp.length, 7);
      for(var i = 0; i < 7; i++) winp[i].value = String(wkVals[i]);
      fire(winp[0], "input");
      applyWeek();
      var sat = 0, mon = 0;
      for(var d2 = 1; d2 <= mi.days; d2++){
        var wd = (new Date(mi.y, mi.m, d2).getDay() + 6) % 7;
        var v = dayBudOf(ymdKey(mi.y, mi.m, d2));
        if(wd >= 5){ if(v === 300) sat++; }
        else if(v === 80) mon++;
      }
      ok("周六周日铺成 300", sat > 0);
      ok("周一到周五是 80", mon > 0);

      // 单日改：点日历选中 1 号，再用上面那个大数字改
      state.dayMode = 1;
      renderDayPanel();
      var c1 = $("dbCal").querySelector('.cd[data-k="' + ymdKey(mi.y, mi.m, 1) + '"]');
      ok("1 号那格是个按钮（不再塞输入框）", !!c1 && c1.tagName === "BUTTON");
      c1.click();
      ok("点一下就把那天选中了", c1.className.indexOf("pick") >= 0);
      $("dbDayIn").value = "999";
      fire($("dbDayIn"), "input");
      eq("单日改生效", dayBudOf(ymdKey(mi.y, mi.m, 1)), 999);
      ok("改完那格高亮了", c1.className.indexOf("has") >= 0);
      $("dbDayIn").value = "";
      fire($("dbDayIn"), "input");
      ok("清空那格 = 这天不限额", dayBudOf(ymdKey(mi.y, mi.m, 1)) === 0);

      // 清除走确认框（1.6.17 起不再按两下）
      ok("清除按钮绑了动作", typeof $("dbClear").onclick === "function");
      var before = Object.keys(state.dayBud).length;
      clearDayBud();
      eq("弹框时先不动数据", Object.keys(state.dayBud).length, before);
      ok("弹的是确认框", $("askBox").classList.contains("on"));
      $("askYes").click();
      eq("确认后才真清", Object.keys(state.dayBud).length, 0);

      /* ===== D. 长按换位置 ===== */
      state.order = defOrder(); save();
      applyOrder("home");
      var hs = $("homeStack");
      eq("首页默认月卡在上", hs.children[0].dataset.blk, "month");
      eq("首页默认日卡在下", hs.children[1].dataset.blk, "day");

      swapBlocks("home", "month", "day");
      eq("换过之后存档里日卡在先", state.order.home[0], "day");
      eq("DOM 也跟着换了", hs.children[0].dataset.blk, "day");

      swapBlocks("flow", "sum", "day");
      eq("记账页也能换", state.order.flow[0], "day");
      eq("记账页 DOM 顺序对", $("flowStack").children[0].dataset.blk, "day");
      /* 账本页只剩一张卡，没得换 —— 容器上连 data-swap 都不留 */
      ok("账本页只有一张卡，不参与换位",
         document.querySelectorAll("#booksStack .hm-blk").length === 1 &&
         !document.getElementById("booksStack").hasAttribute("data-swap"));

      // 重启：顺序和日预算都要在
      setDayBud(k, "120");
      state.dayBud = state.dayBud; save();
      var raw2 = localStorage.getItem(KEY);
      var sv = raw2 ? JSON.parse(raw2) : null;
      ok("存档里带了顺序", !!sv && sv.order && sv.order.home[0] === "day");
      ok("存档里带了日预算", !!sv && sv.dayBud && +sv.dayBud[k] === 120);

      state.dayBud = {}; state.order = null;
      load();
      eq("重启后顺序还在", state.order.home[0], "day");
      eq("重启后日预算还在", dayBudOf(k), 120);
      renderAll(); renderHome();
      eq("重启后首页第一张还是日卡", hs.children[0].dataset.blk, "day");

      // 坏数据不许把页面搞乱
      state.order = { home: ["xxx", "yyy"], flow: "坏的", books: ["day", "day"] };
      save(); state.order = null; load();
      eq("坏顺序回默认（首页）", state.order.home.join(","), "month,day");
      eq("坏顺序回默认（记账页）", state.order.flow.join(","), "sum,day");
      eq("重复的顺序也回默认", state.order.books.join(","), "total");

      state.dayBud = { "坏键": 100, "2026-13-99": 50, "2026-10-01": "abc", "2026-10-02": -8 };
      save(); state.dayBud = {}; load();
      eq("坏日预算一个都不收", Object.keys(state.dayBud).length, 0);

      /* ===== E. 真拖一次（模拟手指按住 → 拖 → 松） =====
         长按那 420ms 在 headless 里没法等（虚拟时钟会乱跳），
         所以用 swLift() 直接走"已经抬起来"这一步，其余全走真实事件。
         换位前有 115ms 的收尾动画，断言必须等它，所以放到 setTimeout 里。 */
      state.order = defOrder(); save(); applyOrder("home");
      var mc = $("homeStack").children[0];

      // E0. 长按前先去拉一次文本选择：卡片必须禁掉，否则手机上系统先把手势抢走
      var cs = getComputedStyle(mc);
      eq("卡片禁止选文字（不然手机上长按会先弹选择菜单）", cs.userSelect || cs.webkitUserSelect, "none");

      // E1. 没长按就动 → 放弃（同步做，时钟来不及插队）
      ok("能模拟触摸事件", fireTouch(mc, "touchstart", 100));
      fireTouch(mc, "touchmove", 145);            // 一上手就划 45px
      fireTouch(mc, "touchend", 145);
      eq("没长按就划 → 不换位置", state.order.home[0], "month");
      ok("也没被判定成拖动（没抬起）", mc.className.indexOf("lift") < 0);
      ok("没留下位移", (mc.style.transform || "") === "");

      // E2. 拖过半 → 换
      fireTouch(mc, "touchstart", 100);
      if(_sw.tm){ clearTimeout(_sw.tm); _sw.tm = null; }
      swLift(mc);
      ok("抬起来那一瞬间关掉过渡（不然卡片追不上手指）", mc.style.transition === "none");
      ok("抬起来时有视觉标记", mc.className.indexOf("lift") >= 0);
      fireTouch(mc, "touchmove", 190);            // 往下 90px
      ok("拖的时候跟着手指走", mc.style.transform.indexOf("translateY") >= 0);
      fireTouch(mc, "touchend", 190);
      // 松手就换完，没有"正在收尾"的中间态 —— 这正是"不会卡在半路"的保证
      eq("松手立刻换位（不等动画）", state.order.home[0], "day");

      setTimeout(function(){
        eq("按住往下拖过半 → 日卡换到上面", state.order.home[0], "day");
        eq("DOM 顺序也真换了", $("homeStack").children[0].dataset.blk, "day");
        ok("换完不留 transform", (mc.style.transform || "") === "");
        ok("换完不再抬着", mc.className.indexOf("lift") < 0);
        ok("换完能接着拖，没有残留状态", _sw.node === null && _sw.on === false);

        /* E3. 只拖一点点 → 必须滑回原位，不能停在半路 */
        state.order = defOrder(); save(); applyOrder("home");
        var mc2 = $("homeStack").children[0];
        fireTouch(mc2, "touchstart", 100);
        if(_sw.tm){ clearTimeout(_sw.tm); _sw.tm = null; }
        swLift(mc2);
        fireTouch(mc2, "touchmove", 140);          // 只拖 40px（不到 45%）
        ok("拖到半路时确实有位移", mc2.style.transform.indexOf("translateY") >= 0 &&
           mc2.style.transform !== "translateY(0px)");
        fireTouch(mc2, "touchend", 140);
        eq("没拖够 → 顺序不变", state.order.home[0], "month");
        ok("没拖够 → 立刻清掉位移（交给 CSS 滑回去）", (mc2.style.transform || "") === "");
        ok("没拖够 → 不再抬着", mc2.className.indexOf("lift") < 0);
        ok("没拖够 → 手势状态清干净", _sw.node === null && _sw.on === false);

        /* E4. 被系统打断（touchcancel）→ 回原位，不算换位 */
        state.order = defOrder(); save(); applyOrder("home");
        var mc3 = $("homeStack").children[0];
        fireTouch(mc3, "touchstart", 100);
        if(_sw.tm){ clearTimeout(_sw.tm); _sw.tm = null; }
        swLift(mc3);
        fireTouch(mc3, "touchmove", 260);          // 拖得很远
        fireTouch(mc3, "touchcancel", 260);
        eq("被系统打断 → 不换位", state.order.home[0], "month");
        ok("被系统打断 → 回到原位", (mc3.style.transform || "") === "" &&
           mc3.className.indexOf("lift") < 0);

        /* E5. 记账页那对卡（细条 + 汇总）也能换 */
        state.order = defOrder(); save(); applyOrder("flow");
        var fs = $("flowStack").children[0];
        fireTouch(fs, "touchstart", 100);
        if(_sw.tm){ clearTimeout(_sw.tm); _sw.tm = null; }
        swLift(fs);
        fireTouch(fs, "touchmove", 200);
        fireTouch(fs, "touchend", 200);
        setTimeout(function(){
          eq("记账页也能把日条拖到上面", state.order.flow[0], "day");
          eq("DOM 也跟着换", $("flowStack").children[0].dataset.blk, "day");

          /* E6. 网页版 / 桌面预览：鼠标长按也能拖（用户常在预览里试） */
          state.order = defOrder(); save(); applyOrder("home");
          var mm = $("homeStack").children[0];
          mm.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, button:0, clientY:100}));
          ok("鼠标按住 → 进入待拖动", _sw.node === mm);
          if(_sw.tm){ clearTimeout(_sw.tm); _sw.tm = null; }
          swLift(mm);
          window.dispatchEvent(new MouseEvent("mousemove", {bubbles:true, cancelable:true, clientY:230}));
          ok("鼠标拖着走", mm.style.transform.indexOf("translateY") >= 0);
          window.dispatchEvent(new MouseEvent("mouseup", {bubbles:true}));
          eq("鼠标松手 → 立刻换位", state.order.home[0], "day");

          /* E7. 长按等够时间后，手指一动不动就松手 → 必须原样，不许换位 */
          state.order = defOrder(); save(); applyOrder("home");
          var still = $("homeStack").children[0];
          fireTouch(still, "touchstart", 100);
          if(_sw.tm){ clearTimeout(_sw.tm); _sw.tm = null; }
          swLift(still);
          fireTouch(still, "touchend", 100);
          eq("长按后没动就松手 → 不换位", state.order.home[0], "month");
          ok("长按后没动就松手 → 不留痕迹", (still.style.transform || "") === "" &&
             still.className.indexOf("lift") < 0 && still.className.indexOf("push") < 0);

          finish();
        }, 60);
      }, 60);

      function finish(){
        if(finishing) return;      // 只收尾一次，防止重复调用把顺序恢复掉
        finishing = true;
        /* 收尾 */
        state.records = back.records;
        state.books = back.books;
        state.dayBud = snap.dayBud;
        state.order = snap.order;
        state.dayMode = snap.dayMode;
        state.dayWeek = snap.dayWeek;
        state.book = snap.book;
        save(); renderAll(); renderHome(); closeSheets();

        document.title = "fix15 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
          " | " + log.join(" | ");
      }
    }catch(e){
      document.title = "fix15 ERR: " + e.message + " | " + log.join(" | ");
    }
  }, 420);

  /* 造一个触摸事件：Chrome 支持 new Touch()，不支持时返回 false 由用例自己判 */
  function fireTouch(el, type, y){
    try{
      var t = new Touch({ identifier: 7, target: el, clientX: 20, clientY: y });
      var ev = new TouchEvent(type, {
        bubbles: true, cancelable: true,
        touches: type === "touchend" ? [] : [t],
        targetTouches: type === "touchend" ? [] : [t],
        changedTouches: [t]
      });
      el.dispatchEvent(ev);
      return true;
    }catch(e){ return false; }
  }
})();
