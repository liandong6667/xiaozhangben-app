<script>
/* 1.6.2 边界两条：H1 跨月退款、H2 分店被并成一家 */
(function(){
  var L = [], pass = 0, fail = 0;
  function ok(n, c){ if(c){ pass++; } else { fail++; L.push("NO:" + n); } }
  function eq(n, a, b){ ok(n + "(" + a + "!=" + b + ")", a === b); }

  function reset(){
    state.records = [];
    state.books = [{id:"daily", name:"日常", icon:"🏠", color:"#DE6B45", cat:null, budget:0, def:true}];
    state.book = "all";
    state.peerRules = {};
    state.viewMonth = {y: 2026, m: 9};
    state.filter = "all";
  }

  function cs() {
    return "交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态\n" +
           Array.prototype.slice.call(arguments).join("\n") + "\n";
  }
  function row(t, peer, amt, dir, stat){
    return [t, "商户消费", peer, "", dir, "¥" + amt, stat].join(",");
  }

  function run(){
    try{
      /* ================= H2：分店不能被并成一家 ================= */
      ok("H2-便利店 vs 便利店A 是两家", samePeer("便利店", "便利店A") === false);
      ok("H2-便利店 vs 便利店3 是两家", samePeer("便利店", "便利店3") === false);
      ok("H2-便利店A vs 便利店B 是两家", samePeer("便利店A", "便利店B") === false);
      ok("H2-完全同名还是同一家", samePeer("便利店", "便利店") === true);
      ok("H2-星巴克 vs 全称仍是同一家", samePeer("星巴克", "上海星巴克咖啡有限公司") === true);
      ok("H2-美团 vs 美团外卖仍是同一家", samePeer("美团", "美团外卖") === true);
      ok("H2-肯德基 vs 肯德基火车站店", samePeer("肯德基", "肯德基火车站店") === true);
      ok("H2-一边没名字按同一笔", samePeer("", "便利店") === true);
      ok("H2-汉堡王 vs 麦当劳是两家", samePeer("汉堡王", "麦当劳") === false);

      // 端到端：先导「便利店」9 元，30 秒后再导「便利店A」9 元
      reset();
      var t0 = new Date(2026, 9, 20, 12, 0, 0).getTime();
      var a = parseBill(cs(row("2026-10-20 12:00:00", "便利店", "9.00", "支出", "支付成功")), t0);
      ingest(a.records, a.skipped, a.refunds);
      var b = parseBill(cs(row("2026-10-20 12:00:30", "便利店A", "9.00", "支出", "支付成功")), t0 + 30000);
      var r2 = ingest(b.records, b.skipped, b.refunds);
      eq("H2-两家分店各记一笔", r2.added, 1);
      eq("H2-两笔都在库里", state.records.length, 2);

      // 完全同名的还是要判重
      reset();
      var c1 = parseBill(cs(row("2026-10-20 12:00:00", "便利店", "9.00", "支出", "支付成功")), t0);
      ingest(c1.records, c1.skipped, c1.refunds);
      var c2 = parseBill(cs(row("2026-10-20 12:00:20", "便利店 ", "9.00", "支出", "支付成功")), t0 + 20000);
      var r3 = ingest(c2.records, c2.skipped, c2.refunds);
      eq("H2-同名跨来源仍判重", r3.dup, 1);

      /* ================= H1：跨月退款要冲回上月的支出 ================= */
      // 场景：9 月已记一笔 18 元美团外卖，10 月账单一行为「支出 + 已全额退款」
      reset();
      var sep = new Date(2026, 8, 5, 19, 30, 0).getTime();
      state.records = [{id:"old1", amt:18, type:"expense", cat:"food", peer:"美团", ts:sep, book:"daily", note:""}];
      var oct = parseBill(cs(row("2026-10-20 12:00:00", "美团", "18.00", "支出", "已全额退款")), t0);
      eq("H1-该行被识别成待定退款", oct.records.length, 1);
      ok("H1-打了 refundOf 标记", oct.records[0].refundOf === true);
      var rh = ingest(oct.records, oct.skipped, oct.refunds);
      eq("H1-新增一笔", rh.added, 1);
      eq("H1-冲减成功计数", rh.refundBack, 1);
      eq("H1-没有被当成净额0丢掉", rh.refunds, 0);
      var back = state.records[state.records.length - 1];
      eq("H1-记成收入", back.type, "income");
      eq("H1-分类是退款", back.cat, "refund");
      eq("H1-金额一致", back.amt, 18);
      eq("H1-指回原来那笔", back.ref, "old1");
      eq("H1-账本跟着原支出", back.book, "daily");
      ok("H1-备注写明冲减哪一笔", /冲减 9月5日/.test(back.note));
      // 净额应当归零
      var net = state.records.reduce(function(s, x){ return s + (x.type === "income" ? x.amt : -x.amt); }, 0);
      eq("H1-全库净额为0", Math.round(net * 100) / 100, 0);

      // 重导同一份账单：不能再冲一次
      var again = parseBill(cs(row("2026-10-20 12:00:00", "美团", "18.00", "支出", "已全额退款")), t0);
      var rh2 = ingest(again.records, again.skipped, again.refunds);
      eq("H1-重导判成重复", rh2.dup, 1);
      eq("H1-重导不多记", rh2.added, 0);
      eq("H1-总笔数没变", state.records.length, 2);

      // 库里没有对应支出（同月成对，或压根没记过）→ 维持不入账
      reset();
      var only = parseBill(cs(row("2026-10-20 12:00:00", "美团", "18.00", "支出", "已全额退款")), t0);
      var rm = ingest(only.records, only.skipped, only.refunds);
      eq("H1-没对上就不入账", rm.added, 0);
      eq("H1-计数为净额0", rm.refunds, 1);
      eq("H1-库里还是空的", state.records.length, 0);

      // 金额对不上不冲减
      reset();
      state.records = [{id:"o2", amt:20, type:"expense", cat:"food", peer:"美团", ts:sep, book:"daily"}];
      var diff = parseBill(cs(row("2026-10-20 12:00:00", "美团", "18.00", "支出", "已全额退款")), t0);
      var rd = ingest(diff.records, diff.skipped, diff.refunds);
      eq("H1-金额不同不冲减", rd.added, 0);
      eq("H1-金额不同算净额0", rd.refunds, 1);

      // 商户对不上不冲减
      reset();
      state.records = [{id:"o3", amt:18, type:"expense", cat:"food", peer:"麦当劳", ts:sep, book:"daily"}];
      var other = parseBill(cs(row("2026-10-20 12:00:00", "美团", "18.00", "支出", "已全额退款")), t0);
      var ro = ingest(other.records, other.skipped, other.refunds);
      eq("H1-商户不同不冲减", ro.added, 0);

      // 两笔同额支出 + 两行退款：各冲一笔，不能叠加冲到同一笔
      reset();
      state.records = [
        {id:"m1", amt:18, type:"expense", cat:"food", peer:"美团", ts:sep, book:"daily"},
        {id:"m2", amt:18, type:"expense", cat:"food", peer:"美团", ts:sep + 86400000, book:"daily"}
      ];
      var two = parseBill(cs(
        row("2026-10-20 12:00:00", "美团", "18.00", "支出", "已全额退款"),
        row("2026-10-21 12:00:00", "美团", "18.00", "支出", "已全额退款")
      ), t0);
      var rt = ingest(two.records, two.skipped, two.refunds);
      eq("H1-两行退款都冲减", rt.refundBack, 2);
      var refs = state.records.filter(function(x){ return x.ref; }).map(function(x){ return x.ref; });
      eq("H1-冲的是不同两笔", refs.length, 2);
      ok("H1-没有重复冲同一笔", refs[0] !== refs[1]);
      // 优先冲最近的那笔
      ok("H1-先冲最近的一笔", refs.indexOf("m2") >= 0);

      // 收入方向的「退款到账」照旧记收入，不走冲减
      reset();
      state.records = [];
      var inc = parseBill(cs(row("2026-10-20 12:00:00", "美团", "18.00", "收入", "退款成功")), t0);
      var ri = ingest(inc.records, inc.skipped, inc.refunds);
      eq("H1-退款到账记成收入", ri.added, 1);
      eq("H1-退款到账不算冲减", ri.refundBack, 0);
      eq("H1-分类仍是退款", state.records[0].cat, "refund");

    }catch(e){
      fail++; L.push("EX:" + (e && e.message));
    }
    document.title = "RESULT pass=" + pass + " fail=" + fail + (L.length ? " | " + L.join(" ; ") : " | ALL OK");
  }

  if(document.readyState === "complete") setTimeout(run, 300);
  else window.addEventListener("load", function(){ setTimeout(run, 300); });
})();
</script>
