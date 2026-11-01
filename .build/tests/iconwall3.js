(function(){
  var L = (typeof LOGOS !== 'undefined') ? LOGOS : {};
  var NEW = ["361度","zara","一点点","乡村基","大参林","好利来","来伊份","极兔","正新鸡排","甜啦啦","绝味","良品铺子","鸿星尔克"].filter(function(k){return L[k]});
  var w=document.createElement('div');
  w.style.cssText='position:fixed;top:0;left:0;z-index:999999;background:#FBF7F2;padding:10px;display:grid;grid-template-columns:repeat(5,1fr);gap:10px;font:10px/1.2 -apple-system,"Microsoft YaHei",sans-serif;color:#444;width:250px;transform:scale(2.6);transform-origin:0 0';
  NEW.forEach(function(k){
    var d=document.createElement('div');
    d.style.cssText='text-align:center';
    d.innerHTML='<div style="width:41px;height:41px;border-radius:12px;overflow:hidden;margin:0 auto 4px;box-shadow:0 1px 3px rgba(0,0,0,.10)"><img src="'+L[k]+'" style="width:41px;height:41px;object-fit:cover;display:block"></div>'+k;
    w.appendChild(d);
  });
  document.body.appendChild(w);
  document.title='k3 '+NEW.length;
})();
