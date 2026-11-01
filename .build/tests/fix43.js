/* fix43：自己起的名字从 2 个字放宽到 4 个（2026-11-01）
   用户原话：「有bug你这文字最多只能填两个」。
   图标位只有 22~32px 宽，字多了必须缩字号，所以这一版验两件事：
     ① 1~4 个字都存得进去、读得回来（不再被截成 2 个）；
     ② 字越多字号越小，4 个字也不会横着挤出去。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix43 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }
  function fire(el){ el.dispatchEvent(new Event("input")); }

  function step1(){
    localStorage.removeItem("xiaozhangben.v3");
    load(); renderAll(); renderHome();

    /* ===== A. 清洗函数本身 ===== */
    eq("A1 上限是 4", IC_TXT_MAX, 4);
    eq("A2 四个字原样留下", cleanIcTxt("宠物医院"), "宠物医院");
    eq("A3 五个字截成四个", cleanIcTxt("美甲店招牌"), "美甲店招");
    eq("A4 空格去掉", cleanIcTxt("猫 粮"), "猫粮");
    eq("A5 混进的表情剔掉", cleanIcTxt("美💅甲店"), "美甲店");
    eq("A6 竖线去掉", cleanIcTxt("猫|粮"), "猫粮");
    eq("A7 空值不出乱码", cleanIcTxt(null), "");

    /* ===== B. 合成 key ===== */
    eq("B1 图案+4字", mkIc("💅", "美甲店招牌"), "💅|" +
       cleanIcTxt("美甲店招牌"));
    eq("B2 只有 4 字", mkIc("", "宠物医院"), "文:宠物医院");
    var sp = icSplit(mkIc("🐱", "宠物医院"));
    eq("B3 拆回来图案", sp.p, "🐱");
    eq("B4 拆回来 4 字", sp.t, "宠物医院");
    eq("B5 列表小标题是 4 字", icCaption(mkIc("🐱", "宠物医院")), "宠物医院");

    /* ===== C. 字号跟着字数走 ===== */
    eq("C1 一个字最大", icTxtEm("税"), ".92");
    eq("C2 两个字", icTxtEm("美甲"), ".62");
    eq("C3 三个字", icTxtEm("美甲店"), ".54");
    eq("C4 四个字最小", icTxtEm("宠物医院"), ".46");

    /* ===== D. 走真实入口：从「＋」填四个字建一本账本 ===== */
    openNewBook();
    $("nbMore").click();
    $("icGrid").querySelector("[data-addic]").click();
    var box = $("icAddRow");
    var ct = box.querySelector('[data-adin="txt"]');
    eq("D1 输入框放得下 4 个字", ct.getAttribute("maxlength"), "4");
    ct.value = "宠物医院"; fire(ct);
    eq("D2 4 个字没被吃掉", ct.value, "宠物医院");
    var cp = box.querySelector('[data-adin="pic"]');
    cp.value = "🐱"; fire(cp);
    box.querySelector("[data-adok]").click();
    eq("D3 key 里带 4 字", _nbIcon, "🐱|宠物医院");
    $("nbName").value = "宠物医院本";
    createBook();
    var nb = state.books[state.books.length - 1];
    eq("D4 落库还是 4 字", nb.iconTxt, "宠物医院");
    renderBooks();
    var card = $("bookGrid").querySelector('[data-bid="' + nb.id + '"] .bi');
    eq("D5 卡片上 4 个字都在", (card.querySelector(".tt").textContent || "").trim(), "宠物医院");
    ok("D6 4 个字用了最小字号",
       (card.querySelector(".tt").getAttribute("style") || "").indexOf(".46em") >= 0);
    var tt = card.querySelector(".tt");
    ok("D7 4 个字没被切掉（内容宽 <= 格子宽）", tt.scrollWidth <= tt.clientWidth + 1);

    /* ===== E. 存读档一圈 ===== */
    var p = JSON.parse(localStorage.getItem("xiaozhangben.v3") || "{}");
    ok("E1 存档里是 4 字",
       (p.books || []).some(function(b){ return b.iconTxt === "宠物医院"; }));
    load();
    var back = state.books.filter(function(b){ return b.name === "宠物医院本"; })[0];
    ok("E2 读档找得到这本", !!back);
    eq("E3 读档没被截成 2 字", back && back.iconTxt, "宠物医院");

    /* ===== F. 备份里也带 4 字（备份带的是整个 books，账本自己身上就有） ===== */
    var dump = JSON.stringify({books: state.books});
    ok("F1 备份里有 4 字", dump.indexOf("宠物医院") >= 0);

    /* ===== G. 自定义细分 4 个字的分类名 ===== */
    state.records.push({id:"t1", ts:Date.now(), amt:12, type:"expense", cat:null,
      peer:"测试店", note:"", book:"daily", src:"manual", guessed:true});
    save(); openUc(); $("ucMore").click();
    $("ucMoreBox").querySelector('[data-adsub="food"]').click();
    var sb = document.getElementById("ucAddBox");
    var st = sb.querySelector('[data-adin="txt"]');
    eq("G1 细分输入框也是 4 个字", st.getAttribute("maxlength"), "4");
    st.value = "宠物用品店"; fire(st);          // 5 个字，实测要截成 4
    eq("G2 打了 5 个字自动留 4 个", st.value, "宠物用品");
    sb.querySelector("[data-adok]").click();
    eq("G3 细分名字存 4 字", (state.customSubs || [])[0].txt, "宠物用品");
    var chip = null;
    $("ucMoreBox").querySelectorAll(".cat-chip").forEach(function(c){
      if(c.textContent.indexOf("宠物用品") >= 0) chip = c;
    });
    ok("G4 分组里显示全 4 个字", !!chip);
    load();
    eq("G5 读档后细分名字还是 4 字", (state.customSubs || [])[0].txt, "宠物用品");
  }

  function step2(){
    /* ===== H. 自己加的图标也得活过读档 ===== */
    var longKey = "👨‍👩‍👧‍👦|宠物医院";   // 组合表情 + 4 字，整串远超 8 个字符（旧的上限）
    state.customIcons = (state.customIcons || []).concat(["🐱|宠物医院", longKey]);
    save();
    load();
    ok("H1 带文字的图标读档后还在", (state.customIcons || []).indexOf("🐱|宠物医院") >= 0);
    ok("H2 组合表情 + 4 字也没被过滤掉", (state.customIcons || []).indexOf(longKey) >= 0);

    /* ===== I. 备份要带上自己加的图标和分类 ===== */
    var src = [].slice.call(document.querySelectorAll("script"))
      .map(function(s){ return s.textContent || ""; }).join("");
    ok("I1 导出备份里写了 customIcons", src.indexOf("customIcons: state.customIcons") >= 0);
    ok("I2 导出备份里写了 customSubs", src.indexOf("customSubs: state.customSubs") >= 0);
    applyBackup({records: [], books: [], peerRules: {},
      customIcons: ["🐱|宠物医院"],
      customSubs: [{k:"cs7", cat:"food", pic:"🍰", txt:"生日蛋糕"}]});
    ok("I3 恢复备份带回了图标", (state.customIcons || []).indexOf("🐱|宠物医院") >= 0);
    var cs7 = (state.customSubs || []).filter(function(s){ return s.k === "cs7"; })[0] || {};
    eq("I4 恢复备份带回了 4 字分类名", cs7.txt, "生日蛋糕");
  }

  setTimeout(function(){
    try{ step1(); }catch(e){ log.push("N例外1:" + (e && e.message)); }
    setTimeout(function(){
      try{ step2(); }catch(e){ log.push("N例外2:" + (e && e.message)); }
      report();
    }, 400);
  }, 750);
})();
