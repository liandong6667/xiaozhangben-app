/* 专测：导入时的账本归属（不能跟着当前浏览的账本走） */
(function(){
  var L = [], errs = [];
  window.onerror = function(m){ errs.push("onerror:" + m); };
  function ok(n, c){ L.push((c ? "Y" : "N") + n); }
  setTimeout(function(){
    try{
      try{ localStorage.removeItem("xiaozhangben.v3"); }catch(e){}
      state.records = []; state.peerRules = {}; state.book = "all";
      state.books = [
        {id: "daily", name: "日常", icon: "🏠", color: "#DE6B45", cat: null, budget: 0, def: true},
        {id: "b_food", name: "吃饭", icon: "🍜", color: "#2E8C63", cat: "food", budget: 0, def: false}
      ];
      // 用户正站在"吃饭账本"里
      state.book = "b_food"; renderFlow();

      openSheet("sheetImp");
      $("pasteArea").value = [
        "2026-10-20 12:30:00  美团外卖  支出  25.00",
        "2026-10-19 08:10:00  中国石油  支出  300.00",
        "2026-09-28 09:00:00  学校超市  支出  12.00"
      ].join("\n");
      $("btnParsePaste").click();

      ok("导入了3笔", state.records.length === 3);
      var foodRec = state.records.filter(function(r){ return r.peer === "美团外卖"; })[0];
      var oilRec = state.records.filter(function(r){ return r.peer === "中国石油"; })[0];
      ok("餐饮进吃饭本", !!foodRec && foodRec.book === "b_food");
      ok("非餐饮没进吃饭本", !!oilRec && oilRec.book === "daily");
      ok("不是全塞当前账本", state.records.filter(function(r){ return r.book === "b_food"; }).length === 1);
      ok("导完切回总账本", state.book === "all");
      ok("月份跳到最新那笔", state.viewMonth.m === 9 && state.viewMonth.y === 2026);
    }catch(e){ errs.push("错误:" + e.message); }
    document.title = "IMP " + L.join(" | ") + " || ERR " + (errs.length ? errs.join(" ; ") : "none");
  }, 600);
})();
