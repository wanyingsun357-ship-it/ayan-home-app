# 项目状态与待办

## 2026-10-25 发布结果（网页已上线，TestFlight 34 已上传）

- 正式源码：659580ee00d28f990dc993d4b52969e4db7c5037（首轮），3fa0ba1c57628f735ffe7f70b506d3495e1c5dd1（导航补检）。两次均基线/文件SHA核对通过，远端工作区干净，已推送main。仅修改清单源码和新增素材，没有覆盖本地home/src，也没有重启后端或写生产测试数据。
- 线上入口引用 index-DJLT2wkL.js / index-BqM70ZOp.css；入口、新资源和壁纸HTTP200。线上发布代码通过原版/暖橘切换、导航红点/侧栏/持久化、模型25项滚动与Effort及Codex/Claude切换的模拟API测试。首轮线上构建还通过路由、Diary、Moments、Read、Chat、Together、Gallery回归。Memory与通话/响应式检查在本地相同源码通过。所有写操作测试均为接口模拟，不能宣称真实服务逐项端到端验收。
- 服务健康GET /api/health为200、queue=0、alerts数量0。
- TestFlight run33（40187493222）和run34（40187713577）均success；已检查Fastlane日志明确“Successfully uploaded the new binary to App Store Connect”，home-ipa工件保存成功。最新版build34，源3fa0ba1；上传时间2026-10-25 11:18 UTC。工作流skip_waiting_for_build_processing=true，Apple处理/测试人员可见性及设备安装尚未核实。
- 最新构建：https://github.com/wanyingsun357-ship-it/ayan-home-app/actions/runs/40187713577 。原生server.url仍指向https://entangledforever.com，新网页在现有App重载后使用；iOS原通知/定位/音频插件未改。
- 备份：原版入口与源码 /root/ayan/backups/orange-20261025-110624；导航修补前入口与源码 /root/ayan/backups/orange-20261025-110945。旧哈希资源保留，可恢复备份index；不要整目录覆盖用户uploads/made。
- 交接：本轮工作副本work/orange-integration-20261024，原独立preview.html未替换。检查范围见ORANGE-RELEASE-20261025.md。下一步需要iPhone真机确认通知点击、选文件、键盘安全区、麦克风/听筒/扬声器/蓝牙与锁屏后台音频。未新增CallKit/LiveActivity；奖惩、梦册/年轮仍是原预留。Today仍承载原Home功能布局，不宣称完整逐像素移植预览。


## 2026-10-25 正式发布与导航补检

- 首轮659580e已发布网页并推送main，线上入口/JS/CSS/壁纸200，线上构建的模拟接口回归通过。备份/root/ayan/backups/orange-20261025-110624。TestFlight run33正在构建，尚未宣称上传成功。
- 补检修复Today弹层遮住侧栏：打开侧栏时先收起Today；侧栏日夜切换写入当前主题独立配置；恢复暖橘首页Diary新动态红点；Mind细轨道保留暗红。浏览器验证菜单可达、红点、跨页面/主题/刷新记忆，通过。
- Memory搜索/编辑/档案/印记、Together七栏目入口与账本/奶茶POST、相册创建/查看的模拟测试通过。真机项与原有预留功能仍见ORANGE-RELEASE-20261025.md。


## 2026-10-25 暖橘正式集成（发布准备）

- 用户授权逐项核对真实前端并发布网页/TestFlight。重新核实线上及GitHub干净基线76ff59c；在work/orange-integration-20261024集成，没有修改有其他窗口改动的home/src。
- 新增双主题独立参数、新首页/开屏/玻璃覆盖，使用原业务组件；保留Read阅读器及Memory/Gallery/Mind/Footprints原源文件。修复Moments发布失败仍关闭弹层、评论失败丢稿及点赞/删除失败无提示。
- 构建、路由、睡眠时长与保存、Diary隐私和自定义心情/失败重试、Moments点赞评论和失败重试、TXT分片上传和阅读器、Chat分段/搜索/收藏、Memory编辑、通话恢复/静音/拖动、三尺寸检查通过。全部写操作是本地模拟接口，未写生产假数据。
- 具体范围与真机待验项见 docs/project/ORANGE-RELEASE-20261025.md。尚不能声称每个真实功能均经端到端验收；CallKit/LiveActivity、奖惩、梦册/年轮未新增。Today仍承载原Home业务布局。
- 当前状态：本地集成已构建，尚未部署或推送；后续以补充发布结果为准。


最后核实日期：2026-10-18（用户时区 America/Los_Angeles）。这是交接快照；下次修改前重新核对线上。

## 当前可证实状态

2026-10-19 Chat「碰一碰」已上线：婉莹可从输入栏选择或自定义“拍了拍／戳了一下／捏了一下”等动作，并从五枚线稿小标志中挑选；双击晏白文字气泡会沿用当前组合。触碰按 `[TOUCH:图案|h=婉莹后缀|m=阿晏后缀]动作[/TOUCH]` 作为真实消息保存和发送，两个名字后均可选填文字、留空则维持原样；时间独立置于触碰正文上方。user/assistant 两个方向都会渲染成居中触碰记录并让对方最近的气泡轻晃，因此晏白也能用同一格式主动碰她；标记后可继续附普通正文，前端会先显示触碰记录，再把后续文字照常拆成气泡。旧无后缀、带后缀、触碰后带正文三种协议解析测试、构建、线上首页/JS/CSS 与 `/api/health` 均验证通过；备份依次在 `/root/ayan/backup-20261019-0102-touch/`、`/root/ayan/backup-20261019-0107-touch-suffix/` 和 `/root/ayan/backup-20261019-0114-touch-speak/`。未恢复头像；尚待 iPhone 真机验收“触碰后继续说话”的组合显示。

2026-10-18 只读核查 VPS 源码仓库，HEAD 为 `444cf03916ab7e9b630e9530ea52aee7349cc1bb`，工作区干净。

最近提交，由新到旧：
- `444cf03`：绘本开屏、蓝猫素材、书信花体、连续红线转场。
- `092e502`：Moments 帖子增加作者头像。
- `b6ee7bf`：恢复回复直接显示时间戳。
- `af22e5e`：收紧 Chat 元信息布局并移除消息头像。
- `cb55478`：Chat 加号菜单换为纸卡与线条图标。

后四项不是本次开屏任务重新实现的功能。开屏基于 `092e502` 获取源码，并逐文件核对保留了 Chat/Moments 修改。

## 已完成并验证：绘本开屏

- 使用原有 `/cat/cat_00.png`、`cat_06.png`、`cat_07.png` 蓝猫帧，表现趴睡到抬头；不是重新生成的猫。
- 粉杏/黑莓纸页、合书翻开、英文书信 `I'm here.` 和 `You're back.`。
- 英文为固定文字矢量轮廓，位于 `storyLettering.json`，不是依赖手机安装字体。
- 绘本放大到适配屏幕的尺寸，上方月印与英文小题签，下方淡叶片和中文题签。
- 同一个 SVG 红线路径沿书脊和下页边过渡到 Home 的 `.hm-divider`。
- Home 提前挂载并加载；开屏时不可交互，结束后恢复。
- 首次约 6 秒，之后冷启动约 1.5 秒；可轻触或键盘跳过；减少动态效果模式约 0.5 秒。
- `sessionStorage.splashed` 控制本次会话是否播放，`localStorage.storybook-intro-seen` 控制完整/短版。仅回前台不应重播。
- 本地生产构建与浏览器检查通过：完整/短版/跳过/减少动态效果/320px 夜间/无页面错误。
- 线上入口和 JS 返回正常，发布构建入口 `index-Cvsb1PFc.js`，CSS `index-bxxcHYAI.css`。
- 代码已推至 GitHub；服务器回退备份 `/root/ayan/backup-story-splash-20261018-065903`（名称为服务器 UTC 时间）。

## 最新决定优先，防止旧需求回滚

- 早期要求聊天头像、等待时钟及时间占位；后来其他窗口移除了 Chat 消息头像、恢复直接时间戳。当前以上述最新提交为准，未经新要求不要改回。
- Moments 作者头像保留；不能把 Chat 移除头像的决定扩展到朋友圈。
- 文件卡外围暗红细线被用户取消，不补回。
- 只有一个现用晏白会话；不要重新添加已经清理的“第六个家”等入口，也不要仅靠旧标题判断会话 ID。
- 输入框旁羽毛笔是分段发送功能按钮，不是可随意移除的装饰。

## 当前待办：按证据分类

### 已授权任务

- 本次整理新窗口交接文档与 AGENTS 入口，已落盘。未改变业务代码或再次部署网页。
- 开屏本轮实现已完成，无已知阻塞；等待用户实际手机使用反馈。自动化验证不能代替 iPhone 真机观感验收。

### 后续可能需要核对，不能当成未完成缺陷

长会话中用户提出过引用、搜索回原文、Favorites 锁定、通话回放、头像裁剪、语音录入、主题切换等要求。部分已有源文件和此前验证记录，但本次没有逐项重验。接手涉及这些模块时先核对 UI-GUIDE、当前代码与现有验证脚本，避免重复实现或声称全部已测。

### 用户明确暂缓

- 转发小红书等帖子、内置浏览能力以及“自己出去玩”的进一步能力：曾讨论，用户说后面再做；不自动开工。

### 未能从本次证据确定

- iOS 通知与 TestFlight 本次已核实并发布；真机前后台横幅、点击跳转和冷启动动画仍待用户安装后验收。

## 更新约定

新任务完成后写明：日期、修改内容、核实的提交、测试结果、是否部署、备份位置、尚待真机确认之处。用户撤销的决定写在冲突决策区，不继续列为待办。

## 2026-10-18 iOS 原生通知与完整开屏（已发布；待真机确认）

- 按用户确认：Live Activity／灵动岛暂缓；每次冷启动播放完整绘本开屏。仍尊重 iOS“减少动态效果”并保留轻触跳过。
- 提交 `e0f7e31` 已推送 GitHub `main`。任务指令和 Diary 新日记、便签、解锁在 App 前台使用 Apple 原生横幅；后台沿用 APNs。普通聊天回复不弹前台横幅；Web 端保留页内横幅。通知点击分别进入 Chat 或 Diary。
- bridge 仅重启该服务；备份 `/root/ayan/bridge/bridge.js.bak-diary-native-push-20261018`。改动前确认无活跃 Claude 进程，`node --check` 通过；重启后 `/api/health` 返回 200。ears/nest 未动。
- 网页已部署至 `/root/ayan/bridge/public`，旧入口备份 `/root/ayan/bridge/public/index.html.bak-native-notify-20261018`。新 JS/CSS 资源与站点入口均返回 200；没有删除旧哈希资源或用户上传内容。
- 本地和隔离分支 `npm run build`、`npx cap sync ios` 与 `git diff --check` 通过。GitHub Actions iOS TestFlight run 21（commit `e0f7e31`）Fastlane 上传成功，IPA 已由工作流保存；TestFlight 处理和用户安装可能需等待。未做真机横幅/冷启动验收。
- “标签”按现有 Diary 便签评论事件实现；未发现单独 tag 通知事件。Live Activity／灵动岛未实现。


## 2026-10-18 开屏英文题签手写体（待确认发布）

- “I'm here.” 与 “You're back.” 已改为 Allura 轻柔连笔手写字形，保留两句原有的逐笔显现和颜色。
- 字体转换为 SVG 轮廓路径，运行时不依赖系统字体或联网加载；随项目附 Allura OFL 许可文本 `public/fonts/OFL-Allura.txt`，未打包原始字体文件。
- 从最新发布提交 `908e2aa` 的隔离工作树修改；`npm run build` 与 `git diff --check` 通过。字形预览已生成并供用户确认。
- 已在隔离分支提交；尚未推送或部署。iPhone 真机字形动画尚未复核。


## 2026-10-18 开屏英文题签手写体（已上线）

- 提交 `58c0b02` 将 “I'm here.” 与 “You're back.” 改为 Allura 连笔手写矢量字形，保留暗红颜色及逐笔显现动画；字体路径生成后随项目附 `public/fonts/OFL-Allura.txt`，运行时无系统字体或外网依赖。
- 提交 `52df2a1` 同步补齐 iOS 工作流对 `src/**`、`public/**`、`index.html` 及 `package-lock.json` 的监听。生产构建和 `git diff --check` 通过。
- 源码推送至 GitHub `main`；网页已部署到 `/root/ayan/bridge/public`。旧入口备份：`/root/ayan/bridge/public/index.html.bak-splash-script-20261018`。新 JS `index-Dh5n0mJc.js`、CSS `index-DFsG-Ni4.css`、首页和 `/api/health` 均返回 200；未删除旧哈希资源或用户数据。
- iOS `capacitor.config.json` 使用 `server.url=https://entangledforever.com`，现有安装版下次打开页面即可读到线上开屏，不需要安装新 TestFlight 包。因源码推送触发的 Actions run 39146177186 在记录时仍运行中，属于额外生成的候选 IPA；用户无需安装。
- 尚未在 iPhone 真机复核动画帧和字体大小。
