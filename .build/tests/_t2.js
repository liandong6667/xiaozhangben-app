setTimeout(function(){
  try{
    localStorage.removeItem("xiaozhangben.v3");
    load(); renderAll(); renderHome();
    document.title = "T2 1/1 || Yhome好了 || ERR none";
  }catch(e){ document.title = "T2 0/1 || N" + e.message + " || ERR none"; }
}, 700);
