/* fix28：2026-10-24 用户报的三个问题里的第一个
   「我支付了金额之后，为什么会给我算一笔收入」
   —— 微信支付那条通知尾巴上带着「转账、收款到账、红包…」，
      旧代码先看收入词，于是一条支出通知被判成收入，还取了尾巴上那个更大的数。
   这里锁死：付了钱就必须是支出，且金额取支付那一处。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix28 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }

  var T0 = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 20, 0, 0).getTime();
  function N(app, title, text, min){
    return { app: app, title: title, text: text, ts: T0 + (min || 0) * 60000 };
  }
  function fresh(){
    state.books = [{id:"daily", name:"日常", icon:"🏠", color:BOOK_COLORS[0], budget:1500, def:true}];
    state.records = [];
    state.peerRules = {};
    state.notifyLog = [];
    state.viewMonth = {y: new Date().getFullYear(), m: new Date().getMonth()};
    state.book = "daily"; state.filter = "all"; state.hide = {};
  }

  setTimeout(function(){
    try{
      fresh();

      /* ===== A. 支出通知里带着收款尾巴 ===== */
      var a1 = parseNotify(N("微信支付", "微信支付",
        "已支付 ¥6.98 转账、收款到账、红包，微信支付都能查", 0));
      ok("付了钱就一定是支出", a1 && a1.type === "expense");
      eq("金额取支付那一处，不取尾巴上的数", a1 && a1.amt, 6.98);

      /* 尾巴上那个数比实付大很多时，也不能抢走 */
      var a2 = parseNotify(N("微信支付", "微信支付",
        "已支付 ¥6.98 本月已省 ¥38.50 收款到账也能查", 1));
      eq("尾巴上更大的数抢不走实付", a2 && a2.amt, 6.98);

      /* ===== B. 真收入不能被误判成支出 ===== */
      var b1 = parseNotify(N("微信", "微信",
        "张三向你转账 ¥38.50 请及时收款", 2));
      ok("别人转账仍是收入", b1 && b1.type === "income");
      eq("转账金额取得对", b1 && b1.amt, 38.50);

      var b2 = parseNotify(N("微信支付", "微信支付", "收款到账 ¥38.50", 3));
      ok("收款到账仍是收入", b2 && b2.type === "income");

      var b3 = parseNotify(N("支付宝", "支付宝", "退款成功 ¥23.50 已原路退回", 4));
      ok("退款仍是收入", b3 && b3.type === "income");

      /* 「可用于消费」这种话说的是用法，不是一笔支出 */
      var b4 = parseNotify(N("微信", "微信", "红包已存入零钱 ¥20.00，可用于消费", 5));
      ok("红包入账不能被判成支出", b4 && b4.type === "income");

      /* ===== C. 认不出商户时，名字位置写付款方式，不写「一笔支出」 ===== */
      fresh();
      addFromNotify(parseNotify(N("微信支付", "微信支付", "已支付 ¥6.98", 10)), true);
      var r = state.records[state.records.length - 1];
      ok("确实记成支出了", r && r.type === "expense");
      var html = itemHTML(r);
      ok("大头像不是纸箱问号", html.indexOf("一笔支出") < 0);
      ok("名字位置写上了付款方式", html.indexOf("微信支付") >= 0);

      /* 有商户时照常显示商户，不能被付款方式顶掉 */
      fresh();
      addFromNotify(parseNotify(N("拼多多", "拼多多", "支付成功 ¥6.98 拼多多", 11)), true);
      var r2 = state.records[state.records.length - 1];
      ok("有商户就写商户", r2 && r2.peer === "拼多多");
      var h2 = itemHTML(r2);
      ok("商户名出现在大字里", h2.indexOf("拼多多") >= 0);

      /* ===== D. 同金额的去重没被这次改动弄坏 ===== */
      fresh();
      addFromNotify(parseNotify(N("微信支付", "微信支付", "已支付 ¥6.98", 20)), true);
      addFromNotify(parseNotify(N("拼多多", "拼多多", "订单已支付 ¥6.98 拼多多", 21)), true);
      eq("同金额的两条通知只记一笔", state.records.length, 1);

      report();
    }catch(e){ document.title = "fix28 0/0 || ERR " + e.message; }
  }, 60);
})();
