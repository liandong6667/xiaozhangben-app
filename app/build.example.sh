#!/bin/bash
# 小账本 APK 构建脚本（不依赖 Gradle，全部手动调用 SDK 工具）
set -e

HERE="$(cd "$(dirname "$0")/.." && pwd)"
P="$(cd "$HERE" && pwd -W 2>/dev/null)"
[ -n "$P" ] || P="$HERE"
JD="$P/.build/jdk-17.0.13+11"
SDK="$P/.build/sdk"
BT="$SDK/build-tools/34.0.0"
ANDROID_JAR="$SDK/platforms/android-34/android.jar"
APP="$P/app"
OUT="$APP/build"
VER="${1:-1.1}"
CODE="${2:-2}"

# 签名口令从环境变量读。仓库里**不带** keystore.jks 和口令：
# 证书一旦公开，任何人都能签一个"看起来是小账本"的包发出去。
KS_PASS="${XZB_KS_PASS:-}"
if [ -z "$KS_PASS" ]; then
  echo "缺签名口令：先 export XZB_KS_PASS=你的口令 再跑" >&2
  exit 1
fi

# Git Bash 里不能直接把 C:/... 塞进 PATH（冒号会被当分隔符），转成 /c/...
JD_U=$(cygpath -u "$JD")
export JAVA_HOME="$JD"
export PATH="$JD_U/bin:$PATH"

PY="$P/../.workbuddy/binaries/python/versions/3.13.12/python.exe"
[ -f "$PY" ] || PY="C:/Users/lenovo/.workbuddy/binaries/python/versions/3.13.12/python.exe"

rm -rf "$OUT"
mkdir -p "$OUT/compiled" "$OUT/gen" "$OUT/classes" "$OUT/dex"

# 版本号只有一个来源：本脚本的参数。
# 以前 manifest 里的版本和 index.html 里的 VER 是两处各写各的，
# 一旦忘了同步，安装包是 1.6、界面上还显示 1.5（更新弹窗的"当前版本"也会错）。
# 顺便每次都从根目录同步一次网页源码，免得忘了 cp 导致把旧界面打进包。
if [ -f "$P/index.html" ]; then
  mkdir -p "$APP/assets/www"
  cp "$P/index.html" "$APP/assets/www/index.html"
fi
WWW="$APP/assets/www/index.html"
if [ -f "$WWW" ]; then
  "$PY" - "$WWW" "$P/index.html" "$VER" "$CODE" <<'PYEOF'
import io, re, sys
ver, code = sys.argv[3], sys.argv[4]
for p in (sys.argv[1], sys.argv[2]):
    h = io.open(p, encoding='utf-8').read()
    new, n = re.subn(r'const VER = \{code: \d+, name: "[^"]*"\}',
                     'const VER = {code: %s, name: "%s"}' % (code, ver), h, count=1)
    if n != 1:
        sys.stderr.write("!! 没在 %s 里找到 const VER = {code: N, name: \"x\"}，"
                         "版本号没写进界面，构建中止。\n" % p)
        sys.exit(3)
    io.open(p, 'w', encoding='utf-8').write(new)
print("    界面版本号 -> %s (code %s)" % (ver, code))
PYEOF
fi

echo "[1/7] 编译资源"
"$BT/aapt2.exe" compile --dir "$APP/res" -o "$OUT/compiled/res.zip"

# 清单里手写的版本号也要换成参数值。
# aapt2 link 的 --version-code/--version-name 只在清单里没有这两个属性时才管用，
# 清单写了就以清单为准——所以以前 bash app/build.sh 1.5 6 里的版本号
# 其实只改到了网页界面，安装包本身还是清单里写死的那个。
MANIFEST_OUT="$OUT/AndroidManifest.xml"
"$PY" - "$APP/AndroidManifest.xml" "$MANIFEST_OUT" "$VER" "$CODE" <<'PYEOF'
import io, re, sys
src, out, ver, code = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
h = io.open(src, encoding='utf-8').read()
h, n1 = re.subn(r'android:versionCode="[^"]*"', 'android:versionCode="%s"' % code, h, count=1)
h, n2 = re.subn(r'android:versionName="[^"]*"', 'android:versionName="%s"' % ver, h, count=1)
if n1 != 1 or n2 != 1:
    sys.stderr.write("!! AndroidManifest.xml 里没找到 versionCode / versionName，构建中止\n")
    sys.exit(4)
io.open(out, 'w', encoding='utf-8').write(h)
print("    清单版本号 -> %s (code %s)" % (ver, code))
PYEOF

echo "[2/7] 链接资源 + 打进 assets"
"$BT/aapt2.exe" link -o "$OUT/base.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$MANIFEST_OUT" \
  -A "$APP/assets" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$CODE" --version-name "$VER" \
  --java "$OUT/gen" \
  "$OUT/compiled/res.zip"

echo "[3/7] 编译 Java"
SRCS=$(find "$APP/src" -name "*.java")
"$JD/bin/javac.exe" -source 8 -target 8 -nowarn -encoding UTF-8 \
  -classpath "$ANDROID_JAR" -d "$OUT/classes" \
  $SRCS "$OUT/gen/com/xiaozhangben/app/R.java"

echo "[4/7] 转换成 dex"
"$BT/d8.bat" --min-api 24 --output "$OUT/dex" $(find "$OUT/classes" -name "*.class") 2>&1 | grep -v "^$" | head -5

echo "[5/7] 把 classes.dex 放进 APK"
"$PY" - "$OUT/base.apk" "$OUT/dex/classes.dex" <<'PYEOF'
import sys, zipfile, os
apk, dex = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(apk, 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(dex, 'classes.dex')
print("  已写入 classes.dex (%d bytes)" % os.path.getsize(dex))
PYEOF

echo "[6/7] 对齐"
"$BT/zipalign.exe" -f -p 4 "$OUT/base.apk" "$OUT/aligned.apk"

echo "[7/7] 签名"
KS="$APP/keystore.jks"
if [ ! -f "$KS" ]; then
  "$JD/bin/keytool.exe" -genkeypair -keystore "$KS" -alias xiaozhangben \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=XiaoZhangBen, OU=Mobile, O=Personal, L=Zhengzhou, ST=Henan, C=CN" 2>&1 | grep -v "^$" | head -3
fi
"$BT/apksigner.bat" sign \
  --ks "$KS" --ks-key-alias xiaozhangben \
  --ks-pass pass:"$KS_PASS" --key-pass pass:"$KS_PASS" \
  --v1-signing-enabled true --v2-signing-enabled true \
  --out "$P/小账本.apk" "$OUT/aligned.apk"

echo ""
echo "构建完成"
ls -la "$P/小账本.apk"
