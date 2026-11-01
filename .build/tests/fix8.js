/* 明细左滑 + 详情页 + 数据分组合并
   验证点：
     1. 明细行外面套了 .sw，里面有详情/修改/删除三个动作按钮
     2. data-rid 只在最外层（重复会让 closest 取到错的那层）
     3. 滑开/收回的状态机（一次只能开一行）
     4. 详情页字段齐全，且不编造"账户余额"这种自己没有的数
     5. 金额能改，改坏了要弹回去
     6. 「我的」里数据/清空数据合成一组，但清空两项还在
     7. 删除确认走的是同一份文案（左滑的垃圾桶和面板里的删掉） */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  function has(n, s, t){ ok(n, String(s).indexOf(t) >= 0); }
  var _i = 0;
  function rec(o){
    var r = { id: "t" + (++_i), amt: 10, type: "expense", cat: "food",
              peer: "", note: "", ts: Date.now(), src: "notify", book: "" };
    for(var k in o) r[k] = o[k];
    return r;
  }

  setTimeout(function(){
    try{
      /* ===== 1. 左滑的骨架 ===== */
      var h = itemHTML(rec({ peer: "蜜雪冰城", amt: 6, cat: "food" }));
      has("行外面套了 .sw", h, 'class="sw"');
      eq("两个动作按钮", (h.match(/data-act=/g) || []).length, 2);
      /* 「详情」在 2026-10-30 删掉了：点整行就能改，多一个按钮只是多一次点击 */
      ok("没有详情按钮", h.indexOf('data-act="info"') < 0);
      /* 2026-11-01：左滑第二个按钮从「编辑」换成「备注」——
         点明细里的分类胶囊本来就能改，编辑是重复入口，备注反而没地方写 */
      ok("有备注", h.indexOf('data-act="note"') >= 0);
      ok("编辑按钮删掉了", h.indexOf('data-act="edit"') < 0);
      ok("有删除", h.indexOf('data-act="del"') >= 0);
      /* 左滑按钮的图标是这两个按钮自己内联的 svg，跟分类 emoji 无关 */
      eq("两个按钮图标都是 svg", (h.match(/<svg/g) || []).length, 2);
      eq("data-rid 只出现一次", (h.match(/data-rid=/g) || []).length, 1);
      ok("data-rid 挂在外层", h.indexOf('<div class="sw" data-rid=') >= 0);
      ok("里面的 .item 不带 id", h.indexOf('<div class="item" data-rid') < 0);
      ok("删除按钮是红的", h.indexOf("sw-b del") >= 0);

      /* ===== 2. 滑开 / 收回 ===== */
      /* 2026-10-30 删掉「详情」按钮后只剩修改+删除 = 114；
     以前按三个按钮算 171，滑开会空一条缝。 */
      eq("滑动宽度", SW_W, 114);
      var box = document.createElement("div");
      box.innerHTML = itemHTML(rec({ peer: "A 店" })) + itemHTML(rec({ peer: "B 店" }));
      document.body.appendChild(box);
      var a = box.querySelectorAll(".sw")[0], b = box.querySelectorAll(".sw")[1];
      swOpenIt(a);
      ok("滑开加了 open", a.classList.contains("open"));
      has("内容左移", a.querySelector(".item").style.transform, "-114px");
      swOpenIt(b);
      ok("开另一行时前一行自动收", !a.classList.contains("open") && b.classList.contains("open"));
      swReset();
      ok("收回后 open 没了", !b.classList.contains("open"));
      eq("收回后位移清零", b.querySelector(".item").style.transform, "");
      box.remove();

      /* ===== 3. 详情页 ===== */
      state.records = [
        rec({ peer: "学校一食堂", note: "早餐 包子豆浆", amt: 6.5, cat: "food",
              src: "import", book: "daily", ts: new Date(2026, 9, 21, 7, 40).getTime() }),
        rec({ peer: "拼多多", amt: 29.9, type: "income", cat: "refund", src: "notify",
              from: "拼多多", ts: new Date(2026, 9, 20, 18, 0).getTime() })
      ];
      state.books = [{ id: "daily", name: "日常", icon: "🏠", color: "#DE6B45", cat: null, budget: 0, def: true }];
      openInfo(state.records[0].id);
      var ib = $("infoBody").innerHTML;
      has("详情有时间", ib, "2026-10-21 07:40");
      has("详情有星期", ib, "周三");
      has("详情有商户", ib, "学校一食堂");
      has("详情有账本", ib, "日常");
      has("详情有记账方式", ib, "从账单导入");
      has("详情有流水号", ib, "流水号");
      has("详情有备注框", ib, 'id="infNote"');
      has("详情金额带负号", ib, "-¥6.50");
      ok("详情不该编账户余额", ib.indexOf("账户余额") < 0);
      ok("详情不该编对方账号", ib.indexOf("对方账户") < 0);
      has("详情能改分类", ib, 'id="infCat"');
      has("详情能删除", ib, 'id="infDel"');

      openInfo(state.records[1].id);
      var ib2 = $("infoBody").innerHTML;
      has("收入详情写收入", ib2, ">收入<");
      has("收入金额带加号", ib2, "+¥29.90");
      has("有支付方式就显示", ib2, "拼多多");

      /* ===== 4. 改金额 ===== */
      openCatFor(state.records[0].id);
      ok("分类面板有金额输入框", !!$("ucAmt"));
      eq("金额框里是原值", $("ucAmt").value, "6.50");
      ok("保留了「以后都算这一类」", !!$("ucKeep"));
      $("ucAmt").value = "abc";
      $("ucAmt").onblur();
      eq("乱填会弹回原值", $("ucAmt").value, "6.50");
      eq("乱填不会改坏账", state.records[0].amt, 6.5);
      $("ucAmt").value = "8.80";
      $("ucAmt").onblur();
      eq("正常金额能改", state.records[0].amt, 8.8);
      closeSheets();

      /* ===== 5. 「我的」数据合并 ===== */
      renderMe();
      var me = $("pg-me").innerHTML;
      ok("不再有单独的「清空数据」标题", me.indexOf(">清空数据<") < 0);
      ok("数据标题还在", me.indexOf(">数据<") >= 0);
      ok("导出还在", me.indexOf('id="meExport"') >= 0);
      ok("导入还在", me.indexOf('id="meImport"') >= 0);
      ok("清空账目还在", me.indexOf('id="meWipeRec"') >= 0);
      ok("恢复出厂还在", me.indexOf('id="meWipeAll"') >= 0);
      ok("中间有分隔条", me.indexOf("grp-sep") >= 0);
      ok("导出和清空在同一张卡里",
         $("meExport").closest(".grp") === $("meWipeRec").closest(".grp"));

      /* ===== 6. 删除确认是同一份 ===== */
      var n0 = state.records.length;
      askDelRecord(state.records[0].id);
      ok("弹出了确认框", $("askBox").classList.contains("on"));
      has("确认框认得出是哪笔", $("askBox").innerText, "学校一食堂");
      closeAsk();
      eq("没确认就不删", state.records.length, n0);

      document.title = "fix8 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
        " | " + log.join(" | ");
    }catch(e){
      document.title = "fix8 ERR: " + e.message + " | " + log.join(" | ");
    }
  }, 700);
})();
