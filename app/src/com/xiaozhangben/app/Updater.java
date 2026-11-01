package com.xiaozhangben.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * App 内更新：自己把新版 APK 下到手机里，下完直接叫系统安装器接手。
 *
 * 先说清一件系统限制：Android 8 起禁止「静默安装」，任何 App 装 APK
 * 都必须由用户在系统弹窗上点一下「安装」。除了那一下，全程不离开 App，
 * 也不用开浏览器。
 *
 * 下载完会先验一遍：是不是安装包、是不是小账本、版本号有没有更高。
 * 网络被劫持返回一个网页、或者下到半截，都会在这一步被挡住，
 * 不至于把一个坏文件递给系统安装器。
 */
public final class Updater {

    private static final String TAG = "XZB-Upd";
    private static final Handler UI = new Handler(Looper.getMainLooper());

    private static volatile boolean busy = false;
    /** 下好但还没装的那个包。授予「安装未知应用」权限后回来直接复用它，不用重下 */
    private static File pendingFile = null;

    public interface Cb {
        /** pct 0~100，-1 表示服务端没给总大小 */
        void onProgress(int pct, String text);
        /** state: ok 成功 / perm 缺权限 / fail 失败 */
        void onEnd(String state, String msg);
    }

    private Updater() { }

    public static boolean isBusy() {
        return busy;
    }

    /** 有没有下好但还没装上的包 */
    public static boolean hasPending() {
        return pendingFile != null && pendingFile.exists();
    }

    public static boolean start(final Activity act, final String url, final String ver, final Cb cb) {
        if (busy) return false;
        if (url == null || url.length() < 8) return false;
        busy = true;
        new Thread(new Runnable() {
            @Override public void run() {
                download(act, url, ver, cb);
            }
        }, "xzb-upd").start();
        return true;
    }

    /** 权限授予后回来接着装（复用已下好的包） */
    public static boolean retryPending(final Activity act, final Cb cb) {
        if (pendingFile == null || !pendingFile.exists()) return false;
        install(act, cb);
        return true;
    }

    /* ---------------- 下载 ---------------- */

    private static void download(Activity act, String url, String ver, Cb cb) {
        File dir = new File(act.getCacheDir(), "upd");
        if (!dir.exists()) dir.mkdirs();
        String safe = ver == null ? "" : ver.replaceAll("[^0-9A-Za-z._-]", "");
        File out = new File(dir, "xzb-" + (safe.length() == 0 ? "new" : safe) + ".apk");

        InputStream in = null;
        FileOutputStream fo = null;
        try {
            if (out.exists()) out.delete();
            HttpURLConnection con = open(url);
            int code = con.getResponseCode();
            if (code != 200) throw new Exception("HTTP " + code);

            long total = con.getContentLength();
            in = con.getInputStream();
            fo = new FileOutputStream(out);
            byte[] buf = new byte[16384];
            long got = 0;
            int n;
            long tick = 0;
            while ((n = in.read(buf)) > 0) {
                fo.write(buf, 0, n);
                got += n;
                long now = System.currentTimeMillis();
                if (now - tick > 180) {
                    tick = now;
                    int pct = total > 0 ? (int) (got * 100 / total) : -1;
                    progress(cb, pct, sizeText(got, total));
                }
            }
            fo.flush();
            fo.close();
            fo = null;
            in.close();
            in = null;

            if (got < 1024 * 1024) throw new Exception("只有 " + got + " 字节，不像安装包");

            String bad = verify(act, out);
            if (bad != null) {
                out.delete();
                end(cb, "fail", bad);
                return;
            }
            pendingFile = out;
            progress(cb, 100, "下载完成 · 已校验");
            install(act, cb);
        } catch (Throwable t) {
            Log.w(TAG, "下载失败", t);
            try { if (fo != null) fo.close(); } catch (Throwable ignored) { }
            try { if (in != null) in.close(); } catch (Throwable ignored) { }
            try { if (out.exists()) out.delete(); } catch (Throwable ignored) { }
            end(cb, "fail", "下载没成功：" + brief(t));
        }
    }

    /** 跟随跳转（GitHub 的下载地址会跳到 objects.githubusercontent.com） */
    private static HttpURLConnection open(String u) throws Exception {
        String cur = u;
        for (int i = 0; i < 6; i++) {
            HttpURLConnection c = (HttpURLConnection) new URL(cur).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(25000);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent", "XiaoZhangBen-Updater");
            c.setRequestProperty("Accept", "*/*");
            int code = c.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String loc = c.getHeaderField("Location");
                c.disconnect();
                if (loc == null) throw new Exception("跳转地址是空的");
                if (loc.startsWith("/")) {
                    URL base = new URL(cur);
                    loc = base.getProtocol() + "://" + base.getHost() + loc;
                }
                cur = loc;
                continue;
            }
            return c;
        }
        throw new Exception("跳转太多次");
    }

    /** 返回 null 表示没问题，返回字符串表示哪里不对 */
    private static String verify(Activity act, File f) {
        PackageInfo pi = act.getPackageManager().getPackageArchiveInfo(f.getAbsolutePath(), 0);
        if (pi == null) return "下到的文件打不开，像是被网络拦截换成了网页";
        if (!act.getPackageName().equals(pi.packageName)) return "下到的不是小账本的安装包";
        int cur = 0;
        try {
            cur = act.getPackageManager().getPackageInfo(act.getPackageName(), 0).versionCode;
        } catch (Throwable ignored) { }
        if (pi.versionCode <= cur) return "这个包不比当前版本新（" + pi.versionCode + " ≤ " + cur + "）";
        return null;
    }

    /* ---------------- 安装 ---------------- */

    private static void install(final Activity act, final Cb cb) {
        final File f = pendingFile;
        if (f == null || !f.exists()) {
            end(cb, "fail", "安装包不在了，重新下一遍");
            return;
        }
        if (Build.VERSION.SDK_INT >= 26 && !act.getPackageManager().canRequestPackageInstalls()) {
            end(cb, "perm", "还差一步：允许小账本安装应用");
            return;
        }
        UI.post(new Runnable() {
            @Override public void run() {
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW);
                    i.setDataAndType(ApkProvider.uriFor(f), "application/vnd.android.package-archive");
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    act.startActivity(i);
                    end(cb, "ok", "正在打开安装界面");
                } catch (Throwable t) {
                    Log.w(TAG, "调不起安装器", t);
                    end(cb, "fail", "系统安装器没打开：" + brief(t));
                }
            }
        });
    }

    /* ---------------- 回调 ---------------- */

    private static void progress(final Cb cb, final int pct, final String text) {
        if (cb == null) return;
        UI.post(new Runnable() {
            @Override public void run() {
                try { cb.onProgress(pct, text); } catch (Throwable ignored) { }
            }
        });
    }

    private static void end(final Cb cb, final String state, final String msg) {
        busy = false;
        if (cb == null) return;
        UI.post(new Runnable() {
            @Override public void run() {
                try { cb.onEnd(state, msg); } catch (Throwable ignored) { }
            }
        });
    }

    private static String sizeText(long got, long total) {
        double g = got / 1048576.0;
        if (total > 0) {
            return String.format(java.util.Locale.US, "%.1f / %.1f MB", g, total / 1048576.0);
        }
        return String.format(java.util.Locale.US, "已下 %.1f MB", g);
    }

    private static String brief(Throwable t) {
        String m = t.getMessage();
        if (m == null || m.length() == 0) m = t.getClass().getSimpleName();
        return m.length() > 60 ? m.substring(0, 60) : m;
    }
}
