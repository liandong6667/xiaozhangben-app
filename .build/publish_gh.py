#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把小账本的新版本发到 GitHub Releases（App 的更新通道就是读这里）。

用法：
    GITHUB_TOKEN=xxx python .build/publish_gh.py
    GITHUB_TOKEN=xxx python .build/publish_gh.py 1.5 xiaozhangben-app

规矩：
  · 版本号默认从 index.html 的 VER 读，不用手敲，省得对不上
  · 更新说明从 CHANGELOG.md 里「## 版本号」那一节取，没写就不让发
  · 安装包先看 发布/xiaozhangben-<版本>.apk，没有就拿刚构建的 小账本.apk
    并核对它的 versionName 是不是这个版本
  · 仓库必须 public —— 手机端检查更新时不带账号，私有仓库读不到
"""
import json, os, re, shutil, subprocess, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
UA = {"User-Agent": "xiaozhangben-publisher", "Accept": "application/vnd.github+json"}
AAPT = os.path.join(".build", "sdk", "build-tools", "34.0.0", "aapt2.exe")


# ---------- 本地文件 ----------

def read_ver():
    """从 index.html 读 VER = {code: 6, name: "1.5"}"""
    try:
        with open("index.html", encoding="utf-8") as f:
            h = f.read()
        m = re.search(r'const\s+VER\s*=\s*\{\s*code:\s*(\d+)\s*,\s*name:\s*"([^"]+)"', h)
        if m:
            return m.group(2), int(m.group(1))
    except Exception:
        pass
    return None, None


def read_changelog(ver):
    """取 CHANGELOG.md 里 '## 1.5' 这一节，直到下一个 ## 标题"""
    try:
        with open("CHANGELOG.md", encoding="utf-8") as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        return None
    out, on = [], False
    for ln in lines:
        s = ln.strip()
        if s.startswith("## "):
            if on:
                break
            on = (s[3:].strip().lstrip("vV") == ver)
            continue
        if on:
            out.append(ln.rstrip())
    txt = "\n".join(out).strip()
    return txt or None


def read_apk_ver(path):
    """用 aapt2 读安装包里的版本，确认没拿错包"""
    if not os.path.exists(AAPT):
        return None, None
    try:
        out = subprocess.check_output([AAPT, "dump", "badging", path],
                                      stderr=subprocess.DEVNULL, timeout=90).decode("utf-8", "ignore")
    except Exception:
        return None, None
    m = re.search(r"versionCode='(\d+)' versionName='([^']*)'", out)
    return (m.group(2), int(m.group(1))) if m else (None, None)


# ---------- GitHub ----------

def api(method, url, body=None, raw=None, ctype="application/json"):
    data = None
    if body is not None:
        data = json.dumps(body).encode()
    elif raw is not None:
        data = raw
    req = urllib.request.Request(url, data=data, method=method)
    for k, v in UA.items():
        req.add_header(k, v)
    req.add_header("Authorization", "Bearer " + TOKEN)
    if data is not None:
        req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        txt = e.read().decode("utf-8", "ignore")
        try:
            j = json.loads(txt)
        except Exception:
            j = {"message": txt[:300]}
        return e.code, j


def main():
    ver = sys.argv[1] if len(sys.argv) > 1 else None
    repo_name = sys.argv[2] if len(sys.argv) > 2 else "xiaozhangben-app"

    if not TOKEN:
        print("没有 token。先拿到一个带 repo 权限的 token，再这样跑：")
        print("  GITHUB_TOKEN=ghp_xxx python .build/publish_gh.py")
        return 2

    # 1) 版本号
    fver, fcode = read_ver()
    ver = ver or fver
    if not ver:
        print("读不到版本号。index.html 里应该有 const VER = {code: 6, name: \"1.5\"};")
        return 2
    if fver and ver != fver:
        print("注意：命令行给的 %s 和 index.html 里的 %s 不一致，按 %s 发。" % (ver, fver, ver))

    # 2) 更新说明
    notes = read_changelog(ver)
    if not notes:
        print("CHANGELOG.md 里没有「## %s」这一节。" % ver)
        print("先在那里写清楚这个版本改了什么（用户看得懂的话），再发。")
        return 2
    print("更新说明（%d 行）：" % len(notes.splitlines()))
    for ln in notes.splitlines()[:8]:
        print("   ", ln)

    # 3) 安装包
    apk = os.path.join("发布", "xiaozhangben-%s.apk" % ver)
    if not os.path.exists(apk):
        src = "小账本.apk"
        if not os.path.exists(src):
            print("找不到安装包：先跑 bash app/build.sh %s %d" % (ver, (fcode or 0)))
            return 2
        av, ac = read_apk_ver(src)
        if av and av != ver:
            print("小账本.apk 是 %s，不是 %s。先重新构建：bash app/build.sh %s %d" % (av, ver, ver, (fcode or 0)))
            return 2
        os.makedirs("发布", exist_ok=True)
        shutil.copy(src, apk)
        print("已复制为", apk)
    else:
        av, ac = read_apk_ver(apk)
        if av and av != ver:
            print("%s 里其实是 %s，版本对不上，先删掉重来。" % (apk, av))
            return 2
    print("安装包：%s（%.1f MB）" % (apk, os.path.getsize(apk) / 1048576.0))

    # 4) 登录 & 仓库
    st, me = api("GET", "https://api.github.com/user")
    if st != 200:
        print("登录失败（%s）：%s" % (st, me.get("message")))
        print("token 可能过期了，重新生成一个带 repo 权限的。")
        return 1
    owner = me["login"]
    print("已登录：", owner)

    st, repo = api("GET", "https://api.github.com/repos/%s/%s" % (owner, repo_name))
    if st == 404:
        st, repo = api("POST", "https://api.github.com/user/repos", {
            "name": repo_name,
            "description": "小账本 · 更新通道（只放安装包和版本信息）",
            "private": False,
            "has_issues": False,
            "has_wiki": False,
            "auto_init": False,
        })
        print("建仓库：", st)
        if st not in (200, 201):
            print("建仓库失败：", repo.get("message"))
            return 1
    elif st != 200:
        print("读仓库失败：", repo.get("message"))
        return 1
    else:
        print("仓库已存在：%s/%s" % (owner, repo_name))

    # 5) Release
    tag = "v" + ver
    st, rel = api("GET", "https://api.github.com/repos/%s/%s/releases/tags/%s" % (owner, repo_name, tag))
    if st != 200:
        st, rel = api("POST", "https://api.github.com/repos/%s/%s/releases" % (owner, repo_name), {
            "tag_name": tag,
            "name": ver,
            "body": notes,
            "draft": False,
            "prerelease": False,
        })
        print("建版本：", st)
        if st not in (200, 201):
            print("建版本失败：", rel.get("message"))
            return 1
    else:
        # 版本已存在：说明改了 CHANGELOG 想重发，顺手把说明改掉
        rid = rel.get("id")
        api("PATCH", "https://api.github.com/repos/%s/%s/releases/%s" % (owner, repo_name, rid), {"body": notes})
        print("版本已存在，说明已更新为 CHANGELOG 最新内容")

    # 6) 上传安装包
    name = os.path.basename(apk)
    has = [a for a in rel.get("assets", []) if a.get("name") == name]
    if has:
        print("安装包已在线上，跳过上传")
        dl = has[0]["browser_download_url"]
    else:
        with open(apk, "rb") as f:
            blob = f.read()
        rid = rel["id"]
        st, asset = api(
            "POST",
            "https://uploads.github.com/repos/%s/%s/releases/%s/assets?name=%s" % (owner, repo_name, rid, name),
            raw=blob, ctype="application/vnd.android.package-archive")
        print("上传安装包：", st, "%.1f MB" % (len(blob) / 1048576.0))
        if st not in (200, 201):
            print("上传失败：", asset.get("message"))
            return 1
        dl = asset["browser_download_url"]

    print("")
    print("发布成功。")
    print("  版本页：%s" % ("https://github.com/%s/%s/releases/tag/%s" % (owner, repo_name, tag)))
    print("  安装包：%s" % dl)
    print("")
    print("index.html 里的 UPDATE_REPO 应该是：\"%s/%s\"" % (owner, repo_name))
    print("（第一次发版才需要改它，改完记得重新打包一次）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
