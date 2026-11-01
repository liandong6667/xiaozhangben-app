/* 火锅图标换成铜锅 + 板面卤蛋（没有「加」字）要拆开 + 西餐能认出来
   ------------------------------------------------------------------
   用户 2026-10-30 晚上第四次报的三个问题：
     ① "火锅的图标改一下，改成前视图，就是那种老式铜锅的那种"
     ② "我记一笔说的是「板面卤蛋」，为什么没有加号隔开"
     ③ "为什么识别不出来西餐的分类"

   ②的难点：中间那个「加」字被整个吞掉了，没有任何分隔符可切。
     不能从中间盲劈 —— 「鸡蛋灌饼」会劈成「鸡蛋 + 灌饼」，
     「西红柿炒鸡蛋」会剩半个「西红柿炒」。所以只认一张加料词表，
     而且前段自己还得像一道菜。
   ③的根因同上一版：词表里有「早餐/午餐/晚饭」，却一个菜系名都没收，
     外加"像不像吃的"那张尾字表里没有「餐」，两头都漏。
*/
(function(){
  var log = [];
  function ok(n, c){ log.push((c ? "Y" : "N") + n); }
  function eq(n, got, want){ log.push((got === want ? "Y" : "N") + n + "(" + got + ")"); }

  setTimeout(function(){
    try{
      var now = Date.now();
      function P(s, t){ return parseOne(s, now, t || "expense"); }

      /* 1) 用户报的三条原句 */
      var a = P("板面卤蛋 19");
      eq("1板面卤蛋拆开", a.note, "板面 + 卤蛋");
      eq("1拆完还是餐饮", a.cat, "food");

      var b = P("西餐 90");
      eq("2西餐有分类", b.cat, "food");
      eq("2西餐名字", b.note, "西餐");
      eq("2西餐有细分", subGuess("西餐", "food"), "west");

      /* 2) 菜系名都要能认出来 */
      ["中餐", "快餐", "日料", "牛排", "披萨", "意大利面", "三明治"].forEach(function(w, i){
        eq("3" + w + "归餐饮", P(w + " 50").cat, "food");
      });

      /* 3) 黏在一起的两样菜：只认加料词，前段还得是菜 */
      eq("4米饭青菜拆开", P("米饭青菜 8").note, "米饭 + 青菜");
      eq("4炒面香肠拆开", P("炒面香肠 12").note, "炒面 + 香肠");
      eq("4三字前段也行", P("牛肉面卤蛋 15").note, "牛肉面 + 卤蛋");

      /* 4) 不许误伤：这些本身就是一道菜 */
      eq("5鸡蛋灌饼不动", P("鸡蛋灌饼 5").note, "鸡蛋灌饼");
      eq("5西红柿炒鸡蛋不动", P("西红柿炒鸡蛋 20").note, "西红柿炒鸡蛋");
      eq("5牛肉面不动", P("牛肉面 15").note, "牛肉面");
      eq("5加州牛肉面不动", P("加州牛肉面 15").note, "加州牛肉面");
      eq("5茶叶蛋不动", P("茶叶蛋 2").note, "茶叶蛋");
      eq("5卤蛋单个不动", P("卤蛋 2").note, "卤蛋");
      eq("5洗面奶不动", P("洗面奶 39").note, "洗面奶");
      ok("5洗面奶仍算日用", P("洗面奶 39").cat === "daily");

      /* 5) 火锅图标：换成自己画的铜锅（SVG），不是 emoji */
      var hot = wordIcon("火锅");
      ok("6火锅是SVG", hot.indexOf("<svg") === 0);
      ok("6铜锅画了烟囱", /M9\.7 1\.7h4\.6/.test(hot));
      ok("6铜锅画了耳", /circle/.test(hot));
      eq("6铜锅涮肉同一个图", wordIcon("铜锅涮肉"), hot);
      /* 麻辣烫/烧烤/串串/冒菜还是原来的 🍲 —— 它们本来就不是铜锅 */
      eq("6麻辣烫还是砂锅", wordIcon("麻辣烫"), "🍲");
      eq("6烧烤还是砂锅", wordIcon("烧烤"), "🍲");

      /* 6) 明细行要真的插进去（而且不能把别人的名字也当 HTML 插） */
      var r1 = {id: "h1", amt: 88, cat: "food", type: "expense", peer: "火锅", note: "",
                ts: now, book: "daily", src: "manual"};
      var h1 = itemHTML(r1);
      ok("7行里出现SVG", h1.indexOf("<svg viewBox=\"0 0 24 24\"") >= 0);
      ok("7行里没有转义后的svg", h1.indexOf("&lt;svg") < 0);

      var r2 = {id: "h2", amt: 1, cat: "food", type: "expense", peer: "<svg onload=alert(1)>",
                note: "", ts: now, book: "daily", src: "manual"};
      var h2 = itemHTML(r2);
      ok("7用户名字里的svg被转义", h2.indexOf("<svg onload") < 0);

      /* 7) 老账重洗：库里存着的「板面卤蛋」开 App 就拆开 */
      var old = [{id: "o1", src: "manual", peer: "板面卤蛋", note: "", cat: "food", amt: 19, ts: 1000, type: "expense"}];
      scrubDishNotes(old);
      eq("8老账拆开", old[0].peer, "板面 + 卤蛋");
      eq("8金额没动", old[0].amt, 19);
      eq("8时间没动", old[0].ts, 1000);
      var keep = [{id: "o2", src: "manual", peer: "鸡蛋灌饼", note: "", cat: "food", amt: 5, ts: 1000, type: "expense"}];
      scrubDishNotes(keep);
      eq("8老账灌饼不拆", keep[0].peer, "鸡蛋灌饼");

      var bad = log.filter(function(x){ return x.charAt(0) === "N"; });
      document.title = "fix37 " + (log.length - bad.length) + "/" + log.length + " " + (bad.length ? bad.join(",") : "");
    }catch(err){
      document.title = "fix37 ERR " + (err && err.message);
    }
  }, 900);
})();
