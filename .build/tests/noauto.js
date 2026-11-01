/* noauto：自动记账整体下线之后，守住「它真的不在了」
   2026-10-30 用户要求：把自动记账先全部删掉（后期再搞），并且
   「不然用户以为 app 是什么流氓软件呢」—— 安装器那两条警告
   （涉敏感权限 / 个人信息将被第三方收集）就是通知使用权 + 读取短信惹的。

   这个文件替代了原来的 fix23 / fix24 / fix33（通知诊断面板）和 fix29（读屏范围），
   那四个测的都是已经删掉的东西，留着只会永远红着。
   现在改成守「删干净了」，谁要是把入口加回来，这里立刻报错。

   注意：解析函数（parseNotify / addFromNotify）**故意保留**，
   fix14 / fix15 等一批测试还在直接调用它们验证解析规则。
   它们不接任何权限来源，留着不会记一分钱，删了反而要重写十几个测试。 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "noauto " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }

  setTimeout(function(){
    try{
      /* ===== A. 「我的」页里那两张自动记账卡片没了 ===== */
      goto("me");
      renderMe();
      ok("A1 没有「自动记账权限」入口", !document.getElementById("mePerm"));
      ok("A2 没有「读屏范围」入口", !document.getElementById("meScope"));
      var meTxt = document.getElementById("pg-me").textContent;
      ok("A3 我的页不再提「自动记账权限」", meTxt.indexOf("自动记账权限") < 0);
      ok("A4 我的页不再提「读屏范围」", meTxt.indexOf("读屏范围") < 0);
      ok("A5 「新账自动记到」还在（这是记账本，不是权限）", !!document.getElementById("meDefaultBook"));

      /* ===== B. 首页那条状态条容器没了 ===== */
      ok("B1 首页没有 #autoBar 容器", !document.getElementById("autoBar"));

      /* ===== C. 两个面板都没了 ===== */
      ok("C1 没有通知诊断面板 #sheetNotilog", !document.getElementById("sheetNotilog"));
      ok("C2 没有读屏范围面板 #sheetScope", !document.getElementById("sheetScope"));

      /* ===== D. 那几个函数确实不存在（不是藏起来） ===== */
      ok("D1 logNotice 已删除", typeof window.logNotice === "undefined");
      ok("D2 renderAutoBar 已删除", typeof window.renderAutoBar === "undefined");
      ok("D3 syncNotices 已删除", typeof window.syncNotices === "undefined");
      ok("D4 showNotifyLog 已删除", typeof window.showNotifyLog === "undefined");
      ok("D5 openScope 已删除", typeof window.openScope === "undefined");
      ok("D6 原生推通知的入口 __onPayNotice 已删除", typeof window.__onPayNotice === "undefined");
      ok("D7 权限变化回调 __onPermChange 已删除", typeof window.__onPermChange === "undefined");

      /* ===== E. 解析引擎留着（别的测试在用），但不该有人调用它入账 ===== */
      ok("E1 parseNotify 还在（一批解析测试依赖它）", typeof window.parseNotify === "function");
      ok("E2 addFromNotify 还在", typeof window.addFromNotify === "function");

      /* ===== F. 换桌面图标那一套不能被误伤 ===== */
      ok("F1 名字和图标面板还在", !!document.getElementById("sheetBrand"));
      /* 2026-10-30 面板改版：用户要「桌面名字和图都自己定」，
         原来那个含糊的「用这个名字和图片另建一个」换成了独立的一块。 */
      ok("F2 桌面名字输入框在", !!document.getElementById("deskNameIn"));
      ok("F2b 桌面表情行在", !!document.getElementById("deskEmojis"));
      ok("F2c 桌面「加到桌面」按钮在", !!document.getElementById("deskAddBtn"));
      ok("F2d 桌面那块默认不露出（网页版）", !!document.getElementById("brandDeskBox"));
      ok("F3 表情转图函数在（自定义图标要用）", typeof window.emojiToPng === "function");

    }catch(e){
      log.push("N 抛异常: " + (e && e.message ? e.message : e));
    }
    report();
  }, 900);
})();
