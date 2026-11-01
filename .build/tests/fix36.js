/* 一句话拆菜 + 不带动词也能分类（2026-10-30 用户连着报的三条）
   ------------------------------------------------------------------
   用户原话（三张截图）：
     ① "我说的是「一份米加一碗菜」为什么还是这样"   → 拆开了，但落成待分类
     ② "必须要加动词吃或喝，不然就会搞成这样未分类的样子" → 「板面」单独进不去餐饮
     ③ "为什么我输入「板面加卤蛋」又出现这个东西"   → 加号后面没量词就拆不开

   根因只有一个：分类全靠 CATS 词表，而餐饮词表里偏偏收着「吃」「喝了」两个字。
   带动词 → 命中「吃」→ 餐饮；不带动词 → 什么都不命中 → 待分类。
   词表再补也追不上菜单（板面、卤蛋、米、菜一个都不认识），
   所以改成"看菜名像不像吃的"：把洗干净的备注按结尾的食物字再判一次。

   手动验过的边界（都在下面第 4 组断言里）：
     加州牛肉面 / 加多宝 / 加油卡 —— 加在开头，不算分隔符
     参加婚礼                    —— 右边不像吃的，不算分隔符
     面膜 / 菜鸟驿站代收          —— 名字里带「面」「菜」，但不许被当成吃的

   还有一个隐藏收益：库里已经躺着的待分类（就是首页那条"1 笔还没分类"）
   会在读档时被 scrubDishCats 补成餐饮，用户不用自己点一遍。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }

  setTimeout(function(){
    try{
      var now = Date.now();
      function P(s, t){ return parseOne(s, now, t || "expense"); }

      /* 1) 用户报的三条原句 */
      var a = P("一份米加一碗菜 16");
      eq("1米菜拆开", a.note, "米 + 菜");
      eq("1米菜归类", a.cat, "food");

      var b = P("板面 19");
      eq("2板面名字", b.note, "板面");
      eq("2板面不用动词也归餐饮", b.cat, "food");

      var c = P("板面加卤蛋 20");
      eq("3板面加卤蛋拆开", c.note, "板面 + 卤蛋");
      eq("3拆完归餐饮", c.cat, "food");

      var d = P("一碗面加一个卤蛋 16");
      eq("3带量词照样拆", d.note, "面 + 卤蛋");
      eq("3带量词也归餐饮", d.cat, "food");

      var e = P("牛肉面加蛋 12");
      eq("3单字也能拆", e.note, "牛肉面 + 蛋");

      /* 2) 不许误伤：这些名字里都有「加」或者像吃的字 */
      var f = P("加州牛肉面 15");
      eq("4加州牛肉面不拆", f.note, "加州牛肉面");
      var g = P("加多宝 3");
      eq("4加多宝不拆", g.note, "加多宝");
      var h = P("加油卡 100");
      eq("4加油卡不拆", h.note, "加油卡");
      eq("4加油卡还是交通", h.cat, "transport");
      var i = P("参加婚礼 500");
      eq("4参加婚礼不拆", i.note, "参加婚礼");
      var j = P("面膜 30");
      eq("4面膜仍是日用", j.cat, "daily");
      var k = P("菜鸟驿站代收 2");
      ok("4菜鸟驿站不算吃的", k.cat !== "food");
      var l = P("话费 50");
      eq("4话费不算吃的", l.cat, "comm");

      /* 3) 老账重洗：名字里已经存下来的「板面加卤蛋」 */
      var old = [{id: "x1", src: "manual", peer: "板面加卤蛋", note: "", cat: "food", amt: 20, ts: now, type: "expense"}];
      scrubDishNotes(old);
      eq("5老账拆开", old[0].peer, "板面 + 卤蛋");

      var keep = [{id: "x2", src: "manual", peer: "加州牛肉面", note: "", cat: "food", amt: 15, ts: now, type: "expense"}];
      scrubDishNotes(keep);
      eq("5老账加州不拆", keep[0].peer, "加州牛肉面");

      /* 4) 待分类自动补齐：钱和时间一分不动 */
      var pend = [{id: "x3", src: "manual", peer: "米 + 菜", note: "", cat: null, amt: 16, ts: 1000, type: "expense"}];
      var n1 = scrubDishCats(pend);
      eq("6待分类补成餐饮", pend[0].cat, "food");
      eq("6金额没动", pend[0].amt, 16);
      eq("6时间没动", pend[0].ts, 1000);
      eq("6只补了一笔", n1, 1);

      var notDish = [{id: "x4", src: "manual", peer: "洗面奶", note: "", cat: null, amt: 39, ts: 1000, type: "expense"}];
      scrubDishCats(notDish);
      eq("6洗面奶不被补成餐饮", notDish[0].cat, null);

      /* 5) 「改这一笔」面板里名字能改（用户 20:24 的要求） */
      var rec = {id: "r_name_" + now, amt: 60, cat: "food", type: "expense",
                 peer: "拌面加卤蛋", note: "", ts: now, book: "daily", src: "manual"};
      state.records.unshift(rec);
      openCatFor(rec.id);
      var inp = document.getElementById("ucName");
      ok("7面板里有改名输入框", !!inp);
      eq("7输入框带出原来的名字", inp ? inp.value : "", "拌面加卤蛋");
      if(inp){
        inp.focus();                      // 真机上用户会先点进输入框，失焦才成立
        inp.value = "板面 + 卤蛋";
        inp.blur();                       // 失焦即落库
      }
      var saved = state.records.filter(function(r){ return r.id === rec.id; })[0];
      eq("7名字改成新的", saved && saved.peer, "板面 + 卤蛋");
      eq("7金额没被连带改", saved && saved.amt, 60);
      /* 再打开一次看看是不是真的读回来了（只看内存不算数） */
      closeSheets();
      openCatFor(rec.id);
      var inp2 = document.getElementById("ucName");
      eq("7重新打开还是新名字", inp2 ? inp2.value : "", "板面 + 卤蛋");
      closeSheets();

      var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
      document.title = "fix36 " + (log.length - bad.length) + "/" + log.length + " " + (bad.length ? bad.join(",") : "");
    }catch(err){
      document.title = "fix36 ERR " + (err && err.message);
    }
  }, 900);
})();
