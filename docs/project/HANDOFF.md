# 新窗口接手与发布说明

## 阅读顺序

先 STATUS，再 UI-GUIDE，再本文件。文档不能代替线上核实，也不包含全部聊天记忆。先回答自己：用户这次要改什么、现在线上是什么版本、哪些目录仅为旧快照。

## 目录地图

| 位置 | 用途 / 注意事项 |
|---|---|
| `D:/阿晏` | 用户工作区根；根 AGENTS 入口 |
| `D:/阿晏/home` | 本地项目及多份发布快照；不要假定 src 最新 |
| `home/release-splash` | 开屏发布构建副本，对应 444cf03 时的代码；未来仍会过期 |
| `home/splash-baseline` | 开屏前 092e502 源码快照，用于校验差异，不是发布源 |
| `home/release-paper`、`home/release-baseline` | 更旧的历史副本，不直接部署 |
| `home/design-preview` | UI 原型/截图，不能替代真实页面业务逻辑 |
| `cat-proto/frames` | 用户原有 18 帧俄罗斯蓝猫、日夜预览；线上素材为 public/cat |
| `openrouter-migration` | 历史发布/验证脚本、截图、恢复文档，也含敏感恢复包；不整目录提交 |
| `/root/ayan/github-repos/ayan-home-app` | VPS 前端源码 Git 检出，当前权威来源需每次核实 |
| `/root/ayan/bridge/public` | 真正线上静态资源，源码提交不等于这里已更新 |

线上站点 `https://entangledforever.com`；源码仓库 `https://github.com/wanyingsun357-ship-it/ayan-home-app`。

## 关键代码索引（先取当前源码）

- `src/paper-theme.css`、`paper-release.css`、`theme.css`：主题变量、纸页覆盖及原样式。
- `src/App.jsx`：导航、开屏接入、全局弹层。
- `src/pages/Home.jsx` / `home.css`：首页与翻页。
- `src/pages/Chat.jsx` / `chat.css`：消息、引用、搜索、分段、语音等；修改前搜索对应事件和状态，而不只看 CSS。
- `src/components/{FavoritesSheet,ArtifactsSheet,ChatCalendar,CallOverlay,PixelCat,PaperAvatar}.jsx`：收藏、附件、日期、通话、加载猫及头像。
- `src/components/{Splash.jsx,splash.css,storyLettering.json}`：本次绘本开场；localStorage 与 sessionStorage 行为见 STATUS。
- `src/pages/Settings.jsx`：原版/绘本主题与日夜分开。
- `src/utils/native.js`、`asrStream.js`：原生桥及语音；改动可能涉及原生打包，勿一概承诺不需要 TestFlight。

## 开始修改前

1. 核对用户最新请求、STATUS 中被撤销或覆盖的决定。
2. 只读检查 VPS 仓库 HEAD、最近提交和 `git status --porcelain`；有改动先识别，不重置或覆盖。
3. 从最新源码建立本次独立工作副本；依赖可按项目实际情况复用。不用旧本地 src 覆盖另一窗口刚发布的代码。
4. 明确此次涉及文件，保存基线提交和文件哈希。生产数据与认证不用于假数据测试。

本地 Git 曾因沙箱用户与文件所有者不同报 dubious ownership；核对路径后可用单次 `git -c safe.directory=D:/阿晏/home ...` 读取，不为此改全局信任所有目录。

## 验证与发布

- 用修改范围相称的构建/浏览器验证。现有脚本位于 `openrouter-migration`，先读脚本，确认测试站点和请求是否模拟，再运行；禁止盲跑历史部署脚本。
- 开屏当前验证：`npm --prefix home/release-splash run build`；`node openrouter-migration/probe-story-splash.cjs`。该浏览器脚本启动本地服务并模拟 API，不修改线上聊天。
- 发布脚本示例 `openrouter-migration/deploy-story-splash.py` 有固定基线与构建哈希，只属于上次发布；下次必须生成新清单，不能原样重跑。
- 发布前重新检查远端 HEAD、干净状态、基线文件 SHA256 与待发布文件 SHA256。有并发修改就重新对齐，不移除保护断言来强行发布。
- 先备份旧入口、相关源文件、清单及基线提交。只提交明确相关文件，构建通过后推送 GitHub，并核实远端提交。
- 静态资源先复制新哈希资源，最后原子替换 index。不要删除历史哈希资源、made、uploads、相册和运行数据。
- 验证线上 index 的新构建引用、资源返回、源码状态；再向用户报告上线。源码提交、构建成功、浏览器预览、线上发布须分别表述。
- 仅前端样式改动不应触发无关后端服务重启。涉及后端/原生变化时重新评估验证范围和发布方式。

历史上用户授权完成相关修改后推送备份；这不是对任意未来功能、数据删除或额外外部操作的空白授权。按当前任务范围执行。

## 认证与恢复资料边界

Windows SSH 连接曾使用 `C:/Users/14403/.ssh/vps_ayan` 到 `root@45.77.208.204`，只作为连接位置提示，不读取或输出私钥内容。需要网络/沙箱许可时使用工具支持的正规权限流程。

`openrouter-migration/GITHUB.md` 记录代码及每日数据备份；`RECOVERY.md` 记录历史恢复方法，内容可能过期，实施前核实。私有恢复包、密钥文档、p8、认证状态、聊天数据不能跟项目说明一起上传。不要用整包恢复覆盖新聊天或新配对状态。

## 本次交接文档存储范围

文档在 Windows 工作区维护，并随源码仓库备份到 GitHub；换机器后需拉取最新版本，旧窗口需要明确重新读取。仓库根 AGENTS.md 指向这三份交接文档；workspace-AGENTS.md 是 Windows 工作区外层入口的备份，恢复到 D:/阿晏/AGENTS.md 时使用。文档同步不会更新线上网页，也不等于自动同步所有窗口的聊天记忆。具体推送结果以本次 Git 操作验证为准。
