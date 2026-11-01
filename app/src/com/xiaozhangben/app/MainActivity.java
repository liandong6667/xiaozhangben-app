package com.xiaozhangben.app;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Rect;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

/**
 * App 外壳：把网页装进来，同时把「通知使用权」捕获到的消费通知喂给网页。
 */
public class MainActivity extends Activity {

    private static final String TAG = "XZB-Main";
    private static final int REQ_FILE = 9001;
    private static final String PREF_DATA = "xzb_data";
    private static final String KEY_STATE = "state";
    /** 界面类偏好（桌面外观），跟账目数据分开放，备份/恢复不该碰它 */
    private static final String PREF_UI = "xzb_ui";
    private static final String KEY_SKIN = "launcher";
    private static final String KEY_SKIN_VER = "launcherVer";

    private WebView web;
    private int port = -1;
    private ValueCallback<Uri[]> fileCb;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);


        /* 第二件：恢复上次选的桌面图标/名字。覆盖安装会把 activity-alias
           的状态重置回清单默认值，不重放一次的话，用户升完级会突然发现
           伪装没了、图标又变回猫。 */
        try { restoreLauncher(); } catch (Throwable ignored) { }

        int top = 0, bottom = 0;
        try {
            top = barPx("status_bar_height");
            bottom = barPx("navigation_bar_height");
        } catch (Throwable ignored) { }
        try { setupSystemBars(); } catch (Throwable ignored) { }

        port = TinyServer.start(this);
        Log.i(TAG, "本地服务端口 = " + port);

        web = new WebView(this);
        web.setBackgroundColor(0xFFFBF7F2);
        web.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setPadding(0, top, 0, bottom);
        web.setClipToPadding(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= 21) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                // 站外链接交给系统浏览器，别在 App 里打开
                if (url != null && !url.startsWith("http://127.0.0.1")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        return true;
                    } catch (Throwable ignored) { }
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                Log.i(TAG, "页面加载完成 " + url);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage cm) {
                Log.i("XZB-Web", cm.message() + " @" + cm.lineNumber());
                return true;
            }

            // 截图记账要选图，必须走这里，否则 <input type=file> 点不动
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (fileCb != null) {
                    fileCb.onReceiveValue(null);
                }
                fileCb = cb;
                try {
                    Intent i = params.createIntent();
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(i, REQ_FILE);
                    return true;
                } catch (Throwable t) {
                    fileCb = null;
                    toastNative("没有找到可以选图的应用");
                    return false;
                }
            }
        });

        web.addJavascriptInterface(new Bridge(), "XZBNative");

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFFFBF7F2);
        root.addView(web);
        setContentView(root);

        if (port > 0) {
            web.loadUrl("http://127.0.0.1:" + port + "/index.html");
        } else {
            web.loadUrl("file:///android_asset/www/index.html");
        }

    }

    @Override
    protected void onResume() {
        super.onResume();
        // 用户可能刚从系统设置里回来，把最新权限状态告诉网页
        if (web != null) {
            web.postDelayed(new Runnable() {
                public void run() {
                    try {
                        // 可能刚从「允许安装应用」开关回来，让更新弹窗刷新按钮
                        web.evaluateJavascript("window.__onUpdResume && window.__onUpdResume();", null);
                    } catch (Throwable ignored) { }
                }
            }, 300);
        }
    }

    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        try {
            web.evaluateJavascript("(function(){try{return !!(window.__onBack && window.__onBack());}catch(e){return false;}})()",
                    new ValueCallback<String>() {
                        public void onReceiveValue(String v) {
                            if (!"true".equals(v)) {
                                finish();
                            }
                        }
                    });
        } catch (Throwable t) {
            finish();
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE) {
            if (fileCb != null) {
                Uri[] out = null;
                if (res == RESULT_OK && data != null) {
                    if (data.getData() != null) {
                        out = new Uri[]{data.getData()};
                    } else if (data.getClipData() != null) {
                        int n = data.getClipData().getItemCount();
                        out = new Uri[n];
                        for (int i = 0; i < n; i++) out[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
                fileCb.onReceiveValue(out);
                fileCb = null;
            }
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            try {
                ((ViewGroup) web.getParent()).removeView(web);
                web.destroy();
            } catch (Throwable ignored) { }
            web = null;
        }
        super.onDestroy();
    }

    /* ---------------- 系统栏 ---------------- */

    /* ==================== 桌面图标 / 名字 ====================
       安卓不允许运行中改 manifest 里写死的 label / icon —— 那是编译期定死的。
       官方唯一被支持的做法：每套外观各声明一个 activity-alias，
       运行时「启用一个、禁用其余」，启用的那个就是桌面上的图标和名字。

       两个坑记下来：
       1) 切换必须带 DONT_KILL_APP。不带的话系统会把本进程杀掉，
          网页里正在填的东西全丢，用户会以为崩了。
       2) 覆盖安装会把别名状态重置回清单里写的默认值（只有书那套是启用的），
          所以启动时要按上次选的重放一次 —— 见 restoreLauncher()。
    */
    private static final String[][] LAUNCHERS = {
            {"book",   "com.xiaozhangben.app.LaunchBook"},
            {"ledger", "com.xiaozhangben.app.LaunchLedger"},
            {"calc",   "com.xiaozhangben.app.LaunchCalc"},
            {"note",   "com.xiaozhangben.app.LaunchNote"},
    };

    private String currentSkin() {
        try {
            return getSharedPreferences(PREF_UI, MODE_PRIVATE).getString(KEY_SKIN, "book");
        } catch (Throwable t) { return "book"; }
    }

    private boolean applyLauncher(String key) {
        try {
            String want = (key == null) ? "book" : key;
            String keep = null;
            for (String[] e : LAUNCHERS) if (e[0].equals(want)) keep = e[1];
            if (keep == null) { keep = LAUNCHERS[0][1]; want = LAUNCHERS[0][0]; }

            PackageManager pm = getPackageManager();
            for (String[] e : LAUNCHERS) {
                pm.setComponentEnabledSetting(
                        new ComponentName(this, e[1]),
                        e[1].equals(keep)
                                ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                                : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP);
            }
            getSharedPreferences(PREF_UI, MODE_PRIVATE).edit()
                    .putString(KEY_SKIN, want).commit();
            Log.i(TAG, "桌面外观切成 " + want);
            return true;
        } catch (Throwable t) {
            Log.w(TAG, "换桌面图标失败: " + t);
            return false;
        }
    }

    /** 启动时按上次选的重放一遍。只在「安装/升级后」做，平时不碰，免得桌面反复刷新。 */
    private void restoreLauncher() {
        int vc;
        try {
            vc = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
        } catch (Throwable t) { return; }
        SharedPreferences sp = getSharedPreferences(PREF_UI, MODE_PRIVATE);
        if (sp.getInt(KEY_SKIN_VER, -1) == vc) return;
        applyLauncher(sp.getString(KEY_SKIN, "book"));
        sp.edit().putInt(KEY_SKIN_VER, vc).commit();
    }

    private void setupSystemBars() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 21) {
            w.setStatusBarColor(0xFFFBF7F2);
            w.setNavigationBarColor(0xFFFFFFFF);
        }
        int flags = 0;
        if (Build.VERSION.SDK_INT >= 23) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= 26) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        w.getDecorView().setSystemUiVisibility(flags);
    }

    private int barPx(String name) {
        int id = getResources().getIdentifier(name, "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : 0;
    }

    private void toastNative(String s) {
        try { Toast.makeText(this, s, Toast.LENGTH_SHORT).show(); } catch (Throwable ignored) { }
    }

    /* ---------------- 网页 ↔ 原生 的桥 ---------------- */

    public class Bridge {

        @JavascriptInterface
        public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Throwable t) {
                return "";
            }
        }

        /**
         * 用系统浏览器打开链接。
         * 更新走这条路：App 自己不能装自己（Android 8 起禁止静默安装），
         * 交给浏览器下载，装的时候系统还会再问一次。
         */
        @JavascriptInterface
        public void openUrl(final String url) {
            if (url == null || url.length() == 0) return;
            final String u = url.startsWith("http") ? url : "https://" + url;
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u)));
                    } catch (Throwable t) {
                        Toast.makeText(MainActivity.this, "这台手机上没有浏览器", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public boolean isApp() {
            return true;
        }

        /* ---------- 在 App 内更新（不跳浏览器） ---------- */

        /** App 内下载新版，下完直接调起系统安装界面。返回 false = 没启动（下载中或地址不对） */
        @JavascriptInterface
        public boolean installUpdate(String url, String ver) {
            return Updater.start(MainActivity.this, url, ver, updCb());
        }

        /** 刚去开完「安装未知应用」权限，回来接着装上次下好的包，不用重下 */
        @JavascriptInterface
        public boolean retryInstall() {
            return Updater.retryPending(MainActivity.this, updCb());
        }

        /** 手上有没有下好但还没装的包 */
        @JavascriptInterface
        public boolean hasPendingApk() {
            return Updater.hasPending();
        }

        /** 是否已允许「安装未知应用」 */
        @JavascriptInterface
        public boolean canInstallApk() {
            if (Build.VERSION.SDK_INT < 26) return true;
            try {
                return getPackageManager().canRequestPackageInstalls();
            } catch (Throwable t) {
                return false;
            }
        }

        /** 跳去本应用的「安装未知应用」开关 */
        @JavascriptInterface
        public void openInstallSettings() {
            try {
                if (Build.VERSION.SDK_INT >= 26) {
                    Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + getPackageName()));
                    startActivity(i);
                    return;
                }
            } catch (Throwable ignored) { }
            try {
                startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
            } catch (Throwable ignored) { }
        }

        private Updater.Cb updCb() {
            return new Updater.Cb() {
                public void onProgress(int pct, String text) {
                    callJs("window.__onUpd&&window.__onUpd(" + pct + "," + jsStr(text) + ")");
                }
                public void onEnd(String state, String msg) {
                    callJs("window.__onUpdEnd&&window.__onUpdEnd(" + jsStr(state) + "," + jsStr(msg) + ")");
                }
            };
        }

        private void callJs(final String js) {
            if (web == null) return;
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try { web.evaluateJavascript(js, null); } catch (Throwable ignored) { }
                }
            });
        }

        /** 把 Java 字符串安全地包成 JS 字面量 */
        private String jsStr(String s) {
            if (s == null) return "\"\"";
            StringBuilder b = new StringBuilder("\"");
            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                if (c == '"' || c == '\\') b.append('\\').append(c);
                else if (c == '\n') b.append("\\n");
                else if (c == '\r') b.append("\\r");
                else if (c < 0x20) b.append(' ');
                else b.append(c);
            }
            return b.append('"').toString();
        }

        /* 桌面图标 / 名字：实现在外层（applyLauncher），这里只做桥接。
           常量和方法都放外层，是因为启动时 restoreLauncher() 也要用同一份。 */
        @JavascriptInterface
        public String launcherKey() {
            return currentSkin();
        }

        @JavascriptInterface
        public boolean setLauncher(String key) {
            return applyLauncher(key);
        }

        /**
         * 用户上传的图 → 桌面图标。
         *
         * 为什么不像上面那样做成 activity-alias：别名的图标是编译期写进安装包的
         * 资源，运行中换成一张用户刚拍的照片，系统根本不让。安卓唯一被支持的路子
         * 是「桌面快捷方式」—— 快捷方式允许任意 Bitmap 当图标，也能自己起名字。
         *
         * 代价说清楚：它会在桌面上**多**一个图标（老的还在，用户自己长按删掉），
         * 而且得用户在系统弹窗里点「添加」才真正落地。桌面不支持的话这里返回 false，
         * 界面上会老实说"这台手机不行"，不会假装成功。
         */
        /**
         * 用户自己起的名字 + 自己的图 → 桌面图标。
         *
         * 返回值说清楚，界面才能给准话（以前只回 true/false，用户点了没反应也不知道为什么）：
         *   1 = 已请求，系统弹窗等他点「添加」
         *   2 = 桌面上已经有一个了，这次直接改掉
         *   0 = 这台手机的桌面不支持
         *  -1 = 图处理不了
         *
         * 为什么不用 activity-alias：别名的图标和名字是编译期写进安装包的，
         * 运行中换成一张用户刚拍的照片，系统根本不认。安卓唯一被支持的路子
         * 是「桌面快捷方式」—— 图标可以任意 Bitmap，名字也自己起。
         * 代价是会在桌面**多**一个图标（老的还在，用户自己长按删）。
         */
        @JavascriptInterface
        public int setCustomIcon(String dataUrl, String label) {
            try {
                if (Build.VERSION.SDK_INT < 26) return 0;
                if (dataUrl == null) return -1;
                int comma = dataUrl.indexOf(',');
                if (comma < 0) return -1;
                byte[] raw;
                try {
                    raw = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
                } catch (Throwable t) { return -1; }
                Bitmap src = BitmapFactory.decodeByteArray(raw, 0, raw.length);
                if (src == null) return -1;

                /* 自适应图标按 108dp 的画布准备（432px），把图按「填满再裁中间」画进去。
                   拉成方块会变形；留白边又会让照片看着小一圈。 */
                int S = 432;
                Bitmap art = Bitmap.createBitmap(S, S, Bitmap.Config.ARGB_8888);
                Canvas cv = new Canvas(art);
                float sc = Math.max(S / (float) src.getWidth(), S / (float) src.getHeight());
                int w = Math.round(src.getWidth() * sc), h = Math.round(src.getHeight() * sc);
                cv.drawBitmap(src, null,
                        new Rect((S - w) / 2, (S - h) / 2, (S + w) / 2, (S + h) / 2), null);

                ShortcutManager sm = (ShortcutManager) MainActivity.this
                        .getSystemService(android.content.Context.SHORTCUT_SERVICE);
                if (sm == null) return 0;

                final String sid = "xzb_icon";
                String nm = (label == null || label.trim().length() == 0) ? "小账本" : label.trim();
                Intent i = new Intent(MainActivity.this, MainActivity.class);
                i.setAction(Intent.ACTION_MAIN);
                i.addCategory(Intent.CATEGORY_LAUNCHER);
                ShortcutInfo si = new ShortcutInfo.Builder(MainActivity.this, sid)
                        .setShortLabel(nm)
                        .setLongLabel(nm)
                        .setIcon(Icon.createWithAdaptiveBitmap(art))
                        .setIntent(i)
                        .build();

                /* 桌面上已经有这个 id 的快捷方式 → 直接更新。
                   再发一次 requestPinShortcut 的话，很多桌面会当作「已存在」静默忽略，
                   用户改了名字点了按钮却什么都没变，还以为功能坏了。 */
                boolean pinned = false;
                try {
                    for (ShortcutInfo e : sm.getPinnedShortcuts()) {
                        if (sid.equals(e.getId())) { pinned = true; break; }
                    }
                } catch (Throwable ignored) { }
                if (pinned) {
                    try {
                        sm.updateShortcuts(java.util.Collections.singletonList(si));
                        Log.i(TAG, "自定义桌面图标: 已更新");
                        return 2;
                    } catch (Throwable t) {
                        Log.w(TAG, "更新快捷方式失败，改走重新添加: " + t);
                    }
                }

                if (!sm.isRequestPinShortcutSupported()) return 0;
                boolean ok = sm.requestPinShortcut(si, null);
                Log.i(TAG, "自定义桌面图标: 请求添加 " + ok);
                return ok ? 1 : 0;
            } catch (Throwable t) {
                Log.w(TAG, "自定义桌面图标失败: " + t);
                return 0;
            }
        }

        /** 数据存原生侧，App 卸载才会丢，不受浏览器缓存影响 */
        @JavascriptInterface
        public String load() {
            try {
                SharedPreferences sp = getSharedPreferences(PREF_DATA, MODE_PRIVATE);
                return sp.getString(KEY_STATE, "");
            } catch (Throwable t) {
                return "";
            }
        }

        /**
         * 存档落盘。返回 false 表示这次没写进去 —— 网页会把警示条挂出来。
         * 以前吞掉异常直接返回 void，手机存储满的时候用户完全不知道，
         * 一直记到重启才发现账没了。
         */
        @JavascriptInterface
        public boolean store(String json) {
            try {
                SharedPreferences sp = getSharedPreferences(PREF_DATA, MODE_PRIVATE);
                /* apply() 而不是 commit()：WebView 里的 JS 和界面是同一个线程，
                   commit() 会当场把整份存档序列化成 XML 写进闪存 ——
                   账目几百上千笔时这一步就是几十毫秒，正好压在动画的第一帧上。
                   用户报的"点减号卡一下"一半来自这里。
                   apply() 是内存立即生效 + 磁盘交给后台线程，
                   系统在界面停掉前会等写完，不会丢数据。 */
                sp.edit().putString(KEY_STATE, json == null ? "" : json).apply();
                // 内存里的值立刻就能读回来；读不回来说明这次编辑根本没生效
                String back = sp.getString(KEY_STATE, "");
                return back != null && back.length() > 0;
            } catch (Throwable t) {
                Log.w("XZB-Store", "保存失败", t);
                return false;
            }
        }

        /* 小配置项（主题、上次检查更新的日期）存原生侧。
           为什么不放 localStorage：页面是从 127.0.0.1:<端口> 提供的，
           端口一变，localStorage 就是另一个"抽屉"，主题会回到默认、当天更新检查会重跑。
           这几个键跟账目分开存，互不影响。 */
        @JavascriptInterface
        public String kvGet(String k) {
            try {
                if (k == null || k.length() == 0) return "";
                SharedPreferences sp = getSharedPreferences("xzb_kv", MODE_PRIVATE);
                return sp.getString(k, "");
            } catch (Throwable t) {
                return "";
            }
        }

        @JavascriptInterface
        public void kvSet(String k, String v) {
            try {
                if (k == null || k.length() == 0) return;
                SharedPreferences sp = getSharedPreferences("xzb_kv", MODE_PRIVATE);
                sp.edit().putString(k, v == null ? "" : v).commit();
            } catch (Throwable ignored) { }
        }

        @JavascriptInterface
        public void toast(String msg) {
            toastNative(msg);
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) v.vibrate(Math.max(10, Math.min(ms, 200)));
            } catch (Throwable ignored) { }
        }

        @JavascriptInterface
        public String deviceInfo() {
            try {
                JSONObject o = new JSONObject();
                o.put("brand", Build.BRAND);
                o.put("model", Build.MODEL);
                o.put("sdk", Build.VERSION.SDK_INT);
                o.put("android", Build.VERSION.RELEASE);
                return o.toString();
            } catch (Throwable t) {
                return "{}";
            }
        }
    }
}
