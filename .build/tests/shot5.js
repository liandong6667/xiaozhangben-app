<script>
setTimeout(function(){
  state.records = [{id:"a", amt:23.5, type:"expense", cat:"food", ts:Date.now(), book:"daily"}];
  setSkin("blue"); setMode("light"); renderAll(); renderHome();
  goto("me");
}, 500);
</script>
