<script>
var L = [];
setTimeout(function(){
  try{
    state.records = [{id:"a", amt:23.5, type:"expense", cat:"food", ts:Date.now(), book:"daily"}];
    L.push("set:" + state.records.length);
    openCatFor("a");
    L.push("sheet:" + document.getElementById("sheetUc").classList.contains("on"));
    var d = document.getElementById("ucDel");
    L.push("hasDel:" + !!d);
    if(d) d.click();
    L.push("dlg:" + document.getElementById("askBox").classList.contains("on"));
    L.push("recs:" + state.records.length);
    L.push("title:" + document.getElementById("askTitle").textContent);
  }catch(e){ L.push("ERR:" + e.message); }
  document.title = "D " + L.join(" | ");
}, 700);
</script>
