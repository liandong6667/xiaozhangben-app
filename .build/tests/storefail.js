/* storefail：存档写不进去的时候，App 该说什么、说到什么程度
   用户报的现场：一个空首页 + 一句「存储满了，先去统计页导出备份」。
   两个毛病：
   ① 文案过时 —— 「统计页」早改名成「账本」了，导出备份其实在「我的」里；
   ② 一闪就没 —— 2.4 秒的 toast 飘过去，用户根本不知道"账正在丢"，
      而这是持续状态，不是一次性错误。
   A. 基线：正常时没有警示条
   B. 点减号（真实按钮 → hideCard → save）写失败：常驻警示条出现、文案指对地方、只弹一次
   C. 第二次失败不刷屏
   D. 恢复可写之后警示条自己撤掉，不用重启
*/
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function $(id){ return document.getElementById(id); }
  /* 警示条用 .svw 挂了两处：首页（卡片上面）和记账页（自动记账状态条上面）。
     用户可能正在记账页一笔一笔地记，只挂首页的话他根本看不到这条。 */
  function warn(){ return document.querySelector("#pg-home .svw"); }
  function warnFlow(){ return document.querySelector("#pg-flow .svw"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    document.title = "storefail " + pass + "/" + log.length + " || " + log.join("|") + " || ERR none";
  }

  var realSet = Storage.prototype.setItem;
  var realToast = window.toast;
  var toasts = [];

  setTimeout(function(){
    ok("A0 两处挂载点都在（首页 + 记账页）", !!warn() && !!warnFlow());
    eq("A1 正常的时候首页没有警示条", warn().children.length, 0);
    eq("A2 正常时它不占高度（不留一条空缝）", warn().offsetHeight, 0);

    /* 把 toast 拦下来数次数：仍然照常显示，只是记一笔 */
    window.toast = function(m, ms){ toasts.push(String(m)); return realToast(m, ms); };

    /* 让写入必然失败。真实世界就是这个表现：无痕模式、或 5MB 真的满了 */
    Storage.prototype.setItem = function(){
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    };

    /* 走真实按钮：点「本月」那张卡右上角的减号 → hideCard → save()
       注意：hideCard 现在把落盘延后了（saveSoon 320ms + 动画结束再 save），
       为的是不跟动画抢帧 —— 所以这里要等得比动画长，才能看到写失败的反应。
       2026-10-29：hideCard 改成「收起动画走完再 saveSoon（+320ms）」之后，
       从点下到落盘一共约 780ms，原来的 620ms 窗口已经等不到了 —— 这里放到 1000。 */
    $("hmXMonth").click();

    setTimeout(function(){
      ok("B1 写失败后首页出现常驻警示条", warn().children.length === 1);
      ok("B2 用的是 svwarn 警示样式", !!warn().querySelector(".notice.svwarn"));
      var txt = warn().textContent;
      ok("B3 文案指到「我的 → 导出备份」", txt.indexOf("我的") >= 0 && txt.indexOf("导出备份") >= 0);
      ok("B4 不再提那个已经不存在的「统计页」", txt.indexOf("统计页") < 0);
      ok("B5 说清后果（账会留不住）", txt.indexOf("留不住") >= 0 || txt.indexOf("没了") >= 0);
      ok("B6 记账页那条也亮了（正在记账时也看得见）", warnFlow().children.length === 1);
      eq("B7 第一次失败弹一句提示", toasts.length, 1);
      eq("B8 状态照样落到内存里（不是白点一下）", state.hide.month, true);

      /* 第二张卡也收：第二次写失败 */
      $("hmXDay").click();
      setTimeout(function(){
        eq("C1 第二次失败不再弹（不刷屏）", toasts.length, 1);
        eq("C2 警示条还在、没被重画掉", warn().children.length, 1);

        /* 用户关掉无痕 / 清了空间：下一次保存成功，警示条应当自己撤 */
        Storage.prototype.setItem = realSet;
        save();
        setTimeout(function(){
          eq("D1 能写了之后警示条自己撤掉", warn().children.length, 0);
          eq("D2 撤掉后没留下空壳占位", warn().innerHTML, "");
          eq("D2b 记账页那条也一起撤了", warnFlow().children.length, 0);
          /* 再失败一次要能重新亮起来 —— 不能"撤一次就再也不管了" */
          Storage.prototype.setItem = function(){
            throw new DOMException("full", "QuotaExceededError");
          };
          save();
          setTimeout(function(){
            eq("D3 又写不进去时警示条重新出现", warn().children.length, 1);
            eq("D4 但不会重复弹 toast", toasts.length, 2);

            /* ---------- E. 开机探测那条路 ---------- */
            /* 场景：页面一打开就发现存不了（无痕模式）。这会儿根本没"刚记的账"，
               弹「刚记的可能留不住」会莫名其妙 —— 只亮横幅、不弹 toast。 */
            storeBroken = false;
            paintStoreWarn();
            eq("E0 复位之后横幅先撤掉", warn().children.length, 0);
            var n0 = toasts.length;
            onStoreFail(new Error("probe"), true);
            eq("E1 开机探测：横幅照样亮起来", warn().children.length, 1);
            eq("E2 开机探测：不弹 toast", toasts.length, n0);

            Storage.prototype.setItem = realSet;
            save();
            window.toast = realToast;
            report();
          }, 120);
        }, 120);
      }, 1000);
    }, 1000);
  }, 350);
})();
