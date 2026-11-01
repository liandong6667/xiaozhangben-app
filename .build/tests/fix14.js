<script>
/* 针对清单里 14 条的回归断言。逐条对应，改坏哪条这里会红。 */
(function(){
  var L = [], pass = 0, fail = 0;
  function ok(name, cond){ if(cond){ pass++; } else { fail++; L.push("NO:" + name); } }
  function eq(name, a, b){ ok(name + "(" + a + "!=" + b + ")", a === b); }

  function run(){
    try{
      /* ===== 1. 当月只有收入时不能崩 ===== */
      var now = new Date();
      state.records = [{id:"i1", amt:2000, type:"income", cat:"living", ts:now.getTime(), book:"daily"}];
      state.books = [{id:"daily",name:"日常",icon:"🏠",color:"#DE6B45",cat:null,budget:0,def:true}];
      state.book = "all";
      state.viewMonth = {y: now.getFullYear(), m: now.getMonth()};
      var threw = null;
      try{ renderStats(); }catch(e){ threw = e.message; }
      ok("1-只收入不崩(" + threw + ")", threw === null);
      var sb = document.getElementById("statsBody").innerHTML;
      ok("1-显示本月没有支出", sb.indexOf("本月没有支出") >= 0);
      // renderAll 整轮不中断：我的页版本号必须被写到真实版本
      try{ renderAll(); }catch(e){ threw = e.message; }
      ok("1-renderAll 不中断", threw === null);
      eq("1-我的页版本号", document.getElementById("meVer").textContent.indexOf(VER.name) >= 0, true);

      /* ===== 2. 千分位 ===== */
      eq("2-¥1,200.00", extractAmount("支付成功 ¥1,200.00"), 1200);
      eq("2-房租1,200.50元", extractAmount("房租 1,200.50元"), 1200.5);
      eq("2-12,345,678.90", extractAmount("¥12,345,678.90"), 12345678.9);
      eq("2-无逗号1200.50", extractAmount("1200.50元"), 1200.5);
      /* 2026-10-30 截图记账删了，但 shotAmount 被 parseNotify 用着（挑金额），
         必须留着 —— 删了通知解析直接炸。这条守的就是"别再被当死代码删掉"。 */
      var sa = shotAmount("微信支付\n¥1,200.00\n支付成功");
      eq("2-截图残留的取金额函数还在（通知解析在用）", sa && sa.v, 1200);
      ok("2-截图面板确实没了", !document.getElementById("sheetShot"));
      eq("2-不把1,20当千分位", extractAmount("1,20"), 20);

      /* ===== 3. 文本方向优先 ===== */
      var p1 = parseText("昨天收到生活费2000", Date.now(), "expense");
      eq("3-收到→收入", p1[0].type, "income");
      var p2 = parseText("午饭15", Date.now(), "income");
      eq("3-无支出词按选中", p2[0].type, "income");
      var p3 = parseText("15", Date.now(), "income");
      eq("3-无词按选中", p3[0].type, "income");
      // 真走一遍补记
      state.records = [];
      document.getElementById("qi").value = "收到生活费2000";
      state.manualType = "expense"; state.manualCat = null;
      commitManual();
      eq("3-补记入库收入", state.records.length, 1);
      eq("3-补记类型", state.records[0].type, "income");
      eq("3-补记金额", state.records[0].amt, 2000);

      /* ===== 4. 跨来源去重 ===== */
      state.records = [];
      var t0 = new Date(2026, 9, 20, 12, 0, 20).getTime();
      var t1 = t0 + 41000;   // 41 秒后，另一个来源
      ingest([{amt:22.8, type:"expense", peer:"美团", note:"", ts:t0, cat:null}], 0);
      var r4 = ingest([{amt:22.8, type:"expense", peer:"美团外卖", note:"", ts:t1, cat:null}], 0);
      eq("4-跨来源只进1笔", state.records.length, 1);
      eq("4-第二次算重复", r4.dup, 1);
      // 同一份账单里真的买了两杯一样价钱的咖啡，不能吞掉第二笔
      state.records = [];
      ingest([
        {amt:15, type:"expense", peer:"咖啡", note:"", ts:t0, cat:null},
        {amt:15, type:"expense", peer:"咖啡", note:"", ts:t0 + 20000, cat:null}
      ], 0);
      eq("4-同一批两笔都留", state.records.length, 2);
      // 整月账单重复导入一次，全部算重复
      state.records = [];
      var batch = [];
      for(var i = 0; i < 10; i++) batch.push({amt:10 + i, type:"expense", peer:"p" + i, note:"", ts:t0 + i * 600000, cat:null});
      ingest(batch, 0);
      var again = ingest(batch, 0);
      eq("4-重导整月全跳过", again.dup, 10);
      eq("4-重导不加笔", state.records.length, 10);

      /* ===== 5. 导入跳过要报出来 ===== */
      var seenMsg = "";
      var _oldToast = window.toast;
      window.toast = function(m){ seenMsg = String(m); };
      reportIngest({added:3, dup:0, guessed:1, uncat:2, skipped:4});
      ok("5-提示含没算行数(" + seenMsg + ")", seenMsg.indexOf("4 行没算") >= 0);
      window.toast = _oldToast;
      // 支出行 + 退款行成对出现：两行都要进，净额归零（1.6.1 在这里也差过钱）
      var bl = "交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态\n" +
               "2026-10-20 12:00:00,商户消费,美团,外卖,支出,¥38.50,支付成功\n" +
               "2026-10-20 13:00:00,退款,美团,外卖退款,支出,¥38.50,退款成功\n";
      var pb = parseBill(bl, Date.now());
      eq("5-成对退款解析出2行", pb.records.length, 2);
      eq("5-退款行单独计数", pb.refunds, 1);
      state.records = [];
      var r5 = ingest(pb.records, pb.skipped, pb.refunds);
      eq("5-支出和退款都进库", state.records.length, 2);
      eq("5-退款冲减成功", r5.refundBack, 1);
      var net5 = state.records.reduce(function(s, x){ return s + (x.type === "income" ? x.amt : -x.amt); }, 0);
      eq("5-成对退款净额为0", Math.round(net5 * 100) / 100, 0);

      /* ===== 6. 聊天转账不算消费 ===== */
      var chatSamples = ["[转账]100.00元", "张三: 转账给你 100.00元", "[2条]张三: 转账 100.00元"];
      chatSamples.forEach(function(s){
        var p = parseNotify({app:"微信", title:"微信", text:s, ts:Date.now()});
        ok("6-聊天不记(" + s + ")", p === null);
      });
      var realPay = parseNotify({app:"支付宝", title:"支付宝", text:"支付宝: 转账成功 100.00元", ts:Date.now()});
      ok("6-真通知仍记", realPay !== null);
      var realPay2 = parseNotify({app:"微信", title:"微信支付", text:"微信支付 支付成功 ¥38.50", ts:Date.now()});
      ok("6-支付成功仍记", realPay2 !== null);

      /* ===== 7. 账本名不能注入 ===== */
      window.__pwn = 0;
      document.getElementById("nbName").value = '<img src=x onerror="window.__pwn=1">';
      var n0 = state.books.length;
      createBook();
      eq("7-账本建上了", state.books.length, n0 + 1);
      eq("7-脚本没执行", window.__pwn, 0);
      var tt = document.getElementById("toast");
      eq("7-toast无子元素", tt.children.length, 0);
      ok("7-toast按文字显示", tt.textContent.indexOf("<img") >= 0);
      // 删掉这个账本，同样不能执行
      var bad = state.books[state.books.length - 1];
      delBook(bad.id);
      var yes = document.getElementById("askYes");
      if(yes && !yes.disabled) yes.click();
      eq("7-删除也不执行", window.__pwn, 0);
      state.books = state.books.filter(function(b){ return b.name.indexOf("<img") < 0; });

      /* ===== 8. 待分类口径 ===== */
      var lastM = new Date(now.getFullYear(), now.getMonth() - 1, 15).getTime();
      state.records = [{id:"u1", amt:20, type:"expense", cat:null, ts:lastM, book:"daily"}];
      state.viewMonth = {y: now.getFullYear(), m: now.getMonth()};
      eq("8-上月的也算待分类", uncatCount(), 1);
      renderNotice();
      var nt = document.getElementById("p1Uc").innerHTML;
      ok("8-不谎报全部分好", nt.indexOf("全部账目都分好类了") < 0);
      ok("8-提示别的月份(" + nt.slice(0, 60) + ")", nt.indexOf("笔在别的月份") >= 0);
      // 点进去要能清掉它
      openUc();
      eq("8-批量队列含上月的", ucQ.length, 1);
      closeSheets();

      /* ===== 9. 截图商户单独一行 ===== */
      /* 截图记账 2026-10-30 下线，截图专用的商户提取函数（shotPeer）跟着删了。
         通知那条链路用的是 notifyPeer，能力没丢，下面第 10 段还在验它。 */
      ok("9-截图专用的商户提取已删除", typeof window.shotPeer === "undefined");

      /* ===== 10. 发红包是支出 ===== */
      eq("10-给朋友发红包", parseOne("给朋友发红包50", Date.now(), "income").type, "expense");
      eq("10-发红包", parseOne("发红包50", Date.now(), "income").type, "expense");
      eq("10-收红包", parseOne("收红包50", Date.now(), "expense").type, "income");
      eq("10-别人给我发红包", parseOne("张三给你发了个红包50", Date.now(), "expense").type, "income");

      /* ===== 14. 小配置走原生 ===== */
      kvSet("xzb.theme", '{"skin":"green","mode":"dark"}');
      eq("14-kv 读回", kvGet("xzb.theme"), '{"skin":"green","mode":"dark"}');
      eq("14-kv 缺省", kvGet("no.such.key"), "");

    }catch(e){
      fail++;
      L.push("EX:" + e.message + "@" + (e.stack || "").split("\n")[1]);
    }
    document.title = "PASS=" + pass + " FAIL=" + fail + " | " + L.join(" ; ");
  }

  setTimeout(run, 700);
})();
</script>
