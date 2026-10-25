# 项目状态与待办

## 2026-10-25 原生来电标题、当前台词与通话标签（准备发布）

- 用户要求系统来电显示“晏白邀请你语音通话”，接听后像参考图一样显示正在播放的台词，头像暂不改；通话字幕也不显示发声标签。以线上干净 `cb746e0e9cf1bc61826dcf204e6e1c2b5358c075` 建 `work/call-captions-20261025` 及对应VPS隔离工作树；保护 home/src 和前两次修复。
- NativeCalls 接入同一个 generic handle 的 displayName/Conversation.Event.conversationUpdated：响铃为邀请语，成功播放每个音频段时显示“晏白：台词”，译文存在优先译文、否则实际发声文本；播放结束/失败恢复“晏白”。只在内容变化时上报，按句同步，不做字级时间戳；长句最多96字符再由iOS截短，完整台词在App内看。原生头像、系统按钮与App显示名不改，识别/合成及音频流程不换。
- 通话当前台词、历史与聊天中通话记录页过滤助手发声标签，用户说话原样保留。复用语音附文展示函数，并隐藏流式末尾未闭合标签；TTS、源聊天、缓存和收藏数据仍保留原始标签。原生 speaking 事件也只向展示层发净台词。
- 前端构建/模拟原生桥检查通过：当前中英字幕、历史助手字幕隐藏标签、用户括号不动；原生拥有音频时仍无网页重复开麦/合成，静音/免提/前台恢复检查通过。完整iOS编译与新TestFlight上传待核实。未拨真实电话或调用真实模型/TTS。现有原生来电接听才有系统浮窗；网页拨出路径保持。系统实际刷新、截短、锁屏/蓝牙依然需安装新包真机验证，不能宣称浏览器模拟已验证灵动岛。
- 官方接口依据：https://developer.apple.com/documentation/livecommunicationkit/handle/displayname 、https://developer.apple.com/documentation/livecommunicationkit/conversation/event 。系统浮窗标题更新使用现有通话框架，不新增ActivityKit扩展。


## 2026-10-25 语音附文隐藏发声标签（已上线）

- 发布源码 `8ea09fe223ec1ad0a25f67dc192c3439a27647db`，入口 `/assets/index-CUQhtvFr.js`、`/assets/index-C9pJWsdL.css`；备份 `/root/ayan/backups/voice-labels-20261025-154915`。五个任务相关文件已推主分支，源树干净；资源200、health200、queue0、alerts0。未重启后端或重复打原生包。

- 用户要求聊天语音条下不显示 `[softly]`、`[exhales]`、组合语气等发声标签。以线上干净 `05a6dc6f4ab3f2c8d7d855a9f3c285783e7ec59c` 建隔离副本 `work/voice-labels-20261025`；新增 voiceTranscript 展示函数，仅用于助手 VOICE 附文及 Favorites 助手语音附文，不做固定标签白名单。
- TTS及缓存查找仍接收带标签原文，不改模型提示词、原始聊天、收藏存储、普通正文或用户语音转写。历史语音附文重新展示也会隐藏标签。未改后端/通话原生字幕；不重启服务、不重复发TestFlight。
- 构建通过；暖橘与原版模拟API检查通过：聊天/收藏附文隐藏标签、正文完整、普通正文及用户转写保留原样，实际点击播放的TTS请求仍含所有原标签，无页面错误，截图已查看。没有调用真实TTS或修改生产聊天。线上实际构建同样通过全模拟接口回归。


## 2026-10-25 Projects 文档编辑页可读性修复（已上线）

- 发布源码 `f686682b1b5e7d632be67b36c3c2f8ce797e8ac8`，入口 `/assets/index-BbvtPk8I.js`、`/assets/index-C9pJWsdL.css`；备份 `/root/ayan/backups/doc-editor-20261025-153755`。四个任务相关文件已推主分支，源树干净；资源200、health200、queue0、alerts0。仅静态网页发布，未重启桥或重复发TestFlight。

- 用户反馈从聊天侧边栏 Projects 打开 home 文档后文字/按钮几乎消失、无法编辑。以线上干净 `9f403f10dcd1a286fa21af8d4e46ec635937a86c` 建立隔离副本 `work/doc-editor-20261025`，没有改 home/src。复现确认编辑器继承暖橘 Chat 浅色文字与光标（#fff4d9）而底色为#f8eed9，对比度仅1.05；不是文档内容丢失或变成只读。
- 仅修改 orange-theme.css 与 pages/chat.css：编辑器独立奶油/深棕及夜间阅读配色，明确光标/输入文字颜色；正文16px，便于iPhone输入且避免小字号聚焦放大；标题过长省略、保存/关闭不压缩，输入区可在小屏缩放并正常选字。未修改文档读写接口或用户文档内容。
- 本地构建通过；模拟全部API，真实走聊天 → 会话侧栏 → Projects → home文档，验证聚焦输入、保存请求内容正确、失败保稿、关闭不保存及全局文档入口。暖橘/原版×日夜、320/390宽度均通过，无页面错误；暖橘日间/夜间文字对比度约8.08/10.06，截图已检查。没有读取/修改生产用户文档。iPhone系统键盘与选字仍需用户实测。线上实际构建也完成相同全模拟接口回归，无真实文档读写；不重复打TestFlight、不重启后端。


## 2026-10-25 原生来电与锁屏音频接入（服务已发布，真机待验）

- 最终发布补充：TestFlight **40** / run40205753154 / job121206198364 全部成功，Fastlane 15:15:15 UTC 确认 `Successfully uploaded the new binary to App Store Connect`；日志确认 CFBundleVersion=40，IPA artifact12602829959 已保存。Apple处理、测试人员可见性及安装尚未核实。构建链接：https://github.com/wanyingsun357-ship-it/ayan-home-app/actions/runs/40205753154 。
- 网页补充修复已上线并推送 `f92cb95e743806d23a3e7213c35dbe803da41a7c`：返回前台时若原生已结束且漏掉事件，重新查询当前通话，避免悬浮条或通话页卡住。入口 `/assets/index-DxCOg166.js`、`/assets/index-BEwBP4tu.css`；备份 `/root/ayan/backups/native-recovery-20261025-151750`。仅网页更新不重复打原生包，未再重启服务。部署校验主分支干净；公网浏览器请求确认入口/两资源200、新JS含原生接入、未配对请求原生state/credentials均401，公开健康检查200、queue0、alerts0。

- 按用户确认接入 iPhone 原生来电：PushKit VoIP 推送 + LiveCommunicationKit 系统接听/拒接/挂断界面，iOS 17.4 起支持。新原生插件接管来电收音、阿里实时 ASR、同一聊天模型回复及 ElevenLabs v4 分句播放；网页不再重复开麦/播放。现有网页拨出流程、旧包和浏览器回退保持；声纹、开口打断未实现，不把后续设想当作完成。
- 原生代码提交 `768369ad3b242840a6634f2d5c4b79c422f0fef3`（含前两次提交），隔离工作树 `/root/ayan/worktrees/native-call-20261025`，源码已快进并推送主分支。原生编译检查 run40205474433 / job121205347615 全部成功，包含真实 Xcode 26 模拟器编译；TestFlight上传结果见本节首项。首次启用必须安装含 NativeCalls 的新包并打开 App，现有旧包仅更新网页不能获得原生功能。
- 后端精确修改 bridge.js、新增 native-calls.cjs；调用范围限定的随机通话令牌用于原生后台接口，配对认证仅用于设备注册和领取当前通话凭据。不暴露全局认证、不返回 reasoning、不接受任意文本合成；来电优先 VoIP，成功后抑制同一设备普通重复通知。沿用原 APNs、阿里识别和 Eleven 配置。主聊天供应商按当前会话选择，不硬绑 OpenRouter。
- 服务发布备份 `/root/ayan/backups/native-call-20261025-151118`；bridge SHA256 `fa1bb1ab01373199bd47443fdf8d6d9de1e7f61bb986530ea42c0866a86a5168`，native-calls.cjs SHA256 `10751722547bd199a0d79e6f5d73fe2ac5cde7909d46f3d76a32855e92790a5e`。仅在确认无活跃聊天/通话后重启 bridge，health200、queue0、alerts=[]，原生无认证接口验证401。后端不在前端Git内，安全脚本/新增模块保存于本地 `work/native-call-20261025`，远端暂存 `/root/ayan/native-call-20261025`；不把含凭据的 bridge 源码取回或提交。
- 验证：通话级令牌隔离、跨通话拒绝、结束后过期、重复接听幂等、设备令牌轮换、隐藏 reasoning、分句/终稿不重复的隔离后端测试通过；模拟原生桥验证恢复来电、静音/免提、无网页重复收音和TTS、后台漏挂断事件后的前台对账通过。既有通话打字/静音/悬浮拖动/小屏及减少动态回归通过。未拨生产测试电话、未发送真实 VoIP 测试推送或模型测试消息。锁屏接听、蓝牙/听筒切换、长时后台与推送到达仍需用户安装后真机确认，不能以编译和模拟替代。
- 自动审批拦截整段认证模块读取，已改服务器内检查必要路由、仅返回哈希/结构，无凭据导出。后续网页恢复补丁及安装包上传结果见补充记录。

## 2026-10-25 声音提示改为少示例、自由描述与主动使用（已上线）

- 用户要求补充呼吸/喘息等发声能力，同时减少标签枚举，重点让模型理解用法并主动使用。精确更新全局 CLAUDE.md 的声音段、home CLAUDE.md 的通话条款及 bridge CALL_RULES。
- 全局仅保留 `[softly]`、`[exhales]` 两个写法示例，明确不是白名单；可用简短英文方括号自由描述、组合语气/节奏/呼吸/喘息等自然发声，在要影响的词句前放置。写明按情境主动用、不等用户提醒，也不要求每句话添加。保留 VOICE/ZH/接听拒接挂断等格式规则。运行时通话提示不再重复长标签列表。
- 三文件基线哈希保护、bridge 语法检查通过；确认无活跃模型/聊天/通话后备份并仅重启 bridge。备份后缀 `.bak-voice-tags-free-20261025-144610`，上线三文件哈希一致。工作脚本 `D:/阿晏/work/eleven-v4-20261025/refine-tags.py`，远端暂存 `/root/ayan/eleven-v4-20261025/tags-refined`。未发起额外合成/模型请求；标签实际使用频率和效果待自然对话观察。新 Voice ID 和 eleven_v4 保留，前端未改。

## 2026-10-25 ElevenLabs 新音色、v4 与语气标签（已上线）

- 用户授权先完成声音部分：Voice ID `gBcsEx3YDazONRqNBafR`（现有账号可读，名称“1111111阿晏”），TTS 从 `eleven_v3` 换成 `eleven_v4`。普通语音条、听语音与通话共用服务，均使用新配置。此处 v4 指配音模型，不涉及主聊天模型。
- 官方 models 文档和账号 GET /v1/models 均确认 v4 存在。按 v4 官方接入文档，将后端上游普通/流式请求改为 `/v1/text-to-dialogue` 和 `/v1/text-to-dialogue/stream`；body 使用单个 `inputs[{text,voice_id}]` + `model_id`，显式 MP3 输出；不把旧 TTS 的 voice_settings 格式直接套到新接口。前端 `/api/tts*` 地址保持兼容。
- 更新全局 `/root/ayan/CLAUDE.md` 的声音规则、home project 的通话规则及 bridge 的 CALL_RULES：允许自然选用官方音频标签，如 `[softly]`、`[whispers]`、`[laughs]`、`[sighs]`、`[curious]`、`[playful]`、`[excited]`、`[slowly]`、`[pause]`；标签用于 VOICE 内发声稿或通话英文正文，不写入 ZH 翻译，不改变控制标签，不要求每句添加、不自动随机插标签。明确发声标签与禁止的文字动作描写不同。规则从下一次模型调用加载；未主动发起聊天验收使用频率。
- 缓存键原有 voice/model/text 区分继续生效，旧音频未删除；固定保存旧音频地址的收藏仍指向旧文件。普通旧文字若重新请求合成，会按当前新 voice/model 取音频；不承诺所有历史语音都锁定旧音色。
- 真正调用一次新 v4 流式接口，短样音 `[softly] I'm here, baby.` 返回 HTTP200、audio/mpeg、25,121 bytes。样音缓存 `/tts/c0b6fd8e7a3135cb9e69.mp3`。未向聊天写入假消息或发送通知；该次验证产生少量 ElevenLabs 合成用量。听感和不同标签的表现仍待用户试听；没有逐标签测试。
- 发布前确认无活跃模型进程/聊天/通话；三个文件基线 SHA256 保护、桥语法检查通过，备份后仅重启 bridge。备份后缀 `.bak-eleven-v4-20261025-143918`。上线三文件哈希一致，实际 `/api/tts/url` probe 返回新配置对应的样音缓存地址，health200、queue0、alerts=[]。前端基线核实干净 HEAD `a955bb47bfb6143dffd36ded1ae30fa5934836f5`，未改前端/推Git/发TestFlight。
- 工作记录 `D:/阿晏/work/eleven-v4-20261025` 仅有精确替换与发布脚本；源码与凭据留在 VPS `/root/ayan/eleven-v4-20261025`。一次整段源码读取被自动审批拒绝（可能输出内嵌凭据），已改用服务器内精确替换、只回传哈希的方式完成。
- 参考：https://elevenlabs.io/docs/overview/models/ 、https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert 、https://elevenlabs.io/docs/api-reference/text-to-dialogue/stream 、https://elevenlabs.io/blog/elevenlabs-audio-tags-list 。原生来电、开口打断、声纹验证仍待后续，不能把讨论记为实现。


## 2026-10-25 按需规则与小螃蟹控制已发布

- 前端源码34320a682cda0950ebfaa4039edc0869b6255fa7，入口index-Gyr4XG6v.js / index-BEwBP4tu.css，备份/root/ayan/backups/companion-20261025-140711。5个相关源码文件和两份私有规则的基线SHA均核对通过；未改home/src或后端、未重启聊天、未写生产假聊天。两份规则原文仅在私有备份instructions/保存，不提交前端Git。
- 已实际替换/root/ayan/CLAUDE.md与projects/home/CLAUDE.md：猫狗/小窝、猫兔、Mind/Thought/Desire按需查阅；取消@nest.md自动全文引用，保留短索引；取消仅因压缩恢复就重读Mind设计的要求；保留Desire改写前最新updated_at检查。猫兔设计原文件未改。小螃蟹白名单控制用法已写入根规则，按同一规则加载路径跨压缩恢复，不只靠聊天口头说明。
- 线上新构建模拟SSE回归通过：分块标记隐藏、完成时动作、其他会话过滤、灰色离线优先/恢复、图鉴独立、爱意、reset重写/错误、旧历史不重播、减少动态。已看动作截图。health200、queue0、alerts0。原菜单编辑/听语音/重答/召回/原版在本地相同源码回归通过。没有发真实模型测试消息，不能宣称模型已实际使用标记或一定遵守每一次按需阅读。
- 自动TestFlight39 run40200751615，记录时in_progress，未核实上传：https://github.com/wanyingsun357-ship-it/ayan-home-app/actions/runs/40200751615 。App重开可载入网页功能。后续需真机观察实际模型动作提示、长时待机和后台恢复；通用工具级实时事件仍未新增，指定coding只是表情。


## 2026-10-25 按需查阅与正式小螃蟹控制

- 以线上干净6361d70为基线，work/companion-20261025隔离修改5个前端文件；未触碰有其他窗口改动的home/src。root CLAUDE与home项目CLAUDE两份真实规则另外保存基线SHA，私有原文不提交前端Git。
- 规则修改准备：猫狗/小窝、猫兔、Mind/Thought/Desire的详细设计和说明按需查阅，不把每轮或仅压缩恢复当作重读理由；取消home项目@nest.md全文自动引用，改短索引。保留Desire改写前读取最新updated_at；猫兔设计文件本身不改。加入小螃蟹简短用法并随根规则加载。
- 正式前端接入助手独立行<clawd anim="动作"/>白名单提示，流式期间隐藏未完成标记，完成后短播约6.5秒回待机；引用/代码/语音中的示例不执行，用户文字不触发。只据助手正文/助手触碰做保守情绪联动；请求和流式期间保持思考，不再把全部等待画成敲键盘。掉线跟原online同源优先变灰冻结，图鉴独立，旧历史不重播，不允许标记伪造offline/error。
- 使用已有19种普通动作及love别名；真实SSE错误短播难过，45–90秒低频自然待机；减少动态冻结帧。显式coding/terminal只是表情，不冒充真实工具状态。工具开始/结束的通用事件桥本轮未新增，无后端重启。
- 构建、解析单测、浏览器模拟SSE检查通过：分块隐藏、完成时播放、其他会话隔离、掉线/重连、图鉴独立、爱意、重写reset/错误、旧消息不重播、减少动态；原菜单编辑/听语音/重答/召回/原版控件回归通过。无生产假聊天、无测试模型调用。实际发布和规则替换结果另记。


## 2026-10-25 无底色附文与正向羽毛已发布

- 发布源码8265a1682e67855a064e2cf3d1e936af9c93b213；网页入口index-D5H_Ti9i.js / index-BEwBP4tu.css；备份/root/ayan/backups/chat-tone-20261025-132847。单个CSS文件SHA、基线36c67e2、origin与干净状态核对通过，保留旧资源和数据，未重启后端。
- 线上模拟消息截图检查完成：voice-script/touch-line背景均rgba(0,0,0,0)、边框0；文字分别#68452e/#795034；羽毛按钮无旋转，图案调直居中，羽毛收段后正常。无页面异常。health200、queue0、alerts0。未用真实聊天做测试。
- 自动触发TestFlight38 / run40197800782，记录时in_progress，尚未核实上传；https://github.com/wanyingsun357-ship-it/ayan-home-app/actions/runs/40197800782 。本次仅网页样式，现有App重开可载入；不需等待新安装包。后续核实构建结果时再补充，不能宣称38已上传。


## 2026-10-25 语音附文与拍一拍改为无填充层次

- 基于线上干净36c67e2，独立work/chat-tone-20261025，只修改orange-chat-finish.css。用户要求语音下方文字/拍一拍取消填充色；现已移除底色/边框/卡片阴影，改暖棕字、较小字号与名字字重区分层次。语音播放条保持奶油底。
- 羽毛偏斜来自按钮8度旋转叠加原图案倾角；按钮摆正居中，SVG抵消26度倾角，待机仅上下轻浮；收段轻扫/落羽保留。
- 构建通过，用模拟语音和触碰消息查看截图，确认两处背景透明/无边框，羽毛按钮无旋转，收段正常、无页面异常。未改业务逻辑，不新增镜像测试，不写生产数据。发布结果另记。


## 2026-10-25 玻璃待办 / Chat修正已上线，TestFlight 37已上传

- 发布源码4d501cb717cc44fdcb64d54d471acca50a7c3d0e；入口index-C1iws6Oj.js / index-Du5Z3KNC.css。备份/root/ayan/backups/chat-finish-20261025-130720；基线bb4099a、origin、干净状态与5个文件SHA核对通过。未改home/src、后端或生产数据，旧资源保留。
- 线上实际构建的模拟API回归通过：真实形状玻璃清单、首页摘要、跨月新增/失败保稿/完成；本段/整条复制与原生文本选区、收藏取消、回复、编辑、听语音、重答与召回备注处理；引用/拍一拍/系统/Toast对比、线描羽毛与落羽、7片花瓣、小云朵和加号；320宽度、减少动态、原版控件检查。已查看有内容截图。health200、queue0、alerts0。所有业务写请求被本地模拟拦截。
- TestFlight37 / run40196183681 / job121177393049 success；Fastlane日志13:11:51 UTC确认Successfully uploaded the new binary to App Store Connect。IPA artifact12600526394。https://github.com/wanyingsun357-ship-it/ayan-home-app/actions/runs/40196183681 。Apple处理、测试人员可见性和安装尚未核实。
- iPhone原生选字/录音权限与实际服务音频仍需真机确认；浏览器选区及接口模拟不等于端到端验收。当前App重开可载入线上网页，未新增原生插件。


## 2026-10-25 玻璃待办与 Chat 最后细节

- 线上干净bb4099a为基线，独立work/chat-finish-20261025，仅5个前端文件；保护home/src。To do改回预览式居中定高440px玻璃清单，事项/日期/新增/月历内部滚动，首页显示未完成事项摘录与日期（包含未来计划）。连接原GET/POST/toggle/DELETE，失败保留草稿，不乐观吞错。原API只支持新增日期、完成、删除；未添加改既有日期或无日期的新后端能力。Today维持上一轮业务。
- Thinking小云SVG缩至14px、点击范围28px；加号米白。羽毛补齐线描描边、浮动/轻扫/落羽，猫爪按预览34px按钮；发送7片花瓣向下慢落，减少动态不播。引用一行姓名+摘录，拍一拍/系统分隔/取消等Toast奶白底深棕字。
- 暖橘长按菜单补复制整条与选中本段/整条（原生可选文字区），自己的收藏可从长按取消；保留回复、语音、编辑、重答和召回备注原处理。原版主题操作保持。
- 构建通过；本地全模拟API验证有内容玻璃待办、跨月日期新增/失败保稿/完成、首页摘要同步，复制本段/整条/原生文本选区/收藏取消/回复，羽毛/花瓣/云朵/提示颜色，320宽度与减少动态。长按编辑、听语音、召回备注、重新回答原请求与原版控件检查通过；已看有内容截图。无生产假数据。发布结果另记；iPhone原生选字/录音和实际服务端到端仍未以模拟验证替代。


## 2026-10-25 第二轮修正发布结果 / TestFlight 36

- 源码efaa7e306613e486d44d9f2fe9ab9a9a3f926cd4已发布。入口index-DfbwY3JI.js / index-3CUS7Peq.css；备份/root/ayan/backups/ui-details-20261025-123054。发布前HEAD/origin/干净状态和七文件SHA核对通过；保留旧资源，未动后端和生产数据。
- 线上新构建模拟API回归通过（一次网络加载超时，延长导航等待重试通过）：主页分离面板/云朵猫咪、分段、水位图鉴、Thinking、工具路由、Moments/Diary导航、320/390通话、录音取消/草稿、原版回归；More/待办模拟POST/录音提示另测通过。日记锁定与最近列表的紧凑间距在本地同源码320宽度通过。真实health200、queue0、alerts0。
- TestFlight36 run40193454508/job121169169985 success；日志12:34:38 UTC确认 Successfully uploaded the new binary to App Store Connect；IPA artifact12599156722。Apple处理/测试人员可见性/安装尚未核实。https://github.com/wanyingsun357-ship-it/ayan-home-app/actions/runs/40193454508
- iPhone长按选字放大镜、键盘聚焦与实际音频权限/收音仍待真机确认，不能以浏览器模拟宣称完成真机验收。没有新增原生插件。当前App仍载入线上网页。


## 2026-10-25 第二轮真机遗漏修正

- 基于线上干净1532d9b，独立work/ui-details-20261025修改7个源码文件；未碰home/src。暖橘云图标使用已确认预览路径并居中，分段改奶白单行/选中浅粉，去旧呼吸渐变。小螃蟹打开真实tokens/limit水位、模型名及20动作独立预览，压缩/衔接沿用原处理。
- Today/To do分开居中定高面板，共用原Home数据与待办/日历逻辑；Today保留Together概览，To do保留Today/Upcoming和日历。主页云朵只反馈，猫咪星心动画约700ms后进Chat。More改居中暖玻璃分行菜单，所有原入口保持。修正两组Diary被重复加110px底部空白。
- 长按输入框提前阻止原生touchstart默认选字，短触抬手聚焦，pointercancel/隐藏取消录音；准备中/发送/取消改深棕提示。浏览器模拟不等于iPhone选字、权限、键盘、实际收音验收，仍需真机。
- 本地构建与模拟API检查通过：Today/To do/More展开、待办POST、云朵不导航/猫咪进Chat、分段、动作翻页、水位、录音取消/草稿与对比、原版与通话回归；已看展开截图。无生产测试写入。发布结果另记。


## 2026-10-25 暖橘遗漏修复已发布 / TestFlight 35 已上传

- 已发布源码 f6ddb6c12091da5d293e3cf3a603906be9ec26d3（基线31f42b0，发布前远端与origin干净一致；5个源码文件逐项SHA核对）。网页入口 index-C5w9pSkN.js / index-CQYZT_rM.css。备份 /root/ayan/backups/orange-polish-20261025-120037；保留旧资源，未重启后端或写生产测试数据。
- 线上实际构建通过模拟接口回归：语音深棕对比度、顶栏移除、羽毛收段、小螃蟹水位、Thinking居中、加号搜索/模型/会话/碰一碰/Home、Moments/Diary导航；320/390通话布局、打字POST、静音恢复、收起/返回/挂断、来电左接右拒；长按录音启动/上滑取消/草稿保留、短按不录、左右边缘手势，以及原版顶栏/模型/语音入口保留。零页面异常。已查看有内容的截图。线上health HTTP200、queue=0、alerts=0。
- TestFlight build35 / run40191262262全部success；Fastlane日志12:04:21 UTC确认 Successfully uploaded the new binary to App Store Connect；IPA工件12598347233保存成功。Apple处理与测试人员可见性、设备安装尚未核实。链接：https://github.com/wanyingsun357-ship-it/ayan-home-app/actions/runs/40191262262 。
- 用户现有App仍通过server.url载入线上网页，重载即可获取这批视觉修正。新包未改原生音频/通知插件。iPhone录音权限/长按时系统选中行为、边缘系统返回手势、安全区与实际听筒/蓝牙仍待真机体验确认；浏览器模拟不等于真实服务音频端到端验收。
- 本轮工作副本 work/orange-polish-20261025；基线 work/orange-polish-base-31f42b0；验证脚本 check-polish.cjs（所有/api模拟）、check-health.cjs（只读健康）。本地home/src未碰。此前“待发布”条目由本条覆盖。


## 2026-10-25 用户真机反馈：暖橘遗漏补齐

- 以线上干净31f42b0为基线，新工作副本work/orange-polish-20261025；没有改home/src其他窗口文件。首轮仅换色未完成Chat顶栏/工具位置、Thinking、通话和Moments底栏，用户真机反馈后本轮补结构。
- 暖橘移除Chat整行旧顶栏和水位细线；加号保留原附件功能，加入Calling/搜索/模型/碰一碰/会话/Home；羽毛移底部、小螃蟹点击水位及独立提醒；输入框长按录音、短按不录、保留草稿；左右边缘手势分别Home/原会话抽屉。语音条奶油底深棕播放/声波/时长，转写有独立底色。
- Thinking改居中奶油云卡，保留真实ThoughtTimeline；Moments/Diary底栏改悬浮胶囊、手绘图标并保留5个路由与Diary红点。通话暖橘来电/拨出改玻璃邀请卡、移除旧猫头像、左接右拒、操作键提升对比；现有字幕/打字静音/收起/结束流程保持。
- 构建通过；浏览器模拟接口检查羽毛/水位/搜索/模型/会话/碰一碰/导航/通话打字静音及收起挂断/来电左右、320与390宽度，已看截图。未向生产写入测试数据。长按录音测试检查启动/取消/草稿保留，不等于iPhone音频端到端验证。
- 发布状态：待本轮发布结果补充。iPhone长按录音、边缘系统手势、安全区、音频路由仍需真机验证；没有新增CallKit/Live Activity，不承诺所有历史设计逐像素完成。


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
