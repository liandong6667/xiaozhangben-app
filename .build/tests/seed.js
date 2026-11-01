/* 用真实解析路径灌一批数据，然后停在指定页面，供截图审查 */
(function(){
  var q = location.search.match(/(\w+)=(\w+)/g) || [];
  var P = {};
  q.forEach(function(kv){ var p = kv.split("="); P[p[0]] = p[1]; });
  var page = P.page || "home";
  var mode = P.mode || "light";

  setTimeout(function(){
    try{
      localStorage.removeItem("xiaozhangben.v3");
      localStorage.removeItem("xzb.theme");
      load(); renderAll();
      setMode(mode);

      // 1) 造三个小账本
      state.books.push({id: "b_food", name: "吃饭", icon: "🍜", color: "#2E8C63", cat: "food", budget: 800, def: false});
      state.books.push({id: "b_trip", name: "出行", icon: "🚇", color: "#3B6FD4", cat: "traffic", budget: 300, def: false});

      // 2) 造 90 天账单文本，走真实 parseBill + ingest
      var rows = [], names = ["美团外卖", "食堂三楼", "蜜雪冰城", "中国移动", "滴滴出行", "地铁", "便利蜂", "学校超市"];
      var now = Date.now();
      for(var i = 0; i < 46; i++){
        var d = new Date(now - i * 20 * 3600 * 1000);
        var dd = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        var nm = names[i % names.length];
        var amt = (8 + (i * 7) % 60) + ".00";
        rows.push(dd + " " + String(8 + i % 12).padStart(2, "0") + ":20:00  " + nm + "  支出  " + amt);
      }
      rows.push(rows[0].split("  ")[0] + "  收到生活费  收入  2000.00");
      var parsed = parseBill(rows.join("\n"), now);
      ingest(parsed.records);

      // 3) 留几笔进"待分类"，让首页/账本页有待处理
      state.records.slice(0, 5).forEach(function(r){ r.cat = null; r.guessed = false; });
      renderAll(); renderHome();
      if(page === "flow") document.querySelector('.tab[data-tab="flow"]').click();
      else if(page === "stats") { document.querySelector('.tab[data-tab="stats"]').click(); $("btnStats").click(); }
      else if(page === "me") document.querySelector('.tab[data-tab="me"]').click();
      else document.querySelector('.tab[data-tab="home"]').click();
      renderAll(); renderHome();
      document.title = "SEED ok n=" + state.records.length + " books=" + state.books.length + " page=" + page + " mode=" + mode;
    }catch(e){ document.title = "SEED ERR " + e.message; }
  }, 500);
})();
