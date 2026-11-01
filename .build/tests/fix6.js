/* 外观定版：第一版暖黄底 + 个性化板块关闭
   验证点：
     1. 底色是 #FBF7F2（和原生启动页同一个色，开机不闪）
     2. 默认浅色，不跟随系统深色
     3. 旧的 xzb.theme 存档不再生效（否则入口关了却改不回来）
     4. 「我的 → 个性化 → 外观」入口隐藏，但代码/面板没删
     5. 主色仍是暖橘 #DE6B45 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }
  try{
    var h = document.documentElement;

    /* ---- 1. 底色 ---- */
    var bg = getComputedStyle(document.body).backgroundColor;
    eq("暖黄底色", bg, "rgb(251, 247, 242)");
    var mc = document.querySelector('meta[name="theme-color"]');
    eq("状态栏色一致", mc.getAttribute("content"), "#FBF7F2");

    /* ---- 2. 默认浅色 ---- */
    eq("默认皮肤", h.getAttribute("data-skin"), "orange");
    eq("默认明暗", h.getAttribute("data-dark"), "0");
    eq("模式是light", theme.mode, "light");
    eq("浅色不靠跟随系统", window.XZB_PERSONALIZE, false);

    /* ---- 3. 旧存档不生效 ---- */
    try{ localStorage.setItem("xzb.theme", JSON.stringify({skin: "ink", mode: "dark"})); }catch(e){}
    loadTheme(); applyTheme();
    eq("旧存档被忽略-皮肤", h.getAttribute("data-skin"), "orange");
    eq("旧存档被忽略-明暗", h.getAttribute("data-dark"), "0");
    eq("存档本身已清空", (function(){
      try{ return localStorage.getItem("xzb.theme") || ""; }catch(e){ return "err"; }
    })(), "");

    /* ---- 4. 入口隐藏 ---- */
    var g = document.getElementById("grpTheme"), gh = document.getElementById("grpHTheme");
    ok("入口区块存在", !!g && !!gh);
    eq("入口隐藏", g.style.display, "none");
    eq("小标题隐藏", gh.style.display, "none");
    ok("外观面板没删", !!document.getElementById("sheetTheme"));
    eq("色卡空", document.querySelectorAll("#skinRow [data-skin]").length, 0);
    eq("明暗按钮还在", document.querySelectorAll("#modeRow [data-mode]").length, 3);

    /* ---- 5. 其它「我的」入口没被误伤 ---- */
    ["meExport", "meImport", "meWipeRec", "meWipeAll", "meUpdate", "meDefaultBook"].forEach(function(id){
      var el = document.getElementById(id);
      ok("入口还在-" + id, !!el && el.style.display !== "none");
    });

    /* ---- 6. 主色没被改 ---- */
    var brand = getComputedStyle(document.body).getPropertyValue("--brand").trim();
    eq("暖橘主色", brand.toUpperCase(), "#DE6B45");

    /* ---- 7. 卡片仍是纯白（暖底 + 白卡，层次没糊） ---- */
    var card = getComputedStyle(document.body).getPropertyValue("--card").trim();
    eq("卡片纯白", card.toUpperCase(), "#FFFFFF");

    /* 收尾：把测试写进去的存档还原，别污染后续用例 */
    try{ localStorage.removeItem("xzb.theme"); }catch(e){}
    applyTheme();
  }catch(e){
    log.push("ERR " + (e && e.message));
  }
  var fail = log.filter(function(x){ return x.charAt(0) !== "Y"; });
  document.title = (fail.length ? "RESULT " + fail.join(" ") : "ALL OK") + " | pass=" + (log.length - fail.length) + " fail=" + fail.length;
})();
