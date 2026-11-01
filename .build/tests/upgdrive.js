/*@bridge@*/  // 需要假原生桥：运行器会把 _bridge.js 塞进 <head>
(function(){
  var R = [];
  function p(k, v){ R.push(k + "=" + v); }
  function sum(a){ var s = 0; a.forEach(function(r){ s += (+r.amt || 0); }); return s; }
  var load = window.load;

  var NOW = Date.now();
  var books3 = [
    {id: "daily", name: "日常", icon: "🏠", color: "#DE6B45", cat: null, budget: 2000, def: true},
    {id: "food", name: "餐饮", icon: "🍜", color: "#2E8C63", cat: "food", budget: 800, def: false},
    {id: "trip", name: "交通", icon: "🚌", color: "#3B6FD4", cat: "transport", budget: 300, def: false}
  ];
  function oldRecs(n){
    var a = [];
    for(var i = 0; i < n; i++){
      a.push({id: "o" + i, amt: (i % 7) + 1.5, type: (i % 10 === 0 ? "income" : "expense"),
        cat: (i % 3 === 0 ? null : "food"), peer: "商户" + i, note: "", ts: NOW - i * 3600000,
        guessed: (i % 3 === 0), src: (i % 2 === 0 ? "notify" : "manual")});
    }
    return a;
  }

  // ===== A：v1.1 老数据（无 books 字段）升级 =====
  var old = oldRecs(200), sOld = sum(old);
  window.__FAKE.v = JSON.stringify({v: 3, records: old, peerRules: {"食堂": "food"}});
  try{ load(); }catch(e){ p("A_抛出", e.message); }
  p("A_条数", state.records.length + "/200");
  p("A_金额", sum(state.records).toFixed(2) + " vs " + sOld.toFixed(2));
  p("A_收入", state.records.filter(function(r){ return r.type === "income"; }).length + "/20");
  p("A_待分类", state.records.filter(function(r){ return !r.cat; }).length + "/67");
  p("A_账本", state.books.length + " 个");
  p("A_全部落默认", state.records.every(function(r){ return r.book === "daily"; }));
  p("A_规则", JSON.stringify(state.peerRules));

  // ===== B：渲染 + 保存 =====
  try{ renderAll(); p("B_渲染", "ok"); }catch(e){ p("B_渲染抛出", e.message); }
  var w0 = window.__WROTE;
  try{ save(); }catch(e){ p("B_保存抛出", e.message); }
  var pay = {};
  try{ pay = JSON.parse(window.__FAKE.v); }catch(e){}
  p("B_写入", pay.v + "/" + (pay.records || []).length + "笔/" + (pay.books || []).length + "账本");

  // ===== C：模拟重启两次，必须幂等 =====
  load(); var n1 = state.records.length, s1 = sum(state.records).toFixed(2);
  load();
  p("C_重启", state.records.length + "vs" + n1 + " / " + sum(state.records).toFixed(2) + "vs" + s1 + " / 账本" + state.books.length);

  // ===== D1：半截 JSON，但里面有一笔是完整的 → 应能抢救回来 =====
  var broken = '{"v":4,"records":[{"id":"x1","amt":10,"ts":' + NOW + '},{"id":"x2","amt":22,"ts":' + NOW + '}],"books":[{"id":"d';
  window.__FAKE.v = broken;
  try{ load(); }catch(e){ p("D1_抛出", e.message); }
  p("D1_抢救", state.records.length + " 笔 / 标记" + (state._badRaw ? "有" : "无"));
  try{ save(); }catch(e){}
  var payD = {};
  try{ payD = JSON.parse(window.__FAKE.v); }catch(e){}
  p("D1_原档随存", (payD.salvage === broken) ? "完整保留" : "丢了");

  // ===== D2：完全读不出来的存档 → 不许把账目清空 =====
  window.__FAKE.v = "这根本不是 JSON，可能是断电时写坏的";
  var before = window.__FAKE.v;
  try{ load(); }catch(e){ p("D2_抛出", e.message); }
  p("D2_读到", state.records.length + " 笔");
  var w1 = window.__WROTE;
  try{ save(); }catch(e){}
  p("D2_拒绝覆盖", window.__WROTE === w1 ? "是（没写）" : "否（写了）");
  p("D2_存档原样", window.__FAKE.v === before ? "未变" : "被改");

  // ===== E：v1.2 三账本数据 =====
  window.__FAKE.v = JSON.stringify({v: 4, books: books3, peerRules: {}, records: [
    {id: "e1", amt: 15, type: "expense", cat: "food", peer: "食堂", note: "", ts: NOW - 1000, book: "food"},
    {id: "e2", amt: 4, type: "expense", cat: "transport", peer: "地铁", note: "", ts: NOW - 2000, book: "trip"},
    {id: "e3", amt: 2000, type: "income", cat: "living", peer: "妈妈", note: "", ts: NOW - 3000, book: "daily"}
  ]});
  load();
  p("E_结构", state.records.length + "笔/" + state.books.length + "账本/归属" + state.records.map(function(r){ return r.book; }).join(""));
  p("E_绑定", state.books.filter(function(b){ return b.cat; }).map(function(b){ return b.name; }).join(""));

  // ===== F：脏记录 =====
  window.__FAKE.v = JSON.stringify({v: 3, peerRules: {}, records: [
    {id: "f1", amt: "15.5", type: "expense", ts: NOW},
    {id: "f2", amt: 0, type: "expense", ts: NOW},
    {id: "f3", amt: 12, type: "expense"},
    null,
    {id: "f5", amt: 8, type: "income", ts: NOW}
  ]});
  load();
  p("F_保留", state.records.length + "/5 跳过" + state._skipped + " 条");

  // ===== G：新增账目是否带账本 =====
  window.__FAKE.v = JSON.stringify({v: 4, books: books3, peerRules: {}, records: []});
  load();
  // G1 自动记账（通知）：食堂 → 应落餐饮账本（分类绑定了账本）
  try{
    addFromNotify({amt: 15, type: "expense", peer: "食堂", note: "", ts: NOW}, true);
    var g1 = state.records[state.records.length - 1];
    p("G1_通知归属", g1.book + "/分类" + g1.cat);
    // G2 自动记账：猜不出分类 → 应落默认账本
    addFromNotify({amt: 12, type: "expense", peer: "扫码付款-A0138", note: "", ts: NOW - 60000}, true);
    var g2 = state.records[state.records.length - 1];
    p("G2_通知无分类", g2.book + "/分类" + g2.cat);
  }catch(e){ p("G_通知抛出", e.message); }
  // G3 补记：当前账本 = 交通，写「午饭15」→ 应进交通账本（用户选的账本优先）
  try{
    state.book = "trip";
    document.getElementById("qi").value = "午饭15";
    document.getElementById("btnAdd").click();
    var g3 = state.records[state.records.length - 1];
    p("G3_补记归属", g3.book + "/" + g3.amt + "/" + g3.cat);
  }catch(e){ p("G3_抛出", e.message); }
  // G4 截图记账：当前账本回到总账本，分类 food 绑定餐饮 → 应进餐饮
  try{
    state.book = "all";
    state.records.push; // noop
    p("G4_截图归属", pickBook("food") + "/自动" + autoBook("food") + "/未知分类" + pickBook(null));
  }catch(e){ p("G4_抛出", e.message); }

  // ===== H：备份导出是否含账本 =====
  var ex = String(doExport);
  p("H_导出含账本", /books: *state\.books/.test(ex));
  var im = String(doImportBackup);
  p("H_恢复含账本", /d\.books/.test(im) && /book: *\(r\.book/.test(im));

  // ===== I：未知字段是否保留 =====
  window.__FAKE.v = JSON.stringify({v: 4, books: books3, peerRules: {}, records: [
    {id: "i1", amt: 5, type: "expense", cat: "food", peer: "x", note: "", ts: NOW, book: "food"}
  ], futureField: {a: 1}});
  load(); save();
  var pay2 = JSON.parse(window.__FAKE.v);
  p("I_未知字段", ("futureField" in pay2) ? "保留" : "丢失");

  // ===== J：账本页面合计与明细是否一致 =====
  try{
    state.book = "food"; renderAll();
    var sOut = document.getElementById("sOut").textContent;
    p("J_餐饮账本", sOut + " 明细" + sum(state.records.filter(function(r){ return r.book === "food"; })).toFixed(2) + " 页面" + (document.getElementById("chipNm") || {}).textContent);
  }catch(e){ p("J_抛出", e.message); }

  p("ERR", window.__errs.length ? window.__errs.join(" | ") : "none");
  document.title = R.join(" | ");
})();
