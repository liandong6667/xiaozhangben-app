<script>
setTimeout(function(){
  state.records = [];
  state.books = [
    {id:"daily", name:"日常", icon:"🏠", color:"#DE6B45", cat:null, budget:0, def:true},
    {id:"b2", name:"很长很长很长很长的账本名字测试溢出效果", icon:"📒", color:"#3B6FD4", cat:null, budget:0, def:false},
    {id:"b3", name:"吃", icon:"🍜", color:"#2E8C63", cat:"food", budget:100, def:false}
  ];
  for(var i=0;i<9;i++){
    state.records.push({id:"r"+i, amt: 12.34 + i, type:"expense", cat: i%3? "food":null, ts: Date.now()-i*3600000, book: i%3? "b2":"b3", peer: "测试商户名字特别长的那种" + i});
  }
  setMode("dark");
  renderAll(); renderHome();
  document.querySelector('.tab[data-tab="stats"]').click();
  document.title = "LONG ok";
}, 600);
</script>
