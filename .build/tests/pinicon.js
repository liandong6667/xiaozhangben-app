(function(){
  /* 用户报的现场（2026-10-25 截图 2）：图标面板里 10 个图标全带 ✓，
     点一个新图标的圈，已经打勾的那些全被取消 —— 看着像只能勾一个。
     根因链：
       ① 没动过时 state.pinIcons 是 null，save() 却存成 []（"没动过"被抹掉了）
       ② 读档回来是 []，pinList() 见空数组拿 DEFAULT_PINS 顶上去显示，
          但 state.pinIcons 本身还是空的
       ③ 这时勾一个新图标，pinIcon() 直接 push，数组只剩这一个 → 十个勾全没了
     另外顺带钉住：⋯ 面板选分类图标时，绑定和名字要和点分类走同一段逻辑。 */
  var R = [];
  var pass = 0, fail = 0;
  function ok(n, cond){ if(cond){ pass++; R.push("Y" + n); } else { fail++; R.push("N" + n); } }
  function eq(n, got, want){ ok(n + "(" + got + ")", String(got) === String(want)); }
  function checked(){ return document.querySelectorAll("#icGrid .icck.on").length; }
  function isOn(ic){ var e = document.querySelector('#icGrid [data-pin="' + ic + '"]'); return !!e && e.className.indexOf("on") >= 0; }
  function chips(){ return document.querySelectorAll("#nbCats [data-icchip]").length; }

  try{
    /* A：没动过 → 存下来的还得是 null，不能压成 [] */
    state.pinIcons = null;
    save();
    var saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    eq("A1_没动过存成null", String(saved.pinIcons), "null");

    /* B：老用户档（pinIcons 已经被压成 []）—— 面板照旧显示默认 10 个 */
    localStorage.setItem(KEY, JSON.stringify({
      v: 4, records: [],
      books: [{id: "daily", name: "日常", icon: "🏠", color: "#DE6B45", cat: null, budget: 0, def: true}],
      pinIcons: []
    }));
    load();
    openIconPick(null);
    eq("B1_面板初始勾选10个", checked(), 10);

    /* C：勾一个新图标 —— 旧的 10 个必须全在（这就是用户报的那一条） */
    document.querySelector('#icGrid [data-pin="🧋"]').click();
    eq("C1_勾一个变11个", checked(), 11);
    ok("C2_餐饮还勾着", isOn("🍽️"));
    ok("C3_日用还勾着", isOn("🛁"));
    ok("C4_奶茶勾上了", isOn("🧋"));
    eq("C5_state里真有11个", (state.pinIcons || []).length, 11);

    /* D：再点一次取消，另外 10 个原样 */
    document.querySelector('#icGrid [data-pin="🧋"]').click();
    eq("D1_取消后回到10个", checked(), 10);
    ok("D2_取消后餐饮还在", isOn("🍽️"));

    /* E：只留一个时不许取消（否则这行空了，空数组又会自己长出默认 10 个） */
    state.pinIcons = ["🍽️"];
    openIconPick(null);
    eq("E1_只剩一个勾", checked(), 1);
    document.querySelector('#icGrid [data-pin="🍽️"]').click();
    eq("E2_最后一个取消不掉", checked(), 1);
    ok("E3_state里还剩一个", (state.pinIcons || []).length === 1);

    /* F：⋯ 面板选「餐饮」→ 确定：绑定变成 food，名字也跟着变（用户 2026-10-25 定下的规则） */
    openEditBook("daily");
    eq("F1_初始名字", document.getElementById("nbName").value, "日常");
    eq("F2_初始没绑定", String(_nbCat), "");
    openIconPick(null);
    document.querySelector('#icGrid [data-ic="🍽️"]').click();
    document.getElementById("icOk").click();
    eq("F3_绑定跟着变餐饮", String(_nbCat), "food");
    eq("F4_名字跟着变餐饮", document.getElementById("nbName").value, "餐饮");
    var chipF = document.querySelector('#nbCats [data-icchip="🍽️"]');
    ok("F5_绑定行亮餐饮", !!chipF && /(^|\s)on(\s|$)/.test(chipF.className));

    /* F6/F7：亲手打过名字以后，再点图标不许覆盖，但绑定照旧跟着换 */
    var nm = document.getElementById("nbName");
    nm.value = "伙食费";
    state.pinIcons = ["🍽️", "🚦"]; renderNbCats();   // 交通得先在行里，才点得到
    document.querySelector('#nbCats [data-icchip="🚦"]').click();
    eq("F6_手打的名字不被覆盖", document.getElementById("nbName").value, "伙食费");
    eq("F7_绑定还是跟着换", String(_nbCat), "transport");

    /* G：名字还空着时（新建流程），选图标要把名字填上 */
    openNewBook();
    document.getElementById("nbName").value = "";
    _nbNameAuto = "";
    openIconPick(null);
    document.querySelector('#icGrid [data-ic="🚦"]').click();
    document.getElementById("icOk").click();
    eq("G1_空名字自动填交通", document.getElementById("nbName").value, "交通");
  }catch(e){
    fail++;
    R.push("N0_抛出(" + e.message + ")");
  }
  document.title = R.join(" | ") + " || ERR none";
})();
