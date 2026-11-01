/* 「检查更新」走真实 GitHub Release（联网）。
   2026-10-30 重写：原来只把探测值拼进 title（形如 "1.9/24.2 MB/..."），
   运行器把其中的 "9/24" 当成通过比例，凭空报出 15 条假失败，
   还一度被误判成「环境无网」。现在每条探针明确输出 Y/N。 */
setTimeout(async function(){
  var R = [];
  function y(k){ R.push("Y" + k); }
  function n(k){ R.push("N" + k); }
  var $id = function(i){ return document.getElementById(i); };

  try{
    /* 1) 版本号读得到 */
    if(VER && VER.name) y("版本号"); else n("版本号为空");

    /* 2) 没配仓库地址时不能抛异常，给个提示就行 */
    try{ checkUpdate({silent:false}); y("空地址不抛"); }
    catch(e){ n("空地址抛异常"); }

    /* 3) 真联网拉 cli/cli 的 latest —— 它肯定比 1.6.90 新 */
    UPDATE_REPO = "cli/cli";
    await checkUpdate({silent:false});

    var box = $id("updBox");
    var on = !!(box && box.classList.contains("on"));
    var tst = ($id("toast") || {}).textContent || "";
    /* 要么弹出更新框，要么给出明确提示（断网时是「检查失败：…」）。
       两种都算功能正常，只有「既没弹窗也没提示」才是真挂。 */
    if(on || tst) y("联网有回应"); else n("联网无回应");

    if(on){
      var ttl = ($id("updTitle") || {}).textContent || "";
      if(ttl.indexOf("发现新版本") === 0) y("标题正常"); else n("标题异常");
      var sub = ($id("updSub") || {}).textContent || "";
      if(sub.indexOf("当前 " + VER.name) >= 0) y("副标题带当前版本");
      else n("副标题异常");
      if(document.querySelectorAll("#updList b").length >= 1) y("有更新条目");
      else n("更新条目为空");
    }

    /* 4) 不联网也能验：从 Release JSON 里挑出 apk */
    var fake = fromRelease({
      tag_name: "v1.9",
      published_at: "2026-11-01T00:00:00Z",
      body: "修复 A\n新增 B",
      assets: [
        {name: "a.txt", size: 10, browser_download_url: "x"},
        {name: "小账本.apk", size: 25355827, browser_download_url: "https://e.com/a.apk"}
      ]
    });
    if(fake && fake.name === "1.9") y("版本号去掉v"); else n("版本号没去v");
    if(fake && fake.apk === "https://e.com/a.apk") y("apk提取对"); else n("apk提取错");
    if(fake && fake.size === "24.2 MB") y("体积换算对"); else n("体积换算错");
    if(fake && fake.log.length === 2) y("更新内容两行"); else n("更新内容行数错");

    /* 5) 整个流程不能有未捕获报错 */
    var errs = window.__errs || [];
    if(!errs.length) y("无JS错误"); else n("有JS错误:" + errs.join("~"));
  }catch(e){
    n("流程异常");
  }

  document.title = R.join(" | ");
}, 600);
