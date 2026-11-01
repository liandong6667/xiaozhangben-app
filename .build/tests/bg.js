<script>
setTimeout(function(){
  var out = [];
  document.querySelectorAll(".bcard").forEach(function(el,i){
    var cs = getComputedStyle(el);
    out.push(i + ":" + el.dataset.bid + "=" + cs.backgroundColor + "/" + cs.backgroundImage.slice(0,30));
  });
  document.title = "BG " + out.join(" | ");
}, 900);
</script>
