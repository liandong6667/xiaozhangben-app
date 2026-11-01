/* 第三轮：不是看代码，是当成用户在点 —— 灌账 → 点分类胶囊 → 左滑改金额 →
   看详情 → 删一笔 → 回首页，每一步之后都重新量一遍两个胶囊/金额有没有跑位。
   新布局最容易出的 bug 是"某条重绘路径忘了重算列宽"，这里就是逮它。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  function px(v){ return Math.round(v * 10) / 10; }
  function spread(root, sel){
    var arr = [];
    root.querySelectorAll(sel).forEach(function(el){ arr.push(px(el.getBoundingClientRect().right)); });
    if(!arr.length) return -1;
    return Math.round((Math.max.apply(null, arr) - Math.min.apply(null, arr)) * 10) / 10;
  }
  function goFlow(){
    document.querySelectorAll(".tab").forEach(function(b){ b.classList.toggle("on", b.dataset.tab === "flow"); });
    document.querySelectorAll(".page").forEach(function(p){ p.classList.remove("on"); });
    var p = document.getElementById("pg-flow");
    if(p) p.classList.add("on");
  }
  function click(el){ if(el) el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }

  setTimeout(function(){
    try{
      /* ===== 0. 灌一批账（走真实解析路径） ===== */
      localStorage.removeItem("xiaozhangben.v3");
      load();
      var now = new Date();
      var head = "交易时间,交易类型,交易对方,商品说明,收/支,金额,支付方式,当前状态,交易单号,商户单号,备注\n";
      var rows = [];
      var names = ["学校二食堂", "蜜雪冰城", "美团外卖", "郑州地铁", "校园超市", "中国移动",
                   "某某烤肉拌饭（大学路店）", "打印店"];
      for(var i = 0; i < 16; i++){
        /* 别再用 now - i 小时：凌晨跑（尤其月初 0 点后）会一路退到昨天、上个月，
           而首页只显示本月，于是「找不到蜜雪冰城那笔」——
           2026-11-01 00:10 就这么红过一次，跟代码无关。
           统一落在今天 00:01 起的 16 分钟里，跨天跨月都稳。 */
        var base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1, 0);
        var d = new Date(base.getTime() + i * 60000);
        var dd = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
                 String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" +
                 String(d.getMinutes()).padStart(2, "0") + ":00";
        rows.push(dd + ",商户消费," + names[i % names.length] + ",消费,支出,¥" + (5 + i * 3) + ".00,零钱,支付成功," + i + ",9,/");
      }
      var p = parseBill(head + rows.join("\n"), Date.now());
      ingest(p.records);
      eq("16 笔都进来了", state.records.length, 16);
      state.book = "all";
      goFlow();
      renderFlow();

      ok("刚灌完：胶囊右缘齐(差" + spread(document.getElementById("flowBody"), ".it-tg") + ")",
         spread(document.getElementById("flowBody"), ".it-tg") <= 1);
      ok("刚灌完：金额右缘齐", spread(document.getElementById("flowBody"), ".it-a") <= 1);

      /* ===== 1. 点分类胶囊改分类（真实点击） ===== */
      var row = null;
      document.querySelectorAll("#flowBody .sw").forEach(function(sw){
        var n = sw.querySelector(".it-n");
        if(!row && n && n.textContent.indexOf("蜜雪") >= 0) row = sw;
      });
      ok("找到蜜雪冰城那笔", !!row);
      var rid = row.dataset.rid;
      var pill = row.querySelector("[data-cid]");
      click(pill);
      ok("点了胶囊弹出分类面板", document.getElementById("sheetUc").classList.contains("on"));
      var keep = document.getElementById("ucKeep");
      if(keep) keep.checked = false;          // 别把规则写进长期记忆，污染后面的用例
      var clothBtn = document.querySelector('#ucBody [data-k="cloth"]');
      ok("面板里有服饰", !!clothBtn);
      click(clothBtn);

      var after = document.querySelector('#flowBody .sw[data-rid="' + rid + '"]');
      /* 图标已换回 emoji：左边方块里得真有一个图案，右边标签得写着「服饰」。
         不能只比某一个字符 —— 有细分时胶囊里挂的是细分图案（上衣/裤子），
         之前这条能过是因为「上衣」和「服饰」的 emoji 恰好都是 👕（1.6.90 起
         服饰改成了 👗，两者已经能分开）。 */
      ok("改成服饰后图标变成衣服",
         after.querySelector(".it-ic").textContent.trim().length > 0 &&
         after.innerHTML.indexOf("服饰") >= 0);
      ok("分类胶囊也变成服饰",
         after.querySelector("[data-cid]").textContent.indexOf("服饰") >= 0);
      ok("没再挂着雪王", after.innerHTML.indexOf("雪王") < 0 && after.innerHTML.indexOf('class="it-ic br') < 0);
      ok("改完分类后胶囊右缘还齐", spread(document.getElementById("flowBody"), ".it-tg") <= 1);

      /* ===== 2. 左滑 → 改金额 ===== */
      var row2 = document.querySelector('#flowBody .sw[data-rid="' + rid + '"]');
      swOpenIt(row2);
      ok("左滑能打开", row2.classList.contains("open"));
      click(row2.querySelector('[data-act="edit"]'));
      ok("打开改这一笔的面板", document.getElementById("sheetUc").classList.contains("on"));
      var ai = document.getElementById("ucAmt");
      ok("金额是能改的输入框", !!ai);
      if(ai){
        ai.value = "12";
        ai.dispatchEvent(new Event("blur"));
      }
      var row3 = document.querySelector('#flowBody .sw[data-rid="' + rid + '"]');
      ok("金额改成 12.00", row3.querySelector(".it-a").textContent.indexOf("12.00") >= 0);
      ok("改完金额后胶囊右缘还齐", spread(document.getElementById("flowBody"), ".it-tg") <= 1);
      ok("改完金额后金额右缘还齐", spread(document.getElementById("flowBody"), ".it-a") <= 1);

      /* 乱填金额不能把账改坏 */
      swOpenIt(document.querySelector('#flowBody .sw[data-rid="' + rid + '"]'));
      click(document.querySelector('#flowBody .sw[data-rid="' + rid + '"] [data-act="edit"]'));
      var ai2 = document.getElementById("ucAmt");
      if(ai2){ ai2.value = "abc"; ai2.dispatchEvent(new Event("blur")); }
      closeSheets();
      renderFlow();
      var row4 = document.querySelector('#flowBody .sw[data-rid="' + rid + '"]');
      ok("乱填金额弹回原值", row4.querySelector(".it-a").textContent.indexOf("12.00") >= 0);

      /* ===== 3. 左滑之后没有「看详情」了 =====
         2026-10-29 用户明确要求：眼睛按钮和详情面板整块删掉，
         明细行左滑只留「全开/全关」，点整行也不该有反应。
         所以这一段从"详情里有什么"改成"详情确实没了" —— 否则它永远红着，
         以后真出问题时反而没人看。 */
      var swEl = document.querySelector('#flowBody .sw[data-rid="' + rid + '"]');
      swOpenIt(swEl);
      ok("左滑面板里没有「看详情」按钮", !swEl.querySelector('[data-act="info"]'));
      ok("点整行不会弹出详情", (function(){
        click(swEl.querySelector(".it"));
        return !document.getElementById("sheetInfo").classList.contains("on");
      })());
      closeSheets();

      /* ===== 4. 左滑 → 删除 ===== */
      var before = state.records.length;
      var victim = document.querySelectorAll("#flowBody .sw")[0].dataset.rid;
      swOpenIt(document.querySelectorAll("#flowBody .sw")[0]);
      click(document.querySelectorAll("#flowBody .sw")[0].querySelector('[data-act="del"]'));
      var yes = document.getElementById("askYes");
      ok("删除要先确认", yes && document.getElementById("askBox").classList.contains("on"));
      click(yes);
      eq("确认后少了一笔", state.records.length, before - 1);
      ok("删的不是别人", !state.records.some(function(r){ return r.id === victim; }));
      ok("删完胶囊右缘还齐", spread(document.getElementById("flowBody"), ".it-tg") <= 1);

      /* ===== 5. 回首页看「最近」 ===== */
      document.querySelectorAll(".tab").forEach(function(b){ b.classList.toggle("on", b.dataset.tab === "home"); });
      document.querySelectorAll(".page").forEach(function(p2){ p2.classList.remove("on"); });
      document.getElementById("pg-home").classList.add("on");
      renderHome();
      ok("首页最近三笔：胶囊右缘齐(差" + spread(document.getElementById("hmRecent"), ".it-tg") + ")",
         spread(document.getElementById("hmRecent"), ".it-tg") <= 1);
      ok("首页最近三笔：金额右缘齐", spread(document.getElementById("hmRecent"), ".it-a") <= 1);

      /* ===== 6. 单账本视图只剩分类胶囊 ===== */
      goFlow();
      state.book = "daily";
      renderFlow();
      var oneTg = document.querySelector("#flowBody .it-tg");
      eq("单账本视图只有一个胶囊", oneTg.querySelectorAll(".pill").length, 1);
      ok("单账本视图胶囊右缘仍齐", spread(document.getElementById("flowBody"), ".it-tg") <= 1);
      state.book = "all";
      renderFlow();

      /* ===== 7. 老数据（待分类）还能正常显示 ===== */
      state.records.push({ id: "legacy1", ts: Date.now(), amt: 3, type: "expense", cat: null,
                           peer: "不知道哪家", note: "", book: "daily", src: "import" });
      renderFlow();
      var leg = document.querySelector('#flowBody .sw[data-rid="legacy1"]');
      ok("待分类那笔照常渲染", !!leg);
      ok("待分类胶囊里是❓", leg && leg.querySelector("[data-cid]").textContent.indexOf("待分类") >= 0);
      ok("待分类也在同一列", spread(document.getElementById("flowBody"), ".it-tg") <= 1);
      state.records = state.records.filter(function(r){ return r.id !== "legacy1"; });

      /* ===== 8. 无横向滚动 ===== */
      var d = document.documentElement;
      ok("整页没有横向溢出", d.scrollWidth <= d.clientWidth + 1);

      document.title = "fix12 " + log.filter(function(s){ return s[0] === "Y"; }).length + "/" + log.length +
        " | " + log.join(" | ");
    }catch(e){
      document.title = "fix12 ERR: " + e.message + " | " + log.join(" | ");
    }
  }, 450);
})();
