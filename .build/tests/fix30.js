/* fix30：明细行左边的图标 —— 老账里那个纸箱子 📦 必须消失
   用户原话（2026-10-24 22:41）："我的就是新版的但是图标没显示呀，用的是默认图标"。

   查下来的实情：新记的账（peer=抖音 / 拼多多）早就上真 logo 了，
   显示成纸箱子的全是 **1.6.51 之前存下来的老账** —— 那时候会把微信支付通知末尾
   那句广告语「转账、收款到账、银行扣款，微信支付都能查」当成商户名写进账里，
   也有版本把「已寄出」「行程结束」这种状态词当店名。这类名字既不匹配品牌，
   又不是空的，于是落到 📦 这个占位符上。

   这里锁三件事：
   A. 读档时把这类废话商户名清掉（清完自动改用付款渠道的 logo + 名字）
   B. 没收录 logo 的店，用店名首字做头像，不再出现 📦 / ❓
   C. 恢复备份时同样清一遍 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix30 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }

  setTimeout(function(){ try{
    var Y = new Date().getFullYear(), M = new Date().getMonth();
    function ts(d, h){ return new Date(Y, M, d, h || 12, 0, 0).getTime(); }
    var TAIL = "转账、收款到账、银行扣款，微信支付都能查";

    /* 图标是不是真 logo（<img>）、是不是首字头像、是不是某个字符 */
    function iconOf(r){
      var h = itemHTML(r);
      var i = h.indexOf('class="it-ic');
      if(i < 0) return {cls: "无", txt: ""};
      var seg = h.slice(i, i + 900);      // 图标改成线条 SVG 后变长了，400 会截断
      var cls = (seg.match(/^class="it-ic([^"]*)"/) || ["", "?"])[1].trim();
      if(seg.indexOf("<img") >= 0) return {cls: cls, txt: "img"};
      /* 1.6.90 起分类图标回到 emoji，方块里就是一个字符；
         火锅例外，那是我们自己画的铜锅（一段 <svg>）。 */
      if(seg.indexOf("<svg") >= 0 && seg.indexOf("<svg") < seg.indexOf("</div>", seg.indexOf(">")))
        return {cls: cls, txt: "svg:hotpot"};
      var j = seg.indexOf(">");
      var txt = seg.slice(j + 1, seg.indexOf("</div>", j));
      return {cls: cls, txt: txt};
    }
    function nameOf(r){
      var m = itemHTML(r).match(/it-n">([^<]*)/);
      return m ? m[1] : "";
    }

    /* ---------- 一、读档时清掉废话商户名 ---------- */
    var store = {
      v: 4,
      books: [{id: "daily", name: "日常", icon: "🏠", color: "#DE6B45", budget: 0, def: true}],
      records: [
        {id: "a", ts: ts(20, 21), amt: 38.5, type: "expense", cat: "human",
         peer: TAIL, from: "微信", note: "", book: "daily"},
        {id: "b", ts: ts(20, 20), amt: 12, type: "expense", cat: "other",
         peer: "已寄出", from: "微信", note: "", book: "daily"},
        {id: "c", ts: ts(20, 19), amt: 9, type: "expense", cat: "food",
         peer: "老张小吃店", from: "微信", note: "", book: "daily"},
        {id: "d", ts: ts(20, 18), amt: 13.8, type: "expense", cat: "other",
         peer: "拼多多", from: "微信", note: "", book: "daily"},
        {id: "e", ts: ts(20, 17), amt: 20, type: "expense", cat: null,
         peer: "一笔支出", from: "支付宝", note: "", book: "daily"},
        {id: "f", ts: ts(20, 16), amt: 500, type: "expense", cat: "other",
         peer: "微信支付", from: "微信", note: "", book: "daily"}
      ]
    };
    localStorage.setItem(KEY, JSON.stringify(store));
    load();

    function peerOf(id){
      var r = state.records.filter(function(x){ return x.id === id; })[0];
      return r ? String(r.peer || "") : "__missing__";
    }
    eq("A1 广告语当商户 → 读档时清空", peerOf("a"), "");
    eq("A2 「已寄出」状态词 → 清空", peerOf("b"), "");
    eq("A3 真店名「老张小吃店」→ 原样保留", peerOf("c"), "老张小吃店");
    eq("A4 平台名「拼多多」→ 必须保留（它不是渠道）", peerOf("d"), "拼多多");
    eq("A5 老兜底词「一笔支出」→ 清空", peerOf("e"), "");
    eq("A6 渠道名「微信支付」→ 清空", peerOf("f"), "");

    /* ---------- 二、清完之后的图标 ---------- */
    function rec(patch){
      var base = {id: "x", ts: ts(20, 12), amt: 10, type: "expense", cat: "other",
                  peer: "", from: "微信", note: "", book: "daily", src: "notify"};
      for(var k in patch) base[k] = patch[k];
      return base;
    }

    var g1 = iconOf(rec({peer: "", from: "微信"}));
    eq("B1 认不出商户 → 微信真 logo", g1.cls, "br has-img");
    eq("B2 名字写成「微信支付」而不是空话", nameOf(rec({peer: "", from: "微信"})), "微信支付");

    var g2 = iconOf(rec({peer: "抖音", cat: "fun"}));
    eq("B3 抖音 → 抖音真 logo", g2.cls, "br has-img");

    var g3 = iconOf(rec({peer: "老张小吃店", cat: "food"}));
    eq("B4 没收录 logo 的店 → 用图案（暗底，不再是汉字头像）", g3.cls, "emo");
    ok("B5 图标里不是「老」这个字", !/[\u4e00-\u9fa5]/.test(g3.txt) && g3.txt.length > 0);
    ok("B6 不再是纸箱子 📦", g3.txt !== "📦");
    ok("B7 名字还是店名", nameOf(rec({peer: "老张小吃店", cat: "food"})) === "老张小吃店");

    var g4 = iconOf(rec({peer: "老王便利店", cat: "food"}));
    eq("B8 便利店 → 店招图标", g4.txt, "🏪");

    var g5 = iconOf(rec({peer: "", from: "邮储银行", cat: "other"}));
    eq("B9 银行短信来的 → 银行名当头像（有 logo 走 img）", g5.txt, "img");

    var g6 = iconOf(rec({peer: "", from: "", cat: "food"}));
    eq("B10 什么都不知道 → 用分类图标，不用问号", g6.txt, "🍽️");

    var g7 = iconOf(rec({peer: TAIL, cat: "human"}));
    eq("B11 老账（peer 还是广告语）→ 也走微信 logo，不落 📦", g7.cls, "br has-img");

    var g8 = iconOf(rec({peer: "已寄出", from: "微信", cat: "other"}));
    eq("B12 老账（peer 是状态词）→ 微信 logo", g8.cls, "br has-img");

    var g10 = iconOf(rec({peer: "财付通支付科技有限公司", from: "邮储银行", cat: "other"}));
    eq("B13 收单机构（财付通）不当商户 → 银行名当头像（有 logo 走 img）", g10.txt, "img");

    /* ---------- 三、恢复备份时同样清 ---------- */
    var bk = {
      v: 4,
      books: [{id: "daily", name: "日常", icon: "🏠", color: "#DE6B45", budget: 0, def: true}],
      records: [{id: "z1", ts: ts(19, 10), amt: 25, type: "expense", cat: "human",
                 peer: TAIL, from: "微信", note: "", book: "daily"}]
    };
    var before = state.records.length;
    applyBackup(bk);
    var got = state.records.filter(function(r){ return r.peer === "" && r.amt === 25; })[0];
    ok("C1 备份带广告语 → 恢复后商户名被清掉", !!got);
    ok("C2 这一笔确实进来了", state.records.length === before + 1);
    var g9 = got ? iconOf(got) : {cls: "无"};
    eq("C3 恢复进来的那笔图标是微信 logo", g9.cls, "br has-img");

    /* ---------- 四、别把好数据改坏 ---------- */
    /* 手工记的账、带备注的账不能被误清 */
    var okRec = rec({peer: "学校二食堂", note: "午饭", cat: "food"});
    ok("D1 手工账的店名不动", nameOf(okRec) === "学校二食堂");
    /* 收入不该被这套逻辑影响 */
    var inRec = rec({peer: "工资", type: "income", cat: "salary"});
    eq("D2 收入还是原样", nameOf(inRec), "工资");

    report();
  }catch(err){
    document.title = "fix30 0/1 || N抛出异常:" + (err && err.message) + " || ERR " + (err && err.stack ? err.stack.slice(0,200) : "");
  } }, 260);
})();
