/* 假原生桥（2026-11-01）
   为什么单独抽出来：index.html 里 `const NATIVE` 是在脚本**解析时**就定死的，
   测试脚本插在 body 末尾之前，那时候 NATIVE 早就等于 null 了。
   于是凡是依赖「让网页以为自己在 App 里」的用例，全部拿不到桥 → 页面一直不回传
   结果 → runtests.py 只能报 60s TIMEOUT。

   修法：用例里写一行 /*@bridge@*\/，运行器就把这个文件塞进 <head>，
   保证它比主脚本先执行。桥本身仍然是假的，只活在测试页面里，不进安装包。

   __FAKE.v 就是「手机上的存档」：写进去的字符串 = 下次 load() 读到的内容。 */
window.__errs = window.__errs || [];
window.addEventListener("error", function(e){
  window.__errs.push((e.message || "") + "@" + (e.lineno || 0));
});
window.__FAKE  = window.__FAKE  || {v: ""};
window.__WROTE = window.__WROTE || 0;
window.__CALLS = window.__CALLS || [];
window.__CAN   = false;   // 是否已允许「安装未知应用」
window.__HAS   = false;   // 手上有没有下好的包
window.XZBNative = {
  load:  function(){ return window.__FAKE.v; },
  store: function(x){ window.__FAKE.v = String(x == null ? "" : x); window.__WROTE++; return true; },

  /* 自动记账已经下线，这几个留着只为兼容老用例的调用 */
  noticeGranted: function(){ return true; },
  pullNotices: function(){ return "[]"; },
  ackNotices: function(){}, clearNotices: function(){},
  totalCaptured: function(){ return 0; }, pendingCount: function(){ return 0; },
  openSetup: function(){}, openNoticeSettings: function(){},

  openUrl: function(u){ window.__CALLS.push("browser:" + u); },
  toast: function(m){ window.__TOASTS = window.__TOASTS || []; window.__TOASTS.push(String(m)); },
  vibrate: function(){},
  version: function(){ return "1.5"; },
  deviceInfo: function(){ return '{"brand":"test","model":"sim","sdk":33}'; },
  keepAliveOn: function(){ return true; }, setKeepAlive: function(){},
  romName: function(){ return "测试机"; },
  openAutoStart: function(){ return true; }, openBattery: function(){ return true; },
  batteryOk: function(){ return true; },
  openAppDetails: function(){}, permissionState: function(){ return "{}"; },

  /* ---- 更新相关 ---- */
  installUpdate: function(u, v){ window.__CALLS.push("install:" + u + ":" + v); return window.__INSTALL_OK !== false; },
  retryInstall: function(){ window.__CALLS.push("retry"); return true; },
  hasPendingApk: function(){ return window.__HAS; },
  canInstallApk: function(){ return window.__CAN; },
  openInstallSettings: function(){ window.__CALLS.push("settings"); }
};
