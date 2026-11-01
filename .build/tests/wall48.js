(function(){
  var L = (typeof LOGOS !== 'undefined') ? LOGOS : {};
  var NEW = ["古茗","茶百道","沪上阿姨","茶颜悦色","书亦烧仙草","益禾堂","快乐柠檬","7分甜",
             "一点点","华莱士","塔斯汀","张亮麻辣烫","杨国福","周黑鸭","煌上煌","85度c",
             "鲍师傅","好利来","爸爸糖","罗森","名创优品","良品铺子","美宜佳","唐久",
             "南城香","紫燕百味鸡","九毛九","和府捞面","萨莉亚","胖东来","真功夫","coco",
             "米哈游","森马","海澜之家","波司登","益丰大药房","老百姓大药房","361度","zara",
             "大参林","来伊份","极兔","正新鸡排","甜啦啦","绝味","乡村基","鸿星尔克"]
             .filter(function(k){ return L[k]; });
  var w = document.createElement('div');
  w.style.cssText = 'position:fixed;top:0;left:0;z-index:999999;background:#FBF7F2;padding:14px;' +
    'display:grid;grid-template-columns:repeat(8,1fr);gap:14px 10px;font:11px/1.3 -apple-system,"Microsoft YaHei",sans-serif;color:#333';
  NEW.forEach(function(k){
    var d = document.createElement('div');
    d.style.cssText = 'text-align:center';
    d.innerHTML = '<div style="width:48px;height:48px;border-radius:14px;overflow:hidden;margin:0 auto 5px;' +
      'box-shadow:0 1px 4px rgba(0,0,0,.12);background:#fff"><img src="' + L[k] + '" ' +
      'style="width:48px;height:48px;object-fit:cover;display:block"></div>' + k;
    w.appendChild(d);
  });
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;left:14px;bottom:8px;font:12px -apple-system,"Microsoft YaHei",sans-serif;color:#999';
  t.textContent = '1.6.30 新补的连锁店图标 · 共 ' + NEW.length + ' 个';
  document.body.appendChild(w); document.body.appendChild(t);
  document.title = 'w48 ' + NEW.length;
})();
