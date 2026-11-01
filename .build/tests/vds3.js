/* vds3：外部包（1.6.59 修复版）核验时实测出来的 4 个坑，钉死别再犯。
   2026-10-25。

   ① 「订单已支付」被当成"订单进度"挡掉 —— 饿了么/支付宝的通知里
      「饿了么 订单已支付 ¥26.80」是最常见的付款成功表达，被挡住等于
      点完外卖账上什么都没有（real 场景 17 实测 0 笔）。

   ② 订单线索（外卖的「商家正在备餐」）不带金额，会把无关的支出冠名：
      26.8 的饿了么线索把 1500 的房租记成了「饿了么 / 餐饮」
      （real 场景 32 实测）。护栏：实付不会超过订单总价。

   ③ 线索比这笔支付还晚 —— 那是"下一笔"的订单，不能拿来补。
      测试里前一个用例留下的线索会污染后一个用例（fix21 B1/C1 实测）。

   ④ 茶饮品牌重复添加：一点点/都可/益禾堂/书亦/甜啦啦/快乐柠檬/7分甜
      表里本来就有（连带官方图），加第二遍匹配词重复，后写的永远命中不了。

   同样重要的一条：这些护栏不能把"订单线索补商户"这个功能本身弄坏 ——
   美团 18.00 的订单 + 微信 13.41 的实付，必须仍然合成一笔、商户是美团。
*/
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }

  var T0 = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 19, 0, 0).getTime();
  function N(app, title, text, min){
    return { app: app, title: title, text: text, ts: T0 + (min || 0) * 60000 };
  }
  function fresh(){
    state.books = [{id:"daily", name:"日常", icon:"🏠", color:BOOK_COLORS[0], budget:1500, def:true}];
    state.records = [];
    state.peerRules = {};
    state.orderHints = [];            // 线索表是会话级的，每个场景从头来
    state.viewMonth = {y: new Date().getFullYear(), m: new Date().getMonth()};
    state.book = "daily"; state.filter = "all";
  }
  function feed(list){
    fresh();
    list.forEach(function(it){
      var p = parseNotify(it);
      if(p) addFromNotify(p, true);
    });
    return state.records;
  }
  /* 带着「之前留下的订单线索」再喂一笔 —— 跨场景污染就是这么发生的，
     所以要能精确复现。注意 fresh() 会清线索，必须先 fresh 再塞。 */
  function feedH(hints, list){
    fresh();
    state.orderHints = hints.slice();
    list.forEach(function(it){
      var p = parseNotify(it);
      if(p) addFromNotify(p, true);
    });
    return state.records;
  }

  setTimeout(function(){ try{

    /* ---------- ① 订单已支付 就是付款成功，必须记账 ---------- */
    var a = feed([N("支付宝", "支付宝", "饿了么 订单已支付 ¥26.80", 0)]);
    eq("A1 饿了么「订单已支付」要记一笔", a.length, 1);
    eq("A2 金额", a[0] && a[0].amt, 26.8);
    eq("A3 商户饿了么", a[0] && a[0].peer, "饿了么");
    eq("A4 分类餐饮", a[0] && a[0].cat, "food");

    var a2 = feed([N("美团", "美团外卖", "您的订单已支付 ¥38.50", 0)]);
    eq("A5 美团「您的订单已支付」也要记账", a2.length, 1);
    eq("A6 金额", a2[0] && a2[0].amt, 38.5);

    /* 真正的订单进度仍然要挡住（别把这条修反了） */
    var a3 = feed([N("美团", "美团外卖", "订单金额18.00元，支付成功，商家正在备餐", 0)]);
    eq("A7 「商家正在备餐」不单独记账", a3.length, 0);
    eq("A8 但它留下了商户线索", (state.orderHints || []).length, 1);
    eq("A9 线索是美团", state.orderHints[0] && state.orderHints[0].name, "美团");

    /* ---------- ② 线索不能冠到金额更大的账上 ---------- */
    var b = feedH([{ name: "饿了么", ts: T0, amt: 26.8 }],
      [N("微信", "微信支付", "转账-房租 ¥1,500.00", 30)]);
    eq("B1 1500 的房租不会被 26.8 的饿了么线索冠名", (b[0] && b[0].peer) !== "饿了么", true);
    eq("B2 分类也不该变成餐饮", (b[0] && b[0].cat) !== "food", true);

    /* 实付 ≤ 订单总价：该补的还得补上 */
    var b2 = feedH([{ name: "美团", ts: T0, amt: 18.0 }],
      [N("微信", "微信支付", "微信支付凭证 ¥13.41", 2)]);
    eq("B3 13.41 实付 ≤ 18 订单 → 商户补成美团", b2[0] && b2[0].peer, "美团");

    /* 金额相等也要补（没优惠券的情况） */
    var b3 = feedH([{ name: "饿了么", ts: T0, amt: 26.8 }],
      [N("微信", "微信支付", "微信支付凭证 ¥26.80", 3)]);
    eq("B4 金额相等 → 照样补", b3[0] && b3[0].peer, "饿了么");

    /* ---------- ③ 比支付还晚的线索不能用 ---------- */
    var c = feedH([{ name: "美团", ts: T0 + 60000, amt: 18.0 }],
      [N("微信", "微信支付", "你已支付 ¥12.00", 0)]);
    eq("C1 线索比这笔支付晚 1 分钟 → 不补", String(c[0] && c[0].peer), "一笔支出");
    eq("C2 付款方式照样记下", c[0] && c[0].from, "微信");

    /* 早 30 秒以内的算同一笔（通知延迟） */
    var c2 = feedH([{ name: "美团", ts: T0 - 20000, amt: 18.0 }],
      [N("微信", "微信支付", "你已支付 ¥12.00", 0)]);
    eq("C3 线索早 20 秒 → 还当同一笔，补上", c2[0] && c2[0].peer, "美团");

    /* 超过 15 分钟就不用了 */
    var c3 = feedH([{ name: "美团", ts: T0, amt: 18.0 }],
      [N("微信", "微信支付", "你已支付 ¥12.00", 20)]);
    eq("C4 隔 20 分钟 → 不补", String(c3[0] && c3[0].peer), "一笔支出");

    /* ---------- ④ 品牌表不许有重复匹配词 ---------- */
    var seen = {}, dup = [];
    BRANDS.forEach(function(x){ x.k.forEach(function(k){ if(seen[k]) dup.push(k); seen[k] = 1; }); });
    eq("D1 没有重复的匹配词[" + dup.join(",") + "]", dup.length, 0);

    /* 茶饮这几家认得出来，且归餐饮 */
    ["喜茶", "奈雪的茶", "一点点", "书亦烧仙草", "蜜雪冰城", "coco都可"].forEach(function(name, i){
      var r = feed([N("微信", "微信支付", name + " 支付成功 ¥15.00", 0)]);
      eq("D" + (2 + i) + " 认得出" + name, r[0] && r[0].cat, "food");
    });

    /* ---------- ⑤ 别把好功能修坏：订单线索的主场景 ---------- */
    var e = feed([
      N("美团", "美团外卖", "订单金额18.00元，支付成功，商家正在备餐", 0),
      N("微信", "微信支付", "微信支付凭证 ¥13.41", 1)
    ]);
    eq("E1 外卖总价 + 实付 → 只留一笔", e.length, 1);
    eq("E2 留下的金额是实付 13.41", e[0] && e[0].amt, 13.41);
    eq("E3 商户是美团", e[0] && e[0].peer, "美团");

    /* 支付先到、订单进度后到（反方向），两分钟内唯一一笔时补上 */
    var f = feed([
      N("微信", "微信支付", "微信支付凭证 ¥13.41", 0),
      N("美团", "美团外卖", "订单金额18.00元，支付成功，商家正在备餐", 1)
    ]);
    eq("F1 反方向也只留一笔", f.length, 1);
    eq("F2 商户补成美团", f[0] && f[0].peer, "美团");

    /* 两笔同价真消费，不能被合成一笔 */
    var g = feed([
      N("微信", "微信支付", "蜜雪冰城 支付成功 ¥8.00", 0),
      N("微信", "微信支付", "瑞幸咖啡 支付成功 ¥8.00", 1)
    ]);
    eq("G1 两家店同价 → 两笔", g.length, 2);

    /* ---------- ⑥ 「＋ 更多」分类面板：两层别叠在一起 ---------- */
    openAddSheet();
    document.getElementById("qi").value = "昨天买书36";
    document.getElementById("chipMore").click();
    ok("H1 分类面板打开", document.getElementById("sheetCat").classList.contains("on"));
    ok("H2 补记面板让开（两层贴底会叠成一团）",
      !document.getElementById("sheetAdd").classList.contains("on"));
    var cb = document.querySelector("#catGrid [data-cat]");
    ok("H3 分类面板里有分类", !!cb);
    var pick = cb ? cb.dataset.cat : "";
    if(cb) cb.click();
    ok("H4 选完分类面板关掉", !document.getElementById("sheetCat").classList.contains("on"));
    ok("H5 回补记面板接着写", document.getElementById("sheetAdd").classList.contains("on"));
    eq("H6 选中的分类生效", state.manualCat, pick);
    eq("H7 已经打的字没丢", document.getElementById("qi").value, "昨天买书36");

    /* 点空白处也只退一层 */
    document.getElementById("mask").click();
    document.getElementById("qi").value = "午饭15";
    document.getElementById("chipMore").click();
    document.getElementById("mask").click();
    ok("H8 点空白处先退回补记",
      document.getElementById("sheetAdd").classList.contains("on") &&
      !document.getElementById("sheetCat").classList.contains("on"));

    /* 返回键同样只退一层 */
    document.getElementById("chipMore").click();
    window.__onBack();
    ok("H9 返回键也是先退回补记",
      document.getElementById("sheetAdd").classList.contains("on") &&
      !document.getElementById("sheetCat").classList.contains("on"));
    closeSheets();

  }catch(err){ log.push("N EX:" + err.message); }

  var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
  var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
  var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
  document.title = "vds3 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR " +
    (window.__errs && window.__errs.length ? window.__errs.join("|") : "none");
  }, 60);
})();
