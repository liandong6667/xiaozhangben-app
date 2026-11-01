/*@bridge@*/  // 需要假原生桥：运行器会把 _bridge.js 塞进 <head>
(function(){
  var R=[]; function p(k,v){R.push(k+"="+v);}
  var D=86400000, NOW=Date.now();
  var books=[{id:"daily",name:"日常",icon:"🏠",color:"#DE6B45",cat:null,budget:2000,def:true},
             {id:"food",name:"餐饮",icon:"🍜",color:"#2E8C63",cat:"food",budget:800,def:false}];
  window.__FAKE.v=JSON.stringify({v:4,books:books,peerRules:{},records:[
    {id:"s1",amt:15,type:"expense",cat:"food",peer:"食堂",note:"",ts:NOW-3600000,book:"food"},
    {id:"s2",amt:50,type:"expense",cat:null,peer:"转账-阿伟",note:"",ts:NOW-7200000,book:"daily"},
    {id:"s3",amt:2000,type:"income",cat:"living",peer:"妈妈",note:"",ts:NOW-3*D,book:"daily"}
  ]});
  load(); renderAll();
  p("载入",state.records.length+"笔/"+state.books.length+"账本");
  ["home","flow","stats","me"].forEach(function(t){ try{ goto(t); p("页"+t,"ok"); }catch(e){ p("页"+t,"崩:"+e.message); } });
  // 待分类清算
  try{ goto("flow"); openUc(); p("清算",document.getElementById("ucPg").textContent); closeSheets(); }catch(e){ p("清算","崩:"+e.message); }
  // 单笔改分类 → 绑定账本自动接管
  try{ openCatFor("s2");
    var b=[].slice.call(document.querySelectorAll("#ucBody [data-k]")).filter(function(x){return x.dataset.k==="food";})[0];
    b.click();
    var r=state.records.filter(function(x){return x.id==="s2";})[0];
    p("改分类",r.cat+"/归属"+r.book+"/面板关"+!document.getElementById("sheetUc").classList.contains("on"));
  }catch(e){ p("改分类","崩:"+e.message); }
  // 删到空是否允许
  try{
    state.records=[state.records[0]]; renderAll();
    openCatFor(state.records[0].id);
    document.getElementById("ucDel").click();
    p("删空", state.records.length+"笔/存档"+JSON.parse(window.__FAKE.v).records.length+"笔");
  }catch(e){ p("删空","崩:"+e.message); }
  // 更新检查仍可用
  try{ checkUpdate({silent:true}); p("检查更新","ok/地址"+UPDATE_URLS.filter(Boolean).length); }catch(e){ p("检查更新","崩:"+e.message); }
  p("ERR",window.__errs.length?window.__errs.join("|"):"none");
  document.title=R.join(" | ");
})();
