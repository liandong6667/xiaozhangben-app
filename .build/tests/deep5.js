/* deep5：翻月跨年 / 金额极端值 / 删光 / 备份撞 id
   S. 月份导航跨年：1 月往前是上一年 12 月，12 月往后是下一年 1 月
   T. 金额：千分位、浮点累加、九位数不出现 e+
   U. 账目删光之后：首页/明细/账本页都得回到"空"而不是残留旧数
   V. 备份恢复撞 id：账本 id 撞了要带回预算，账目 id 撞了不能出现两条同 id
   W. 空备份不清库、非法日期键不进日预算
   X. state.book 指向不存在的账本时不能白屏 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }

  setTimeout(function(){
    var snap = {
      records: state.records, books: state.books, dayBud: state.dayBud,
      dayMode: state.dayMode, dayWeek: state.dayWeek, order: state.order,
      viewMonth: state.viewMonth, book: state.book, filter: state.filter,
      peerRules: state.peerRules, _storeCount: state._storeCount, _extra: state._extra,
      _flowKey: state._flowKey, _flowAll: state._flowAll
    };
    var Y = new Date().getFullYear(), M = new Date().getMonth();
    function rec(id, y, m, d, amt, extra){
      var r = {id: id, ts: new Date(y, m, d, 9, 0, 0).getTime(), amt: amt,
        type: "expense", cat: "food", peer: "食堂", note: "", book: "daily", src: "manual"};
      if(extra) for(var k in extra) r[k] = extra[k];
      return r;
    }

    try{
      /* ================= S. 翻月跨年 ================= */
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true}];
      state.records = []; state.book = "all"; state.filter = "all";

      var prevBtn = document.querySelector("#pg-flow .monthnav button[data-m='-1']");
      var nextBtn = document.querySelector("#pg-flow .monthnav button[data-m='1']");
      ok("记账页有上一月按钮", !!prevBtn);
      ok("记账页有下一月按钮", !!nextBtn);

      state.viewMonth = {y: Y, m: 0}; state._flowKey = null; renderAll();
      if(prevBtn) prevBtn.click();
      eq("1 月点上一月 → 上一年 12 月", state.viewMonth.y + "-" + state.viewMonth.m, (Y - 1) + "-11");

      state.viewMonth = {y: Y, m: 11}; state._flowKey = null; renderAll();
      if(nextBtn) nextBtn.click();
      eq("12 月点下一月 → 下一年 1 月", state.viewMonth.y + "-" + state.viewMonth.m, (Y + 1) + "-0");

      // 连着点 24 下应该刚好差两年
      state.viewMonth = {y: Y, m: M}; state._flowKey = null; renderAll();
      for(var i = 0; i < 24; i++){ if(nextBtn) nextBtn.click(); }
      eq("连点 24 下下一月 = 两年后同一个月",
        state.viewMonth.y + "-" + state.viewMonth.m, (Y + 2) + "-" + M);

      // 翻到很久以前的月份不该崩
      state.viewMonth = {y: 2020, m: 1}; state._flowKey = null;
      renderAll(); renderFlow();
      ok("翻到 2020 年 2 月能正常渲染（有月份标题）",
        document.querySelector("#pg-flow .monthnav").textContent.indexOf("2020") >= 0);

      /* ================= T. 金额 ================= */
      eq("千分位：99999999.99", money(99999999.99), "99,999,999.99");
      eq("浮点累加：0.1 + 0.2 显示 0.30", money(0.1 + 0.2), "0.30");
      eq("四舍五入：0.005 不会显示成 0.005",
        money(1.005).split(".")[1].length, 2);

      state.records = [rec("m1", Y, M, 3, 88888888.88), rec("m2", Y, M, 4, 0.01)];
      state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      renderAll(); renderHome();
      var outTxt = $("sOut").textContent, leftTxt = $("hmLeft").textContent;
      ok("明细合计没有科学计数法", outTxt.indexOf("e+") < 0 && outTxt.indexOf("E+") < 0);
      ok("首页大数字没有科学计数法", leftTxt.indexOf("e+") < 0 && leftTxt.indexOf("NaN") < 0);
      ok("九位数的合计带了千分位逗号", outTxt.indexOf("88,888,888") >= 0);

      /* ================= U. 删光之后 ================= */
      state.records = [];
      state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      renderAll(); renderHome(); renderBooks();
      eq("删光后首页还能花是 0.00", $("hmLeft").textContent, "0.00");
      eq("删光后明细支出是 ¥0.00", $("sOut").textContent, "¥0.00");
      eq("删光后明细笔数是 0", $("sCnt").textContent.indexOf("0 笔") >= 0, true);
      eq("删光后明细列表是空的", document.querySelectorAll("#flowBody .item").length, 0);
      ok("删光后明细有空态提示", $("flowBody").textContent.trim().length > 0);
      eq("删光后徽标藏起来", $("tabBadge").style.display, "none");

      /* ================= V. 备份撞 id ================= */
      // V1. 账本 id 撞了：新机叫"日常"预算 0，备份里同 id 叫"吃饭"预算 1500
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true}];
      state.records = []; state.dayBud = {}; state._storeCount = 0;
      var bk1 = {
        v: 4,
        books: [{id: "daily", name: "吃饭", icon: "🍜", color: "#2E8C63", budget: 1500, def: true}],
        records: [rec("b1", Y, M, 6, 30, {book: "daily", peer: "面馆"})]
      };
      applyBackup(bk1);
      eq("账本 id 撞了也不会多出一本", state.books.length, 1);
      eq("账本预算跟着备份回来", state.books[0].budget, 1500);
      eq("账本名字跟着备份回来", state.books[0].name, "吃饭");
      eq("账本图标跟着备份回来", state.books[0].icon, "🍜");
      eq("账本颜色也跟着回来", state.books[0].color, "#2E8C63");

      // V2. 备份里的 budget 是 0 时，不能把现在设好的预算清掉
      applyBackup({v: 4, books: [{id: "daily", name: "吃饭", icon: "🍜", color: "#2E8C63", budget: 0}], records: []});
      eq("备份里没写预算时不清掉现在的预算", state.books[0].budget, 1500);

      // V3. 账目 id 撞了但内容不同：不能出现两条同 id 的账
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true}];
      state.records = [rec("same", Y, M, 7, 12, {peer: "本地记的"})];
      applyBackup({v: 4, records: [rec("same", Y, M, 8, 88, {peer: "备份里的"})]});
      var ids = state.records.map(function(r){ return r.id; });
      eq("恢复后账目 id 没有重复", new Set(ids).size, ids.length);
      eq("两份不同的账都在（2 笔）", state.records.length, 2);
      ok("两笔的内容都还在", state.records.some(function(r){ return r.peer === "本地记的"; }) &&
        state.records.some(function(r){ return r.peer === "备份里的"; }));

      // V4. 同一份备份恢复两次：账目 id 不重复、笔数不变
      var bk4 = {v: 4, records: [rec("x1", Y, M, 9, 10), rec("x2", Y, M, 9, 10)]};
      state.records = [];
      applyBackup(bk4);
      applyBackup(bk4);
      eq("同一份备份恢复两次：还是 2 笔", state.records.length, 2);
      var ids4 = state.records.map(function(r){ return r.id; });
      eq("同一份备份恢复两次：id 不重复", new Set(ids4).size, 2);

      // V5. 同一秒同店同价但 id 不同的两笔（真实两笔），恢复时不能吞掉一笔
      state.records = [];
      applyBackup({v: 4, records: [
        rec("t1", Y, M, 10, 12, {peer: "食堂"}),
        rec("t2", Y, M, 10, 12, {peer: "食堂"})
      ]});
      eq("同秒同店同价的两笔都留下来（宁可多一笔）", state.records.length, 2);

      /* ================= W. 空备份 / 非法日期键 ================= */
      state.records = [rec("keep1", Y, M, 11, 6)];
      applyBackup({v: 4, records: []});
      eq("空备份不会把库清空", state.records.length, 1);

      state.dayBud = {};
      applyBackup({v: 4, records: [], dayBud: {"2026-02-30": 100, "abc": 50, "2026-13-01": 10, "": 5}});
      eq("非法日期键一个都不进日预算", Object.keys(state.dayBud).length, 0);

      /* ================= X. book 指向不存在的账本 ================= */
      state.book = "ghost";
      state.records = [rec("g1", Y, M, 12, 3)];
      state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      renderAll(); renderHome(); renderBooks();
      ok("账本指向不存在的 id 时不白屏（首页还在）", !!$("hmLeft") && $("hmLeft").textContent.length > 0);

    }catch(e){
      log.push("N抛异常:" + (e && e.message ? e.message : e));
    }

    // 收尾：还原
    try{
      state.records = snap.records; state.books = snap.books; state.dayBud = snap.dayBud;
      state.dayMode = snap.dayMode; state.dayWeek = snap.dayWeek; state.order = snap.order;
      state.viewMonth = snap.viewMonth; state.book = snap.book; state.filter = snap.filter;
      state.peerRules = snap.peerRules; state._storeCount = snap._storeCount;
      state._extra = snap._extra; state._flowKey = snap._flowKey; state._flowAll = snap._flowAll;
      renderAll(); renderHome();
    }catch(e){}

    var pass = log.filter(function(s){ return s[0] === "Y"; }).length;
    document.title = "deep5 " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 400);
})();
