/* perf1：首页加减号「刚进 App 第一次点」vs「等一会儿再点」到底差多少
   用户原话："首页的加减号刚进 app 的时候点击会有点卡顿，不过呆一段时间就好了"。

   这个测试不改任何业务逻辑，只量三件事：
     1. 首屏出来后**立刻**点减号，同步那段花了多少毫秒
     2. 3.5 秒后再点加号 / 再点减号，同样量一次 —— 差值就是"首次成本"
     3. 首屏之后主线程上还压着多少长任务（>50ms 的那种）

   为什么要单独跑：runtests.py 用 --virtual-time-budget，虚拟时钟下
   performance.now() 在同步代码里根本不前进，量出来全是 0。
   所以这个用 .build/tests/perfrun.py 起一个不带虚拟时间的浏览器。 */
(function(){
  var R = [];
  function p(k, v){ R.push(k + "=" + v); }
  function $(id){ return document.getElementById(id); }

  /* 首屏之后主线程还在忙什么？长任务是最直接的证据 */
  var longs = [];
  try{
    new PerformanceObserver(function(l){
      l.getEntries().forEach(function(e){ longs.push(Math.round(e.duration)); });
    }).observe({entryTypes: ["longtask"]});
  }catch(e){ p("longtask", "unsupported"); }

  /* 模拟一根手指：先 pointerdown（会触发预建合成层），再 click（真正干活） */
  function tap(sel){
    var el = document.querySelector(sel);
    if(!el) return "noel";
    try{
      el.dispatchEvent(new PointerEvent("pointerdown",
        {bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true}));
    }catch(e){}
    var t0 = performance.now();
    el.click();
    var t1 = performance.now();
    return +(t1 - t0).toFixed(2);
  }

  /* 造几笔账：让「最近」有内容、两张卡的数不是 0 —— 空的页面量不出真实成本 */
  function seed(){
    var Y = new Date().getFullYear(), M = new Date().getMonth();
    state.books = [{id: "daily", name: "日常", icon: "\u{1F3E0}", color: BOOK_COLORS[0], budget: 3000, def: true}];
    var rs = [];
    for(var i = 0; i < 12; i++){
      rs.push({id: "p" + i, ts: new Date(Y, M, Math.max(1, new Date().getDate() - (i % 8)), 12, 0, 0).getTime(),
        amt: 10 + i * 3.5, type: "expense", cat: "food", peer: i % 2 ? "蜜雪冰城" : "拼多多",
        note: "", book: "daily", src: "manual"});
    }
    state.records = rs;
    state.hide = {}; state.order = defOrder();
    state.dayBud = {}; state.dayMode = 1;
    state.viewMonth = {y: Y, m: M};
    renderAll();
  }

  var s0 = performance.now();
  seed();
  p("造数据", (performance.now() - s0).toFixed(1));

  /* 时间线：首帧后立刻点一次，3.5 秒（= 用户说的"呆一段时间"）之后再点几次。
     每步隔 600ms，够 340/440ms 的动画走完，不会叠在一起。 */
  var steps = [
    {at: 0,    k: "T1_刚进来点减号（本月）",      sel: "#hmXMonth"},
    {at: 3500, k: "T2_等3.5s点加号（本月）",      sel: "#hmAddBar [data-show=month]"},
    {at: 4100, k: "T3_再点减号（本月）",          sel: "#hmXMonth"},
    {at: 4700, k: "T4_点减号（今天）",            sel: "#hmXDay"},
    {at: 5300, k: "T5_点加号叫回（今天）",        sel: "#hmAddBar [data-show=day]"},
    {at: 5900, k: "T6_等6s再点减号（本月·热）",   sel: "#hmXMonth"}
  ];

  function runStep(i){
    if(i >= steps.length){
      p("长任务", longs.length ? longs.join("/") : "无");
      p("ERR", window.__errs && window.__errs.length ? window.__errs.join("|") : "none");
      document.title = R.join(" | ");
      return;
    }
    var s = steps[i];
    var wait = i === 0 ? 0 : (s.at - steps[i - 1].at);
    setTimeout(function(){
      p(s.k, tap(s.sel));
      runStep(i + 1);
    }, wait);
  }

  requestAnimationFrame(function(){ runStep(0); });
})();
