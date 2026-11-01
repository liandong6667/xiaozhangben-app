/* vds：外部检查报告（DeepSeek Harness，2026-10-25）里那几条的守门测试。
   报告进了 8 条，逐条先用测试复现、再修，这里留成永久回归。

   B1 多条消息拼在一起时取到旧金额（Java 侧顺序，网页侧只认"第一个数"）
   B2 带「可用余额」的通知被整条丢掉
   B3 合并补上商户名后不重算分类 → 品牌 logo 被"图标必须和分类一致"这条拒掉
   B4 两边都没商户、同额，2 分钟内被吞成一笔 —— 查实存在，但**故意不改**（见 B4a 的注释） */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }

  setTimeout(function(){ try{
    var Y = new Date().getFullYear(), M = new Date().getMonth();
    function ts(sec){ return new Date(Y, M, 20, 12, 0, 0).getTime() + sec * 1000; }

    /* ---------- B1：网页侧只认"第一个数"（Java 已保证新的那句排在最前） ---------- */
    /* 契约：拼给网页的文本，第一段必须是刚发生的这条消息。
       Java 那边 PayFilterTest 的 joinMessages 用例守着"新的在前"。 */
    var b1a = parseNotify({app: "微信", title: "微信支付", text: "微信支付 | 支付成功 ¥38.50 | 支付成功 ¥6.98", src: "notify"});
    eq("B1a 新的在前(38.50 是这次)", b1a ? b1a.amt : null, 38.5);
    var b1b = parseNotify({app: "微信", title: "微信支付", text: "微信支付 | 支付成功 ¥6.98 | 支付成功 ¥38.50", src: "notify"});
    eq("B1b 新的在前(6.98 是这次)", b1b ? b1b.amt : null, 6.98);

    /* ---------- B2：带「可用余额」的通知 ---------- */
    var b2a = parseNotify({app: "微信", title: "微信支付", text: "微信支付 支付成功 ¥13.80，可用余额 88.00", src: "notify"});
    eq("B2a 可用余额(微信)", b2a ? b2a.amt : null, 13.8);
    var b2b = parseNotify({app: "招商银行", title: "招商银行", text: "【招商银行】您账户01月20日消费13.80元，可用余额5000.00元", src: "notify"});
    eq("B2b 可用余额(招行)", b2b ? b2b.amt : null, 13.8);
    var b2c = parseNotify({app: "短信", title: "建设银行", text: "您尾号1234的储蓄卡消费人民币13.80元，可用余额5000.00元", src: "sms"});
    eq("B2c 可用余额(建行短信)", b2c ? b2c.amt : null, 13.8);
    /* 余额那个数不能被当成本次金额 */
    eq("B2d 余额不是金额", b2b ? b2b.amt : null, 13.8);
    var b2e = parseNotify({app: "微信", title: "微信支付", text: "微信支付 支付成功 ¥13.80，余额 88.00", src: "notify"});
    eq("B2e 对照：只写余额", b2e ? b2e.amt : null, 13.8);
    /* 反向：真噪音还是不能进 */
    eq("B2f 反向 验证码",
      parseNotify({app: "微信", title: "微信支付", text: "验证码 123456，您正在支付 ¥13.80", src: "notify"}), null);
    eq("B2g 反向 可用额度提醒",
      parseNotify({app: "招商银行", title: "招商银行", text: "您本期可用额度5000.00元，可分期", src: "notify"}), null);

    /* ---------- B3：合并把商户补进来，分类要跟着改 ---------- */
    state.records = [];
    state.peerRules = {};
    addFromNotify({amt: 13.8, type: "expense", peer: "一笔支出", from: "微信", ts: ts(0), note: "", src: "notify"}, true);
    addFromNotify({amt: 13.8, type: "expense", peer: "蜜雪冰城", from: "微信", ts: ts(300), note: "", src: "screen"}, true);
    eq("B3a 合并后条数", state.records.length, 1);
    eq("B3b 合并后商户", state.records[0].peer, "蜜雪冰城");
    eq("B3c 合并后分类跟着改", state.records[0].cat, "food");
    var h3 = state.records[0] ? itemHTML(state.records[0]) : "";
    ok("B3d 明细行用的是真logo(<img>)", /<img/.test(h3));

    state.records = [];
    addFromNotify({amt: 21, type: "expense", peer: "一笔支出", from: "支付宝", ts: ts(0), note: "", src: "notify"}, true);
    addFromNotify({amt: 21, type: "expense", peer: "肯德基", from: "支付宝", ts: ts(300), note: "", src: "screen"}, true);
    eq("B3e 肯德基分类", state.records[0].cat, "food");
    ok("B3f 肯德基真logo", /<img/.test(itemHTML(state.records[0])));

    /* 用户自己改过的分类不许被覆盖 */
    state.records = [];
    addFromNotify({amt: 32, type: "expense", peer: "一笔支出", from: "微信", ts: ts(0), note: "", src: "notify"}, true);
    state.records[0].cat = "entertain";       // 用户手动改成「娱乐」
    addFromNotify({amt: 32, type: "expense", peer: "肯德基", from: "微信", ts: ts(300), note: "", src: "screen"}, true);
    eq("B3g 手改过的分类不覆盖", state.records[0].cat, "entertain");

    /* ---------- B4：两条都没商户、同额，隔多久算两笔 ---------- */
    function pair(gapSec, src1, src2){
      state.records = [];
      addFromNotify({amt: 13.8, type: "expense", peer: "一笔支出", from: "微信", ts: ts(0), note: "", src: src1}, true);
      addFromNotify({amt: 13.8, type: "expense", peer: "一笔支出", from: "微信", ts: ts(gapSec), note: "", src: src2}, true);
      return state.records.length;
    }
    /* B4 这一条**没改** —— 报告说应该缩到 30 秒，但缩了会重新挖开 1.6.18 修过的坑：
       同一条「扣款 ¥38.50」被系统重复投递两次、跨了分钟边界，账上直接翻倍。
       两头都是真事，这里选择"宁可极少数情况少记一笔，也不让金额翻倍"。
       所以把现在的行为锁死，谁改了都会红。 */
    eq("B4a 同一路 80 秒 = 一笔（取舍：防翻倍优先）", pair(80, "notify", "notify"), 1);
    eq("B4b 同一路 3 分钟 = 两笔（窗口外）", pair(180, "notify", "notify"), 2);
    eq("B4c 同一路 15 秒 = 一笔（重复投递）", pair(15, "notify", "notify"), 1);
    eq("B4d 通知 + 抓屏 同额 80 秒 = 一笔", pair(80, "notify", "screen"), 1);
    eq("B4e 通知 + 抓屏 同额 100 秒 = 一笔（2分钟窗口）", pair(100, "notify", "screen"), 1);

    /* 一边报了真商户：仍然是 15 分钟窗口（这条老规矩不能被我改坏） */
    state.records = [];
    addFromNotify({amt: 5.75, type: "expense", peer: "一笔支出", from: "微信", ts: ts(0), note: "", src: "notify"}, true);
    addFromNotify({amt: 5.75, type: "expense", peer: "拼多多", from: "微信", ts: ts(600), note: "", src: "screen"}, true);
    eq("B4f 一边报商户 → 10 分钟仍是同一笔", state.records.length, 1);
    eq("B4g 商户补上了", state.records[0].peer, "拼多多");

    /* 两边都报了同一个商户：仍然按 2 分钟（不是 60 秒）——
       这是「同一条通知被重复投递」的主力场景，缩窗口会把账记两遍 */
    state.records = [];
    addFromNotify({amt: 38.5, type: "expense", peer: "店甲", from: "微信", ts: ts(0), note: "", src: "notify"}, true);
    addFromNotify({amt: 38.5, type: "expense", peer: "店甲", from: "微信", ts: ts(119), note: "", src: "notify"}, true);
    eq("B4h 两边都报同一商户 119 秒仍是一笔", state.records.length, 1);
    addFromNotify({amt: 38.5, type: "expense", peer: "店甲", from: "微信", ts: ts(121), note: "", src: "notify"}, true);
    eq("B4i 121 秒出了窗口 = 两笔", state.records.length, 2);

  }catch(e){ log.push("N EX:" + e.message); }

  var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
  var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
  var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
  document.title = "vds " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR " +
    (window.__errs && window.__errs.length ? window.__errs.join("|") : "none");
  }, 700);
})();
