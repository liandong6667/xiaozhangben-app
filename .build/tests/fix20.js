/* fix20：「今天」那张卡收起时，最后百分之一两秒最上面留一行小东西
   2026-10-23 用户报（这次是桌面录屏，10.5 秒）：
     「点减号的时候，先点最上边没事情，非常丝滑；但是如果剩最后一个卡片的时候
       再点减号，存在两个卡片的时候先点最下边，在卡片消失前零点几秒的时候，
       最上部分有一行小东西，感觉像卡了一下。」

   真因（逐帧量出来的，不是猜的）：
     .hm-hero.collapsing 里 padding-top/bottom 归零（两个类，靠前）
     .hm-hero.day        里 padding:15px 17px 13px（也是两个类，靠后）
   → 同特异性、后写的赢 → **日卡的 padding 收起时根本没有归零**。
     盒子高度 = max(height, padding+边框)，于是高度从 129 掉到 28 就再也下不去，
     挂着一条 28px 的空壳（= 卡的最上面那一行）一直等到 340ms 动画结束，
     然后 display:none 啪一下抹掉，下面整片内容同时向上跳 28px。
     月卡没有 .day 那条覆盖，所以一直是好的 —— 这就是
     「点最上边没事、点最下边卡一下」的全部原因。

   ⚠️ 这个测试**不靠时序**。测试跑在 --virtual-time-budget 下，
      定时器会瞬间跳到点，而动画时间轴还是真实时钟 —— 在动画中途采样是量不到东西的
      （这一点踩过：同一份断言在 shot.py 里全绿，在这里全红）。
      所以这里只锁两样东西：
      H. 塌缩那一刻的**计算终值**（给探针挂 transition:none，绕开过渡直接读终值）
      K/M. 真实走一遍按钮，只看到头来状态对不对（收掉、加号出来、位置不再占着）
      以及「padding 和 height 同曲线同时长」这条不变量 ——
      有了它，盒子高度数学上恒等于 height(t)，不可能再卡在 padding 上。
*/
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function $(id){ return document.getElementById(id); }
  function card(k){ return document.querySelector('#homeStack [data-blk="' + k + '"]'); }
  function norm(s){ return String(s || "").replace(/\s+/g, ""); }
  function report(){
    var pass = 0, i;
    for(i = 0; i < log.length; i++) if(log[i].charAt(0) === "Y") pass++;
    /* 失败项排最前面：一眼就能看见坏的是哪条 */
    var bad = [], good = [];
    for(i = 0; i < log.length; i++) (log[i].charAt(0) === "Y" ? good : bad).push(log[i]);
    document.title = "fix20 " + pass + "/" + log.length + " || " +
      bad.concat(good).join("|") + " || ERR none";
  }

  /* 造一个不参与过渡的探针：内联 transition:none 优先级高于类里的过渡，
     所以挂上 .collapsing 之后读到的就是**终值**，不是"过渡到一半的值"。 */
  function probe(cls){
    var d = document.createElement("div");
    d.className = cls;
    d.style.cssText = "position:absolute;left:-9999px;top:0;width:200px;height:80px;transition:none!important";
    $("homeStack").appendChild(d);
    var cs = getComputedStyle(d);
    var out = {
      pt: cs.paddingTop, pb: cs.paddingBottom,
      bt: cs.borderTopWidth, bb: cs.borderBottomWidth,
      tp: norm(cs.transitionProperty), td: norm(cs.transitionDuration),
      tf: norm(cs.transitionTimingFunction)
    };
    d.parentNode.removeChild(d);
    return out;
  }

  setTimeout(function(){
    try{
      /* ---------- H. 塌缩终值：CSS 特异性（最硬的一条） ---------- */
      var off = probe("hm-hero hm-blk day");              // 正常态
      var col = probe("hm-hero hm-blk day collapsing");   // 收起终态
      eq("H1 日卡进入 .collapsing 后 padding-top 必须归零", col.pt, "0px");
      eq("H2 padding-bottom 也必须归零", col.pb, "0px");
      eq("H3 上下边框一起归零（留着就是 2px 的线）", col.bt + "/" + col.bb, "0px/0px");
      eq("H4 不收起时还是日卡自己的 15/13（.day 那条不许改坏）",
         off.pt + "/" + off.pb, "15px/13px");
      ok("H5 收起的 padding 确实比正常态小（不是两条规则都没生效）",
         parseFloat(col.pt) + parseFloat(col.pb) < parseFloat(off.pt) + parseFloat(off.pb) - 20);
      /* 月卡也得是同一个结果（它是原本就好的那一张，别一起改坏） */
      var colM = probe("hm-hero hm-blk month collapsing");
      eq("H6 月卡收起同样归零（两张卡一个规则）", colM.pt + "/" + colM.pb, "0px/0px");

      /* ---------- 准备：两张卡都在（= 用户说的"存在两个卡片"） ---------- */
      var Y = new Date().getFullYear(), M = new Date().getMonth();
      state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 1500, def: true}];
      state.records = [];
      state.hide = {}; state.order = defOrder();
      state.dayBud = {}; state.dayMode = 1;
      state.viewMonth = {y: Y, m: M}; state._flowKey = null;
      renderAll(); renderHome();

      var dayEl = card("day"), monEl = card("month");
      var sec = document.querySelector('#pg-home .sec-h');

      /* ---------- H7. 不变量：padding 和 height 同曲线、同时长 ----------
         盒子高度 = max(height, padding+边框)。两条曲线不一致时：
         height 早早到 0、padding 还在慢慢磨 → 就是"先缩完、再拖一条薄边慢慢爬"。
         只要曲线和时长一致、且起始 height 大于起始 padding，
         盒子高度就**恒等于** height(t)，一路单调压到 0，不可能再卡住。
         （注意：这里必须读真卡，探针为了拿终值挂了 transition:none，看不出过渡。） */
      var cs0 = getComputedStyle(dayEl);
      var props = norm(cs0.transitionProperty).split(",");
      var durs = norm(cs0.transitionDuration).split(",");
      var fns = String(cs0.transitionTimingFunction || "").match(/cubic-bezier\([^)]*\)|ease|linear|ease-in-out|ease-in|ease-out/g) || [];
      var iP = props.indexOf("padding"), iH = props.indexOf("height");
      ok("H7 卡片同时过渡 height 和 padding（两条都在）[" + props.join(",") + "]", iP >= 0 && iH >= 0);
      eq("H8 padding 和 height 时长一致（不然就是两段式：缩完再拖薄边）",
         iP >= 0 ? durs[iP] : "?", iH >= 0 ? durs[iH] : "?");
      eq("H9 padding 和 height 用同一条缓动曲线",
         iP >= 0 ? norm(fns[iP]) : "?", iH >= 0 ? norm(fns[iH]) : "?");
      ok("G0 两张卡都在（不然测的就不是「剩最后一张」那个场景）",
         !!dayEl && !!monEl && dayEl.offsetHeight > 100 && monEl.offsetHeight > 100);
      var hDay0 = dayEl.offsetHeight, hMon0 = monEl.offsetHeight;
      var sec0 = sec.getBoundingClientRect().top;
      var pad0 = parseFloat(off.pt) + parseFloat(off.pb);

      /* ---------- G. 真实点「今天」的减号 ---------- */
      $("hmXDay").click();
      ok("G1 点下去立刻进入塌缩态", dayEl.classList.contains("collapsing"));
      ok("G2 状态当场就落了（不等存档）", state.hide.day === true);
      ok("G3 起始高度远大于 padding（所以盒子会跟着 height 走，不会被 padding 垫住）["
         + hDay0 + " > " + pad0 + "]", hDay0 > pad0 + 60);
      ok("G4 加号在收起一开始就生成了（不用等动画结束）",
         !!document.querySelector('#hmAddBar [data-show="day"]'));

      setTimeout(function(){
        try{
          ok("K1 收完后卡片挂上 .away", dayEl.classList.contains("away"));
          eq("K2 收完后不再占位置", dayEl.offsetHeight, 0);
          ok("K3 加号在（能叫回来）", !!document.querySelector('#hmAddBar [data-show="day"]'));
          eq("K4 收起后内联高度清干净（下次展开才量得准）", dayEl.style.height, "");
          ok("K5 下面内容整体上移了（不是纹丝不动）",
             sec.getBoundingClientRect().top < sec0 - 20);

          /* ---------- M. 对照：月卡走同一把尺子 ---------- */
          $("hmXMonth").click();
          ok("M1 月卡点下去也立刻塌缩", monEl.classList.contains("collapsing"));
          setTimeout(function(){
            try{
              ok("M2 月卡收完也是 .away + 不占位置",
                 monEl.classList.contains("away") && monEl.offsetHeight === 0);
              ok("M3 两张卡起点高度不同（" + hMon0 + " / " + hDay0 + "），但同一套塌缩规则",
                 Math.abs(hDay0 - hMon0) > 0);
              ok("M4 两张都收下之后，加号各有各的（不会互相顶掉）",
                 !!document.querySelector('#hmAddBar [data-show="day"]') &&
                 !!document.querySelector('#hmAddBar [data-show="month"]'));
              report();
            }catch(e){ document.title = "fix20 ERR M " + (e && e.message); }
          }, 620);
        }catch(e){ document.title = "fix20 ERR K " + (e && e.message); }
      }, 620);
    }catch(e){
      document.title = "fix20 ERR " + (e && e.message);
    }
  }, 500);
})();
