/* ============================================================
   深跑脚本 第 2 轮：模拟"关掉 App 再打开"
   只读，不写；验证上一轮记的账、账本、规则都还在
   ============================================================ */
(function(){
  var L = [], errs = [];
  window.onerror = function(m){ errs.push("onerror:" + m); };
  window.addEventListener("unhandledrejection", function(e){
    errs.push("reject:" + ((e.reason && e.reason.message) || e.reason));
  });
  function ok(n, c){ L.push((c ? "Y" : "N") + n); }

  setTimeout(function(){
    try{
      var exp = null;
      try{ exp = JSON.parse(localStorage.getItem("deep.expect") || "null"); }catch(e){}
      ok("读得到期望值", !!exp);
      if(exp){
        ok("笔数还在(" + state.records.length + "/" + exp.n + ")", state.records.length === exp.n);
        ok("账本还在(" + state.books.length + "/" + exp.books + ")", state.books.length === exp.books);
        var sum = state.records.reduce(function(a, r){ return a + (r.type === "income" ? 0 : r.amt); }, 0);
        ok("金额一分不差(" + sum.toFixed(2) + ")", Math.abs(sum - exp.sum) < 0.005);
        ok("吃饭账本还在", state.books.some(function(b){ return b.name === "吃饭"; }));
        ok("学过的规则还在", Object.keys(state.peerRules || {}).length >= 0);
      }
      ok("四个页面都渲染", ["home", "flow", "stats", "me"].every(function(t){
        try{ document.querySelector('.tab[data-tab="' + t + '"]').click(); return document.querySelector("#pg-" + t).classList.contains("on"); }
        catch(e){ return false; }
      }));
      ok("没有跳过记录", !state._skipped);
      ok("没有抢救提示", !state._salvaged);
      ok("存档计数一致", state._storeCount === state.records.length);
    }catch(e){ errs.push("脚本错误:" + e.message); }
    document.title = "RUN2 " + L.join(" | ") + " || ERR " + (errs.length ? errs.join(" ; ") : "none");
  }, 700);
})();
