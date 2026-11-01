/*@bridge@*/  // 需要假原生桥：运行器会把 _bridge.js 塞进 <head>
(function(){
  var R = [];
  function p(k, v){ R.push(k + "=" + v); }
  var $ = function(id){ return document.getElementById(id); };

  window.__FAKE.v = JSON.stringify({v: 4, books: [
    {id: "daily", name: "日常", icon: "🏠", color: "#DE6B45", cat: null, budget: 2000, def: true}
  ], peerRules: {}, records: [
    {id: "a1", amt: 12, type: "expense", cat: "food", peer: "食堂", note: "", ts: Date.now(), book: "daily"}
  ]});
  try{ load(); renderAll(); }catch(e){ p("初始化抛出", e.message); }

  p("配置仓库", UPDATE_REPO || "(空)");
  p("入口可见", $("meUpdate") && $("meUpdate").style.display !== "none" ? "是" : "否");

  var calls = [];
  window.toast = function(m){ calls.push(String(m)); };
  var t0 = Date.now();
  var done = function(extra){
    p("耗时", (Date.now() - t0) + "ms");
    p("提示", calls.join(" / ") || "(无)");
    p("弹窗", $("updBox").classList.contains("on") ? "弹了" : "没弹");
    if(extra) p("异常", extra);
    p("ERR", (window.__errs || []).length ? window.__errs.join(" | ") : "none");
    document.title = R.join(" | ");
  };

  setTimeout(function(){
    try{
      checkUpdate({silent: false}).then(function(){ done(); }, function(e){ done("reject: " + (e && e.message)); });
    }catch(e){ done("throw: " + e.message); }
  }, 400);
})();
