#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一句话解析探针：把 parseOne 的结果打出来看，改规则前先量一遍基线。
用法：python _probe.py            （跑内置用例）
"""
import json, os, re, subprocess, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
OUT = os.path.join(ROOT, "_probe.html")

CASES = [
    "板面卤蛋 19",
    "西餐 90",
    "火锅 1010",
    "中餐 25",
    "快餐 15",
    "日料 80",
    "鸡蛋灌饼 5",
    "西红柿炒鸡蛋 20",
    "茶叶蛋 2",
    "肯德基 30",
    "牛肉面 15",
    "米饭青菜 8",
    "一份米加一碗菜 16",
    "板面 19",
    "吃了一碗板面 20",
    "板面加卤蛋 20",
    "拌面加卤蛋 20",
    "一碗面加一个卤蛋 16",
    "加州牛肉面 15",
    "加多宝 3",
    "加油卡 100",
    "参加婚礼 500",
    "牛肉面加蛋 12",
    "菜鸟驿站代收 2",
    "面膜 30",
    "米饭 2",
    "两个包子 4",
]

JS = """
<script>
setTimeout(function(){
  function probe(s){
    var r = parseOne(s, Date.now(), "expense");
    return r ? (r.note + " | " + (r.cat === null ? "未分类" : r.cat) + " | " + r.amt) : "解析失败";
  }
  var cases = %s;
  var out = cases.map(function(c){ return c + "  =>  " + probe(c); });
  document.title = "PROBE::" + out.join(" || ");
}, 300);
</script>
"""


def main():
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    block = JS % json.dumps(CASES, ensure_ascii=False)
    html = html.replace("</body>", block + "\n</body>", 1)
    open(OUT, "w", encoding="utf-8").write(html)

    p = subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--virtual-time-budget=4000",
                        "--dump-dom", "http://127.0.0.1:8899/_probe.html"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.search(r"<title>(PROBE::.*?)</title>", p.stdout, re.S)
    if not m:
        t = re.search(r"<title>(.*?)</title>", p.stdout, re.S)
        print("没拿到结果，title =", t.group(1)[:200] if t else "(空)")
        return 1
    for line in m.group(1)[len("PROBE::"):].split(" || "):
        print("  " + line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
