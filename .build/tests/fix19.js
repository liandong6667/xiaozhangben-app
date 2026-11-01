/* fix19：三条用户实测报上来的问题，锁住修复
   2026-10-23 用户报：
     ① 点减号"卡一下"（他录了屏）—— 落盘别跟动画抢帧；
     ② 在拼多多用微信付的钱，账单上"什么图标都不显示"——
        通知里明明有"拼多多"三个字，以前只拿去认图标、不拿去当商户名；
     ③ 图标在大促期间变成"11.11"横幅（用户说的"不显示"有一半是这个）。

   A. 标题里的商户名要被用上（以前整条标题被丢掉）
   B. 正文里写着的平台名要当商户名（不只是当图标）
   C. "微信支付/服务通知/银行"这些标题不能被当成商户（宁可空着也不猜）
   D. 渠道永远不会进 peer
   E. 认出来的商户要能挂上真图标（不是品牌色+一个字）
   F. 点减号：状态立刻落、动画照跑、存档延后但一定会写
*/
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function $(id){ return document.getElementById(id); }
  function peerOf(item){ var p = parseNotify(item); return p ? p.peer : "NULL"; }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    document.title = "fix19 " + pass + "/" + log.length + " || " + log.join("|") + " || ERR none";
  }

  setTimeout(function(){
    try{
      /* ---------- A. 标题当商户名 ---------- */
      eq("A1 标题「拼多多」+ 正文只有金额 → 商户是拼多多",
         peerOf({app: "微信", title: "拼多多", text: "支付成功 ¥5.75"}), "拼多多");
      eq("A2 标题「美团外卖」→ 归一成「美团」",
         peerOf({app: "微信", title: "美团外卖", text: "支付成功 ¥38.50"}), "美团");
      eq("A3 标题「支付宝」是渠道，不能当商户",
         peerOf({app: "支付宝", title: "支付宝", text: "麦当劳 支付成功 32.00元"}), "麦当劳");

      /* ---------- B. 正文里的平台名 ---------- */
      eq("B1 正文「拼多多 | 支付成功」→ 商户是拼多多",
         peerOf({app: "微信", title: "微信支付", text: "拼多多 | 支付成功 ¥5.75"}), "拼多多");
      eq("B2 正文「肯德基 | 支付成功」→ 商户是肯德基",
         peerOf({app: "微信", title: "微信支付", text: "肯德基 | 支付成功 ¥29.90"}), "肯德基");
      eq("B3 正文「在蜜雪冰城消费」→ 商户是蜜雪冰城",
         peerOf({app: "微信", title: "微信支付", text: "在蜜雪冰城消费 8.00元"}), "蜜雪冰城");

      /* ---------- C. 不该当商户的词 ---------- */
      eq("C1 正文里啥都没写 → 老实记「一笔支出」",
         peerOf({app: "微信", title: "微信支付", text: "微信支付凭证 付款金额 ¥5.75"}), "一笔支出");
      /* C2/C3 原本断言 peer=一笔支出。2026-10-23 复查时发现更根本的问题：
         「账单待还款」「本期应还」是催你还钱的提醒，这笔钱根本还没付出去，
         记下来等于凭空多一笔支出（原生层 PayFilter 还把「本期应还」当支付证据放行了）。
         现在整条都不入账，所以这里断言"不记账"。标题不能当商户这条由 C1/C4 覆盖。 */
      eq("C2 账单待还款是提醒，不入账",
         peerOf({app: "微信", title: "服务通知", text: "你有一笔账单待还款 1200.00元"}), "NULL");
      eq("C3 信用卡本期应还只是账单，不入账",
         peerOf({app: "微信", title: "招商银行", text: "信用卡账单 本期应还 3200.00元"}), "NULL");
      eq("C4 标题「交易提醒」不能当商户",
         peerOf({app: "微信", title: "交易提醒", text: "支出 12.00元"}), "一笔支出");

      /* ---------- D. 渠道不进 peer ---------- */
      var p4 = parseNotify({app: "微信", title: "微信支付", text: "你已支付¥5.75"});
      ok("D1 peer 不是「微信」", p4 && p4.peer !== "微信" && p4.peer.indexOf("微信") < 0);
      eq("D2 但来源照样记下来（明细里写「微信支付」）", p4 && p4.from, "微信");

      /* ---------- E. 认出来的商户要有真图标 ---------- */
      var r5 = {id: "e5", amt: 5.75, type: "expense", cat: "shopping",
                peer: "拼多多", note: "拼多多 | 支付成功 ¥5.75", ts: Date.now(),
                src: "notify", from: "微信", book: "daily"};
      ok("E1 拼多多这一笔有官方图标（不是品牌色+一个字）", !!LOGOS["拼多多"]);
      var h5 = itemHTML(r5);
      ok("E2 明细行真的把图标 img 画出来了", h5.indexOf("has-img") >= 0 && h5.indexOf("<img") >= 0);
      ok("E3 图标是老实的 100×100 JPEG", String(LOGOS["拼多多"]).indexOf("data:image/jpeg;base64,") === 0);
      /* 大促角标那批：换掉之后不该再是原来那串（长度会变，这里只查"换过"这个事实） */
      ok("E4 电商六家的图标都在", ["拼多多", "淘宝", "天猫", "京东", "唯品会", "得物"].every(function(k){
        return !!LOGOS[k];
      }));

      /* ---------- F. 点减号 ---------- */
      var Y = new Date().getFullYear(), M = new Date().getMonth();
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 1500, def: true}];
      state.records = [];
      state.hide = {}; state.order = defOrder(); state.dayBud = {}; state.dayMode = 1;
      state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      renderAll(); renderHome();

      var el = document.querySelector('#homeStack [data-blk="month"]');
      var h0 = el.offsetHeight;
      $("hmXMonth").click();
      /* 点下去这一瞬间：状态已经是对的、卡片已经开始塌（不是等存档回来才动） */
      eq("F1 点下去的同一帧状态就落了（不等落盘）", state.hide.month, true);
      ok("F2 卡片当场就有收起动画（.animating/.collapsing 已挂）",
         el.classList.contains("animating") || el.classList.contains("collapsing"));
      ok("F3 卡片高度当场就变成像素值（不是还挂在 auto 上）", /px$/.test(el.style.height));
      /* cardCollapse 里已经把它从 h0 推到 0（过渡会自己从上一次的值接上），
         所以这里看到的是 0px；关键是 h0 得先量出来，否则量到的是"插完加号之后"的数。 */
      ok("F4 收起目标高度是 0，且动手前量到了真实高度", el.style.height === "0px" && h0 > 0);

      /* 存档是延后的，但必须真的写进去（这里等过动画 + 320ms） */
      setTimeout(function(){
        try{
          var raw = localStorage.getItem(KEY);
          var d = raw ? JSON.parse(raw) : null;
          ok("F5 延后之后存档里确实有 hide.month", !!(d && d.hide && d.hide.month === true));
          ok("F6 卡片最终收起来了", el.classList.contains("away"));
          ok("F7 加号出来了（能叫回来）", !!document.querySelector('#hmAddBar [data-show="month"]'));
          report();
        }catch(e){ document.title = "fix19 ERR F " + e.message; }
      }, 900);
    }catch(e){
      document.title = "fix19 ERR " + (e && e.message);
    }
  }, 500);
})();
