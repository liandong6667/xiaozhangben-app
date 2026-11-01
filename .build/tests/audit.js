/* audit：不复用那些"直接改 state"的断言，全部走真实入口，复核前几轮修过的 bug。
   数据来源都是真实链路：parseNotify+addFromNotify（通知）、parseBill+ingest（账单）、
   applyBackup（备份）、真实按钮点击（恢复出厂 / 待分类 / 报表）。

   A. 1.6.18 修的 6 个：重复记账 / 同秒同店同价 / 退款冲减 / 缺颜色白屏 / 金额日期解析
   B. 1.6.19 修的 6 个：首页跨月 / 恢复出厂 / 备份跳月 / 按星期留空 / 跳过文案 / 转义
   C. 1.6.20 修的 3 个：备份账本撞 id / 备份吞重复 / 备份 id 撞车
   D. 长期原则：每笔有账本、合计实时算、待分类全月、800 笔截断、toast 纯文本 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function near(n, got, want){ log.push((Math.abs(got - want) < 0.005 ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }

  setTimeout(function(){
    var snap = {
      records: state.records, books: state.books, dayBud: state.dayBud,
      dayMode: state.dayMode, dayWeek: state.dayWeek, order: state.order,
      viewMonth: state.viewMonth, book: state.book, filter: state.filter,
      peerRules: state.peerRules, _storeCount: state._storeCount, _extra: state._extra,
      _flowKey: state._flowKey, _flowAll: state._flowAll
    };
    var Y = new Date().getFullYear(), M = new Date().getMonth();
    var T0 = new Date(Y, M, 20, 12, 0, 0).getTime();

    function reset(){
      state.records = [];
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 0, def: true}];
      state.book = "all"; state.filter = "all"; state.peerRules = {};
      state.viewMonth = {y: Y, m: M}; state._flowKey = null; state._flowAll = null;
      state.dayBud = {}; state.dayMode = 1; state.dayWeek = [0,0,0,0,0,0,0];
      state._storeCount = 0;
      try{ allowEmptySave = true; }catch(e){}
    }
    function notif(app, title, text, ts){ return parseNotify({app: app, title: title, text: text, ts: ts}); }
    function push(app, title, text, ts){ var p = notif(app, title, text, ts); return p ? addFromNotify(p, true) : false; }

    /* ==================== A. 通知链路（1.6.18） ==================== */
    try{
      reset();
      var p1 = notif("微信", "微信支付", "微信支付凭证 扣款 ¥38.50", T0);
      ok("A1 微信扣款能认成一笔支出", !!p1 && p1.type === "expense");
      eq("A1 渠道 App 不能当商户（不能写成「微信」）", p1 && p1.peer, "一笔支出");
      eq("A1 来源 App 记成微信", p1 && p1.from, "微信");
      addFromNotify(p1, true);
      eq("A1 入库一笔", state.records.length, 1);

      var p2 = notif("拼多多", "拼多多", "拼多多 支付成功 ¥38.50", T0 + 40000);
      addFromNotify(p2, true);
      eq("A2 拼多多那条 40 秒后到，还是同一笔（不重复）", state.records.length, 1);
      /* 2026-10-23 改：这一格（from）装的是「用什么付的」，不能被平台名顶掉。
         用户原话：「实际支付来源还是按照你在哪里买东西」——
         商户进 peer（拼多多），付款渠道留 from（微信）。 */
      eq("A2 商户补成拼多多（在哪买的）", state.records[0].peer, "拼多多");
      eq("A2 付款渠道仍是微信（用什么付的）", state.records[0].from, "微信");

      reset();
      push("微信", "微信支付", "扣款 ¥58.00", T0);
      push("微信", "微信支付", "扣款 ¥58.00", T0 + 65000);
      eq("A3 跨过分钟边界的同额通知不重复记", state.records.length, 1);
      push("微信", "微信支付", "扣款 ¥58.00", T0 + 200000);
      eq("A4 隔 3 分钟的同额是另外一笔（2 分钟窗口外）", state.records.length, 2);

      reset();
      push("微信", "微信支付", "在 星巴克 消费 ¥30.00", T0);
      push("微信", "微信支付", "在 麦当劳 消费 ¥30.00", T0 + 30000);
      eq("A5 两家不同的店、同价、隔 30 秒 → 两笔，不能吞", state.records.length, 2);
      eq("A5 商户各自记对", state.records.map(function(r){ return r.peer; }).join(","), "星巴克,麦当劳");

      reset();
      push("微信", "微信支付", "在 美团 消费 ¥100.00", T0);
      var pr = notif("微信", "微信支付", "退款到账 ¥100.00", T0 + 3600000);
      ok("A6 退款到账认成收入", !!pr && pr.type === "income" && pr.refund === true);
      addFromNotify(pr, true);
      var rf = state.records.filter(function(r){ return r.cat === "refund"; })[0];
      ok("A6 退款入账成一笔收入", !!rf && rf.type === "income");
      eq("A6 原支出不动（还是支出，没被改成 0）", state.records.filter(function(r){ return r.type === "expense"; }).length, 1);
      eq("A6 退款的 ref 指回原支出", rf && rf.ref, state.records[0].id);
      eq("A6 退款笔数没多出来", state.records.length, 2);

      ok("A7 「退款申请已提交」不是一笔账", notif("微信", "微信支付", "退款申请已提交 ¥100.00", T0) === null);
      ok("A7 「退款处理中」也不记", notif("微信", "微信支付", "退款处理中 ¥100.00", T0) === null);

      reset();
      push("招商银行", "入账通知", "工资到账 ¥2000.00", T0);
      push("微信", "微信支付", "退款到账 ¥2000.00", T0 + 50000);
      eq("A8 同分钟「工资 2000」和「退款 2000」是两笔，退款不能被当重复吞掉", state.records.length, 2);
      eq("A8 退款那笔分类是退款", state.records.filter(function(r){ return r.cat === "refund"; }).length, 1);

      ok("A9 验证码不记账", notif("短信", "验证码", "验证码 123456，5 分钟内有效", T0) === null);
      ok("A9 取件码不记账", notif("短信", "取件码", "取件码 8-2-3012，请及时取件", T0) === null);
      ok("A9 聊天里的「[转账]100元」不记账", notif("微信", "张三", "[转账]100.00元", T0) === null);
      ok("A10 超过 100 万的金额不记（防解析错）", notif("微信", "微信支付", "扣款 ¥1000001.00", T0) === null);
    }catch(e){ log.push("NA段异常:" + (e && e.message ? e.message : e)); }

    /* ==================== B. 账单解析（1.6.18） ==================== */
    try{
      reset();
      var csv = [
        "微信支付账单明细",
        "微信昵称：[示例]",
        "起始时间：[2026-09-21 00:00:00] 终止时间：[2026-10-21 00:00:00]",
        "----------------------",
        "交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号",
        (Y + "-" + pad2(M + 1) + "-05 12:30:00,商户消费,星巴克,咖啡,支出,\"¥1,200.00\",零钱,支付成功,NO1"),
        (Y + "-" + pad2(M + 1) + "-05 12:30:00,商户消费,星巴克,咖啡,支出,\"¥1,200.00\",零钱,支付成功,NO2"),
        (Y + "-" + pad2(M + 1) + "-06 09:00:00,商户消费,食堂,午饭,支出,\"1.2万\",零钱,支付成功,NO3"),
        (Y + "." + pad2(M + 1) + ".07 20:15:00,商户消费,超市,日用,支出,¥.5,零钱,支付成功,NO4")
      ].join("\n");
      function pad2(n){ return (n < 10 ? "0" : "") + n; }
      var pb = parseBill(csv, new Date(Y, M, 10));
      eq("B1 四行都解析出来了", pb.records.length, 4);
      near("B2 带千分位的 ¥1,200.00 读成 1200", pb.records[0].amt, 1200);
      near("B3 「1.2万」读成 12000", pb.records[2].amt, 12000);
      near("B4 「¥.5」读成 0.5", pb.records[3].amt, 0.5);
      ok("B5 点分隔日期 2026.10.07 认对了",
        new Date(pb.records[3].ts).getMonth() === M && new Date(pb.records[3].ts).getDate() === 7);

      ingest(pb.records, pb.skipped, pb.refunds);
      eq("B6 同秒同店同价但单号不同的两笔都入库", state.records.length, 4);
      var ids = state.records.map(function(r){ return r.id; });
      eq("B6 id 不重复", new Set(ids).size, ids.length);

      // 重导同一份：不该多一笔
      var before = state.records.length;
      var pb2 = parseBill(csv, new Date(Y, M, 10));
      ingest(pb2.records, pb2.skipped, pb2.refunds);
      eq("B7 同一份账单再导一次：一笔不多", state.records.length, before);

      // 同一份文件里一模一样的行（没有单号列）只留一行
      reset();
      var dupCsv = "交易时间,交易对方,收/支,金额(元)\n" +
        (Y + "-" + pad2(M + 1) + "-08 10:00:00,食堂,支出,12.00\n") +
        (Y + "-" + pad2(M + 1) + "-08 10:00:00,食堂,支出,12.00\n");
      var pd = parseBill(dupCsv, new Date(Y, M, 10));
      ingest(pd.records, pd.skipped, pd.refunds);
      eq("B8 一字不差的两行只留一行", state.records.length, 1);

      // 退款行：库里有同额支出 → 冲减；没有 → 不记
      reset();
      push("微信", "微信支付", "在 京东 消费 ¥199.00", T0);
      var rc = "交易时间,交易对方,收/支,金额(元),当前状态,交易单号\n" +
        (Y + "-" + pad2(M + 1) + "-21 10:00:00,京东,支出,199.00,已退款,R1\n");
      var pr2 = parseBill(rc, new Date(Y, M, 10));
      ingest(pr2.records, pr2.skipped, pr2.refunds);
      var back = state.records.filter(function(r){ return r.cat === "refund"; });
      eq("B9 库里已有的支出被退款冲回来（多一笔退款收入）", back.length, 1);
      near("B9 冲减金额对得上", back[0] && back[0].amt, 199);
      ok("B9 冲减的 ref 指回那笔支出", !!back[0] && back[0].ref === state.records[0].id);

      reset();
      var pr3 = parseBill("交易时间,交易对方,收/支,金额(元),当前状态\n" +
        (Y + "-" + pad2(M + 1) + "-21 11:00:00,某店,支出,88.00,已退款\n"), new Date(Y, M, 10));
      ingest(pr3.records, pr3.skipped, pr3.refunds);
      eq("B10 库里有没这笔支出时，孤立退款不硬记（净额 0）", state.records.length, 0);
    }catch(e){ log.push("NB段异常:" + (e && e.message ? e.message : e)); }

    /* ==================== C. 页面口径（1.6.19） ==================== */
    try{
      // C1 首页永远按真实本月
      reset();
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 1000, def: true}];
      state.records = [
        {id: "c1a", ts: new Date(Y, M, 3, 9, 0, 0).getTime(), amt: 100, type: "expense", cat: "food", peer: "本月店", note: "", book: "daily", src: "manual"},
        {id: "c1b", ts: new Date(Y, M === 0 ? 11 : M - 1, 3, 9, 0, 0).getTime(), amt: 777, type: "expense", cat: "food", peer: "上月店", note: "", book: "daily", src: "manual"}
      ];
      state.viewMonth = {y: Y, m: M === 0 ? 11 : M - 1}; state._flowKey = null;
      renderAll(); renderHome();
      ok("C1 记账页翻到上个月，首页还是本月（已花 100 而不是 877）",
        $("hmSpent").textContent.indexOf("100.00") >= 0);
      eq("C1 首页还能花 = 1000 - 100", $("hmLeft").textContent.replace(/,/g, ""), "900.00");

      // C2 恢复出厂连预算一起清，重启不复活
      reset();
      state.records = [{id: "c2a", ts: T0, amt: 20, type: "expense", cat: "food", peer: "店", note: "", book: "daily", src: "manual"}];
      state.dayBud[ymdKey(Y, M, 1)] = 120; state.dayMode = 2; state.dayWeek = [10,20,30,40,50,60,70];
      state.books[0].budget = 500;
      save();
      wipeAll();
      $("askInp").value = "恢复出厂";
      $("askInp").dispatchEvent(new Event("input"));
      $("askYes").click();
      eq("C2 恢复出厂：账目清空", state.records.length, 0);
      eq("C2 恢复出厂：日预算清空", Object.keys(state.dayBud).length, 0);
      eq("C2 恢复出厂：填法回默认", state.dayMode, 1);
      eq("C2 恢复出厂：星期表归零", state.dayWeek.join(","), "0,0,0,0,0,0,0");
      eq("C2 恢复出厂：账本预算归零", state.books[0].budget, 0);
      load();
      eq("C2 重启后日预算没复活", Object.keys(state.dayBud).length, 0);
      eq("C2 重启后账目还是空的", state.records.length, 0);

      // C3 恢复备份后跳到备份所在月份
      reset();
      applyBackup({v: 4, records: [
        {id: "c3a", ts: new Date(Y - 1, 2, 5, 9, 0, 0).getTime(), amt: 9, type: "expense", cat: "food", peer: "老店", note: "", book: "daily", src: "manual"}
      ]});
      eq("C3 恢复完跳到备份那笔所在的月份", state.viewMonth.y + "-" + state.viewMonth.m, (Y - 1) + "-2");
      /* 2026-10-26 起流水页是"切过去才画"（首屏省掉它，见 index.html 里 renderFlow 开头）。
         所以要真走一遍用户路径：点 tab。不能直接查一个从没画过的 #flowBody ——
         那样测的就不是"用户看不看得到"，而是"内部有没有提前画"。 */
      goto("flow");
      ok("C3 恢复后明细里看得到那笔", $("flowBody").textContent.indexOf("老店") >= 0);
      goto("home");

      // C4 按星期套用：留空的星期要清掉旧值
      reset();
      state.dayMode = 3;
      renderAll();
      openDayBud();                       // 生成 #dbWeek7 的 7 行输入框
      var dd = new Date(Y, M + 1, 0).getDate();
      for(var d = 1; d <= dd; d++) state.dayBud[ymdKey(Y, M, d)] = 100;   // 先铺满 100
      document.querySelectorAll("#dbWeek7 input.wk-in").forEach(function(inp, i){
        inp.value = [80, 80, 80, 80, 80, 0, 0][i];
      });
      applyWeek();
      var sunday = null, saturday = null, workday = null;
      for(var d2 = 1; d2 <= dd; d2++){
        var wd = new Date(Y, M, d2).getDay();
        if(wd === 0 && sunday === null) sunday = d2;
        if(wd === 6 && saturday === null) saturday = d2;
        if(wd >= 1 && wd <= 5 && workday === null) workday = d2;   // 1 号不一定是工作日
      }
      eq("C4 按星期套用后周日变成「不限」（清掉了 100）", sunday ? dayBudOf(ymdKey(Y, M, sunday)) : 0, 0);
      eq("C4 按星期套用后周六也是「不限」", saturday ? dayBudOf(ymdKey(Y, M, saturday)) : 0, 0);
      /* 别写死 1 号：2026-11-01 正好是周日，那条断言会平白无故变红。
         取本月第一个周一到周五。 */
      eq("C4 周一到周五按 80 设上了", workday ? dayBudOf(ymdKey(Y, M, workday)) : 0, 80);

      // C5 待分类跳过后的收尾文案
      reset();
      state.records = [
        {id: "c5a", ts: new Date(Y, M, 2, 9, 0, 0).getTime(), amt: 11, type: "expense", cat: null, peer: "甲", note: "", book: "daily", src: "import"},
        {id: "c5b", ts: new Date(Y, M, 3, 9, 0, 0).getTime(), amt: 22, type: "expense", cat: null, peer: "乙", note: "", book: "daily", src: "import"},
        {id: "c5c", ts: new Date(Y, M, 4, 9, 0, 0).getTime(), amt: 33, type: "expense", cat: null, peer: "丙", note: "", book: "daily", src: "import"}
      ];
      state.viewMonth = {y: Y, m: M}; state._flowKey = null; renderAll(); renderHome();
      openUc(); ucPick("food"); ucSkip(); ucPick("daily");
      ok("C5 跳过一笔后不说「都归好类了」，如实说还剩 1 笔",
        $("ucBody").textContent.indexOf("还有 1 笔没分") >= 0);
      eq("C5 徽标和弹窗是同一个数", $("tabBadge").textContent, "1");
      closeSheets();

      // C6 商户名带尖括号不能撑坏详情面板
      reset();
      state.records = [{id: "c6a", ts: T0, amt: 38.5, type: "expense", cat: "food",
        peer: "<b>不良商家</b>&店", note: "", book: "daily", src: "manual"}];
      state.viewMonth = {y: Y, m: M}; state._flowKey = null; renderAll();
      openInfo("c6a");
      /* 断言要看 HTML 源码里有没有真的 <b> 标签，
         不能看 textContent —— 转义正确的文字本身长得就像 <b>不良商家</b>。 */
      eq("C6 商户名里的尖括号被转义了（源码里没有真标签）",
        $("infoBody").innerHTML.indexOf("<b>不良商家") >= 0, false);
      ok("C6 尖括号原样显示成文字", $("infoBody").textContent.indexOf("<b>不良商家</b>") >= 0);
      closeSheets();

      // C7 账本 id 带引号，data 属性不能被切断
      reset();
      state.books.push({id: 'q"z', name: "带引号", icon: "📒", color: "#2E8C63", budget: 0});
      state.records = [{id: "c7a", ts: T0, amt: 5, type: "expense", cat: "food", peer: "店", note: "", book: 'q"z', src: "manual"}];
      state.viewMonth = {y: Y, m: M}; state._flowKey = null; renderAll();
      var bi = document.querySelector('#bookGrid [data-bid]');
      eq("C7 账本卡片的 data-bid 完整（引号没切断）",
        Array.prototype.map.call(document.querySelectorAll("#bookGrid [data-bid]"), function(e){ return e.dataset.bid; }).indexOf('q"z') >= 0, true);

      // C8 待分类按全部月份数
      reset();
      state.records = [
        {id: "c8a", ts: new Date(Y, M, 2, 9, 0, 0).getTime(), amt: 1, type: "expense", cat: null, peer: "本月", note: "", book: "daily", src: "manual"},
        {id: "c8b", ts: new Date(Y, M === 0 ? 11 : M - 1, 2, 9, 0, 0).getTime(), amt: 2, type: "expense", cat: null, peer: "上月", note: "", book: "daily", src: "manual"}
      ];
      state.viewMonth = {y: Y, m: M}; state._flowKey = null; renderAll(); renderHome();
      eq("C8 待分类数全部月份（本月 1 + 上月 1 = 2）", uncatCount(), 2);
      ok("C8 首页待分类卡也说 2 笔", $("hmUc").textContent.indexOf("2 笔") >= 0);

      // C9 900 笔明细截断，但合计是全月
      reset();
      var big = [];
      for(var i = 0; i < 900; i++){
        big.push({id: "c9_" + i, ts: new Date(Y, M, 1 + (i % 28), 9, 0, 0).getTime(),
          amt: 1, type: "expense", cat: "food", peer: "店" + (i % 7), note: "", book: "daily", src: "manual"});
      }
      state.records = big;
      state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      goto("flow");            // 同 C3：流水页切过去才画
      renderAll();
      var items = document.querySelectorAll("#flowBody .item").length;
      /* 截断按「天」判断，最后一天整组留下，所以会略超 800（不会把一天拆两半） */
      ok("C9 明细截断了（实际 " + items + " 条，远少于 900）", items < 900 && items >= 700);
      eq("C9 合计仍然是 900 笔", $("sCnt").textContent, "共 900 笔");
      ok("C9 有「还有 100 笔更早的」入口", $("flowBody").textContent.indexOf("还有") >= 0);
      goto("home");            // 回首页，后面的用例从默认状态出发

      // C10 toast 只显示纯文本
      toast("<b>粗体</b><img src=x onerror=alert(1)>");
      eq("C10 toast 里没有生成标签", $("toast").querySelectorAll("b,img").length, 0);
      ok("C10 toast 原样显示成文字", $("toast").textContent.indexOf("<b>") >= 0);

      // C11 账本页的总支出是实时算的，不是写死的
      reset();
      state.records = [{id: "c11a", ts: T0, amt: 10, type: "expense", cat: "food", peer: "店", note: "", book: "daily", src: "manual"}];
      state.viewMonth = {y: Y, m: M}; state._flowKey = null; renderAll(); renderBooks();
      eq("C11 一笔 10 元时账本页显示 10.00", $("bbOut").textContent.replace(/[¥,]/g, ""), "10.00");
      state.records[0].amt = 42.5;
      renderBooks();
      eq("C11 改成 42.5 后账本页跟着变（没有硬编码）", $("bbOut").textContent.replace(/[¥,]/g, ""), "42.50");
    }catch(e){ log.push("NC段异常:" + (e && e.message ? e.message : e)); }

    /* ==================== D. 备份（1.6.20） ==================== */
    try{
      reset();
      applyBackup({v: 4,
        books: [{id: "daily", name: "吃饭", icon: "🍜", color: "#2E8C63", budget: 1500, def: true}],
        records: [{id: "d1", ts: T0, amt: 30, type: "expense", cat: "food", peer: "面馆", note: "", book: "daily", src: "manual"}]
      });
      eq("D1 账本 id 撞了不会多出一本", state.books.length, 1);
      eq("D1 预算跟着备份回来", state.books[0].budget, 1500);
      eq("D1 名字跟着备份回来", state.books[0].name, "吃饭");
      eq("D1 图标和颜色也跟着回来", state.books[0].icon + state.books[0].color, "🍜#2E8C63");
      eq("D1 账目也回来了", state.records.length, 1);

      applyBackup({v: 4, books: [{id: "daily", name: "吃饭", budget: 0}], records: []});
      eq("D1 备份里没写预算时，不清掉现在的预算", state.books[0].budget, 1500);

      reset();
      applyBackup({v: 4, records: [
        {id: "d2a", ts: T0, amt: 12, type: "expense", cat: "food", peer: "食堂", note: "", book: "daily", src: "manual"},
        {id: "d2b", ts: T0, amt: 12, type: "expense", cat: "food", peer: "食堂", note: "", book: "daily", src: "manual"}
      ]});
      eq("D2 备份里同秒同店同价的两笔都留（宁可多一笔）", state.records.length, 2);

      reset();
      state.records = [{id: "same", ts: T0, amt: 7, type: "expense", cat: "food", peer: "本地", note: "", book: "daily", src: "manual"}];
      applyBackup({v: 4, records: [{id: "same", ts: T0 + 86400000, amt: 99, type: "expense", cat: "food", peer: "备份", note: "", book: "daily", src: "manual"}]});
      var dids = state.records.map(function(r){ return r.id; });
      eq("D3 备份 id 撞车后换新号，两笔 id 不重复", new Set(dids).size, dids.length);
      eq("D3 两笔都在", state.records.length, 2);

      var bk = {v: 4, records: [{id: "d4", ts: T0, amt: 5, type: "expense", cat: "food", peer: "店", note: "", book: "daily", src: "manual"}]};
      reset();
      applyBackup(bk); applyBackup(bk);
      eq("D4 同一份备份恢复两次：还是一笔", state.records.length, 1);

      var bad = false;
      try{ applyBackup({books: []}); }catch(e){ bad = true; }
      ok("D5 不是备份的文件被拦住（抛错）", bad);

      reset();
      applyBackup({v: 4, records: [], dayBud: {"2026-02-30": 100, "abc": 5, "2026-13-01": 9}});
      eq("D6 非法日期键不进日预算", Object.keys(state.dayBud).length, 0);
    }catch(e){ log.push("ND段异常:" + (e && e.message ? e.message : e)); }

    /* ==================== E. 长期原则 ==================== */
    try{
      reset();
      push("拼多多", "拼多多", "拼多多 支付成功 ¥12.00", T0);
      reset();
      var csv2 = "交易时间,交易对方,收/支,金额(元)\n" + (Y + "-" + pad2(M + 1) + "-09 10:00:00,超市,支出,30\n");
      var p2 = parseBill(csv2, new Date(Y, M, 10));
      ingest(p2.records, p2.skipped, p2.refunds);
      ok("E1 导入进来的账有账本（不能漏 book）", state.records.every(function(r){ return !!r.book && state.books.some(function(b){ return b.id === r.book; }); }));
      eq("E1 落到默认账本", state.records[0].book, "daily");

      reset();
      push("微信", "微信支付", "在 麦当劳 消费 ¥25.00", T0);
      ok("E2 通知记账也有账本", !!state.records[0].book);

      reset();
      state.books.push({id: "study", name: "学习", icon: "📚", color: "#4C6FFF", budget: 0, cat: "study"});
      push("微信", "微信支付", "在 当当 消费 ¥45.00", T0);
      ok("E3 有分类绑定的账本时，账照样落在存在的账本里",
        !!state.records[0] && state.books.some(function(b){ return b.id === state.records[0].book; }));
    }catch(e){ log.push("NE段异常:" + (e && e.message ? e.message : e)); }

    try{
      state.records = snap.records; state.books = snap.books; state.dayBud = snap.dayBud;
      state.dayMode = snap.dayMode; state.dayWeek = snap.dayWeek; state.order = snap.order;
      state.viewMonth = snap.viewMonth; state.book = snap.book; state.filter = snap.filter;
      state.peerRules = snap.peerRules; state._storeCount = snap._storeCount;
      state._extra = snap._extra; state._flowKey = snap._flowKey; state._flowAll = snap._flowAll;
      renderAll(); renderHome();
    }catch(e){}

    var pass = log.filter(function(s){ return s[0] === "Y"; }).length;
    document.title = "audit " + pass + "/" + log.length + " | " + log.join(" | ");
  }, 400);
})();
