<script>
setTimeout(function(){
  state.records = [{id:"a", amt:23.5, type:"expense", cat:"food", ts:Date.now(), book:"daily", peer:"美团外卖"}];
  setSkin("rose"); setMode("dark");
  renderAll(); renderHome();
  openCatFor("a");
  setTimeout(function(){ var d = document.getElementById("ucDel"); if(d) d.click(); }, 250);
}, 500);
</script>
