# 小账本 · 规则全集（详细版，MEMORY.md 的完整备份）

安卓本地记账 App。数据只存手机（App: SharedPreferences / 网页: localStorage），不上传、无账号。
卖点：读通知 / 截图 OCR / 导入账单自动记账。

## 设计原则
同一个数字只在最该出现的地方大一次。每笔账只属一个真实账本，总账本只是并集视图。
账本页总数实时算。猜不准进「待分类」（按**全部月份**统 `uncatCount`）。提醒不超过两处。

## 数据安全
新增账目必须写 `book`（`pickBook`/`autoBook`），漏写静默落「日常」。`load()` 从干净状态赋值。
坏档先 `salvageRecords()`，坏串存 `payload.salvage` 永不丢弃；内存空而存档有账时 `save()` 拒写。
备份必带 `books` 和每笔 `book`；未知字段走 `_extra`。写失败要一直报（`.svw` 横幅）。
`app/keystore.jks` 与 build.sh 明文密码不进公开仓库。用户数据进 innerHTML 一律 `esc()`
（peer/from/name/icon/**id**，`data-*` 也算）。`toast()` 用 textContent。

## 商户识别（BRANDS 231 / 图标 200）
顺序即优先级：具体店 → 平台 p:1 → 渠道 p:2；取第一个命中；新增必须写 `cat`（漏了退分类图标）。
商户名按序：正文 `notifyPeer` → 小程序/平台下的店 → 标题 `peerFromTitle` → 正文平台名
`brandInText` → 通知 App。标题要挡渠道词、`服务通知/支付成功`、`银行/钱包`结尾 —— 宁可空着。
**渠道永不进 peer**。图标左边必须和右边分类标签说同一件事。大促期 App Store 图标带 11.11 横幅，
跑 `.build/logos/repromo.py`。

## 「在哪买的」vs「用什么付的」（2026-10-23 用户明确要求）
`peer` = 在哪买的（拼多多），账记在它头上；`from` = 用什么付的（微信/支付宝），只当付款方式。
- 两条通知合并时 `betterFrom()` **渠道优先**，别拿平台把渠道顶掉。
- 明细行：渠道念成「微信支付/支付宝/云闪付」（`payWord`），平台才说「来自 X」。
- 判重窗口：两边都报了商户 or 都没报 → 2 分钟；**只有一边报了 → 15 分钟**
  （`DUP_WINDOW_GENERIC`）。拼多多跳微信输密码能隔五六分钟，2 分钟会让同一笔记两遍。
- `noteFor()`：通知来的账剔掉渠道词和"支付成功/付款金额"这种废话，不重复念；手动的一字不动。

## 动效与性能
点击那一帧只做动画：`NATIVE.store()` 必须 `apply()` 不是 `commit()`；纯界面偏好用 `saveSoon()`
（320ms）延后。先量后写：`hideCard` 先读 `offsetHeight` 再 `paintBar`；`cardCollapse(el,done,h0)`。
果冻：位移 WAAPI，height 只走 transition，阴影/边框宽度绝不过渡。

## CSS 特异性陷阱（同一坑栽两次）
卡片收起要归零的属性（margin-bottom / padding / 上下边框）**必须写在
`#homeStack > .hm-blk.collapsing`** 这条 ID 规则里 —— 写成 `.hm-hero.collapsing` 会被后写的
`.hm-hero.day{padding:15px 17px 13px}` 压掉（同特异性后写赢），日卡冻结在 28px 再"啪"一下。
收起时 `padding` 过渡必须和 `height` 同曲线同时长。逐帧排查：rAF 采
`offsetHeight + paddingTop + 目标区域 top`，看哪项**不再变化**。

## 页面铁律
首页「本月」永远按真实本月（`curMonthRecs()`），不跟 `state.viewMonth`。
卡片收起：`state.hide` + `.away` + `paintCards()`；`swKids()` 必须过滤 `.away`；
`hide` 要带齐 load/save/备份/`applyBackup`/`_extra`/`wipeAll`。
明细行**点整行无响应**；左滑只有全开(-171px)/全关。备份恢复唯一入口 `applyBackup(d)`；
账本 id 撞车用备份设置覆盖（`budget<=0` 除外）。

## 判重与解析
备份恢复有 `id` 按 `id` 认，撞车且内容不同 → `uid()` 换号。金额两处入口都认「万/千/¥.5」；
`moneyNum` 只认纯数字，先过 `stripThousand()`。退款记 `cat=refund` 收入并 `ref` 指回原支出，
**不改原来那笔**；`ref` 随 load/备份带过。

## 原生
首次设置页是 `SetupActivity.java`（**不是网页**，在线预览看不到）。**引导不许"一点就跳系统设置"**：
先弹底部说明卡 `showGuide(kind)`，用户点主按钮才跳；别往系统页上飘 Toast（"像不正规的 app"）。
能自动弹框的只有忽略电池优化和发通知(13+)；其余只能跳页面，状态存 SharedPreferences，
延时跳转前核对 `autoCur()==kind`。

## 配色（定版）
`--bg:#FBF7F2`（= `styles.xml` windowBackground，否则白闪）、`--brand:#DE6B45`、`--card:#FFF`、
`--card2:#FAF6F0`。全站不出现冷色；固定浅色；个性化开关默认关。分类 11 类勿改名。

## 测试与交付
`python .build/tests/runtests.py [名字]`，跑前清掉 `.build/tests/_prof/deep1`（残留会锁死超时）。
验证历史修复要重走真实入口（`audit.js`），别把会变的事（哪家没图、版本号）写死。
改完网页必须 `python .build/tools/mk_demo.py`。打包 `bash app/build.sh <版本> <code>` 是版本号唯一来源
（自动 cp 网页 + 改清单和 `VER`）。产物放 `D:\小账本\交付\`，桌面只放 junction，别往 C 盘堆。
