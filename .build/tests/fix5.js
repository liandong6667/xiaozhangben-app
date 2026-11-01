<script>
/* 1.6.3：通知来源（渠道 vs 平台）+ 退款记收入 */
(function(){
  var L = [], pass = 0, fail = 0;
  function ok(n, c){ if(c){ pass++; } else { fail++; L.push("NO:" + n); } }
  function eq(n, a, b){ ok(n + "(" + a + "!=" + b + ")", a === b); }

  function reset(){
    state.records = [];
    state.books = [{id:"daily", name:"日常", icon:"🏠", color:"#DE6B45", cat:null, budget:0, def:true}];
    state.book = "all";
    state.peerRules = {};
    state.viewMonth = {y: 2026, m: 9};
    state.filter = "all";
  }
  var T = new Date(2026, 9, 22, 10, 0, 0).getTime();
  function n(app, title, text, ts){ return {app:app, title:title, text:text, ts:ts || T}; }

  function run(){
    try{
      /* ============ 一、支付渠道 ≠ 消费平台 ============ */
      // 微信支付的扣款通知（正文里没有商户）
      var p1 = parseNotify(n("微信", "微信支付", "你已支付 ¥38.50"));
      ok("1-微信支付通知能被识别", !!p1);
      eq("1-不是把微信当商户", p1.peer, "一笔支出");
      eq("1-来源记成微信", p1.from, "微信");
      eq("1-方向是支出", p1.type, "expense");

      // 拼多多自己发的支付通知
      var p2 = parseNotify(n("拼多多", "拼多多", "支付成功 ¥38.50"));
      ok("2-拼多多通知能被识别", !!p2);
      eq("2-商户是拼多多", p2.peer, "拼多多");
      eq("2-来源是拼多多", p2.from, "拼多多");

      // 正文里写了「在XX消费」时，商户要取 XX
      var p3 = parseNotify(n("微信", "微信支付", "你在拼多多消费 38.50元"));
      ok("3-能从正文抓出商户", p3.peer === "拼多多");
      eq("3-来源仍是渠道", p3.from, "微信");

      // 两条同额通知：先微信后拼多多 → 合并成拼多多，且只记一笔
      reset();
      ok("4-先到微信支付那笔入账", addFromNotify(parseNotify(n("微信", "微信支付", "你已支付 ¥38.50")), true) === true);
      eq("4-此时商户是兜底名", state.records[0].peer, "一笔支出");
      eq("4-此时来源是微信", state.records[0].from, "微信");
      ok("4-后到拼多多那笔不新增", addFromNotify(parseNotify(n("拼多多", "拼多多", "支付成功 ¥38.50")), true) === false);
      eq("4-始终只有1笔", state.records.length, 1);
      eq("4-商户被升级成拼多多", state.records[0].peer, "拼多多");
      /* 2026-10-23 改：from 这一格装「用什么付的」，不能被平台名顶掉。
         用户原话：「实际支付来源还是按照你在哪里买东西」—— 商户进 peer，渠道留 from。 */
      eq("4-付款渠道不被平台顶掉（仍是微信）", state.records[0].from, "微信");

      // 反序：先拼多多后微信支付 → 不能被降级回微信
      reset();
      addFromNotify(parseNotify(n("拼多多", "拼多多", "支付成功 ¥38.50")), true);
      addFromNotify(parseNotify(n("微信", "微信支付", "你已支付 ¥38.50")), true);
      eq("5-反序也只有1笔", state.records.length, 1);
      eq("5-反序也能补上付款渠道（微信）", state.records[0].from, "微信");
      eq("5-商户没被降级", state.records[0].peer, "拼多多");

      // 明细里要看得见来源
      var html = itemHTML(state.records[0]);
      ok("6-明细显示来自拼多多", html.indexOf("来自 拼多多") >= 0 || html.indexOf("拼多多") >= 0);

      /* ============ 二、退款记成收入 ============ */
      // 退款通知，库里没有对应支出
      reset();
      var r1 = parseNotify(n("拼多多", "拼多多", "退款成功 ¥38.50 已原路退回"));
      ok("7-退款通知能被识别", !!r1);
      eq("7-方向是收入", r1.type, "income");
      ok("7-带退款标记", r1.refund === true);
      ok("7-能入账", addFromNotify(r1, true) === true);
      eq("8-记成收入", state.records[0].type, "income");
      eq("8-分类是退款", state.records[0].cat, "refund");
      eq("8-金额对", state.records[0].amt, 38.5);
      eq("8-来源是拼多多", state.records[0].from, "拼多多");
      eq("8-没找到源就不挂ref", state.records[0].ref, "");

      // 退款通知，库里有对应支出 → 要指回去
      reset();
      var past = new Date(2026, 9, 10, 19, 0, 0).getTime();
      state.records = [{id:"buy1", amt:38.5, type:"expense", cat:"daily", peer:"拼多多", ts:past, book:"daily"}];
      var r2 = parseNotify(n("拼多多", "拼多多", "退款成功 ¥38.50"));
      addFromNotify(r2, true);
      eq("9-多了一笔收入", state.records.length, 2);
      var back = state.records[1];
      eq("9-是收入", back.type, "income");
      eq("9-ref指回原支出", back.ref, "buy1");
      ok("9-备注写明冲减哪天", /冲减 10月10日/.test(back.note));
      var net = state.records.reduce(function(s, x){ return s + (x.type === "income" ? x.amt : -x.amt); }, 0);
      eq("9-净额归零", Math.round(net * 100) / 100, 0);

      // 申请退款 / 处理中：钱还没回来，不能记
      reset();
      eq("10-申请退款不记", parseNotify(n("拼多多", "拼多多", "退款申请已提交 ¥38.50")), null);
      eq("10-退款处理中不记", parseNotify(n("拼多多", "拼多多", "退款处理中 ¥38.50")), null);
      eq("10-退款失败不记", parseNotify(n("拼多多", "拼多多", "退款失败 ¥38.50")), null);
      eq("10-一条都没进库", state.records.length, 0);

      // 「已退款」这种支出方向的文案，也要判成收入
      var r4 = parseNotify(n("微信", "微信支付", "已退款 ¥38.50 至零钱"));
      ok("11-已退款判成收入", r4 && r4.type === "income");
      ok("11-已退款带标记", r4 && r4.refund === true);

      // ============ 三、不能把原来的支出改掉 ============
      reset();
      state.records = [{id:"e1", amt:20, type:"expense", cat:"daily", peer:"拼多多", ts:past, book:"daily"}];
      addFromNotify(parseNotify(n("拼多多", "拼多多", "退款成功 ¥20.00")), true);
      eq("12-原支出还在", state.records.filter(function(x){ return x.id === "e1"; }).length, 1);
      eq("12-原支出金额没变", state.records[0].amt, 20);
      eq("12-新增的是收入", state.records[1].type, "income");

      // 退款再重复投递一次，不能记两笔
      addFromNotify(parseNotify(n("拼多多", "拼多多", "退款成功 ¥20.00")), true);
      eq("13-退款不会重复记", state.records.length, 2);

    }catch(e){
      fail++; L.push("EX:" + (e && e.message));
    }
    document.title = "RESULT pass=" + pass + " fail=" + fail + (L.length ? " | " + L.join(" ; ") : " | ALL OK");
  }

  if(document.readyState === "complete") setTimeout(run, 300);
  else window.addEventListener("load", function(){ setTimeout(run, 300); });
})();
</script>
