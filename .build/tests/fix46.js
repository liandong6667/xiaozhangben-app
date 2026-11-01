/* fix46：「今中午和朋友吃火锅」被劈成「今 + 朋友吃火锅」+ 记一笔加备注
   （2026-11-01 用户报）
   ① splitDishes 把「和朋友」的「和」当成两样菜之间的分隔符
   ② 时间词只认「今天」，口语里的「今中午」会剩一个「今」
   ③ 补记面板底下的「日常用导入账单更省事」那行小字删掉
   ④ 记一笔加一个手填备注框 */
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "[" + got + "!=" + want + "]"); }
  function report(){
    var pass = log.filter(function(x){ return x.charAt(0) === "Y"; }).length;
    var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
    var good = log.filter(function(x){ return x.charAt(0) === "Y"; });
    document.title = "fix46 " + pass + "/" + log.length + " || " + bad.concat(good).join("|") + " || ERR none";
  }
  function fire(el, ev){ el.dispatchEvent(new Event(ev || "input")); }
  function peerOf(q){
    var r = parseOne(q, "expense");
    return r ? r.note : "NULL";
  }

  setTimeout(function(){
    try{
      localStorage.removeItem("xiaozhangben.v3");
      load(); renderAll(); renderHome();

      /* ===== A. 那句话不能再劈成两半 ===== */
      eq("A1 今天中午和朋友吃火锅 → 火锅", peerOf("今天中午和朋友吃火锅花了100"), "火锅");
      eq("A2 今中午（省字）也要剥干净", peerOf("今中午和朋友吃火锅花了100"), "火锅");
      ok("A3 不许再出现「今 + 」", peerOf("今中午和朋友吃火锅花了100").indexOf("今 + ") < 0);
      eq("A4 和室友一起拼奶茶", peerOf("中午和室友拼单奶茶20"), "奶茶");
      eq("A5 跟闺蜜喝杯奶茶", peerOf("下午跟闺蜜喝了杯奶茶18"), "奶茶");
      eq("A6 和爸妈吃早饭", peerOf("今早和爸妈吃早饭20"), "早饭");
      // 该拆的还得拆，别把老规则拆没了
      eq("A7 火锅和奶茶仍然拆两样", peerOf("火锅和奶茶50"), "火锅 + 奶茶");
      eq("A8 板面卤蛋仍然黏着拆", peerOf("板面卤蛋15"), "板面 + 卤蛋");
      ok("A9 「和同学吃饭」不会只剩一个字",
         (peerOf("和同学吃饭30") || "").length >= 2);
      ok("A10 「和平饭店」的「和」不能被当成陪人",
         peerOf("和平饭店吃饭120").indexOf("和平") >= 0);
      // 单字段不拆：任何一段只有一个字，整句就退回不拆
      ok("A11 「今和朋友吃火锅」不会拆出「今」",
         peerOf("今和朋友吃火锅80").indexOf("今 +") < 0);

      /* ===== B. 底下那行小字提示删掉了 ===== */
      var ad = document.getElementById("sheetAdd");
      ok("B1 面板里没有 .mini-tip 了", !ad.querySelector(".mini-tip"));
      ok("B2 也没有「导入账单更省事」那句话", (ad.textContent || "").indexOf("更省事") < 0);

      /* ===== C. 备注框 ===== */
      openAddSheet();
      var nt = document.getElementById("qiNote");
      ok("C1 备注框在", !!nt);
      ok("C2 是选填（占位写着选填）", (nt.getAttribute("placeholder") || "").indexOf("选填") >= 0);

      var q = document.getElementById("qi");
      q.value = "今中午和朋友吃火锅花了100"; fire(q);
      previewManual();
      nt.value = "AA，我先垫的"; fire(nt);
      var before = state.records.length;
      document.getElementById("btnAdd").click();
      var rec = state.records[state.records.length - 1];
      eq("C3 多了一笔", state.records.length, before + 1);
      eq("C4 备注存进 note", rec.note, "AA，我先垫的");
      eq("C5 店名还是火锅（备注不覆盖店名）", rec.peer, "火锅");
      eq("C6 记完备注框自己清空", nt.value, "");

      /* 明细行要能看见这句备注 */
      goto("flow"); renderFlow();
      var joined = Array.prototype.slice.call(document.querySelectorAll(".it-s .tm"))
        .map(function(x){ return x.textContent || ""; }).join(" || ");
      ok("C7 明细那行小字里有备注", joined.indexOf("AA，我先垫的") >= 0);

      /* 不填备注时，note 必须是空的（别把上一笔的备注带过来） */
      openAddSheet();
      q.value = "午饭15"; fire(q);
      previewManual();
      var b2 = state.records.length;
      document.getElementById("btnAdd").click();
      eq("C8 不填备注就存空", state.records[b2].note, "");

      /* 清空按钮要一起清备注 */
      openAddSheet();
      nt.value = "写了点东西"; fire(nt);
      document.getElementById("btnClear").click();
      eq("C9 点清空，备注也清掉", nt.value, "");

      /* 备注入库之后，读档 / 备份还得带着它 */
      ok("C10 存档里 note 跟着记录走（records 原样存）", (function(){
        var raw = localStorage.getItem("xiaozhangben.v3") || "";
        return raw.indexOf("AA，我先垫的") >= 0;
      })());

      /* ===== D. 已经躺在库里的那条怪名字，读档时自动洗掉 ===== */
      var old = [
        {id:"o1", src:"manual", peer:"今 + 朋友吃火锅", note:"", cat:"food", amt:100, ts:1000, type:"expense", book:"daily"},
        {id:"o2", src:"manual", peer:"米 + 菜",        note:"", cat:"food", amt:16,  ts:1000, type:"expense", book:"daily"},
        {id:"o3", src:"manual", peer:"板面 + 卤蛋",    note:"", cat:"food", amt:20,  ts:1000, type:"expense", book:"daily"},
        {id:"o4", src:"notify", peer:"今 + 朋友吃火锅", note:"", cat:"food", amt:10,  ts:1000, type:"expense", book:"daily"}
      ];
      scrubBadSplit(old);
      eq("D1 劈坏的老账洗成火锅", old[0].peer, "火锅");
      eq("D1 金额没动", old[0].amt, 100);
      eq("D1 时间没动", old[0].ts, 1000);
      eq("D2 正常的「米 + 菜」不许动", old[1].peer, "米 + 菜");
      eq("D3 正常的「板面 + 卤蛋」不许动", old[2].peer, "板面 + 卤蛋");
      eq("D4 通知记的账一个字都不许动", old[3].peer, "今 + 朋友吃火锅");
    }catch(e){
      log.push("N例外:" + (e && e.message));
    }
    report();
  }, 700);
})();
