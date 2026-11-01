(function(){
  var LOGOS_ = (typeof LOGOS !== 'undefined') ? LOGOS : {};
  var NEW = ["古茗","茶百道","沪上阿姨","茶颜悦色","书亦烧仙草","益禾堂","快乐柠檬","7分甜","华莱士","塔斯汀","张亮麻辣烫","杨国福","周黑鸭","煌上煌","85度c","鲍师傅","爸爸糖","罗森","名创优品","森马","海澜之家","波司登","益丰大药房","老百姓大药房","真功夫","美宜佳","胖东来","唐久","南城香","紫燕百味鸡","九毛九","和府捞面","萨莉亚","coco","米哈游"].filter(function(k){return LOGOS_[k]});
  var w=document.createElement('div');
  /* 41px 原样渲染，再整体放大 2.5 倍看细节 —— 等价于把截图放大看，不改布局。 */
  w.style.cssText='position:fixed;top:0;left:0;z-index:999999;background:#FBF7F2;padding:10px;display:grid;grid-template-columns:repeat(7,1fr);gap:10px;font:10px/1.2 -apple-system,"Microsoft YaHei",sans-serif;color:#444;width:290px;transform:scale(2.5);transform-origin:0 0';
  NEW.forEach(function(k){
    var d=document.createElement('div');
    d.style.cssText='text-align:center';
    d.innerHTML='<div style="width:41px;height:41px;border-radius:12px;overflow:hidden;margin:0 auto 4px;box-shadow:0 1px 3px rgba(0,0,0,.10)"><img src="'+LOGOS_[k]+'" style="width:41px;height:41px;object-fit:cover;display:block"></div>'+k;
    w.appendChild(d);
  });
  document.body.appendChild(w);
  document.title='new '+NEW.length;
})();
