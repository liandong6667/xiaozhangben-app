<script>
setTimeout(function(){
  try{ localStorage.removeItem("xiaozhangben.v3"); }catch(e){}
  state.records = []; state.peerRules = {}; state.book = "all";
  state.books = [{id:"daily",name:"日常",icon:"🏠",color:"#DE6B45",cat:null,budget:0,def:true}];
  setMode("light"); renderAll(); renderHome();
  document.querySelector('.tab[data-tab="home"]').click();
  document.title = "EMPTY ok";
}, 500);
</script>
