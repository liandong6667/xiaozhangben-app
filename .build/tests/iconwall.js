(function(){
  /* LOGOS 是 const 声明，挂在全局词法环境里，不在 window 上 —— 直接引用名字才行。 */
  var LOGOS_ = (typeof LOGOS !== 'undefined') ? LOGOS : {};
  var keys = Object.keys(LOGOS_);
  var w=document.createElement('div');
  w.style.cssText='position:fixed;inset:0;z-index:99999;background:#FBF7F2;padding:12px;overflow:auto;display:grid;grid-template-columns:repeat(10,1fr);gap:12px;font:10px/1.2 -apple-system,"Microsoft YaHei",sans-serif;color:#444';
  keys.forEach(function(k){
    var d=document.createElement('div');
    d.style.cssText='text-align:center';
    d.innerHTML='<div style="width:41px;height:41px;border-radius:12px;overflow:hidden;margin:0 auto 4px;box-shadow:0 1px 3px rgba(0,0,0,.10)"><img src="'+LOGOS_[k]+'" style="width:41px;height:41px;object-fit:cover;display:block"></div>'+k;
    w.appendChild(d);
  });
  document.body.appendChild(w);
  document.title='wall '+keys.length;
})();
