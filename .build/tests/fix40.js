/* fix40 —— 「两个更新通道一起问，谁新用谁」（1.6.92 改的那条）
   老逻辑：先问 GitHub，只要它返回了一个 Release 就当场下结论并 return，
   哪怕那个版本比下载页的 ver.js 旧 —— 于是「只在下载页发了新版」时用户永远
   看到「已经是最新版」。
   这里把两个源都换成桩，六个场景逐个钉住。 */
setTimeout(async function(){
  var R = [];
  function y(k){ R.push("Y" + k); }
  function n(k){ R.push("N" + k); }
  var $id = function(i){ return document.getElementById(i); };

  var realFetch = window.fetchJson, realScript = window.loadUpdScript, realToast = window.toast;
  var gh = null, ghErr = null, dl = null, dlErr = null, toasts = [];
  var shownOf = function(){
    var box = $id("updBox");
    if(!box || !box.classList.contains("on")) return "";
    return (($id("updTitle") || {}).textContent || "").replace(/^发现新版本\s*/, "").trim();
  };

  // 桩：GitHub 那条走 fetchJson，下载页那条（ver.js）走 loadUpdScript
  window.fetchJson = function(){
    if(ghErr) return Promise.reject(new Error(ghErr));
    return Promise.resolve(JSON.parse(JSON.stringify(gh)));
  };
  window.loadUpdScript = function(){
    if(dlErr) return Promise.reject(new Error(dlErr));
    return Promise.resolve(JSON.parse(JSON.stringify(dl)));
  };
  window.toast = function(m){ toasts.push(String(m)); };

  /* 版本号不再写死：以前这里钉着 1.6.93，App 一升到 1.6.94 全部断言就集体变红，
     看着像更新通道坏了，其实只是"拿旧版本号当新版"。一律按当前版本往上加。 */
  var VN = String(VER.name).split(".").map(Number);
  function bump(k){ return VN[0] + "." + VN[1] + "." + ((VN[2] || 0) + k); }
  var CODE = function(k){ return (VER.code | 0) + k; };

  function rel(tag, apk){
    return {tag_name: tag, published_at: "2026-10-31T00:00:00Z",
            body: "测试说明第一行\n第二行",
            assets: apk ? [{name: "xiaozhangben-" + tag + ".apk",
                            browser_download_url: "https://example.com/" + tag + ".apk",
                            size: 1215748}] : []};
  }
  function verJs(name, code, apk){
    return {name: name, code: code, date: "2026-10-31", size: "1.2 MB",
            apk: apk ? "https://xiaozhangben.example/" + name + ".apk" : "",
            log: ["测试更新说明"]};
  }

  async function run(name, g, gErr, d, dErr){
    gh = g; ghErr = gErr; dl = d; dlErr = dErr; toasts = [];
    try{ closeUpd(); updReset(); }catch(e){}
    var box = $id("updBox");
    if(box) box.classList.remove("on");
    try{ await checkUpdate({silent: false}); }
    catch(e){ n(name + "抛异常"); return ""; }
    return shownOf();
  }

  try{
    /* ① 关键场景：GitHub 上是旧版（1.6.90），下载页是新版（1.6.93）
       —— 老逻辑会在这里说「已是最新」并 return */
    var s1 = await run("旧GitHub+新下载页", rel("v" + VER.name, true), null, verJs(bump(1), CODE(1), true), null);
    if(s1 === bump(1)) y("旧GitHub不挡住新下载页");
    else n("旧GitHub挡住了新下载页(显示:" + (s1 || "无") + ")");

    /* ② 反过来：GitHub 新（1.6.94），下载页旧（1.6.93） */
    var s2 = await run("新GitHub+旧下载页", rel("v" + bump(2), true), null, verJs(bump(1), CODE(1), true), null);
    if(s2 === bump(2)) y("GitHub新版能取到");
    else n("GitHub新版没取到(显示:" + (s2 || "无") + ")");

    /* ③ 两边都不比当前新 → 不弹窗，提示「已经是最新版」 */
    var s3 = await run("两边都旧", rel("v" + VER.name, true), null, verJs(VER.name, VER.code, true), null);
    if(!s3 && toasts.join("/").indexOf("已经是最新版") >= 0) y("两边都旧不弹窗");
    else n("两边都旧处理错(弹:" + (s3 || "无") + " 提示:" + toasts.join("/") + ")");

    /* ④ GitHub 版本更新但漏传 .apk → 要用下载页那条有安装包的 */
    var s4 = await run("GitHub新但没包", rel("v" + bump(3), false), null, verJs(bump(1), CODE(1), true), null);
    if(s4 === bump(1)) y("没安装包的版本被跳过");
    else n("选了个没安装包的版本(显示:" + (s4 || "无") + ")");

    /* ⑤ GitHub 404（仓库还没发过版）→ 下载页照常生效 */
    var s5 = await run("GitHub404", null, "HTTP 404", verJs(bump(1), CODE(1), true), null);
    if(s5 === bump(1)) y("404时下载页兜住");
    else n("404时下载页没生效(显示:" + (s5 || "无") + ")");

    /* ⑥ 两个源都读不通 → 不弹窗，提示网络问题（不能谎称「没有版本」） */
    var s6 = await run("两边都不通", null, "HTTP 404", null, "load fail");
    var t6 = toasts.join("/");
    if(!s6 && t6.indexOf("检查失败") >= 0) y("都不通时提示网络");
    else n("都不通的提示不对(弹:" + (s6 || "无") + " 提示:" + t6 + ")");

    /* ⑦ 弹窗内容完整：说明有条目、副标题带当前版本 */
    await run("弹窗内容", rel("v" + bump(5), true), null, null, "load fail");
    var li = document.querySelectorAll("#updList b").length;
    var sub = ($id("updSub") || {}).textContent || "";
    if(li >= 2) y("更新说明有条目"); else n("更新说明为空(" + li + ")");
    if(sub.indexOf("当前 " + VER.name) >= 0) y("副标题带当前版本");
    else n("副标题异常(" + sub + ")");

    /* ⑧ 版本号比较只看数字，tag 带 v 前缀也要认 */
    var s8 = await run("tag带v", rel("v" + bump(4), true), null, null, "load fail");
    if(s8 === bump(4)) y("tag的v前缀被剥掉");
    else n("tag的v前缀没处理(显示:" + (s8 || "无") + ")");
  }catch(e){
    n("整体抛出:" + (e && e.message));
  }finally{
    window.fetchJson = realFetch;
    window.loadUpdScript = realScript;
    window.toast = realToast;
  }

  document.title = R.join(" | ") + " || ERR " +
    ((window.__errs && window.__errs.length) ? window.__errs.join(" ; ") : "none");
}, 500);
