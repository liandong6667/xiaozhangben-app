/* 1.6.105 走查：更新弹窗 —— 图标换成 App 自己的、说明砍成一句话。
   用户的意见原话：「简洁一点并且把火箭图标换成 app 的图标，
   更新提示就写『优化了一些不知名的小问题 o.O?』」。 */
(function(){
  var R = [], all = 0, bad = 0;
  function p(k, v){ R.push(k + "=" + v); }
  function ok(name, cond, extra){ all++; if(!cond) bad++; p((cond ? "Y" : "N") + name, extra || ""); }
  function q(id){ return document.getElementById(id); }
  function txt(id){ return ((q(id) || {}).textContent || "").replace(/\s+/g, " ").trim(); }
  function cssTxt(){
    var t = "";
    document.querySelectorAll("style").forEach(function(s){ t += s.textContent; });
    return t;
  }

  /* ---- A. 图标：火箭没了，换成安装包里那张图（base64 内嵌，断网也在） ---- */
  try{
    var iconBox = document.querySelector("#updBox .upd-ic");
    ok("A1 图标框在", !!iconBox);
    ok("A2 火箭没了", (iconBox ? iconBox.textContent : "x").indexOf("🚀") < 0,
       (iconBox ? iconBox.textContent : "").slice(0, 8));

    var img = iconBox ? iconBox.querySelector("img") : null;
    ok("A3 换成图片了", !!img);
    var src = img ? (img.getAttribute("src") || "") : "";
    ok("A4 是内嵌 PNG", src.indexOf("data:image/png;base64,") === 0, src.slice(0, 24));
    ok("A5 图是真图不是空串", src.length > 5000, String(src.length));

    /* 白底线稿放在白卡片上等于隐形 —— 必须有一圈边线把方块勾出来 */
    var cs = iconBox ? getComputedStyle(iconBox) : null;
    ok("A6 白底", !!cs && cs.backgroundColor === "rgb(255, 255, 255)", cs && cs.backgroundColor);
    ok("A7 有边线", !!cs && parseFloat(cs.borderTopWidth) >= 1, cs && cs.borderTopWidth);
    ok("A8 圆角没丢", !!cs && parseFloat(cs.borderTopLeftRadius) >= 10, cs && cs.borderTopLeftRadius);
    ok("A9 样式表里裁掉了图四周的白边", cssTxt().indexOf(".upd-ic img") >= 0 &&
       /\.upd-ic img\{[^}]*transform:\s*scale\(/.test(cssTxt()));
  }catch(e){ ok("A 段没抛异常", false, e.message); }

  /* ---- B. 说明：一句话，且单条不带「·」小圆点 ---- */
  try{
    ok("B1 一句话常量在", typeof UPDATE_NOTE === "string" && UPDATE_NOTE.length > 0, UPDATE_NOTE);
    ok("B2 就是用户要的那句", UPDATE_NOTE === "优化了一些不知名的小问题o.O?", UPDATE_NOTE);

    /* 真正的更新（有包可下）：标题还是「发现新版本」 */
    showUpd({name: "1.6.999", apk: "https://example.com/x.apk", size: "1.2 MB",
             date: "2026-11-01", log: [UPDATE_NOTE]});
    ok("B3 真更新标题", txt("updTitle") === "发现新版本 1.6.999", txt("updTitle"));
    ok("B4 说明只有一句", txt("updList") === UPDATE_NOTE, txt("updList"));
    ok("B5 单条不带小圆点", document.querySelectorAll("#updList b").length === 0);
    ok("B6 主按钮还在", !!q("updGo") && q("updGo").style.display !== "none");
    ok("B7 次按钮是「以后再说」", txt("updLater") === "以后再说", txt("updLater"));

    /* 好几条的时候仍然逐条带「·」，别为了这一版把老路拆了 */
    showUpd({name: "1.6.998", log: ["第一条", "第二条"]});
    ok("B8 多条还是列出来", txt("updList") === "· 第一条 · 第二条", txt("updList"));
    ok("B9 多条有小圆点", document.querySelectorAll("#updList b").length === 2);

    /* 远端一个字都没写 → 也别留空 */
    showUpd({name: "1.6.997", log: []});
    ok("B10 空说明兜底", txt("updList") === UPDATE_NOTE, txt("updList"));
  }catch(e){ ok("B 段没抛异常", false, e.message); }

  /* ---- C. 我的 › 更新日志：别再说「发现新版本」，也别留一个下不了包的主按钮 ---- */
  try{
    closeUpd();
    q("meLog").click();
    ok("C1 打开了", q("updBox").classList.contains("on"));
    ok("C2 标题是「更新日志」", txt("updTitle") === "更新日志 " + VER.name, txt("updTitle"));
    ok("C3 副标题不重复「当前版本」", txt("updSub").indexOf("当前版本") < 0, txt("updSub"));
    ok("C4 副标题带当前版本号", txt("updSub").indexOf("当前 " + VER.name) >= 0, txt("updSub"));
    ok("C5 说明一句话", txt("updList") === UPDATE_NOTE, txt("updList"));
    ok("C6 「立即更新」藏起来了", q("updGo").style.display === "none", q("updGo").style.display);
    ok("C7 只剩「知道了」", txt("updLater") === "知道了", txt("updLater"));
    ok("C8 不提醒「不会删除账目」了", q("updNote").style.display === "none");
    q("updLater").click();
    ok("C9 点「知道了」能关", !q("updBox").classList.contains("on"));

    /* 关掉之后再走一次真正的更新，按钮样式得恢复，不能粘着隐藏 */
    showUpd({name: "1.6.996", apk: "https://example.com/x.apk", log: [UPDATE_NOTE]});
    ok("C10 再弹真更新主按钮回来了", q("updGo").style.display !== "none", q("updGo").style.display);
    ok("C11 次按钮文字也回来了", txt("updLater") === "以后再说", txt("updLater"));
    ok("C12 底部提示也回来了", q("updNote").style.display !== "none", q("updNote").style.display);
    closeUpd();
  }catch(e){ ok("C 段没抛异常", false, e.message); }

  p("VER", VER.name);
  p("ERR", (window.__errs || []).length ? window.__errs.join(" | ") : "none");
  document.title = all + "/" + all + " || " + (bad ? R.filter(function(x){ return x.charAt(0) === "N"; }).join(" | ") : "全过");
})();
