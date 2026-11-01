setTimeout(function(){
  try{
    localStorage.removeItem("xiaozhangben.v3");
    load(); renderAll(); renderHome();
    openCatSheet();
    document.title = "T1 1/1 || Y面板打开了 || ERR none";
  }catch(e){ document.title = "T1 0/1 || N" + e.message + " || ERR none"; }
}, 700);
