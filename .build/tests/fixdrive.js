/*@bridge@*/  // 需要假原生桥：运行器会把 _bridge.js 塞进 <head>
setTimeout(function(){
  var R=[]; function p(k,v){ R.push(k+"="+v); }
  try{
    var D=86400000, NOW=Date.now();
    window.__FAKE.v = JSON.stringify({v:4,books:[
      {id:"daily",name:"日常",icon:"🏠",color:"#DE6B45",cat:null,budget:2000,def:true},
      {id:"food",name:"餐饮",icon:"🍜",color:"#2E8C63",cat:"food",budget:800,def:false}],
      peerRules:{}, records:[
      {id:"s1",amt:15,type:"expense",cat:"food",peer:"食堂",note:"",ts:NOW-3600000,book:"food"},
      {id:"s2",amt:50,type:"expense",cat:null,peer:"转账-阿伟",note:"",ts:NOW-7200000,book:"daily"},
      {id:"s3",amt:2000,type:"income",cat:"living",peer:"妈妈",note:"",ts:NOW-3*D,book:"daily"}]});
    load(); renderAll();
    p("载入", state.records.length+"笔/"+state.books.length+"账本");

    // 1) 新建账本弹窗的「取消」——之前拼错函数完全没反应
    goto("stats"); openNewBook();
    var opened = document.getElementById("sheetNewBook").classList.contains("on");
    var btn = [].slice.call(document.querySelectorAll("#sheetNewBook .btn-ghost")).filter(function(b){return b.textContent.indexOf("取消")>=0;})[0];
    btn.click();
    p("取消按钮", "开="+opened+" 关="+!document.getElementById("sheetNewBook").classList.contains("on"));

    // 2) 旧面板已移除，不应再有残留
    p("旧面板", document.getElementById("sheetCat") ? "还在" : "已删");

    // 3) 更新检查：真实走一次网络
    UPDATE_URLS.length = 0; UPDATE_URLS.push("http://127.0.0.1:8899/version.json");
    checkUpdate({silent:false});
    setTimeout(function(){
      p("弹窗", document.getElementById("updBox").classList.contains("on"));
      p("标题", document.getElementById("updTitle").textContent);
      p("副标题", document.getElementById("updSub").textContent);
      p("条目", document.querySelectorAll("#updList b").length);
      doUpdate();
      p("更新按钮", "点击后弹窗关="+!document.getElementById("updBox").classList.contains("on")+" 打开地址="+(window.__OPENED||"无"));
      p("ERR", window.__errs && window.__errs.length ? window.__errs.join("|") : "none");
      document.title = R.join(" | ");
    }, 2500);
  }catch(e){ p("EX", e.message); document.title=R.join(" | "); }
}, 500);
