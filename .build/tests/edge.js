/* 边界状态扫雷：空数据 / 单笔 / 全待分类 / 超大金额，扫界面有没有 NaN、undefined、Infinity */
(function(){
  var bad = [], L = [], errs = [];
  window.onerror = function(m){ errs.push("onerror:" + m); };
  function scan(tag){
    var t = document.body.innerText || "";
    ["NaN", "undefined", "Infinity", "null"].forEach(function(k){
      if(t.indexOf(k) >= 0) bad.push(tag + ":" + k);
    });
  }
  function step(tag, fn){
    try{ fn(); renderAll(); renderHome(); scan(tag); L.push("ok:" + tag); }
    catch(e){ errs.push(tag + " -> " + e.message); }
  }
  setTimeout(function(){
    try{
      /* A. 完全空 */
      try{ localStorage.removeItem("xiaozhangben.v3"); }catch(e){}
      state.records = []; state.books = [{id:"daily",name:"日常",icon:"🏠",color:"#DE6B45",cat:null,budget:0,def:true}];
      state.peerRules = {}; state.book = "all";
      ["home", "flow", "stats", "me"].forEach(function(t){
        step("空-" + t, function(){ document.querySelector('.tab[data-tab="' + t + '"]').click(); });
      });
      // 空数据下展开报表 + 空待分类点"去分类"
      step("空-报表", function(){ document.querySelector('.tab[data-tab="stats"]').click(); $("btnStats").click(); });
      step("空-待分类按钮", function(){ state.filter = "uncat"; renderFlow(); state.filter = "all"; renderFlow(); });

      /* B. 只有一笔，金额很大 */
      state.records = [{id:"x1", amt: 99999.99, type:"expense", cat:null, ts: Date.now(), book:"daily", peer:"大额"}];
      step("单笔-首页", function(){ document.querySelector('.tab[data-tab="home"]').click(); });
      step("单笔-账本", function(){ document.querySelector('.tab[data-tab="stats"]').click(); $("btnStats").click(); });
      step("单笔-记账", function(){ document.querySelector('.tab[data-tab="flow"]').click(); });

      /* C. 全部待分类 + 批量清算 */
      state.records = [];
      for(var i = 0; i < 6; i++){
        state.records.push({id: "u" + i, amt: 10 + i, type: "expense", cat: null, ts: Date.now() - i * 1000, book: "daily", peer: "商户" + i});
      }
      step("全待分类-首页", function(){ document.querySelector('.tab[data-tab="home"]').click(); });
      step("批量清算", function(){
        var b = document.getElementById("hmUcGo");
        if(b) b.click(); else openUc();
      });
      // 面板里点三下分类
      for(var k = 0; k < 3; k++){
        var c = document.querySelector("#ucBody [data-k]");
        if(c) c.click();
      }
      scan("批量面板");
      okBatch = $("ucBody").innerHTML.length > 0;
      L.push("批量后剩余=" + (document.querySelector("#ucPg") ? $("ucPg").textContent : "-"));
      closeSheets();

      /* D. 无分类的账本 + 预算 0 */
      step("预算0", function(){
        state.books = [{id:"daily",name:"日常",icon:"🏠",color:"#DE6B45",cat:null,budget:0,def:true},
                       {id:"b2",name:"很长很长很长很长的账本名字测试溢出",icon:"📒",color:"#3B6FD4",cat:null,budget:0,def:false}];
        state.records[0].book = "b2";
        document.querySelector('.tab[data-tab="stats"]').click();
      });

      /* E. 未来月份（空月） */
      step("空月份", function(){
        state.viewMonth = {y: 2027, m: 5};
        document.querySelector('.tab[data-tab="stats"]').click(); $("btnStats").click();
      });
    }catch(e){ errs.push("外壳:" + e.message); }
    document.title = "EDGE " + L.length + "步 | 异常文本(" + (bad.length ? bad.join(",") : "无") + ") || ERR " +
      (errs.length ? errs.join(" ; ") : "none");
  }, 600);
})();
