/* fix31：首屏静默预热（warmHome）不能改变任何东西，只许"提前花钱"
   用户报："首页的加减号刚进 app 的时候点击会有点卡顿，不过呆一段时间就好了。"
   处理办法是启动后趁用户看数字时，把第一次点击要付的一次性成本先花掉。
   这种"偷偷干活"的代码最容易出事，所以每一件都要钉住：

     F1 预热会挂 .hot（提前建合成层）
     F2 加号条也挂上（第一版漏了它，点加号时一个都没预热到）
     F3 预热**不改状态**：两张卡还都露着、state.hide 还是空的
     F4 预热**不改尺寸**：卡片高度、加号条高度都和预热前一模一样
     F5 那个离屏假按钮确实造出来了（它负责预热 .hm-add 的样式和 hmAddIn）
     F6 1.2 秒后 .hot 全部撤掉（合成层不许常驻吃显存）
     F7 离屏假按钮也删干净了（不能留在 body 里）
     F8 预热之后点减号照样能收起（功能没被搞坏）
     F9 再点加号照样能叫回来
     F10 _warmed 挡住重复预热（别每次 renderHome 都来一遍） */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function $(id){ return document.getElementById(id); }
  function card(k){ return document.querySelector('#homeStack [data-blk="' + k + '"]'); }

  /* 造两笔账，让首页不是空的 */
  var Y = new Date().getFullYear(), M = new Date().getMonth();
  state.books = [{id: "daily", name: "日常", icon: "🏠", color: BOOK_COLORS[0], budget: 3000, def: true}];
  state.records = [
    {id: "w1", ts: new Date(Y, M, 2, 9, 0, 0).getTime(), amt: 18, type: "expense", cat: "food", peer: "食堂", note: "", book: "daily", src: "manual"},
    {id: "w2", ts: Date.now() - 3600000, amt: 32, type: "expense", cat: "food", peer: "咖啡", note: "", book: "daily", src: "manual"}
  ];
  state.hide = {}; state.order = defOrder();
  state.dayBud = {}; state.dayMode = 1;
  state.viewMonth = {y: Y, m: M};
  renderAll(); renderHome();

  setTimeout(function(){
    var m = card("month"), d = card("day"), bar = $("hmAddBar");

    /* F12：启动流程里真的把它挂上了（不是只有测试会调它） */
    ok("F12 启动时自动预热跑过了", _warmed === true);

    /* 先把上一次预热留下的痕迹清干净，从"没预热"的状态开始测 */
    _warmed = false;
    m.classList.remove("hot"); d.classList.remove("hot");
    if(bar) bar.classList.remove("hot");

    var h0m = m.offsetHeight, h0d = d.offsetHeight;
    var h0bar = bar ? bar.offsetHeight : 0;

    ok("F0 预热前没有 .hot", !m.classList.contains("hot") && !d.classList.contains("hot"));

    /* 那个离屏假按钮活不过 1.2 秒，测试跑起来早被删了 ——
       所以不能"事后去找"，要在预热调用的同一刻盯着 body 的新增节点。 */
    var born = [];
    var mo = null;
    try{
      mo = new MutationObserver(function(){});
      mo.observe(document.body, {childList: true});
    }catch(e){}

    warmHome();

    try{
      if(mo){
        mo.takeRecords().forEach(function(r){
          if(!r.addedNodes) return;
          for(var i = 0; i < r.addedNodes.length; i++){
            var n = r.addedNodes[i];
            if(n.nodeType === 1 && n.classList && n.classList.contains("hm-add")) born.push(n);
          }
        });
        mo.disconnect();
      }
    }catch(e){}

    /* F1 / F2 / F3 */
    ok("F1 预热给两张卡挂上 .hot（提前建层）",
      m.classList.contains("hot") && d.classList.contains("hot"));
    ok("F2 加号条也挂上 .hot", !bar || bar.classList.contains("hot"));
    ok("F3 预热不改状态（都还露着、hide 空）",
      !m.classList.contains("away") && !d.classList.contains("away") &&
      !state.hide.month && !state.hide.day);

    /* F4：尺寸一点都不能变 —— 变了就是用户眼皮底下抽了一下 */
    ok("F4 预热不改高度", m.offsetHeight === h0m && d.offsetHeight === h0d &&
      (bar ? bar.offsetHeight === h0bar : true));

    /* F5：离屏假按钮（预热 .hm-add 的样式和 hmAddIn 就靠它） */
    ok("F5 造了离屏假按钮预热样式",
      born.length === 1 && /-9999px/.test(born[0].getAttribute("style") || ""));

    /* F8：预热完，点减号照样能收 */
    $("hmXMonth").dispatchEvent(new PointerEvent("pointerdown", {bubbles: true, pointerType: "touch"}));
    $("hmXMonth").click();
    ok("F8a 预热后点减号，状态记上了", state.hide.month === true);
    ok("F8b 预热后点减号，卡片开始塌（.collapsing/.animating）",
      m.classList.contains("collapsing") || m.classList.contains("animating"));

    setTimeout(function(){
      ok("F8c 收完后卡片挂上 .away", m.classList.contains("away"));
      ok("F8d 收完后加号出现了", !!document.querySelector('#hmAddBar [data-show="month"]'));

      /* F9：再点加号叫回来 */
      var add = document.querySelector('#hmAddBar [data-show="month"]');
      if(add){
        add.dispatchEvent(new PointerEvent("pointerdown", {bubbles: true, pointerType: "touch"}));
        add.click();
      }
      ok("F9a 点加号后 hide 清掉了", !state.hide.month);

      setTimeout(function(){
        ok("F9b 卡片回来了（没有 .away）", !m.classList.contains("away"));

        /* F11：手指按在**加号**上时，要叫回来的那张卡也得提前建层。
           1.6.53 之前 pointerdown 只认 .hm-hero，而加号在 #hmAddBar 里，
           closest(".hm-hero") 返回 null —— 点加号那一路一个都没预热到。 */
        state.hide = {month: true};
        paintCards();
        var addBtn = document.querySelector('#hmAddBar [data-show="month"]');
        ok("F11a 加号按钮在位", !!addBtn);
        if(addBtn){
          addBtn.dispatchEvent(new PointerEvent("pointerdown", {bubbles: true, pointerType: "touch"}));
        }
        ok("F11b 按加号时目标卡提前建层（.animating）", m.classList.contains("animating"));
        state.hide = {};
        paintCards();

        /* F6 / F7：1.2 秒后必须收干净 */
        setTimeout(function(){
          ok("F6 预热用的 .hot 已撤（合成层不常驻）",
            !m.classList.contains("hot") && !d.classList.contains("hot") &&
            (!bar || !bar.classList.contains("hot")));
          ok("F7 离屏假按钮已删除",
            document.querySelectorAll(".hm-add[style*='-9999px']").length === 0);

          /* F10：重复调用不重复预热 */
          _warmed = true;
          m.classList.remove("hot");
          warmHome();
          ok("F10 _warmed 挡住重复预热", !m.classList.contains("hot"));

          log.push("ERR " + (window.__errs && window.__errs.length ? window.__errs.join("|") : "none"));
          document.title = log.join(" | ");
        }, 1500);
      }, 700);
    }, 700);
  }, 600);
})();
