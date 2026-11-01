/* perf2：把「第一次点减号」那 2~3ms 拆开看，到底哪一段贵。

   perf1 已经量出结论：桌面 headless 上 第一次 2.5ms → 第二次 2ms →
   第三次 0.8ms → 第六次 0.1ms。这就是典型的"越点越快"——
   V8 分层编译 + 浏览器把样式/布局/合成层都建好了。
   手机上 CPU 慢 5~10 倍、WebView 更老，2.5ms 会放大成几十毫秒，就是用户说的"卡一下"。

   这一段要回答的是：这 2.5ms 花在哪儿，好知道该减谁的负。
   做法：不动 index.html，在测试里把关键函数包一层计时。 */
(function(){
  var R = [];
  function p(k, v){ R.push(k + "=" + v); }

  /* 造数据 */
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

  /* ---- 分段计时脚手架：把要量的函数换成带计时的同名全局 ---- */
  var bucket = {}, order = [];
  function wrap(name, label){
    var f = window[name] || eval(name);
    if(typeof f !== "function"){ p("缺" + name, "1"); return; }
    var w = function(){
      var t0 = performance.now();
      var r = f.apply(this, arguments);
      var d = performance.now() - t0;
      if(!bucket[label]){ bucket[label] = []; order.push(label); }
      bucket[label].push(d);
      return r;
    };
    try{ window[name] = w; }catch(e){ try{ eval(name + " = w"); }catch(_){} }
  }
  wrap("paintBar", "paintBar");
  wrap("cardCollapse", "cardCollapse");
  wrap("playJelly", "playJelly");
  wrap("save", "save");
  wrap("cardElOf", "cardElOf");

  /* navigator.vibrate：真机上第一次调用要初始化震动服务，怀疑是卡顿来源之一 */
  var vT = [];
  try{
    var origVib = navigator.vibrate;
    if(origVib) navigator.vibrate = function(){ var t0 = performance.now(); var r = origVib.apply(navigator, arguments); vT.push(performance.now() - t0); return r; };
  }catch(e){}

  function dump(tag){
    order.forEach(function(k){
      var a = bucket[k];
      p(tag + "." + k, a.map(function(x){ return x.toFixed(2); }).join("/"));
    });
    if(vT.length) p(tag + ".vibrate", vT.map(function(x){ return x.toFixed(2); }).join("/"));
  }
  function clear(){ bucket = {}; order = []; vT.length = 0; }

  function tap(sel){
    var el = document.querySelector(sel);
    if(!el) return "noel";
    try{
      el.dispatchEvent(new PointerEvent("pointerdown", {bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true}));
    }catch(e){}
    var t0 = performance.now();
    el.click();
    return +(performance.now() - t0).toFixed(2);
  }

  requestAnimationFrame(function(){
    setTimeout(function(){
      clear();
      p("T1总", tap("#hmXMonth"));
      setTimeout(function(){ dump("T1冷"); }, 40);

      setTimeout(function(){
        clear();
        p("T2总_点加号", tap("#hmAddBar [data-show=month]"));
        setTimeout(function(){ dump("T2冷"); }, 40);

        setTimeout(function(){
          clear();
          p("T3总_再点减号", tap("#hmXMonth"));
          setTimeout(function(){
            dump("T3冷");
            /* 第 4 次：此时已"热" */
            setTimeout(function(){
              clear();
              p("T4总_热", tap("#hmXDay"));
              setTimeout(function(){
                dump("T4热");
                p("ERR", window.__errs && window.__errs.length ? window.__errs.join("|") : "none");
                document.title = R.join(" | ");
              }, 40);
            }, 600);
          }, 40);
        }, 600);
      }, 600);
    }, 0);
  });
})();
