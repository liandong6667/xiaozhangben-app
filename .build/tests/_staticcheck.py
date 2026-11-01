# -*- coding: utf-8 -*-
"""静态自检：抓两类「跑测试也发现不了、但一上手就是 bug」的问题
   1) HTML 里 onclick/oninput/onchange 写的函数，JS 里到底有没有定义
   2) $("id") 用的 id，HTML 里到底有没有这个元素（拼错就静默失效）
   只读，不改文件。
"""
import re, io, sys

SRC = r"D:\小账本\index.html"
html = io.open(SRC, encoding="utf-8").read()

# ---------- 1. 内联事件里调用的函数 ----------
# 取 onclick="a(); b(1)" 里的顶层函数名（跳过 el.xxx( 这种成员调用）
handlers = re.findall(r'\son(?:click|input|change|focus|blur|keydown|keyup|submit)\s*=\s*"([^"]*)"', html)
called = {}
for h in handlers:
    for m in re.finditer(r'(?<![\w.$])([A-Za-z_$][\w$]*)\s*\(', h):
        called.setdefault(m.group(1), []).append(h[:40])

# JS 里定义过的函数/常量（含 window.xxx =）
defined = set()
for m in re.finditer(r'function\s+([A-Za-z_$][\w$]*)\s*\(', html):
    defined.add(m.group(1))
for m in re.finditer(r'(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=', html):
    defined.add(m.group(1))
for m in re.finditer(r'window\.([A-Za-z_$][\w$]*)\s*=', html):
    defined.add(m.group(1))

# 浏览器内置 + 本项目里合法但不算函数的
BUILTIN = set("""alert confirm prompt parseInt parseFloat isNaN Number String Boolean
Array Object Math Date JSON setTimeout setInterval clearTimeout clearInterval
encodeURIComponent decodeURIComponent if for while return typeof new this
toast closeSheets openSheet esc money catOf bookOf catsOf""".split())

missing = []
for fn, where in sorted(called.items()):
    if fn in defined or fn in BUILTIN:
        continue
    # 对象方法调用（el.foo()）在正则里已被 (?<![\w.$]) 排除大部分
    missing.append((fn, where[0]))

print("[1] 内联事件调用的函数")
if not missing:
    print("    OK 全部有定义（共 %d 个不同函数）" % len(called))
else:
    for fn, w in missing:
        print("    !! 没定义: %-24s  出现在: %s" % (fn, w))

# ---------- 2. $("id") 引用的元素 ----------
ids_in_html = set(re.findall(r'\sid="([^"]+)"', html))
used = set(re.findall(r'\$\("([^"]+)"\)', html))
# JS 里用字符串拼出来、运行时才插进 DOM 的 id，静态 HTML 里当然找不到。
# 登记在这儿，别让它们变成"疑点"被忽略掉真正的错。
# 注意上面那条正则连 JS 字符串里的 ` id="xxx"` 也会一起收（前缀是空格），
# 所以以前 autoFix 侥幸没报错 —— 这不是设计，是巧合，别依赖。
DYNAMIC_IDS = {"autoFix", "autoFixHome", "autoFixHome2", "autoA11y", "autoA11yHome"}
bad = sorted(i for i in used if i not in ids_in_html and i not in DYNAMIC_IDS)
print("\n[2] $(\"id\") 引用的元素")
if not bad:
    print("    OK 全部存在（共 %d 个 id 被引用）" % len(used))
else:
    for i in bad:
        print("    !! HTML 里没有这个 id: %s" % i)

# ---------- 3. 顺手查几个容易写坏的地方 ----------
print("\n[3] 其他")
# 未闭合的 <div class="sheet"（数量应与 </div> 配平，但简单起见只报 sheet 数）
print("    sheet 面板数: %d" % len(re.findall(r'<div class="sheet"', html)))
# innerHTML 里直接拼用户数据却没 esc 的（粗略：找 innerHTML = ... + r.xxx 且无 esc）
risky = re.findall(r'innerHTML[^;]{0,200}?\+(?![^;]*\besc\()\s*r\.(\w+)', html)
print("    innerHTML 拼接未走 esc 的疑点: %d 处" % len(risky))
for x in risky[:5]:
    print("      -> r.%s" % x)

sys.exit(1 if (missing or bad) else 0)
