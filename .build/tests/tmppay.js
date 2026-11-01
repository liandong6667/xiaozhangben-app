/* 临时：复现「微信支付 / 已支付 ¥13.80」这条通知 */
(function(){
  setTimeout(function(){
    var cases = [
      {name:"A 手机拼好的", item:{app:"微信", title:"微信支付", text:"微信支付 | 已支付 ¥13.80"}},
      {name:"B 只有正文",   item:{app:"微信", title:"微信支付", text:"已支付 ¥13.80"}},
      {name:"C 无空格",     item:{app:"微信", title:"微信支付", text:"已支付¥13.80"}},
      {name:"D 拼多多加一条", item:{app:"拼多多", title:"拼多多", text:"拼多多 | 支付成功 ¥13.80"}}
    ];
    var out = cases.map(function(c){
      var p = null, err = "";
      try{ p = parseNotify(c.item); }catch(e){ err = e.message; }
      if(!p) return c.name + "=>没认出来 " + err;
      return c.name + "=>" + p.amt + "/" + (p.peer||"空") + "/" + (p.type||"") + "/" + (p.from||"空");
    });
    document.title = "tmp 1/1 || " + out.join(" ;;; ") + " || ERR none";
  }, 700);
})();
