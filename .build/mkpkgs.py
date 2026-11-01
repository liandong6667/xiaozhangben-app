# -*- coding: utf-8 -*-
"""重新打包源码：full = 含密钥与 OCR 的完整版（私用）；lite = 可公开上传版。"""
import os, zipfile, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 完整版：项目里所有源码与文档，排除构建工具链、产物、临时测试页
SKIP_DIRS = {'.build', '.workbuddy', '__pycache__', '安装包', '交付', '发布'}
SKIP_EXT = {'.apk', '.idsig', '.zip'}
SKIP_NAMES = {'run-fix14.html'}

def walk():
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f in SKIP_NAMES:
                continue
            if os.path.splitext(f)[1].lower() in SKIP_EXT:
                continue
            p = os.path.join(base, f)
            rel = os.path.relpath(p, ROOT).replace('\\', '/')
            if rel.startswith('.build/'):
                continue
            yield rel, p

# 可上传版额外剔除：签名密钥 + OCR 语言包/wasm 大件（js 引导层保留，仓库里可再下载）
LITE_DROP_EXACT = {'app/keystore.jks'}
LITE_DROP_SUFFIX = ('.traineddata.gz', '.wasm', '.wasm.js')
LITE_DROP_EXT = set()

# 可上传版里把 build.sh 的签名口令抹成占位符（别名不抹，那不是密码）
# 铁律：setup 口令绝不进公开包。之前只剔了 keystore，口令还明文躺在脚本里。
PASS_REDACT = [
    ('-storepass xiaozhangben -keypass xiaozhangben',
     '-storepass YOUR_KEY_PASS -keypass YOUR_KEY_PASS'),
    ('--ks-pass pass:xiaozhangben --key-pass pass:xiaozhangben',
     '--ks-pass pass:YOUR_KEY_PASS --key-pass pass:YOUR_KEY_PASS'),
]

def sha(p):
    h = hashlib.md5()
    with open(p, 'rb') as fp:
        for chunk in iter(lambda: fp.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

items = sorted(walk())
print('files:', len(items))

def make(out, lite=False):
    n = 0
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel, p in items:
            if lite:
                if rel in LITE_DROP_EXACT:
                    continue
                if any(rel.endswith(s) for s in LITE_DROP_SUFFIX):
                    continue
                if os.path.splitext(rel)[1].lower() in LITE_DROP_EXT:
                    continue
                if rel == 'app/build.sh':
                    s = open(p, encoding='utf-8').read()
                    for a, b in PASS_REDACT:
                        s = s.replace(a, b)
                    z.writestr(rel, s.encode('utf-8'))
                    n += 1
                    continue
            z.write(p, rel)
            n += 1
    print(out, n, 'entries', round(os.path.getsize(out) / 1048576, 2), 'MB')

make(os.path.join(ROOT, '小账本源码.zip'))
make(os.path.join(ROOT, '小账本源码-可上传版.zip'), lite=True)

print('--- 关键文件校验 ---')
for f in ('index.html', 'app/assets/www/index.html', 'app/src/com/xiaozhangben/app/Updater.java'):
    p = os.path.join(ROOT, f)
    print(f, sha(p))
