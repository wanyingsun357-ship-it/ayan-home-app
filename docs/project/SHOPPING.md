# Shopping 与晏白的账本

本阶段仅提供记录、账本与足迹联动。未接京东浏览器、登录、加购或支付，不能声称已具备自主购买能力。

- Footprints 的 Shopping 入口打开独立页面；购物活动详情可以定位关联订单。
- Together 的“我的账本”继续使用原有数据和接口；“晏白的账本”使用独立 `shopping.json`，不会迁移或改写原账本。
- 汇款为手工登记收入，充值、实际资金划转和自动每月扣款均未接入。每月零花钱计划只作计划，不自动增加余额。
- 金额按整数分保存；账本余额是全部已记收入与退款减支出，不代表京东钱包余额，历史漏记时可能为负。
- 商品先记录为心愿或实际观察到的状态；只在真实付款被确认后登记已付款。需要实际金额与订单号或付款凭据说明，并原子生成关联支出。重复登记付款/全额退款不重复计入收支。
- 关联收支不能从账本直接改删，避免与订单脱节；订单退款为全额退款，部分退款使用独立退款记录及备注。
- 自定义分类、每月计划与独立账本均在服务器持久保存；采用原子写入，现有文件损坏时停止加载，不以空白覆盖。

## 给晏白的接口

按需读取 `GET /api/shopping/guide` 的最新用法。沿用家现有配对认证，所有本地请求使用 `Authorization: Bearer $AYAN_APP_TOKEN`，不显示或保存认证值。

- `GET /api/shopping`：商品、活动、截图路径、独立账本及余额。
- `GET /api/shopping/ledger`：独立账本。
- `POST /api/shopping/ledger`：`{op:add|update|remove,id,type:income|expense|refund,amount,date,category,note,by:ayan,clientId}`。新建时使用稳定的 clientId，重试不重复记入。同 ID 不同内容返回 409。
- `POST /api/shopping/settings`：`{categories:[分类...],monthlyPlan:元}`。
- `POST /api/shopping/orders`：创建时传 `title,clientId,session`，更新时传 `id`；其他字段 `url,platform,quantity,amount,category,note,status,activity,screenshot,merchantOrderId,paymentNote,by`。金额是整单金额。
- 状态：`saved/browsing/cart/checkout/payment_pending/paid/failed/cancelled/refunded`。实际支付未接通，状态更新只是记录。
- 截图由现有 `/api/upload` 上传图片后传回来的 `/uploads/...` 路径关联；不传收货信息、支付密码或账户凭据。

自动唤醒可以按需查看和整理已有购物记录；无需每轮调用，不生成假购买、假截图或假成功状态。现有唤醒记录器保存真实调用开始/完成/失败状态，即使最后 `[QUIET]` 也保留；前端把购物调用单列为购物活动，并提供 Shopping 跳转。工具调用完成与付款成功分别展示。

## 部署

`server/shopping.cjs` 是不含凭据的后端模块源码，复制到 VPS bridge 目录；在既有认证中间件之后注册，独立数据文件在 bridge 私有目录中，不属于 Git 或静态站点。写入广播 `shopping_changed`，页面只在可见时读取更新，无新增持续轮询。

后端验证：`NODE_PATH=/root/ayan/bridge/node_modules node server/shopping.test.cjs`（使用现有后端 Express 依赖）。前端构建：`npm run build`。浏览器回归使用模拟接口与临时账本，不发起真实购物、聊天或模型调用。
