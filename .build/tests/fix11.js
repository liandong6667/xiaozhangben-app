/* 1.6.11 布局与归类口径
   A. 结构：分类/账本两个胶囊搬进 .it-tg，排在金额左边，.it-s 里只剩备注
   B. 图标要对得上：分类胶囊里放的就是这个分类的图标（餐饮→🍜，不是小房子）
   C. 真量一遍：不管店名多长、金额几位，胶囊右缘和金额右缘都得在同一条线上
   D. 归类：猜不出来的支出进「其他」、收入进「其他收入」，不再出现"待分类" */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  var _i = 0;
  function rec(o){
    var r = { id: "v" + (++_i), amt: 10, type: "expense", cat: "food",
              peer: "", note: "", ts: Date.now(), src: "notify", book: "" };
    for(var k in o) r[k] = o[k];
    return r;
  }
  /* 2026-10-30：分类图标改成自绘线条 SVG（GL），不再是 emoji。
     这里直接吐渲染用的那段 SVG，断言跟着"渲染出来的是什么"走。 */
  function catIcon(k){ return gicon(k); }
  function px(v){ return Math.round(v * 10) / 10; }

  setTimeout(function(){
    try{
      /* ===== A. 结构：金额在上、两个胶囊横排在下，整块靠右 ===== */
      var h1 = itemHTML(rec({ peer: "学校二食堂", cat: "food", note: "午餐" }));
      ok("胶囊包在 it-tg 里", h1.indexOf('class="it-tg"') >= 0);
      ok("金额和胶囊在同一个右栏", h1.indexOf('class="it-rt"') < h1.indexOf('class="it-a') &&
         h1.indexOf('class="it-a') < h1.indexOf('class="it-tg"'));
      ok("备注那行不再挂胶囊", h1.indexOf('<div class="it-s"><span class="tm">') >= 0 &&
         h1.indexOf("it-tg") > h1.indexOf('class="it-s"'));
      ok("分类胶囊还是可点的", h1.indexOf("<button class=\"pill\"") >= 0 && h1.indexOf("data-cid=") >= 0);

      /* ===== B. 胶囊里的图标 = 分类图标 ===== */
      ok("餐饮胶囊里是🍜", h1.indexOf('<span class="pe">' + catIcon("food") + "</span>") >= 0);
      /* 账本胶囊只写名字 —— 以前它挂 🏠，紧挨着「餐饮」，看着像餐饮的图标是小房子 */
      var oldBk = state.book;
      state.book = "all";
      var hAll = itemHTML(rec({ peer: "学校二食堂", cat: "food", book: "daily" }));
      state.book = oldBk;
      /* 2026-10-26：账本胶囊整个去掉了 —— 右边并排两个灰胶囊太挤，
         而且「📚学习」＋「住房」看着像两个分类在打架。账本名挪进小字行。 */
      ok("右边不再有账本胶囊", hAll.indexOf('class="pill bk"') < 0);
      ok("账本名挪到小字行里", hAll.indexOf("日常") > hAll.indexOf('class="it-s"'));
      ok("整行只有分类这一个 emoji", hAll.indexOf("🏠") < 0);
      var hb = itemHTML(rec({ peer: "郑州地铁", cat: "transport" }));
      ok("交通胶囊里是🚌", hb.indexOf('<span class="pe">' + catIcon("transport") + "</span>") >= 0);
      var hi = itemHTML(rec({ peer: "生活费", cat: "living", type: "income" }));
      ok("收入也用分类图标", hi.indexOf('<span class="pe">' + catIcon("living") + "</span>") >= 0);
      var ho = itemHTML(rec({ peer: "某某", cat: "other" }));
      ok("其他有📦", ho.indexOf('<span class="pe">' + catIcon("other") + "</span>") >= 0);

      /* ===== C. 真量一遍对齐 ===== */
      var oldRecs = state.records, oldBook = state.book;
      /* 直接切到记账页，量真实布局（隐藏页里 getBoundingClientRect 全是 0） */
      document.querySelectorAll(".tab").forEach(function(b){ b.classList.toggle("on", b.dataset.tab === "flow"); });
      document.querySelectorAll(".page").forEach(function(p){ p.classList.remove("on"); });
      var pg = document.getElementById("pg-flow");
      if(pg) pg.classList.add("on");
      state.book = "all";

      var cases = [
        ["学校二食堂", 14, "food"],
        ["学校二食堂", 6.5, "food"],
        ["蜜雪冰城", 4, "food"],
        ["美团外卖", 22.8, "food"],
        ["郑州地铁", 3, "transport"],
        ["校园超市", 39.9, "daily"],
        ["中国移动", 30, "comm"],
        ["某某培训机构（大学路店）", 1280, "study"],
        ["生活费", 2045, "living"],
        ["一个特别特别长的商户名字测试会不会把胶囊挤歪", 9.9, "other"]
      ];
      state.records = cases.map(function(c, i){
        return { id: "lay" + i, ts: Date.now() - i * 60000, amt: c[1],
                 type: c[2] === "living" ? "income" : "expense",
                 cat: c[2], peer: c[0], note: "备注", book: "daily", src: "manual" };
      });
      renderFlow();

      var tgR = [], aR = [], hCat = [], chk = [], aw = [];
      var pillCnt = 0;
      document.querySelectorAll("#flowBody .sw").forEach(function(sw){
        var tg = sw.querySelector(".it-tg");
        var a = sw.querySelector(".it-a");
        var pc = tg.querySelector(".pill");
        pillCnt += tg.querySelectorAll(".pill").length;
        tgR.push(px(tg.getBoundingClientRect().right));
        aR.push(px(a.getBoundingClientRect().right));
        aw.push(px(a.getBoundingClientRect().width));
        if(pc) hCat.push(px(pc.getBoundingClientRect().height));
      });
      var spread = function(arr){
        return arr.length ? Math.round((Math.max.apply(null, arr) - Math.min.apply(null, arr)) * 10) / 10 : -1;
      };
      eq("10 行都渲染出来了", document.querySelectorAll("#flowBody .sw").length, 10);
      ok("胶囊右缘全在一条线上(差" + spread(tgR) + "px)", spread(tgR) <= 1);
      ok("金额右缘也全在一条线上(差" + spread(aR) + "px)", spread(aR) <= 1);
      /* 金额列宽度固定，胶囊才不会跟着金额几位数左右飘 */
      ok("金额列宽度有点下限(不挤胶囊)", aw.every(function(v){ return v >= 73; }));
      ok("分类胶囊高度统一 19", hCat.length === 10 && hCat.every(function(v){ return v === 19; }));
      eq("10 行一共 10 个胶囊（账本胶囊已去掉）", pillCnt, 10);
      /* 金额不能被固定宽度挤到换行或截断 */
      var cut = 0;
      document.querySelectorAll("#flowBody .it-a").forEach(function(a){
        if(a.scrollWidth > a.clientWidth + 1) cut++;
      });
      eq("没有金额被切掉", cut, 0);

      /* 长店名必须截断而不是撑出去 */
      var last = document.querySelectorAll("#flowBody .it-n");
      var lastName = last[last.length - 1];
      ok("超长店名被截断", lastName.scrollWidth > lastName.clientWidth + 1);
      ok("截断后胶囊照样对齐", spread(tgR) <= 1);

      /* 页面不能被撑出横向滚动 */
      var d = document.documentElement;
      ok("没有横向溢出", d.scrollWidth <= d.clientWidth + 1);

      /* 单账本视图：不挂账本胶囊，但分类胶囊还在 */
      state.book = "daily";
      renderFlow();
      var oneTg = document.querySelector("#flowBody .sw .it-tg");
      eq("单账本只有一个胶囊", oneTg.querySelectorAll(".pill").length, 1);
      ok("剩下那个是分类", oneTg.querySelector(".pill").classList.contains("bk") === false);
      state.book = "all";

      state.records = oldRecs;
      state.book = oldBook;
      renderFlow();

      /* ===== D. 归类兜底 ===== */
      var snap = state.records.slice();
      state.records = [];

      function one(line){ return parseBill(line, Date.now()); }
      var r1 = one("2026-10-20 12:00:00  老王小摊  支出  12.00");
      ingest(r1.records);
      var got1 = state.records[state.records.length - 1];
      eq("认不出的支出进其他", got1.cat, "other");
      ok("其他显示📦", itemHTML(got1).indexOf('<span class="pe">' + catIcon("other") + "</span>") >= 0);
      ok("其他写着「其他」", itemHTML(got1).indexOf("其他") >= 0);

      var r2 = one("2026-10-20 13:00:00  张三  收入  50.00");
      ingest(r2.records);
      var got2 = state.records[state.records.length - 1];
      eq("认不出的收入进其他收入", got2.cat, "otherin");

      eq("没有待分类了", uncatCount(), 0);
      renderNotice();
      var nt = document.getElementById("p1Uc");
      ok("首页不再提示待分类", !nt || nt.innerHTML.indexOf("笔待分类") < 0);

      /* 品牌兜底：山姆、沃尔玛这些不在关键词表里，但品牌表里有品类 */
      var r3 = one("2026-10-20 14:00:00  山姆  支出  180.00");
      ingest(r3.records);
      eq("山姆按品牌归到日用", state.records[state.records.length - 1].cat, "daily");

      var r4 = one("2026-10-20 15:00:00  得物  支出  399.00");
      ingest(r4.records);
      eq("得物这种平台不硬塞(其他)", state.records[state.records.length - 1].cat, "other");

      /* 退款不能被兜底改掉 */
      var csvHead = "交易时间,交易类型,交易对方,商品说明,收/支,金额,支付方式,当前状态,交易单号,商户单号,备注\n";
      ingest(one(csvHead + "2026-10-20 16:00:00,商户消费,瑞幸咖啡,生椰拿铁,支出,¥18.00,零钱,支付成功,1,2,/").records);
      ingest(one(csvHead + "2026-10-20 16:10:00,商户消费,瑞幸咖啡,已取消订单,支出,¥18.00,零钱,已全额退款,3,4,/").records);
      var refRow = state.records.filter(function(x){ return x.cat === "refund"; });
      ok("退款仍记成收入(冲减)", refRow.length === 1 && refRow[0].type === "income");

      /* 用户教过的规则优先级最高（先清掉上一轮留下的，否则这条测不出东西） */
      delete state.peerRules["老王小摊"];
      save();
      state.peerRules["老王小摊"] = "fun";
      state.records = [];
      ingest(one("2026-10-20 17:00:00  老王小摊  支出  8.00").records);
      eq("教过的规则优先", state.records[state.records.length - 1].cat, "fun");
      delete state.peerRules["老王小摊"];
      save();

      /* 老数据里的待分类照旧能显示（不清空用户已有的账） */
      var legacy = itemHTML(rec({ peer: "某某商户", cat: null }));
      /* 待分类的问号也换成线条了，这里只认「渲染出了那个问号图标」 */
      ok("老待分类还能渲染", legacy.indexOf("待分类") >= 0 && legacy.indexOf(gicon("unknown")) >= 0);

      state.records = snap;
      renderFlow(); renderHome();

      document.title = "fix11 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
        " | " + log.join(" | ");
    }catch(e){
      document.title = "fix11 ERR: " + e.message + " | " + log.join(" | ");
    }
  }, 420);
})();
