# -*- coding: utf-8 -*-
"""生成线上更新信息（ver.js / version.json）。

以前的坑（2026-10-31）：版本号是从 发布/version.json 里读的，那份文件要手写。
出了 1.6.93 忘了改它，生成的 ver.js 还写着 1.6.92 —— App 一问就说「已是最新版」，
而且一点报错都没有，最难看出来的那种错。

现在全部从真东西里读，不会再对不上：
  版本号 / code  ← index.html 里的 const VER
  apk 文件名      ← 按版本号推
  size           ← 下载页里那个 apk 的真实字节数
  log            ← CHANGELOG.md 里这一版的条目
日期用今天。

用法：python .build/mkver.py
"""
import io, json, os, re, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHARE = "7G5KXIJMK5"
BASE = "https://xiaozhangben-28313.app.workbuddy.host/"

# ① 版本号：以源码为准
html = io.open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
m = re.search(r'const VER = \{code:\s*(\d+),\s*name:\s*"([^"]+)"\}', html)
if not m:
    raise SystemExit("index.html 里找不到 const VER")
code, ver = int(m.group(1)), m.group(2)

# ② 安装包：按版本号推，真实大小现算
apk_name = "xiaozhangben-%s.apk" % ver
apk_path = os.path.join(ROOT, "下载页", apk_name)
if not os.path.exists(apk_path):
    raise SystemExit("下载页里没有 %s —— 打包后要先拷进来" % apk_name)
size = os.path.getsize(apk_path)
apk_url = BASE + apk_name + "?sharecode=" + SHARE

# ③ 更新说明：CHANGELOG 里这一节（"-" 开头的条目，缩进的续行拼回上一条）
ch = io.open(os.path.join(ROOT, "CHANGELOG.md"), encoding="utf-8").read()
sec = re.search(r"^##\s*" + re.escape(ver) + r"\s*$(.*?)(?=^##\s|\Z)", ch, re.M | re.S)
notes = []
if sec:
    for line in sec.group(1).splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("-"):
            notes.append(s.lstrip("-").strip())
        elif notes:
            notes[-1] += s
notes = notes[:6]          # 弹窗最多显示 6 行，多的也看不见

payload = {
    "name": ver,
    "code": code,
    "date": datetime.date.today().isoformat(),
    "apk": apk_url,
    "size": "%.1f MB" % (size / 1048576.0),
    "log": notes,
}

js = (
    "/* 小账本更新信息。App 里用 <script> 加载这一份，绕开跨域限制。\n"
    "   由 .build/mkver.py 从 index.html / CHANGELOG.md 生成，不要手改。 */\n"
    "window.__XZB_UPD = "
    + json.dumps(payload, ensure_ascii=False, indent=2)
    + ";\n"
)

out_js = os.path.join(ROOT, "下载页", "ver.js")
out_json = os.path.join(ROOT, "下载页", "version.json")
io.open(out_js, "w", encoding="utf-8").write(js)
io.open(out_json, "w", encoding="utf-8").write(
    json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
io.open(os.path.join(ROOT, "发布", "version.json"), "w", encoding="utf-8").write(
    json.dumps(payload, ensure_ascii=False, indent=2) + "\n")

print("ver.js   ->", os.path.getsize(out_js), "bytes")
print("json     ->", os.path.getsize(out_json), "bytes")
print("版本     ->", ver, "code", code, "|", payload["size"])
print("下载地址 ->", apk_url)
for n in notes:
    print("  ·", n)
