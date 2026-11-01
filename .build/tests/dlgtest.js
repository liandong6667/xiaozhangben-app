(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  try{
    // ---- 外观：个性化板块已关闭，固定第一版暖黄浅色 ----
    ok("默认皮肤", document.documentElement.getAttribute("data-skin") === "orange");
    ok("默认浅色(不跟系统深色)", document.documentElement.getAttribute("data-dark") === "0");
    ok("个性化入口已隐藏", (function(){
      var a = document.getElementById("grpTheme"), b = document.getElementById("grpHTheme");
      return !!a && !!b && a.style.display === "none" && b.style.display === "none";
    })());
    ok("色卡不再渲染", document.querySelectorAll("#skinRow [data-skin]").length === 0);
    ok("明暗面板结构还在(没删)", document.querySelectorAll("#modeRow [data-mode]").length === 3);
    // 函数本身还留着，以后把开关改回 true 就能立刻用
    setSkin("blue");
    ok("换色函数仍可用", document.documentElement.getAttribute("data-skin") === "blue");
    setMode("dark");
    ok("换明暗函数仍可用", document.documentElement.getAttribute("data-dark") === "1");
    setSkin("orange"); setMode("light");
    ok("能回到暖黄浅色", document.documentElement.getAttribute("data-skin") === "orange" &&
       document.documentElement.getAttribute("data-dark") === "0");

    // ---- 清空账目 ----
    state.records = [
      {id: "t1", amt: 12.5, type: "expense", cat: "food", ts: Date.now(), book: "daily"},
      {id: "t2", amt: 7.5, type: "expense", cat: "food", ts: Date.now(), book: "daily"}
    ];
    allowEmptySave = true; save();
    wipeRecords();
    ok("弹窗出来", $("askBox").classList.contains("on"));
    ok("按钮先锁", $("askYes").disabled === true);
    $("askInp").value = "清"; $("askInp").dispatchEvent(new Event("input"));
    ok("半字仍锁", $("askYes").disabled === true);
    $("askInp").value = "清空"; $("askInp").dispatchEvent(new Event("input"));
    ok("打对才亮", $("askYes").disabled === false);
    $("askYes").click();
    ok("账目清空", state.records.length === 0);
    ok("弹窗关闭", !$("askBox").classList.contains("on"));

    // ---- 取消不删 ----
    state.records = [{id: "t3", amt: 1, type: "expense", ts: Date.now(), book: "daily"}];
    wipeRecords(); $("askNo").click();
    ok("取消保留", state.records.length === 1);
    ok("取消关窗", !$("askBox").classList.contains("on"));

    // ---- 删账本：账目挪走不丢 ----
    state.books.push({id: "b_food", name: "吃饭", icon: "🍜", color: "#2E8C63", cat: null, budget: 0, def: false});
    state.records = [{id: "t4", amt: 9, type: "expense", ts: Date.now(), book: "b_food"}];
    delBook("b_food");
    ok("删本要确认", $("askBox").classList.contains("on"));
    $("askYes").click();
    ok("账本没了", !state.books.some(function(b){ return b.id === "b_food"; }));
    ok("账没丢", state.records.length === 1 && state.records[0].book === "daily");

    // ---- 最后一笔删掉后仍可保存 ----
    state.records = [{id: "t5", amt: 3, type: "expense", ts: Date.now(), book: "daily"}];
    allowEmptySave = true; save();
    openCatFor("t5");
    var dl = $("ucDel");
    ok("单笔删要确认", !!dl);
    if(dl){
      dl.click();
      ok("单笔弹窗", $("askBox").classList.contains("on"));
      ok("单笔不用打字", $("askYes").disabled === false);
      $("askYes").click();
      ok("这笔记删了", state.records.length === 0);
      ok("存档没被拦", state._storeCount === 0);
    }

    // ---- 恢复出厂 ----
    state.books.push({id: "b_x", name: "临时", icon: "📒", color: "#3B6FD4", cat: null, budget: 0, def: false});
    state.records = [{id: "t6", amt: 5, type: "expense", ts: Date.now(), book: "b_x"}];
    state.peerRules = {"美团": "food"};
    wipeAll();
    ok("出厂要打字", $("askYes").disabled === true);
    $("askInp").value = "恢复出厂"; $("askInp").dispatchEvent(new Event("input"));
    $("askYes").click();
    ok("账清了", state.records.length === 0);
    ok("本恢复", state.books.length === 1 && state.books[0].id === "daily");
    ok("规则清", Object.keys(state.peerRules).length === 0);
  }catch(e){ log.push("ERR " + e.message); }
  document.title = "R " + log.join(" | ");
})();
