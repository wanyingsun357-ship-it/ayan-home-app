# Shopping、独立浏览器与晏白的账本

## 当前能力

Shopping 提供独立京东浏览器的扫码登录、人工额外验证、搜索、查看商品、查看购物车和单件加购。**提交订单、付款与自动转账尚未开放**。扫码完成后的真实账号检验、搜索/加购还需用户登录后验证；匿名登录页可用不代表真实购物全流程已验证。

- 浏览器只有一页，同一时间执行一个操作；不用时可以关闭。使用独立低权限系统账户和持久化用户目录，Cookies/本地存储不导出、不提交、不发聊天。
- 用户选择升级VPS并取消额外上限。服务未配置额外内存、交换、CPU、线程限制，原650MB测试上限已移除。Vultr实际升级尚未执行。
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

用户在Vultr完成升级后核实实际内存和聊天/通话/浏览器服务恢复；随后用户在Shopping扫码，按实际账号结果验证搜索与加购。付款能力另行明确预算、资金来源与购买授权后再做。
