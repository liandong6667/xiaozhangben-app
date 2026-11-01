# -*- coding: utf-8 -*-
"""把 index.html 复制成一份「带演示账单」的在线预览版。

为什么要单独一步：演示数据绝不能活在正式文件里，否则打出来的 APK
会带着别人的账。所以正式 index.html 一个字节不动，这里只在副本的
</head> 之前插一段 seed 脚本，往 localStorage 里灌数据，然后让 App 自己的
load() 去读 —— 走的全是真实代码路径（分类、头像、统计、账本结构都一样）。
"""
import io, os, re, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "index.html")
OUT_DIR = os.path.join(ROOT, "在线预览")
OUT = os.path.join(OUT_DIR, "index.html")

# 改这个字符串 = 强制所有打开过预览的人重新灌一遍数据
DEMO_VER = "demo-2026-11-01a"

SEED = """
<script>
/* ================= 演示数据（只存在于在线预览这份副本里，不进 APK）=================
   目的：点开链接就有一屏真实的账可以看、可以点，不用自己先记十笔。
   做法：直接写 localStorage 里那个 key，让 App 自己的 load() 去读 ——
   不是另搭一套假界面，所以分类归位、品牌头像、账本构成、本月预算全是真算出来的。
   日期用「今天往前推 N 天」而不是写死 10 月几号：不管哪天打开，账都落在最近，
   首页的「本月」才有东西。 */
(function(){
  var VER = "__DEMO_VER__";
  try{
    if(localStorage.getItem("xzb.demo") === VER) return;   // 灌过了，别覆盖用户自己改的账
    var DAY = 864e5;
    function ago(d, hh, mm){
      var x = new Date(Date.now() - d * DAY);
      x.setHours(hh == null ? 12 : hh, mm || 0, 0, 0);
      return x.getTime();
    }
    var books = [
      {id: "daily", name: "日常", icon: "🏠", color: "#DE6B45", budget: 1500, def: true},
      {id: "study", name: "学习", icon: "📚", color: "#9B7EDE", budget: 600},
      {id: "side",  name: "兼职", icon: "💼", color: "#2E8C63", budget: 0},
      /* 1.6.96：图案 + 文字都填的样子 —— 卡片图标位上面 💅、下面「美甲」 */
      {id: "nail",  name: "美甲", icon: "💅", iconTxt: "美甲", color: "#C9778F", budget: 0},
      /* 只写了文字、没挑图案：上面一张白文件纸，下面两个字 */
      {id: "vet",   name: "宠物", icon: "", iconTxt: "宠物", color: "#5B8DB8", budget: 0}
    ];
    var R = [
      /* ---- 支出：12 笔，跨 6 个分类、2 个账本，来源 App 有微信也有支付宝 ---- */
      {id:"d01", ts:ago(21,12,10), amt:18,    type:"expense", cat:"food",      peer:"第一食堂",   from:"",     note:"午饭 两荤一素", book:"daily", src:"manual"},
      {id:"d02", ts:ago(19,15,30), amt:8,     type:"expense", cat:"food",      peer:"蜜雪冰城",   from:"微信", note:"冰鲜柠檬水",   book:"daily", src:"notify"},
      {id:"d03", ts:ago(18, 8, 5), amt:4,     type:"expense", cat:"transport", peer:"地铁",       from:"支付宝",note:"2 号线 学校→市中心", book:"daily", src:"notify"},
      {id:"d04", ts:ago(16,12,40), amt:32,    type:"expense", cat:"food",      peer:"老王黄焖鸡", from:"美团", note:"外卖 加了个鸡腿", book:"daily", src:"manual"},
      {id:"d05", ts:ago(15,19,20), amt:47.5,  type:"expense", cat:"daily",     peer:"永辉超市",   from:"微信", note:"洗发水 抽纸 洗衣液", book:"daily", src:"manual"},
      {id:"d06", ts:ago(12,16, 0), amt:12,    type:"expense", cat:"study",     peer:"打印店",     from:"支付宝",note:"课程资料 双面 30 页", book:"study", src:"manual"},
      {id:"d07", ts:ago(11,10, 0), amt:89,    type:"expense", cat:"study",     peer:"京东",       from:"京东", note:"《算法导论》",  book:"study", src:"manual"},
      {id:"d08", ts:ago( 9,20, 0), amt:45,    type:"expense", cat:"fun",       peer:"万达影城",   from:"微信", note:"电影票 两张",   book:"daily", src:"manual"},
      {id:"d09", ts:ago( 7,17,30), amt:25,    type:"expense", cat:"daily",     peer:"理发店",     from:"支付宝",note:"剪头发",        book:"daily", src:"manual"},
      {id:"d10", ts:ago( 5,12,15), amt:22,    type:"expense", cat:"food",      peer:"蜜雪冰城",   from:"微信", note:"两杯 给室友带的", book:"daily", src:"notify"},
      {id:"d11", ts:ago( 3,21, 0), amt:13.5,  type:"expense", cat:"daily",     peer:"罗森便利店", from:"支付宝",note:"关东煮 夜宵",   book:"daily", src:"manual"},
      {id:"d12", ts:ago( 1,13, 0), amt:9.9,   type:"expense", cat:"food",      peer:"瑞幸咖啡",   from:"微信", note:"生椰拿铁",      book:"daily", src:"notify"},
      /* 今天的两笔：不然首页「今天已花」是 0.00，看着像数据没进去 */
      {id:"d13", ts:ago( 0, 7,50), amt:6.5,   type:"expense", cat:"food",      peer:"第一食堂",   from:"微信", note:"早餐 包子豆浆", book:"daily", src:"manual"},
      {id:"d14", ts:ago( 0,11,40), amt:7,     type:"expense", cat:"food",      peer:"蜜雪冰城",   from:"微信", note:"冰鲜柠檬水",    book:"daily", src:"notify"},
      /* 兼职账本也要有支出，不然那本账在账本页是"0 元 0 笔"，看着像没数据 */
      {id:"d15", ts:ago(13,19, 0), amt:35,    type:"expense", cat:"study",     peer:"打印店",     from:"支付宝",note:"家教用的习题册", book:"side", src:"manual"},
      /* 再补 5 笔，把剩下几个支出分类也占上：账本页的分类构成条才有东西看 */
      {id:"d16", ts:ago( 8,15,20), amt:79,    type:"expense", cat:"cloth",     peer:"优衣库",     from:"支付宝",note:"换季卫衣",      book:"daily", src:"manual"},
      {id:"d17", ts:ago( 6, 9,30), amt:18,    type:"expense", cat:"med",       peer:"校医院",     from:"微信", note:"感冒药",        book:"daily", src:"manual"},
      {id:"d18", ts:ago( 2,20,10), amt:30,    type:"expense", cat:"comm",      peer:"中国移动",   from:"支付宝",note:"话费 月租",     book:"daily", src:"notify"},
      {id:"d19", ts:ago( 2,21, 0), amt:20,    type:"expense", cat:"other",     peer:"卡务中心",   from:"微信", note:"校园卡补办",    book:"daily", src:"manual"},
      {id:"d20", ts:ago( 4,19,30), amt:58,    type:"expense", cat:"social",    peer:"好利来",     from:"微信", note:"室友生日蛋糕",  book:"daily", src:"manual"},
      /* 三个"识别链路"的活样本：校园 App、小程序、平台里的具体店 */
      {id:"d21", ts:ago( 0,12, 5), amt:12.5,  type:"expense", cat:"food",      peer:"慧生活798", from:"慧生活798", note:"食堂二楼 刷卡消费", book:"daily", src:"notify"},
      {id:"d22", ts:ago( 1,16,20), amt:14,    type:"expense", cat:"food",      peer:"古茗",      from:"微信", note:"古茗小程序 支付成功", book:"daily", src:"notify"},
      {id:"d23", ts:ago( 5,18,40), amt:39,    type:"expense", cat:"food",      peer:"肯德基",    from:"美团", note:"美团外卖 已送达",   book:"daily", src:"notify"},
      /* 三个"没有独立 App 的连锁店"样本：它们只做门店和小程序，
         图标是靠品牌图案补的（1.6.30）。点开看看是不是真 logo。 */
      {id:"d24", ts:ago( 3,12,15), amt:26,    type:"expense", cat:"food",      peer:"华莱士",    from:"微信", note:"华莱士小程序 支付成功", book:"daily", src:"notify"},
      {id:"d25", ts:ago( 7,15,40), amt:17,    type:"expense", cat:"food",      peer:"茶百道",    from:"微信", note:"茶百道小程序 支付成功", book:"daily", src:"notify"},
      {id:"d26", ts:ago( 9,21,10), amt:23.5,  type:"expense", cat:"daily",     peer:"美宜佳",    from:"支付宝", note:"牙膏 洗衣液", book:"daily", src:"manual"},
      /* 游戏充值（1.6.31）：大学生账单里很常见的一块，图标是新补的。
         peer 写游戏名（真正花钱的那款），from 写钱从哪个 App 出去的；
         崩铁那条故意用全角冒号，真实通知就这么写的；steam 那条是"在哪买的"，不是某一款游戏。 */
      {id:"d27", ts:ago( 6,21,40), amt:68,    type:"expense", cat:"fun",       peer:"王者荣耀",       from:"微信",   note:"点券充值 支付成功", book:"daily", src:"notify"},
      {id:"d28", ts:ago( 8,20,15), amt:30,    type:"expense", cat:"fun",       peer:"原神",           from:"支付宝", note:"小月卡 创世结晶", book:"daily", src:"notify"},
      {id:"d29", ts:ago(11,19, 5), amt:98,    type:"expense", cat:"fun",       peer:"崩坏：星穹铁道", from:"微信",   note:"列车补给凭证", book:"daily", src:"notify"},
      {id:"d30", ts:ago(13,22,30), amt:128,   type:"expense", cat:"fun",       peer:"steam",          from:"支付宝", note:"STEAM PURCHASE", book:"daily", src:"notify"},
      /* 文字图标那本账也要有支出，不然在账本页是"0 元 0 笔"，看不出样子 */
      {id:"d31", ts:ago( 6,15, 0), amt:128, type:"expense", cat:"fun", peer:"美甲店", from:"微信",   note:"做指甲",   book:"nail", src:"manual"},
      {id:"d32", ts:ago(20,16, 0), amt:68,  type:"expense", cat:"fun", peer:"美甲店", from:"支付宝", note:"卸甲 补色", book:"nail", src:"manual"},
      /* 电商两笔（1.6.33）：用户报"拼多多用微信付的，账单上一个图标都没有"。
         这两条就是那个场景的活样本 —— 左边该是拼多多/淘宝的真 logo，
         小字写「来自 微信 / 来自 支付宝」（在哪付的），商户名在左（在哪买的）。 */
      {id:"d31", ts:ago( 0,15, 5), amt:5.75,  type:"expense", cat:"daily",     peer:"拼多多",   from:"微信",   note:"拼多多 | 支付成功 ¥5.75", book:"daily", src:"notify"},
      {id:"d32", ts:ago( 2,14,30), amt:129,   type:"expense", cat:"daily",     peer:"淘宝",     from:"支付宝", note:"淘宝 | 支付成功 ¥129.00", book:"daily", src:"notify"},
      /* 「喝水」「奶茶」这类记账词现在有图标了（1.6.61）：喝水→💧、奶茶→🧋。
         放两条在这里，点开预览一眼就能看见，不用自己去记一笔。 */
      {id:"d33", ts:ago( 0, 9,20), amt:0.5,   type:"expense", cat:"food",      peer:"喝水",     from:"",       note:"宿舍开水机", book:"daily", src:"manual"},
      {id:"d34", ts:ago( 0,16,40), amt:12,    type:"expense", cat:"food",      peer:"奶茶",     from:"微信",   note:"和室友拼的", book:"daily", src:"manual"},
      /* ---- 收入：4 笔，四种来源 ---- */
      {id:"i01", ts:ago(22,10, 0), amt:1500,  type:"income",  cat:"living",    peer:"家里",       from:"",     note:"这个月的生活费", book:"daily", src:"manual"},
      {id:"i02", ts:ago(14,18, 0), amt:300,   type:"income",  cat:"parttime",  peer:"家教",       from:"微信", note:"给高二学生补数学", book:"side", src:"manual"},
      {id:"i03", ts:ago(10, 9,30), amt:66,    type:"income",  cat:"gift",      peer:"室友",       from:"微信", note:"我生日他发的",  book:"daily", src:"notify"},
      /* 退款：ref 指回上面那张电影票，明细里能看出"这笔是冲哪个的" */
      {id:"i04", ts:ago( 4,11, 0), amt:45,    type:"income",  cat:"refund",    peer:"万达影城",   from:"微信", note:"其中一张退掉了", ref:"d08", book:"daily", src:"notify"},
      /* 再补两笔，收入 6 个分类就全了（生活费/工资/兼职/红包/退款/其他收入） */
      {id:"i05", ts:ago(17,16, 0), amt:400,   type:"income",  cat:"salary",    peer:"图书馆",     from:"",     note:"勤工助学 每月 400", book:"daily", src:"manual"},
      {id:"i06", ts:ago( 6,14, 0), amt:26,    type:"income",  cat:"otherin",   peer:"闲鱼",       from:"微信", note:"卖了旧教材和真题", book:"side", src:"manual"},
      /* 今天/昨天各一笔收入：不然一打开记账页，最上面两天全是支出，
         用户会以为"收入没进去"（其实要往下翻）。 */
      {id:"i07", ts:ago( 0, 9,20), amt:100,   type:"income",  cat:"parttime",  peer:"家教家长",   from:"微信", note:"这周两次补课的尾款", book:"side", src:"manual"},
      {id:"i08", ts:ago( 1,10, 0), amt:20,    type:"income",  cat:"gift",      peer:"妈妈",       from:"微信", note:"让买点水果",    book:"daily", src:"notify"},
      /* ---- 上个月的几笔：让账本页能往回翻，不是只有这个月有东西 ---- */
      {id:"p01", ts:ago(35,12,20), amt:16,    type:"expense", cat:"food",      peer:"第一食堂",   from:"",     note:"午饭",         book:"daily", src:"manual"},
      {id:"p02", ts:ago(38,15, 0), amt:60,    type:"expense", cat:"study",     peer:"学校书店",   from:"微信", note:"专业课本",      book:"study", src:"manual"},
      {id:"p03", ts:ago(41,10, 0), amt:1500,  type:"income",  cat:"living",    peer:"家里",       from:"",     note:"上个月生活费",  book:"daily", src:"manual"}
    ];
    /* 1.6.95：自己加的小分类（更多分类里每个大类尾巴那个＋）。
       放一个「蛋糕」在餐饮下，点「记一笔 → 其他 → 更多分类」就能看到它，
       右上角「编辑」还能把它删掉。 */
    var subs = [
      {k: "csdemo", cat: "food", pic: "", txt: "蛋糕"}
    ];
    var PAY = JSON.stringify({v: 3, records: R, books: books, peerRules: {}, customSubs: subs});
    var KB = "xiaozhangben.v3";
    var ok = false;
    try{ localStorage.setItem(KB, PAY); localStorage.setItem("xzb.demo", VER); ok = true; }catch(e){}

    /* 写不进去的时候（无痕模式 / 从微信或 QQ 里点开 / 预览窗里的 iframe）不能让页面空着 ——
       那就把这份数据挂到读路径上，用内存假装成存储，页面照样能看能点。
       读的时候真值优先，所以正式账号里的账不会被顶掉；写的也同步往真存储写一份，
       能写就写进去了，写不进就只在这次浏览有效（关掉就没了，反正是演示数据）。 */
    if(!ok){
      var mem = {};
      mem[KB] = PAY; mem["xzb.demo"] = VER;
      var G = Storage.prototype.getItem,
          S = Storage.prototype.setItem,
          D = Storage.prototype.removeItem;
      Storage.prototype.getItem = function(k){
        var v = null;
        try{ v = G.call(this, k); }catch(_){}
        if(v != null) return v;
        return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
      };
      Storage.prototype.setItem = function(k, v){
        mem[k] = String(v);
        try{ S.call(this, k, v); }catch(_){}   // 写不进就算了，别再让 save() 抛出去弹横幅
      };
      Storage.prototype.removeItem = function(k){
        delete mem[k];
        try{ D.call(this, k); }catch(_){}
      };
    }
  }catch(e){ /* 兜底也失败了才真的空着跑 */ }
})();
</script>
""".replace("__DEMO_VER__", DEMO_VER)


def main():
    html = io.open(SRC, encoding="utf-8").read()
    if "xzb.demo" in html:
        sys.exit("index.html 里已经有 demo 脚本了，先确认没被污染")
    if "</head>" not in html:
        sys.exit("找不到 </head>")
    out = html.replace("</head>", SEED + "</head>", 1)
    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)
    io.open(OUT, "w", encoding="utf-8").write(out)
    print("已生成 %s（%.2f KB，比正式版多 %.1f KB 演示数据）" % (
        OUT, os.path.getsize(OUT) / 1024.0, (os.path.getsize(OUT) - os.path.getsize(SRC)) / 1024.0))
    print("演示版本号：%s" % DEMO_VER)


if __name__ == "__main__":
    main()
