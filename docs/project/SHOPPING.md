# Shopping、独立浏览器与晏白的账本

## 默认自主使用额度，聊天不逐步播报

用户明确给出的购物额度是供晏白自主安排的预算，额度内不需要逐步或逐单询问；这是默认约定，没有“惊喜模式”开关，也不新增单独审批页。普通聊天/语音/通知不主动播报选品、加购、截图与购物进度，不提前剧透；仅有购物内容的自动唤醒按原协议结束为[QUIET]。同轮其他真正想说的事可正常说；她主动问起时如实回答。

用户再次确认Footprints仍保留真实工具记录，Shopping必须保留实际购物截图，实际支出仍记在晏白账本。成功购物操作不能静默丢截图；截图失败返回“操作已发生、截图未保存”，先用recordScreen补存当前画面并核对，禁止重复原操作。身份验证画面/二维码/验证码继续不归档。

预算以她实际给出的可用资金为准，账本/月计划不等于平台充值，不虚增收入，不使用信用或其他资金来源。当前提交订单与付款仍未接通，默认约定不代表执行了自动购买；将来付款执行必须同时核对授权余额、实际资金和真实付款结果。不能因预算内无需逐单审批就声称支付已经可用。

服务器升级已由用户操作并经SSH核实：MemTotal 3999736kB、2CPU，根分区75GiB（80GB档），重启后caddy、pm2-root和ayan-shopping-browser均active，health queue0/alerts[]。未设额外资源上限。

## 当前能力

Shopping 提供独立京东浏览器的扫码登录、人工额外验证、搜索、查看商品、查看购物车和单件加购。**提交订单、付款与自动转账尚未开放**。扫码完成后的真实账号检验、搜索/加购还需用户登录后验证；匿名登录页可用不代表真实购物全流程已验证。

- 浏览器只有一页，同一时间执行一个操作；不用时可以关闭。使用独立低权限系统账户和持久化用户目录，Cookies/本地存储不导出、不提交、不发聊天。
- 用户选择升级VPS并取消额外上限。服务未配置额外内存、交换、CPU、线程限制，原650MB测试上限已移除。Vultr升级已由用户完成并经服务器核实。
- 初始内存约1.9GiB、空闲快照可用约1.3GiB。Playwright1.64.1/Chromium156以现代无头模式打开京东登录页200；单页短时测试记录到368MiB峰值，未测并行聊天/通话与复杂商品页的峰值。二维码已实际裁切检查，未扫码登录；关闭网页后服务约80MiB。
- 二维码、当前画面与购物截图沿用设备配对认证，返回no-store。登录二维码和验证码不归档进活动或公开uploads。额外验证由用户在Shopping亲自完成，不记录验证码请求内容。
- 仅允许京东HTTPS主站导航，阻止本机/内网目标。不隐藏webdriver或改变设备指纹绕过风控；额外验证交给用户，未确认就停。

## 助手按需使用

沿用家的Authorization，认证值不显示、不存文件；简表在 GET /api/shopping/guide。

- GET /api/shopping/browser：服务、登录、当前页面与近期活动；此请求不启动Chromium。
- POST /api/shopping/browser/action：{action,query?,skuId?,orderId?,clientId?,session?}。
- login打开二维码，用户用京东App扫码确认；check打开购物车核实登录。仅收到会话Cookie时仍待核对，不当作已确认登录。
- search传query；open传数字skuId或已保存orderId；cart看购物车；close关闭浏览器。
- add必须提供Shopping中的orderId和稳定唯一clientId，仅接受对应京东链接、数量1且未加购/购买的记录。先核实登录与SKU，再点加入购物车；看到明确成功提示才记cart。
- 加购未确认、超时或失败后，必须先查看购物车再考虑重试，避免加重数量。不连续自动点击，不把调用完成说成加购或付款成功。
- loginClick/loginCode仅供用户页面亲自验证，助手内部Authorization调用被拒绝；不要在聊天、终端、工具参数中输入短信码或支付密码。
- GET /api/shopping/browser/screen、/qr、/media/<id>.jpg是配对保护图片；不复制Cookie，不把登录二维码传到公开目录。
- 自动唤醒可以按需找商品、看记录和整理心愿，不强制每轮调用。足迹保存真实购物工具调用并跳转详情，浏览器操作实际结果与截图集中在Shopping。

## 独立账本

Together“我的账本”保留原数据/API；“晏白的账本”使用独立shopping.json，不迁移或覆盖。

- 汇款手工记收入，实际充值/划款未接；每月计划不自动到账。整数分保存，余额为全部已记收入+退款−支出，不代表京东钱包实有金额。
- GET /api/shopping看商品和账本；GET /api/shopping/ledger看独立账本。
- POST /api/shopping/ledger：{op:add|update|remove,id,type:income|expense|refund,amount,date,category,note,by:ayan,clientId}。稳定clientId防重试重复，同ID改内容拒绝，未来收入到账后再记。
- POST /api/shopping/settings：{categories:[分类...],monthlyPlan:元}。
- POST /api/shopping/orders：创建传title,clientId,session，更新传id；其他字段url,platform,quantity,amount,category,note,status,activity,screenshot,merchantOrderId,paymentNote,by。amount为整单金额。
- 状态saved/browsing/cart/checkout/payment_pending/paid/failed/cancelled/refunded是记录。浏览器不提交订单/付款。只在真实付款核实后手工登记paid，需要金额与订单号/付款说明，原子记关联支出。重复付款/全额退款不重复记账。
- 关联收支不直接改删；商品名称/分类同步到关联账目，原付款金额不变。部分退款另记并备注。普通手动截图仍可用/api/upload；浏览器截图走私密目录。

## 运行与验证

- server/shopping.cjs和shopping-browser-api.cjs复制到bridge目录，在原认证之后注册；独立JSON原子保存，损坏文件不以空白覆盖。
- shopping-browser-activities.json和shopping-media保存在bridge私有目录，不入Git。截图不公开，不把登录验证码记入日志。
- server/shopping-browser-worker.cjs安装到/opt/ayan-shopping，锁定Playwright依赖；systemd服务ayan-shopping-browser.service仅监听127.0.0.1:3025，无公网CDP。
- 专用账户ayan-shopping，用户资料/var/lib/ayan-shopping/profile，浏览器/var/lib/ayan-shopping/browsers。不要读取、复制或提交登录资料。
- 前端可见时接shopping_changed更新活动，无新增持续轮询；不展示的画面不反复截图。
- 后端验证：NODE_PATH=/root/ayan/bridge/node_modules:/opt/ayan-shopping/node_modules node server/shopping.test.cjs，再运行server/shopping-browser.test.cjs。前端npm run build；浏览器回归全部模拟接口和临时账本，不用真实账号加购/下单测试。

## 下一步

升级与服务恢复已核实；随后用户在Shopping扫码，按实际账号结果验证搜索与加购。付款需接入真实资金与结果核对；额度内不另加逐单审批流程。

当前登录排查观察到京东明确提示“操作太频繁”，已暂停该次京东访问。遇此提示停止当前尝试，不连续刷新/扫码/加购，不自动换IP重试；不能把截图/页面标题可达当作账号已登录。限流提示通过check结果和loginEvidence.rateLimited给出，真实登录仅凭页面可见账号证据确认。

## 京东扫码被拒与本人密码登录（2026-10-26）

后续用户手机确认后，实际京东登录页显示“本次扫码存在风险，请改用密码登录”。不要把手机确认当作已登录，也不要继续扫码试探；是否与海外出口有关未知。Shopping显示qrRisk提示，并提供账号/密码表单，passwordForm只表示当前官方输入框可见。

loginPassword仅用于本人配对页面，内部助手Authorization调用403。官方passport.jd.com表单接收account/password；只在请求内存和当前官方表单使用，不入活动/截图历史，不在响应中回显，提交后前端清空。助手不能在聊天/终端/工具中索取或代填密码；用户自己在Shopping填写。当前画面遮挡账号/密码/验证码，身份验证不归档。提交后按京东提示人工验证，再由页面证据检查登录；不绕过风控或验证码，不改变付款未接通的状态。

## 本人远程登录窗口（2026-10-26）

用户可在已配对电脑打开/api/shopping/browser/desktop，使用真实Chromium窗口亲自键盘输入、鼠标拖动验证；noVNC1.7.0经同源受保护WebSocket连接服务私有显示，VNC仅127.0.0.1:5906。与原购物专用profile共用，切换可视浏览器需重开一次，不能保证保留当前验证码。验证画面不归档，不向助手暴露原始远程界面。

窗口begin/end只允许本人设备Cookie，拒绝助手Authorization；连接校验Origin、认证及活跃人工租约，单连接，每15秒再验，失效断开。可见窗口每30秒续两分钟租约，完成/离开释放；人工操作期间worker拒绝其他自动动作。助手不可代替拖动/求解验证码或索取凭据。用户完成返回后才检查登录，不宣称连接窗口等于登录成功。

独立测试：NODE_PATH=/root/ayan/bridge/node_modules:/opt/ayan-shopping/node_modules node server/shopping-desktop.test.cjs；真实显示传输测试shopping-desktop-ui.test.cjs仅使用独立Xvfb:97、VNC5907与普通范围控件fixture，无真实京东/凭据。生产启动script内Xvfb:96无TCP，x11vnc5906仅loopback，不开放公网VNC/CDP，不改Caddy/代理/支付。

## 远程通道的设备验证修复（2026-10-26）

生产engine-access会包装global.fetch，为本机3000/api自请求补内部Authorization。远程本人通道不能通过该fetch请求desktop-auth再判断身份，否则会被本人专用规则拒绝。当前WebSocket直接复用engine-access.authorized验证原请求设备Cookie（仍先拒绝Bearer/跨站），只从3025读取人工租约，不放宽验证，也不生成生产测试设备。画面断开与真正401/403授权失败分开提示；不根据黑屏或回主页推断京东登录。

本轮诊断误将内部导出值写进私有工具日志，部署仅改变内部HMAC派生域以失效旧值；签名secret和现有设备Cookie/配对码不变。敏感认证源码只在VPS私有备份保留，不进入此仓库。shopping-desktop-auth.test.cjs以隔离目录复制通用认证代码，拦截本机API网络，验证注入根因、真实签名Cookie及内部值更新不会丢配对；不输出值、不创建生产设备或读取现有Cookie。

## 与原语音WebSocket共用服务器（2026-10-26）

原bridge已在同一httpServer注册server-bound WebSocket.Server，直接再加购物upgrade监听器会让原语音处理器先拒绝购物路径（真实本机/公网400）。购物attach在最后注册，收集已注册的rawListeners后统一分流：购物路径专属处理，其余路由以原this转发原处理器，保留未知路径和once策略。不要恢复为两个独立upgrade监听器各自抢处理；不修改语音内容/认证。

新增shopping-desktop-routing.test.cjs复现server-bound监听冲突并验证语音二进制流和VNC输入并存；实际noVNC显示测试也必须先注册模拟语音监听器。无凭据公网购物握手应由本人保护返回403，不能停留在抢占的400；真实本人画面仍由用户窗口确认，不生成生产测试设备。
