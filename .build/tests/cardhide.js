/* cardhide：首页两张卡「−」收起 / 「＋」叫回来
   用户原话："在这两个小组件的右上角保留一个减号，如果用不到其中一个的话……
   点减号把它消掉；消掉之后又想加回来，那么下面肯定要有一个加号。"
   A. 初始两张都在，下面没有多余东西
   B. 点 − 收起：卡消失、下面冒出对应的 ＋
   C. 存盘读回：重启后还是收起的样子
   D. 点 ＋ 叫回来
   E. 两张都收起也不炸
   F. 只剩一张时不许拖（没得换）
   G. 恢复出厂：卡片回到两张都在
   H. 备份导出/恢复都带着收起状态
   I. 坏存档里的 hide 不许乱收（"yes" / 1 / 陌生键）
   J. 换过位置再收起，剩下的那张顶到最上面 */
(function(){
  /* 1.6.24 起收起/展开带 190ms 动画，状态要等动画完才落库。
     逻辑断言不需要看动画，这里直接关掉，断言仍按同步写法跑；
     动画本身由 cardanim.js 用真实时序单独核对。 */
  window.XZB_NO_ANIM = true;
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }

  setTimeout(function(){
    var snap = {
      records: state.records, books: state.books, hide: state.hide, order: state.order,
      dayBud: state.dayBud, dayMode: state.dayMode, dayWeek: state.dayWeek,
      viewMonth: state.viewMonth, _storeCount: state._storeCount, _extra: state._extra
    };
    var Y = new Date().getFullYear(), M = new Date().getMonth();

    try{
      /* ---------- 造一份最小数据 ---------- */
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true}];
      state.records = [
        {id: "ch1", ts: new Date(Y, M, 3, 12, 0, 0).getTime(), amt: 12.5, type: "expense",
         cat: "food", peer: "食堂", note: "", book: "daily", src: "manual"}
      ];
      state.hide = {}; state.order = defOrder();
      state.dayBud = {}; state.dayMode = 1; state.dayWeek = [0,0,0,0,0,0,0];
      state.viewMonth = {y: Y, m: M};
      renderAll(); renderHome();

      function card(k){ return document.querySelector('#homeStack [data-blk="' + k + '"]'); }
      function bar(){ return document.getElementById("hmAddBar"); }
      function shown(k){ return !card(k).classList.contains("away"); }

      /* ================= A 初始 ================= */
      ok("A1 一开始两张卡都在", shown("month") && shown("day"));
      eq("A2 都没收起时下面那排是空的", bar().children.length, 0);
      /* 判据从 display:none 改成"真的不占地方"：
         加号那块现在靠 height:0 + overflow:hidden 收起来（为了能平滑长出来），
         display 仍是 flex，但占位必须是 0。 */
      ok("A3 空的时候整块不占地方（高度 0、无上边距）",
        bar().offsetHeight === 0 && getComputedStyle(bar()).marginTop === "0px");
      ok("A4 两张卡各自有一枚减号",
        !!document.getElementById("hmXMonth") && !!document.getElementById("hmXDay"));

      /* ================= B 点 − 收起本月 ================= */
      document.getElementById("hmXMonth").click();
      ok("B1 点 − 之后本月卡收起来了", !shown("month"));
      ok("B2 今天卡没被连坐", shown("day"));
      eq("B3 下面出现 1 枚加号", bar().children.length, 1);
      ok("B4 加号写清是加回哪张", bar().textContent.indexOf("加回「本月」") >= 0);
      eq("B5 收起的那张真的不占高度了", card("month").getBoundingClientRect().height, 0);
      ok("B6 收起状态记进了内存", state.hide.month === true);
      eq("B7 首页数字照常算（收起只是不看，不是不算）", $("hmLeft").textContent, "12.50");
      eq("B8 有加号时这块要显示出来", getComputedStyle(bar()).display, "flex");

      /* ================= C 存盘读回 ================= */
      save();
      load();
      renderAll(); renderHome();
      ok("C1 重启后本月卡仍然是收起的", !shown("month"));
      ok("C2 重启后今天卡还在", shown("day"));
      eq("C3 重启后那枚加号还在", bar().children.length, 1);

      /* ================= D 点 ＋ 叫回来 ================= */
      bar().querySelector('[data-show="month"]').click();
      ok("D1 点 ＋ 之后本月卡回来了", shown("month"));
      eq("D2 叫回来之后加号就没了", bar().children.length, 0);
      ok("D3 内存里的收起标记也清了", !state.hide.month);
      ok("D4 加号那块又缩回去不占位（高度 0）", bar().offsetHeight === 0);

      /* ================= E 两张都收起 ================= */
      document.getElementById("hmXMonth").click();
      document.getElementById("hmXDay").click();
      ok("E1 两张都能收起来", !shown("month") && !shown("day"));
      eq("E2 两枚加号都在", bar().children.length, 2);
      ok("E3 加号各自对着不同的卡",
        !!bar().querySelector('[data-show="month"]') && !!bar().querySelector('[data-show="day"]'));
      eq("E4 两张都收起时数据没丢（本月数还是对的）", $("hmLeft").textContent, "12.50");
      ok("E5 两张都收起时下面的「最近」照常显示", $("hmRecent").children.length > 0);
      ok("E6 收起后卡片容器没有残留高度",
        document.getElementById("homeStack").getBoundingClientRect().height === 0);

      /* ================= F 只剩一张时不许拖 ================= */
      bar().querySelector('[data-show="day"]').click();
      eq("F1 只剩一张卡时可供拖动的只有 1 个",
        swKids(document.getElementById("homeStack")).length, 1);
      eq("F2 只剩一张时不启动拖动（没得换就别拦手势）",
        swBegin(card("day"), 100), false);

      /* ================= G 恢复出厂 ================= */
      state.hide = {month: true, day: true};
      renderHome();
      ok("G1 先弄成两张都收起", !shown("month") && !shown("day"));
      wipeAll();
      $("askInp").value = "恢复出厂";
      $("askInp").dispatchEvent(new Event("input"));   // 不打这一下按钮还是灰的
      $("askYes").click();
      ok("G2 恢复出厂后两张卡都回来了", shown("month") && shown("day"));
      eq("G3 恢复出厂后收起记录是空的", Object.keys(state.hide || {}).length, 0);
      eq("G4 恢复出厂后加号区也空了", bar().children.length, 0);

      /* ================= H 备份带着收起状态 ================= */
      state.hide = {day: true};
      var cap = null, OB = window.Blob;
      window.Blob = function(parts, opt){
        try{ if(parts && parts[0]) cap = String(parts[0]); }catch(_){}
        return new OB(parts, opt);
      };
      try{ doExport(); }catch(e){ }
      window.Blob = OB;
      ok("H1 导出的备份里带 hide 字段", !!cap && cap.indexOf('"hide"') >= 0);
      ok("H2 备份里记的是「今天」那张收起",
        !!cap && /"hide"\s*:\s*\{\s*"day"\s*:\s*true\s*\}/.test(cap));

      state.hide = {};
      renderHome();
      applyBackup({records: [], books: state.books, hide: {month: true}});
      renderAll(); renderHome();
      ok("H3 恢复备份后本月卡跟着收起", !shown("month"));
      ok("H4 恢复备份后今天卡在", shown("day"));

      /* ================= I 坏数据不许乱收 ================= */
      applyBackup({records: [], hide: {month: "yes", day: 1, foo: true}});
      renderAll(); renderHome();
      ok("I1 存档里写字符串 yes 不算收起", shown("month"));
      ok("I2 存档里写数字 1 不算收起", shown("day"));
      ok("I3 不认识的键一律丢掉", !state.hide.foo);
      ok("I4 坏值也不会把两张卡都收掉", shown("month") && shown("day"));

      /* ================= J 换过位置再收起 ================= */
      state.hide = {}; state.order.home = ["day", "month"];
      renderAll(); renderHome();
      document.getElementById("hmXDay").click();
      ok("J1 收起上边那张", !shown("day"));
      var stackTop = document.getElementById("homeStack").getBoundingClientRect().top;
      ok("J2 剩下的本月卡顶到最上面",
        Math.abs(card("month").getBoundingClientRect().top - stackTop) < 2);
      ok("J3 换过位置也不影响收起状态", state.hide.day === true);

    }catch(e){
      log.push("N异常:" + (e && e.message ? e.message : e));
    }

    /* ---------- 还现场，别把后面的用例带坏 ---------- */
    try{
      state.records = snap.records; state.books = snap.books; state.hide = snap.hide;
      state.order = snap.order; state.dayBud = snap.dayBud; state.dayMode = snap.dayMode;
      state.dayWeek = snap.dayWeek; state.viewMonth = snap.viewMonth;
      state._storeCount = snap._storeCount; state._extra = snap._extra;
      renderAll(); renderHome();
    }catch(e){}

    var pass = log.filter(function(s){ return s[0] === "Y"; }).length;
    document.title = "cardhide " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 450);
})();
