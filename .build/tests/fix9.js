/* 左滑只有两种落点 + 单账本不显示账本标签
   验证点：
     1. 慢慢拖到一半松手 → 一定弹回原位（以前会歪在半路）
     2. 拖到九成以上松手 → 全开
     3. 快速向左甩（哪怕只甩一半）→ 全开，不留中间态
     4. 手势被系统打断 → 收回
     5. 已打开的行往回拖一半 → 收回
     6. 点一下不拖 → 状态不变
     7. 只有一个账本时，明细里不出现「🏠 日常」；多账本时才显示 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  var _i = 0;
  function rec(o){
    var r = { id: "t" + (++_i), amt: 10, type: "expense", cat: "food",
              peer: "", note: "", ts: Date.now(), src: "notify", book: "" };
    for(var k in o) r[k] = o[k];
    return r;
  }
  /* 造"手指速度"不能真等：headless 的 --virtual-time-budget 会伪造 Date.now，
     真忙等会直接把虚拟时钟卡死（试过一次，整轮被 SIGTERM 杀掉）。
     改成自己接管 Date.now，每步往前跳指定毫秒，速度就完全可控了。 */
  var REAL_NOW = Date.now, T = REAL_NOW();
  function tick(ms){ T += ms; }
  function fakeClockOn(){ Date.now = function(){ return T; }; }
  function fakeClockOff(){ Date.now = REAL_NOW; }

  function drag(el, px, steps, gapMs, how){
    var x0 = 300, y0 = 100;
    el.dispatchEvent(new PointerEvent("pointerdown",
      { clientX: x0, clientY: y0, bubbles: true, button: 0 }));
    for(var i = 1; i <= steps; i++){
      tick(gapMs);
      el.dispatchEvent(new PointerEvent("pointermove",
        { clientX: x0 + px * i / steps, clientY: y0, bubbles: true }));
    }
    tick(gapMs);
    var ev = how === "cancel" ? "pointercancel" : "pointerup";
    el.dispatchEvent(new PointerEvent(ev,
      { clientX: x0 + px, clientY: y0, bubbles: true }));
  }

  setTimeout(function(){
    try{
      fakeClockOn();
      var box = document.createElement("div");
      box.innerHTML = itemHTML(rec({ peer: "A 店" })) +
                      itemHTML(rec({ peer: "B 店" })) +
                      itemHTML(rec({ peer: "C 店" })) +
                      itemHTML(rec({ peer: "D 店" }));
      document.body.appendChild(box);
      var sws = box.querySelectorAll(".sw");
      var a = sws[0], b = sws[1], c = sws[2], d = sws[3];
      function inner(sw){ return sw.querySelector(".item"); }
      function opened(sw){ return sw.classList.contains("open"); }

      /* ===== 1. 慢慢拖到一半 —— 必须回正 ===== */
      drag(inner(a), -80, 4, 130);              // -80px ≈ 70%，每步 130ms（慢）
      ok("慢拖一半没有留下 open", !opened(a));
      eq("慢拖一半弹回原位", inner(a).style.transform, "");

      /* ===== 2. 拖到九成 —— 全开 ===== */
      drag(inner(b), -160, 4, 130);             // -160px 超过整宽，会被夹到 -114
      ok("拖够九成就打开", opened(b));
      eq("打开后全露出来", inner(b).style.transform, "translateX(-114px)");

      /* ===== 3. 快甩 —— 也开，但绝不停半路 ===== */
      drag(inner(c), -90, 4, 10);               // 只甩一半多的距离，但很快
      ok("快甩能打开", opened(c));
      eq("快甩后也是全开", inner(c).style.transform, "translateX(-114px)");

      /* ===== 4. 系统打断 —— 收回 ===== */
      drag(inner(d), -120, 4, 130, "cancel");
      ok("打断后没有 open", !opened(d));
      eq("打断后回原位", inner(d).style.transform, "");

      /* ===== 5. 已打开的行往回拖一半 —— 收回 ===== */
      swOpenIt(a);
      ok("手动开 a", opened(a));
      drag(inner(a), 85, 4, 130);               // -114 + 85 = -29，四分之一，该收回
      ok("往回拖一半就收回", !opened(a));
      eq("收回后 transform 清空", inner(a).style.transform, "");

      /* ===== 6. 点一下不拖 —— 什么都不变 ===== */
      var before = inner(b).style.transform;
      inner(b).dispatchEvent(new PointerEvent("pointerdown",
        { clientX: 300, clientY: 100, bubbles: true, button: 0 }));
      inner(b).dispatchEvent(new PointerEvent("pointerup",
        { clientX: 300, clientY: 100, bubbles: true }));
      eq("点一下不改状态", inner(b).style.transform, before);

      /* ===== 7. 半开状态在任何一个 .sw 上都不该出现 ===== */
      var halfOpen = 0;
      box.querySelectorAll(".sw").forEach(function(sw){
        var t = sw.querySelector(".item").style.transform;
        if(t && t !== "translateX(-114px)") halfOpen++;
      });
      eq("没有停在半路的行", halfOpen, 0);
      box.remove();
      swReset();

      /* ===== 8. 账本名：写进小字行，右侧只留分类一个胶囊 =====
         2026-10-26 用户要求：右边并排「📚学习」＋「住房」两个灰胶囊太挤，
         而且看着像两个分类在打架。现在账本名挪到时间那行小字里。 */
      var daily = { id: "daily", name: "日常", icon: "🏠", color: "#DE6B45",
                    cat: null, budget: 0, def: true };
      var life = { id: "life", name: "生活", icon: "🌿", color: "#4E9A6B",
                   cat: null, budget: 0, def: false };
      var oldBook = state.book, oldBooks = state.books;
      state.book = "all";

      state.books = [daily];
      var h1 = itemHTML(rec({ peer: "蜜雪冰城", cat: "food", book: "daily" }));
      ok("全部账本视图会标出是哪一本", h1.indexOf("日常") >= 0);
      ok("右边不再有账本胶囊", h1.indexOf('class="pill bk"') < 0);
      ok("账本名写在时间那行小字里", h1.indexOf("日常") > h1.indexOf('class="it-s"'));

      state.books = [daily, life];
      var h3 = itemHTML(rec({ peer: "蜜雪冰城", cat: "food", book: "life" }));
      ok("另一本也能认出来", h3.indexOf("生活") >= 0);

      /* 真的量一遍：右边只剩分类一个胶囊，而且贴着这一列的右缘 */
      var probe = document.createElement("div");
      probe.innerHTML = itemHTML(rec({ peer: "蜜雪冰城", cat: "food", book: "daily" }));
      document.body.appendChild(probe);
      var pills = probe.querySelectorAll(".it-tg .pill");
      eq("右侧只有一个胶囊", pills.length, 1);
      var catPill = pills[0];
      ok("留下来的那个是分类胶囊", !!catPill && catPill.tagName === "BUTTON");
      if(catPill){
        var tr = probe.querySelector(".it-tg").getBoundingClientRect();
        ok("分类胶囊贴着这一列的右边", Math.abs(catPill.getBoundingClientRect().right - tr.right) < 1.5);
      }
      probe.remove();

      state.book = "daily";                      // 只看某一本时不必再标一遍
      var h4 = itemHTML(rec({ peer: "蜜雪冰城", cat: "food", book: "daily" }));
      ok("单本视图不标账本", h4.indexOf("日常") < 0);

      state.books = oldBooks; state.book = oldBook;
      fakeClockOff();

      document.title = "fix9 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
        " | " + log.join(" | ");
    }catch(e){
      fakeClockOff();
      document.title = "fix9 ERR: " + e.message + " | " + log.join(" | ");
    }
  }, 700);
})();
