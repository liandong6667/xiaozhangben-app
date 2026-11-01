/* UI 真实操作模拟：像用户一样一笔笔记、改分类、删、切月、备份恢复、删账本，
   每一步都把屏幕上会变成什么打出来。 */
(function(){
  var out = [];
  function P(s){ out.push(s); }
  function money2(n){ return money(n); }
  function fresh(){
    state.books = [{id:"daily", name:"日常", icon:"🏠", color:BOOK_COLORS[0], budget:1500, def:true}];
    state.records = []; state.peerRules = {}; state.dayBud = {}; state.dayMode = 1;
    state.dayWeek = [0,0,0,0,0,0,0]; state.order = defOrder();
    state.viewMonth = {y: new Date().getFullYear(), m: new Date().getMonth()};
    state.book = "daily"; state.filter = "all"; state.hide = {};
    state.manualCat = null; state.manualType = "expense";
    renderAll(); renderHome();
  }
  function monthOut(){
    return curMonthRecs().filter(function(r){ return r.type !== "income"; })
      .reduce(function(s, r){ return s + r.amt; }, 0);
  }
  function flowFirst(){
    var el = document.getElementById("flowBody");
    return el ? el.innerText.replace(/\s+/g, " ").slice(0, 90) : "(空)";
  }
  function toastNow(){ var t = document.getElementById("toast"); return t ? t.textContent : ""; }

  try{
      /* ========== 1. 手动记三笔 ========== */
      fresh();
      [["午饭 15", "expense"], ["收到生活费 2000", "income"], ["昨天地铁 4", "expense"]].forEach(function(a){
        document.getElementById("qi").value = a[0];
        state.manualType = a[1];
        commitManual();
      });
      P("1 手动记三笔 → 共 " + state.records.length + " 笔，本月支出 ¥" + money2(monthOut()));
      state.records.forEach(function(r){
        P("   " + r.peer + " | " + (r.type === "income" ? "收" : "支") + " ¥" + money2(r.amt) +
          " | 分类 " + (r.cat ? catOf(r.cat).n : "待分类") + " | 账本 " + bookIdOf(r) +
          " | " + dayKey(r.ts) + " " + timeStr(r.ts));
      });

      /* ========== 2. 把「午饭」改成餐饮：商户规则要记住 ========== */
      var lunch = state.records.filter(function(r){ return r.peer.indexOf("午饭") >= 0; })[0];
      if(lunch){
        openCatFor(lunch.id);
        ucPick("food");
        P("2 把「" + lunch.peer + "」改成餐饮 → 分类 " + catOf(lunch.cat).n +
          "，提示语:" + toastNow().slice(0, 40));
        P("   学到的规则 peerRules=" + JSON.stringify(state.peerRules));
      }

      /* ========== 3. 删掉一笔 ========== */
      var before = state.records.length, beforeSum = monthOut();
      var victim = state.records.filter(function(r){ return r.type !== "income"; })[0];
      askDelRecord(victim.id);
      document.getElementById("askYes").click();
      P("3 删掉 ¥" + money2(victim.amt) + " → " + before + " 笔变 " + state.records.length +
        " 笔，本月支出 ¥" + money2(beforeSum) + " → ¥" + money2(monthOut()));

      /* ========== 4. 切到上个月：记账页空，首页仍是本月 ========== */
      var d = new Date(); d.setMonth(d.getMonth() - 1);
      state.viewMonth = {y: d.getFullYear(), m: d.getMonth()};
      state._flowKey = "";
      renderFlow(); renderHome();
      var homeTxt = document.getElementById("homeStack").innerText.replace(/\s+/g, " ");
      P("4 切到上个月 → 记账页:" + flowFirst());
      P("   首页仍在说本月:" + (homeTxt.indexOf("本月还能花") >= 0 ? "是" : "不是") +
        "，本月已花 ¥" + money2(monthOut()));

      /* ========== 5. 备份导出 → 清空 → 恢复 ========== */
      state.viewMonth = {y: new Date().getFullYear(), m: new Date().getMonth()};
      state.hide = {month: true};
      var books0 = JSON.parse(JSON.stringify(state.books));
      var recs0 = JSON.parse(JSON.stringify(state.records));
      var backup = {records: recs0, books: books0, peerRules: state.peerRules,
                    dayBud: {"2026-10-23": 50}, dayMode: 2, dayWeek: [0,60,60,60,60,60,0],
                    order: state.order, hide: {month: true}, v: 4, at: Date.now()};
      // 模拟换机：库里只剩默认账本、账全空、还多出一笔同 id 的别的账
      state.books = [{id:"daily", name:"日常", icon:"🏠", color:BOOK_COLORS[0], budget:0, def:true}];
      state.records = [{id: recs0[0].id, amt: 99, type:"expense", cat:"food", peer:"换机前的旧账",
                        note:"", ts: Date.now(), src:"manual", book:"daily"}];
      state.hide = {}; state.dayBud = {};
      var res = applyBackup(backup);
      var restored = state.records.length;
      var ids = {}; state.records.forEach(function(r){ ids[r.id] = (ids[r.id] || 0) + 1; });
      var dupId = Object.keys(ids).filter(function(k){ return ids[k] > 1; }).length;
      P("5 备份恢复 → 恢复 " + res.n + " 笔、新增 " + res.nb + " 个账本；现在共 " + restored + " 笔");
      P("   id 撞车有没有换号（应为 0 个重复 id）:" + dupId);
      P("   预算回来了吗:" + state.books.map(function(b){ return b.name + ":" + b.budget; }).join(" / "));
      P("   收起的卡片回来了吗:" + JSON.stringify(state.hide) +
        "，日预算:" + JSON.stringify(state.dayBud) + "，填法:" + state.dayMode);
      P("   恢复后跳到 " + state.viewMonth.y + "年" + (state.viewMonth.m + 1) + "月");

      /* ========== 6. 新建账本 → 挪一笔进去 → 删账本 ========== */
      state.books.push({id:"food", name:"吃饭", icon:"🍜", color:BOOK_COLORS[1], budget:0, cat:"food"});
      var fr = state.records.filter(function(r){ return r.type !== "income"; })[0];
      fr.book = "food";
      renderAll();
      var booksBefore = state.books.length, recsAll = state.records.length;
      delBook("food");
      document.getElementById("askYes").click();
      var orphan = state.records.filter(function(r){ return !state.books.some(function(b){ return b.id === bookIdOf(r); }); }).length;
      P("6 删掉「吃饭」账本 → 账本 " + booksBefore + " → " + state.books.length +
        "，账目仍是 " + state.records.length + "/" + recsAll + " 笔，找不到账本的账 " + orphan + " 笔");
      P("   那笔被挪到:" + bookOf(fr.book).name);

      /* ========== 7. 待分类跨月统计 ========== */
      var old = new Date(); old.setMonth(old.getMonth() - 2);
      state.records.push({id:"u1", amt:12, type:"expense", cat:null, peer:"说不清的小店",
        note:"", ts: old.getTime(), src:"manual", book:"daily"});
      renderAll();
      P("7 两个月前留一笔待分类 → 徽标数 " + uncatCount() + "（只有 1 笔，说明跨月也算进来了）");
      P("   本月记账页没有它:" + (flowFirst().indexOf("说不清") < 0 ? "对" : "错"));

      P("");
      P("页面报错 " + JSON.stringify(window.__errs || []));
      return out.join("\n");
    }catch(e){
      return "UI SIM ERROR: " + e.message + "\n" + (e.stack || "");
    }
  })()
