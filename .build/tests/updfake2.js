/*@bridge@*/  // 需要假原生桥：运行器会把 _bridge.js 塞进 <head>
/* 假原生桥自检（2026-11-01）
   原来这个文件只是「把假桥挂上去」的一段片段，没有任何断言，也没有回传标题，
   运行器只能一直等到 60 秒超时 —— 它和 upgfake.js 因此长期是红的。
   现在桥统一由 _bridge.js 在 <head> 里注入，这个文件改成守它：
   桥真的挂上了没有、存档是不是真的走进假存储、方法少了会不会静默炸。 */
(function(){
  var R = []; function p(k, v){ R.push(k + "=" + v); }
  var all = 0, bad = 0;
  function ok(name, cond){ all++; if(!cond) bad++; p((cond ? "Y" : "N") + name, ""); }

  ok("桥已挂上", !!(window.XZBNative && window.XZBNative.load && window.XZBNative.store));
  ok("主脚本认出了 App 身份（NATIVE 非空）", !!NATIVE);
  ok("识别成 App 而不是网页", !!NATIVE && typeof NATIVE.store === "function");

  /* 存档往返：写一笔 → 假存储里应该真有那段 JSON */
  window.__FAKE.v = "";
  state.records = []; state.books = [];
  state.books = [{id: "daily", name: "日常", icon: "🏠", color: "#DE6B45",
                  cat: null, budget: 0, def: true}];
  state.records.push({id: "b1", amt: 20, type: "expense", cat: "food",
                      peer: "食堂", note: "", ts: Date.now(), book: "daily"});
  var before = String(window.__FAKE.v || "");
  save();
  ok("save() 真的写进了假存储", String(window.__FAKE.v).length > before.length);
  ok("写进去的是 JSON", (function(){ try{ return JSON.parse(window.__FAKE.v).v > 0; }catch(e){ return false; } })());

  /* 读回来 */
  window.__FAKE.v = JSON.stringify({v: 4, books: [{id: "daily", name: "日常", icon: "🏠",
    color: "#DE6B45", cat: null, budget: 2000, def: true}], peerRules: {},
    records: [{id: "r1", amt: 9.9, type: "expense", cat: "food", peer: "食堂", note: "",
               ts: Date.now(), book: "daily"}]});
  load();
  ok("load() 读回了 1 笔", state.records.length === 1);
  ok("金额没错", state.records.length === 1 && state.records[0].amt === 9.9);

  ok("更新相关方法齐全",
     ["installUpdate", "canInstallApk", "hasPendingApk", "openInstallSettings"].every(function(k){
       return typeof window.XZBNative[k] === "function";
     }));
  ok("没有页面报错", (window.__errs || []).length === 0);

  document.title = all + "/" + all + " || ERR " + (bad ? bad + " 条不通过" : "none");
})();
