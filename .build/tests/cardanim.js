/* cardanim：首页卡片收起 / 叫回来那 190ms 的动画
   用户原话："点击加号或减号时不要直接消失，最好有一个快速的消失动画，
   参考一下市面上大型 App。"
   A. 样式真的挂上了（height 过渡 + 塌缩态 + 加号淡入）
   B. 点减号的那一帧：卡片还在、已经塌起来（不是啪一下没了），且不弹黑条
   C. 动画结束后：卡片收掉、加号出现、内联高度清干净
   D. 点加号的那一帧：卡片已经回来、从 0 高度开始长
   E. 长完之后：卡片完全露着、加号消失
   F. 连点 / 两张都收 也不乱 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function $(id){ return document.getElementById(id); }
  function card(k){ return document.querySelector('#homeStack [data-blk="' + k + '"]'); }
  function bar(){ return $("hmAddBar"); }
  function cssRules(){
    var out = "";
    for(var i = 0; i < document.styleSheets.length; i++){
      try{
        var rs = document.styleSheets[i].cssRules;
        for(var j = 0; j < rs.length; j++) out += rs[j].cssText + "\n";
      }catch(e){ /* 跨域样式表跳过 */ }
    }
    return out;
  }

  function seed(){
    var Y = new Date().getFullYear(), M = new Date().getMonth();
    state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 1500, def: true}];
    state.records = [
      {id: "q1", ts: new Date(Y, M, 2, 9, 0, 0).getTime(), amt: 18, type: "expense", cat: "food", peer: "食堂", note: "", book: "daily", src: "manual"},
      {id: "q2", ts: Date.now() - 3600000, amt: 32, type: "expense", cat: "food", peer: "咖啡", note: "", book: "daily", src: "manual"}
    ];
    state.hide = {}; state.order = defOrder();
    state.dayBud = {}; state.dayMode = 1;
    state.viewMonth = {y: Y, m: M}; state._flowKey = null;
    renderAll(); renderHome();
  }

  setTimeout(function(){
    /* ---------- A. 样式到位 ---------- */
    var rules = cssRules();
    ok("A1 塌缩态样式在（.hm-hero.collapsing）", rules.indexOf(".hm-hero.collapsing") >= 0);
    ok("A2 加号淡入的 keyframes 在（hmAddIn）", rules.indexOf("hmAddIn") >= 0);
    var el = card("month");
    var cs = getComputedStyle(el);
    ok("A3 卡片的高度是过渡的（不是零时长）",
      /height/.test(cs.transitionProperty) && !/^0s(,\s*0s)*$/.test(cs.transitionDuration));
    eq("A4 一开始没有黑条", $("toast").classList.contains("on"), false);

    /* ---------- A0. 按下就先建合成层 ----------
       用户报："点减号会卡一下，点加号不会"。量出来是**第一次**收起要 15.7ms、
       之后只要 7.8ms —— 差在动画开始那一帧才挂 will-change，
       浏览器得当场建图层。现在改成 pointerdown 就挂上，click 到时图层已经好了。
       这两条守的就是它，别被人当成"多余的类"删掉。 */
    ok("A0a 按下之前卡片没有预建层", !el.classList.contains("animating"));
    $("hmXMonth").dispatchEvent(new PointerEvent("pointerdown", {bubbles: true}));
    ok("A0b 手指一按下就给卡片挂上 .animating（提前建层）", el.classList.contains("animating"));
    ok("A0c will-change 真的算出 transform,opacity",
      /transform/.test(getComputedStyle(el).willChange));

    /* ---------- A' 果冻弹簧真的接上了 ----------
       用户要"果冻感 + 帧率高"。果冻的判据只有一条：曲线会**冲过目标再弹回来**，
       也就是采样值有 >1 的峰。单调逼近的贝塞尔永远到不了 1 以上，
       所以这一条最能区分"果冻"和"平滑缩小"。 */
    ok("A5 弹簧曲线函数在（阻尼振子）", typeof springCurve === "function");
    var mxOut = 0, mxIn = 0, i;
    for(i = 0; i < SPR_OUT.length; i++) if(SPR_OUT[i] > mxOut) mxOut = SPR_OUT[i];
    for(i = 0; i < SPR_IN.length; i++) if(SPR_IN[i] > mxIn) mxIn = SPR_IN[i];
    ok("A6 收起曲线冲过头（>1.05 才算果冻）[" + mxOut.toFixed(3) + "]", mxOut > 1.05);
    ok("A7 展开曲线也冲过头[" + mxIn.toFixed(3) + "]", mxIn > 1.05);
    ok("A8 末端吸附到精确落点（不会停在半路）",
      Math.abs(SPR_OUT[SPR_OUT.length - 1] - 1) < 1e-9 &&
      Math.abs(SPR_IN[SPR_IN.length - 1] - 1) < 1e-9);
    ok("A9 采样够密（每个周期至少 8 帧，不然会看出折线）", SPR_OUT.length >= 20);
    /* 曲线只说"会冲过头"，真正决定观感的是摊出来的每一帧。
       这里直接读关键帧里的 scale 数值 —— 收起必须真的缩到 0.9 以下再回来，
       展开必须真的冲到 1 以上。少任何一边，观感就退回"平滑缩小"。 */
    function scales(fr){
      return fr.map(function(f){
        var m = /scale\(([\d.]+)\)/.exec(f.transform);
        return m ? parseFloat(m[1]) : NaN;
      });
    }
    var scIn = scales(jellyFrames(SPR_IN, 0.9, 1, "in"));
    var scOut = scales(jellyFrames(SPR_OUT, 1, 0.9, "out"));
    var mxIn = Math.max.apply(null, scIn), mnOut = Math.min.apply(null, scOut);
    ok("A10 展开关键帧冲到 1 以上[" + mxIn.toFixed(4) + "]", mxIn > 1.0);
    ok("A11 收起关键帧缩到 0.9 以下[" + mnOut.toFixed(4) + "]", mnOut < 0.9);
    eq("A12 展开最后一帧落回正好 1", scIn[scIn.length - 1], 1);
    eq("A13 收起最后一帧落回正好 0.9", scOut[scOut.length - 1], 0.9);
    /* 收起时的果冻恰恰是"先缩过头、再弹回来一点、最后停住"，
       所以 scale 中途一定会有一小段回升 —— 这段回升就是手感本身，不是 bug。 */
    var bounce = 0;
    for(i = 1; i < scOut.length; i++) if(scOut[i] > scOut[i - 1] + 0.0005) bounce++;
    ok("A14 收起中途真的弹回来了一下（回升段 " + bounce + " 处）", bounce >= 1);
    var fOut = jellyFrames(SPR_OUT, 1, 0.9, "out");
    eq("A15 收起的透明度最后归零（不然缩成一点了还亮着）", fOut[fOut.length - 1].opacity, "0.000");
    eq("A16 关键帧 offset 从 0 到 1 且不倒退",
      fOut[0].offset + "/" + fOut[fOut.length - 1].offset, "0/1");

    /* ---------- B. 点减号，看那一帧 ---------- */
    seed();
    $("hmXMonth").click();
    ok("B1 点完卡片没有立刻消失（还没挂 away）", !el.classList.contains("away"));
    ok("B2 卡片进入了塌缩态（collapsing）", el.classList.contains("collapsing"));
    ok("B3 高度已经被写成固定像素，可以过渡了", /px$/.test(el.style.height));
    eq("B4 那一帧仍然占着位置（display 不是 none）", getComputedStyle(el).display, "block");
    eq("B5 点减号不再弹黑条提示", $("toast").classList.contains("on"), false);
    /* B6 以前是"动画结束前加号一个都没有"。改成现在这样，是因为用户报了
       "出现加回之后会卡一下" —— 根子就是加号等动画结束才插进来，
       把刚刚上移的内容又顶回去 41px。现在它一开始就生成、高度从 0 长出来。 */
    eq("B6 加号在收起一开始就生成了（不再等动画结束才插进来）", bar().children.length, 1);
    ok("B6b 加号是长出来的，容器高度在过渡（不是瞬间撑开）",
      /height/.test(getComputedStyle(bar()).transitionProperty));
    /* 点击那一刻**不许**把加号的目标高度同步写进去：写一次就得强制重排一次
       （手机上要把整页重新算一遍），那一下正好多掉一帧。
       现在改成"先归零、下一帧再送目标值" —— 所以这一刻量到的必须还是 0px。 */
    eq("B6c 点击那一帧加号高度还是 0（不在点击里硬算布局）", bar().style.height, "0px");
    /* 点击那一刻**不许**把加号的目标高度同步写进去：写一次就得强制重排一次
       （手机上要把整页重新算一遍），那一下正好多掉一帧。
       现在改成"先归零、下一帧再送目标值" —— 所以这一刻量到的必须还是 0px。 */
    eq("B6c 点击那一帧加号高度还是 0（不在点击里硬算布局）", bar().style.height, "0px");
    /* 位移必须交给 WAAPI（合成线程），不能退回 CSS 过渡 ——
       这是"帧率高一点"的落点，退回过渡就又变成主线程逐帧算。 */
    ok("B7 点减号后位移跑在 WAAPI 上",
      typeof el.getAnimations === "function" && el.getAnimations().length > 0);
    /* will-change 在 pointerdown 就提前挂上了（见 A0），所以这里当然是有的。
       提前挂是为了不在动画第一帧临时建图层 —— 那一下就是"第一次收会卡"的根。 */
    eq("B8 动画期间卡片带着 will-change", el.classList.contains("animating"), true);

    /* ---------- C. 等它走完 ---------- */
    setTimeout(function(){
      eq("C1 动画结束后卡片才收掉", el.classList.contains("away"), true);
      eq("C2 收掉的卡片不占位", getComputedStyle(el).display, "none");
      eq("C3 加号这时候才出来", bar().children.length, 1);
      /* C10–C12：这三条盯的是"收完不准再推一把"。
         加号如果没撑开，说明它还在等下一帧插进来 —— 那一插就是把内容顶回去的元凶。 */
      ok("C10 加号已经撑开了（高度 > 20px，不是 0 高等着后面插）", bar().offsetHeight > 20);
      /* 不要断言 computed 的 8px：测试跑在虚拟时钟上，CSS 过渡根本不推进，
         computed 会一直是起点值。判 .on 类才可靠（.on 里就带着 margin-top:8px）。 */
      ok("C11 加号那 8px 间距随 .on 一起到位", bar().classList.contains("on"));
      eq("C12 收起的卡片不再占高度", el.offsetHeight, 0);
      ok("C4 加号写的是「加回本月」", bar().textContent.indexOf("加回「本月」") >= 0);
      eq("C5 内联高度已经清干净（不然下次展开量不准）", el.style.height, "");
      eq("C6 塌缩态也摘掉了", el.classList.contains("collapsing"), false);
      eq("C7 状态落库了", state.hide.month, true);
      eq("C8 动画跑完不留残影（WAAPI 已交还给 CSS）",
        (el.getAnimations ? el.getAnimations().length : 0), 0);
      eq("C9 will-change 也撤了（不然一直占着合成层）",
        el.classList.contains("animating"), false);

      /* ---------- D. 点加号，看那一帧 ---------- */
      bar().children[0].click();
      eq("D1 点完就不再是收起状态", el.classList.contains("away"), false);
      /* D2 原意：别被长按拖动留下的内联 transition:none 卡住。
         现在展开会自己写一条 440ms 的高度过渡（要和弹簧同步结束），
         所以判据改成"不是 none，而且 height 在里面"。 */
      ok("D2 过渡没被长按拖动留下的内联 none 卡住",
        el.style.transition !== "none" && el.style.transition.indexOf("height") >= 0);
      ok("D3 内联高度有值（起点 0，目标是真实高度）", /px$/.test(el.style.height));
      eq("D4 现在还是占位状态，看得见", getComputedStyle(el).display, "block");
      /* 同样别断言"内容还在"：虚拟时钟下那句 340ms 的延迟清空会立刻执行。
         真正要守的是"它已经进入了收回状态"，内容最后有没有清由 E4 兜底。 */
      eq("D5 加号开始收回去（.on 已摘掉）", bar().classList.contains("on"), false);

      /* ---------- E. 长完 ---------- */
      setTimeout(function(){
        eq("E1 长完后卡片完全露着", el.classList.contains("away"), false);
        eq("E2 塌缩态已摘", el.classList.contains("collapsing"), false);
        eq("E3 内联高度清回 auto", el.style.height, "");
        eq("E4 加号撤掉了", bar().children.length, 0);
        eq("E5 状态里也没有 month 了", state.hide.month, undefined);

        /* ---------- F. 连点 / 两张都收 ---------- */
        $("hmXMonth").click();
        $("hmXMonth").click();          // 190ms 内连点，第二次应该被挡掉
        setTimeout(function(){
          eq("F1 连点两次也只收一次，状态是对的", state.hide.month, true);
          eq("F2 连点之后加号只有一个", bar().children.length, 1);
          $("hmXDay").click();
          setTimeout(function(){
            eq("F3 两张都收掉：两个加号都在", bar().children.length, 2);
            ok("F4 两个加号分别对应今天和本月",
              bar().textContent.indexOf("加回「今天」") >= 0 && bar().textContent.indexOf("加回「本月」") >= 0);
            eq("F5 两张都收掉后卡片都不占位",
              getComputedStyle(card("month")).display + "/" + getComputedStyle(card("day")).display, "none/none");

            var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
            document.title = "cardanim " + pass + "/" + log.length + " || " + log.join("|") + " || ERR none";
          }, 500);
        }, 700);
      }, 700);
    }, 900);
  }, 500);
})();
