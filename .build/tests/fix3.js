<script>
/* 1.6.1 复测三条：N1 跨批次去重误杀、N2 批内完全相同行、N3 退款口径 */
(function(){
  var L = [], pass = 0, fail = 0;
  function ok(n, c){ if(c){ pass++; } else { fail++; L.push("NO:" + n); } }
  function eq(n, a, b){ ok(n + "(" + a + "!=" + b + ")", a === b); }

  var T = new Date(2026, 9, 21, 12, 0, 0).getTime();

  function reset(){
    state.records = [];
    state.books = [{id:"daily", name:"日常", icon:"🏠", color:"#DE6B45", cat:null, budget:0, def:true}];
    state.book = "all";
    state.peerRules = {};
    state.viewMonth = {y: 2026, m: 9};
    state.filter = "all";
  }
  function rec(peer, amt, ts, type){ return {amt:amt, type:type || "expense", peer:peer, ts:ts, note:"", cat:null}; }
  function old(peer, amt, ts){ return {id:"x" + Math.random(), amt:amt, type:"expense", cat:"food", peer:peer, ts:ts, book:"daily"}; }

  function run(){
    try{
      /* ===== N1：跨批次去重不能误杀真实消费 ===== */
      reset();
      state.records = [old("咖啡A", 20, T)];
      var r = ingest([rec("咖啡B", 20, T + 60000)], 0, 0);
      eq("N1-不同商户放行", r.added, 1);
      eq("N1-不判重", r.dup, 0);
      eq("N1-两笔都在", state.records.length, 2);

      reset();
      state.records = [old("咖啡A", 20, T)];
      r = ingest([rec("咖啡A ", 20, T + 60000)], 0, 0);
      eq("N1-同商户仍判重(空格不影响)", r.dup, 1);

      reset();
      state.records = [old("星巴克", 20, T)];
      r = ingest([rec("上海星巴克咖啡有限公司", 20, T + 30000)], 0, 0);
      eq("N1-全称与简称算同一家", r.dup, 1);

      reset();
      state.records = [old("", 20, T)];
      r = ingest([rec("咖啡B", 20, T + 30000)], 0, 0);
      eq("N1-一边没名字按同一笔", r.dup, 1);

      reset();
      state.records = [old("咖啡A", 20, T)];
      r = ingest([rec("咖啡B", 20, T + 200000)], 0, 0);
      eq("N1-超出2分钟当然放行", r.added, 1);

      /* ===== N2：同一份文件里逐字段相同的两行只记一笔 ===== */
      reset();
      r = ingest([rec("咖啡A", 20, T), rec("咖啡A", 20, T)], 0, 0);
      eq("N2-完全相同两行只记一笔", r.added, 1);
      eq("N2-计为重复", r.dup, 1);

      reset();
      r = ingest([rec("咖啡A", 20, T), rec("咖啡A", 20, T + 20000)], 0, 0);
      eq("N2-同店不同时间两笔都留", r.added, 2);
      eq("N2-同店不同时间不重复", r.dup, 0);

      reset();
      r = ingest([rec("咖啡A", 20, T), rec("咖啡B", 20, T)], 0, 0);
      eq("N2-同秒不同店两笔都留", r.added, 2);

      reset();
      r = ingest([rec("咖啡A", 20, T), rec("咖啡A", 21, T)], 0, 0);
      eq("N2-同秒同店不同价两笔都留", r.added, 2);

      /* ===== N3：退款口径 ===== */
      var head = "交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注\n";
      var csvRefundExp = head +
        "2026-10-21 07:40:00,商户消费,一食堂,包子,支出,¥6.50,零钱,支付成功,1,2,/\n" +
        "2026-10-09 12:30:00,商户消费,美团外卖,已取消订单,支出,¥18.00,零钱,已全额退款,3,4,/\n";
      var p = parseBill(csvRefundExp, T);
      // 1.6.2 起退款行不再在解析阶段丢弃，而是打 refundOf 标记交给 ingest 判断
      eq("N3-退款行被标记而不是丢弃", p.records.length, 2);
      eq("N3-带 refundOf 标记的只有1条", p.records.filter(function(x){ return x.refundOf; }).length, 1);
      eq("N3-退款行单独计数", p.refunds, 1);
      reset();
      var pr = ingest(p.records, p.skipped, p.refunds);
      eq("N3-库里只进正常那笔", state.records.length, 1);
      eq("N3-只新增1笔", pr.added, 1);
      eq("N3-退款按净额0计", pr.refunds, 1);
      eq("N3-没有冲减", pr.refundBack, 0);
      eq("N3-留下的那笔是对的", state.records[0].amt, 6.5);

      var csvRefundIn = head +
        "2026-10-09 12:30:00,退款,美团外卖,订单退款,收入,¥18.00,零钱,退款成功,3,4,/\n";
      var p2 = parseBill(csvRefundIn, T);
      eq("N3-退款到账记一笔", p2.records.length, 1);
      eq("N3-是收入", p2.records[0].type, "income");
      reset();
      ingest(p2.records, 0, 0);
      eq("N3-分类锁定退款", state.records[0].cat, "refund");

      /* 示例账单整体核对：库里的账仍是 19 笔、支出 585 + 收入 2045、退款 1 行不留痕 */
      if(window.__SAMPLE_CSV){
        var s = parseBill(window.__SAMPLE_CSV, T);
        eq("N3-示例账单解析出20行(含1行退款)", s.records.length, 20);
        eq("N3-示例账单退款1行", s.refunds, 1);
        var inc = 0, exp = 0;
        s.records.forEach(function(x){ if(x.refundOf) return; if(x.type === "income") inc += x.amt; else exp += x.amt; });
        eq("N3-示例账单收入2045", Math.round(inc * 100) / 100, 2045);
        eq("N3-示例账单支出585", Math.round(exp * 100) / 100, 585);
        reset();
        var ri = ingest(s.records, s.skipped, s.refunds);
        eq("N3-导入19笔", ri.added, 19);
        eq("N3-退款没冲进任何一笔", ri.refundBack, 0);
        var bIn = 0, bEx = 0;
        state.records.forEach(function(x){ if(x.type === "income") bIn += x.amt; else bEx += x.amt; });
        eq("N3-入库后收入2045", Math.round(bIn * 100) / 100, 2045);
        eq("N3-入库后支出585", Math.round(bEx * 100) / 100, 585);
        eq("N3-没有退款收入混进来", state.records.filter(function(x){ return x.cat === "refund"; }).length, 0);
      } else {
        ok("N3-示例账单未注入", false);
      }

      /* ===== 空结果提示要看得出原因 ===== */
      var empty = parseBill(head + "2026-10-09 12:30:00,商户消费,美团外卖,已取消订单,支出,¥18.00,零钱,已全额退款,3,4,/\n", T);
      eq("提示-解析出1行待定退款", empty.records.length, 1);
      reset();
      var re = ingest(empty.records, empty.skipped, empty.refunds);
      eq("提示-全是退款时0笔入库", re.added, 0);
      eq("提示-退款计数为1", re.refunds, 1);
      ok("提示-文案说清是退款", emptyHint(empty).indexOf("退款") >= 0);

    }catch(e){
      fail++;
      L.push("EX:" + e.message + "@" + (e.stack || "").split("\n")[1]);
    }
    document.title = "PASS=" + pass + " FAIL=" + fail + " | " + L.join(" ; ");
  }

  setTimeout(run, 700);
})();
</script>
