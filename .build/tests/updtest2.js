/*@bridge@*/  // 需要假原生桥：运行器会把 _bridge.js 塞进 <head>
(function(){
  var R = [];
  function p(k, v){ R.push(k + "=" + v); }
  var $ = function(id){ return document.getElementById(id); };

  // 先塞一笔账，用来验证「更新前会先把账写死」
  window.__FAKE.v = JSON.stringify({v: 4, books: [
    {id: "daily", name: "日常", icon: "🏠", color: "#DE6B45", cat: null, budget: 2000, def: true}
  ], peerRules: {}, records: [
    {id: "a1", amt: 12, type: "expense", cat: "food", peer: "食堂", note: "", ts: Date.now(), book: "daily"}
  ]});
  try{ load(); renderAll(); }catch(e){ p("初始化抛出", e.message); }

  var info = {name: "1.6", apk: "https://example.com/xzb-1.6.apk", size: "24.2 MB",
              date: "2026-10-21", log: ["测试条目一", "测试条目二"]};

  /* T1 弹窗初始态 */
  showUpd(info);
  p("T1_弹出", $("updBox").classList.contains("on") ? "是" : "否");
  p("T1_进度条", $("updProg").classList.contains("on") ? "显示(错)" : "隐藏");
  p("T1_按钮", $("updGo").textContent + "/" + ($("updGo").disabled ? "禁用" : "可点"));
  p("T1_说明", $("updList").textContent.indexOf("测试条目一") >= 0 ? "有" : "无");

  /* T2 点更新：应在 App 内下载，不跳浏览器 */
  var w0 = window.__WROTE;
  $("updGo").click();
  p("T2_调用", window.__CALLS.join(",").indexOf("install:https://example.com/xzb-1.6.apk:1.6") >= 0 ? "是" : window.__CALLS.join(","));
  p("T2_先存账", window.__WROTE > w0 ? "是" : "否");
  p("T2_进度显示", $("updProg").classList.contains("on") ? "是" : "否");
  p("T2_按钮", $("updGo").textContent + "/" + ($("updGo").disabled ? "禁用" : "可点"));
  p("T2_以后再说", $("updLater").style.display === "none" ? "已藏" : "还在");
  p("T2_没开浏览器", window.__CALLS.join(",").indexOf("browser:") < 0 ? "是" : "否");

  /* T3 进度回调 */
  window.__onUpd(37, "9.0 / 24.2 MB");
  p("T3_进度", $("updBar").style.width + " / " + $("updPt").textContent);

  /* T4 下载完成 */
  window.__onUpdEnd("ok", "正在打开安装界面");
  p("T4_按钮", $("updGo").textContent + "/" + ($("updGo").disabled ? "禁用" : "可点"));
  p("T4_进度", $("updBar").style.width);
  p("T4_说明", $("updNote").textContent.indexOf("不用卸载") >= 0 ? "有保留数据的提示" : $("updNote").textContent);

  /* T5 缺「安装未知应用」权限 → 去开，回来复用已下好的包 */
  window.__CALLS.length = 0; window.__HAS = true; window.__CAN = false;
  showUpd(info);
  $("updGo").click();
  window.__onUpdEnd("perm", "还差一步");
  p("T5_按钮", $("updGo").textContent + "/" + ($("updGo").disabled ? "禁用" : "可点"));
  $("updGo").click();
  p("T5_去开开关", window.__CALLS.join(","));
  window.__CAN = true;
  window.__onUpdResume();
  p("T5_回来文案", $("updGo").textContent);
  $("updGo").click();
  p("T5_复用已下好", window.__CALLS.join(",") + " → " + $("updGo").textContent);

  /* T6 失败 */
  window.__CALLS.length = 0; window.__INSTALL_OK = true;
  showUpd(info);
  $("updGo").click();
  window.__onUpdEnd("fail", "网络断了，换个网络再试");
  p("T6_按钮", $("updGo").textContent + "/" + ($("updGo").disabled ? "禁用" : "可点"));
  p("T6_说明", $("updNote").textContent);
  p("T6_进度收起", $("updProg").classList.contains("on") ? "还在(错)" : "已收");

  /* T7 没有原生安装能力 → 退回浏览器 */
  window.__CALLS.length = 0;
  var keep = NATIVE.installUpdate;
  delete NATIVE.installUpdate;
  showUpd(info);
  $("updGo").click();
  p("T7_走浏览器", window.__CALLS.join(",") || "没调用");
  p("T7_弹窗关", $("updBox").classList.contains("on") ? "没关" : "已关");
  NATIVE.installUpdate = keep;

  /* T8 下载中重复点不该重复下 */
  window.__CALLS.length = 0;
  showUpd(info);
  $("updGo").click();
  window.__onUpd(10, "1.0 / 24.2 MB");
  var once = window.__CALLS.length;
  $("updGo").click();
  p("T8_重复点击", window.__CALLS.length === once ? "没重复下" : "重复了(" + window.__CALLS.length + ")");

  /* T9 原生启动失败 → 明确告知并允许重试 */
  window.__CALLS.length = 0; window.__INSTALL_OK = false;
  showUpd(info);
  $("updGo").click();
  p("T9_失败文案", $("updGo").textContent + " / " + $("updNote").textContent);
  window.__INSTALL_OK = true;

  p("ERR", window.__errs.length ? window.__errs.join(" | ") : "none");
  document.title = R.join(" | ");
})();
