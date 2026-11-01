(function(){
  var L = (typeof LOGOS !== 'undefined') ? LOGOS : {};
  var NEW = ["王者荣耀","和平精英","原神","崩坏星穹铁道","绝区零","崩坏3","未定事件簿","鸣潮",
    "战双帕弥什","明日方舟","光遇","碧蓝航线","蔚蓝档案","尘白禁区","恋与深空","光与夜之恋",
    "无限暖暖","蛋仔派对","元梦之星","第五人格","金铲铲之战","英雄联盟手游","无畏契约",
    "穿越火线","使命召唤手游","三角洲行动","暗区突围","火影忍者","天涯明月刀","逆水寒",
    "永劫无间","明日之后","倩女幽魂","剑网3","燕云十六声","梦幻西游","阴阳师","率土之滨",
    "三国志战略版","三国谋定天下","万国觉醒","皇室战争","部落冲突","荒野乱斗","qq炫舞",
    "qq飞车","欢乐斗地主","欢乐麻将","开心消消乐","球球大作战","迷你世界","我的世界",
    "元气骑士","植物大战僵尸2","羊了个羊","steam","epic","xbox","taptap"].filter(function(k){return L[k];});
  var w = document.createElement('div');
  w.style.cssText = 'position:fixed;top:0;left:0;z-index:999999;background:#FBF7F2;padding:14px;' +
    'display:grid;grid-template-columns:repeat(9,1fr);gap:14px 10px;font:11px/1.3 -apple-system,"Microsoft YaHei",sans-serif;color:#333';
  NEW.forEach(function(k){
    var d = document.createElement('div');
    d.style.cssText = 'text-align:center';
    d.innerHTML = '<div style="width:46px;height:46px;border-radius:14px;overflow:hidden;margin:0 auto 5px;' +
      'box-shadow:0 1px 4px rgba(0,0,0,.12);background:#fff"><img src="' + L[k] + '" ' +
      'style="width:46px;height:46px;object-fit:cover;display:block"></div>' + k;
    w.appendChild(d);
  });
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;left:14px;bottom:6px;font:12px -apple-system,"Microsoft YaHei",sans-serif;color:#999';
  t.textContent = '1.6.31 新增游戏图标 · 共 ' + NEW.length + ' 个（46px 显示）';
  document.body.appendChild(w); document.body.appendChild(t);
  document.title = 'wg ' + NEW.length;
})();
