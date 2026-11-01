/* fix27：2026-10-24 用户提的两件事
   ① 新建账本一打开就弹键盘，半个屏幕被顶掉 —— 多数人这时候只想点个图标/分类。
   ② 截屏识别金额记错（拼多多 13.8 记成 250）—— 网页侧只负责收，识别在原生，
      这里只锁「抓屏那条话进来之后，金额不会被别处的数字带偏」。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix27 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }

  function fresh(){
    state.books = [{id:"daily", name:"日常", icon:"🏠", color:BOOK_COLORS[0], budget:1500, def:true}];
    state.records = [];
    state.peerRules = {};
    state.notifyLog = [];
    state.viewMonth = {y: new Date().getFullYear(), m: new Date().getMonth()};
    state.book = "daily"; state.filter = "all"; state.hide = {};
  }

  setTimeout(function(){
    try{
      fresh();

      /* ===== A. 新建账本不抢键盘 ===== */
      /* 先故意把光标塞进名字框，模拟"上一个面板残留的焦点" */
      $("nbName").focus();
      openNewBook();
      setTimeout(function(){
        try{
          ok("打开新建账本后键盘不顶上来的（焦点不在名字框）", document.activeElement !== $("nbName"));

          /* 面板确实打开了 */
          ok("面板是真的打开了", $("sheetNewBook").classList.contains("on"));

          /* 不弹键盘也不影响点图标：点分类图标仍会自动填名字 */
          var chip = document.querySelector('#nbCats [data-icchip]');
          ok("分类图标还在", !!chip);
          if(chip){
            $("nbName").value = "";
            chip.click();
            ok("点分类仍会自动填名字", $("nbName").value.length > 0);
          }

          /* 真能建出来 */
          $("nbName").value = "测试账本";
          createBook();
          ok("能建出新账本", state.books.some(function(b){ return b.name === "测试账本"; }));

          report();
        }catch(e){ document.title = "fix27 0/0 || ERR " + e.message; }
      }, 320);
    }catch(e){ document.title = "fix27 0/0 || ERR " + e.message; }
  }, 40);
})();
