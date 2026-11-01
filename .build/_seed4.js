(function(){var t=new Date();t.setHours(0,1,0,0);var T0=t.getTime();
state.books=[{id:"daily",name:"日常",icon:"🏠",color:"#DE6B45",cat:null,budget:1500,def:true}];
state.records=[];state.peerRules={};state.manualCat=null;state.manualSub=null;state.manualIc="";
save();renderAll();renderHome();})();
