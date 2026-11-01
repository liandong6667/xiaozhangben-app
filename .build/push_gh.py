#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把源码推到 GitHub（只做「上传代码」这一件事，发版本用 publish_gh.py）。

用法：
    GITHUB_TOKEN=ghp_xxx python .build/push_gh.py "这次改了什么"

为什么单独写一个：git 命令行第一次推代码要交互式输入账号密码，
而这个环境里的终端不能交互（会直接卡住）。所以口令走环境变量，
地址也只在这一条命令里出现一次，不会留在 .git/config 里。

需要什么样的 token：GitHub → Settings → Developer settings →
Personal access tokens → Tokens (classic) → Generate new token，
勾 **repo** 这一项（fine-grained 的话给 Contents: Read and write）。
"""
import os, re, subprocess, sys, urllib.request, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
REPO = "xiaozhangben-app"


def sh(*args, check=True):
    p = subprocess.run(args, capture_output=True, text=True)
    out = (p.stdout or "") + (p.stderr or "")
    if check and p.returncode != 0:
        print("命令失败：", " ".join(args))
        print(out.strip()[:800])
        sys.exit(1)
    return out.strip()


def whoami():
    req = urllib.request.Request("https://api.github.com/user",
                                 headers={"Authorization": "Bearer " + TOKEN,
                                          "User-Agent": "xiaozhangben-push"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())["login"]


def main():
    if not TOKEN:
        print("没有 token。先拿一个带 repo 权限的 token，再这样跑：")
        print('  GITHUB_TOKEN=ghp_xxx python .build/push_gh.py "改了什么"')
        return 2

    msg = sys.argv[1] if len(sys.argv) > 1 else ""
    if not msg:
        print('写一句这次的改动，比如：python .build/push_gh.py "修了记账页的按钮文案"')
        return 2

    owner = whoami()
    print("已登录：", owner)

    # 1) 暂存 + 提交（没有改动就跳过）
    sh("git", "add", "-A")
    dirty = sh("git", "status", "--porcelain")
    if dirty:
        n = len(dirty.splitlines())
        sh("git", "commit", "-m", msg)
        print("已提交 %d 个文件" % n)
    else:
        print("没有新改动，直接推")

    # 2) 远端（用普通地址存，token 不落地）
    plain = "https://github.com/%s/%s.git" % (owner, REPO)
    remotes = sh("git", "remote", check=False)
    if "origin" not in remotes.split():
        sh("git", "remote", "add", "origin", plain)
    else:
        sh("git", "remote", "set-url", "origin", plain)

    # 3) 推（token 只在这一次的地址里）
    url = "https://%s:%s@github.com/%s/%s.git" % (owner, TOKEN, owner, REPO)
    branch = sh("git", "rev-parse", "--abbrev-ref", "HEAD")
    print("推到 %s 的 %s 分支…" % (REPO, branch))
    out = sh("git", "push", url, "%s:%s" % (branch, branch))
    print(out[-400:] if out else "(无输出)")
    print("")
    print("完成：https://github.com/%s/%s" % (owner, REPO))
    return 0


if __name__ == "__main__":
    sys.exit(main())
