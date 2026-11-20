# dsh-find 开发参考与更新历史

如果你只想知道怎么使用插件，请看 [新手指南](README.md)。

## 实现

- **Host 半**（`index.js`）：注册同源路由 `GET /dsh-find/search`、`GET /dsh-find/media`，
  以及媒体文件回传 `GET /dsh-find/media/attachment`、`GET /dsh-find/media/file`，
  以及懒加载用的 `GET /dsh-find/media/tree`（只列工作区/对话）、`GET /dsh-find/media/session?id=`（只读一个对话），
  以及右键菜单用的 `GET /dsh-find/media/reveal?id=`、`POST /dsh-find/media/delete?id=`
（先 `GET /dsh-find/health` 可探活，返回 `version: 6`）。
  搜索用 `ctx.sessionQuery`：
  - `listSessions()` 拿到全部会话（跳过 `origin === 'subagent'` 的子代理会话）；
  - 每个会话 `filterEvents(id, [{kind:'text', text}, {kind:'type', values:[...]}])` 先用索引判断有没有命中；
  - 命中的会话再 `readSession(id)` 取原始事件，从 `message.content` 里按块拆分：
    `{type:'reasoning'}` → `channel:'thinking'`，`{type:'text'}` → `channel:'conversation'`。
    这样每条命中都带 `channel`，前端才能分栏（索引里的 `text` 是 JSON 序列化，无法区分块）；
  - `readTitleSnapshots()` 补对话标题，`ctx.workspaceRegistry.list()` 用 `cwd` 匹配工作区名称；
  - `ctx.workspaceRegistry.archivedSessionIds`（登记表全局的归档集合）给每条命中打 `archived` 标记，
    并把归档会话整体排到普通会话之后；
  - 8 路并发；客户端断开（`res.on('close')`）时用 `AbortController` 取消。
- **Client 半**（`client.js`）：只用 `fetch` 调上面的路由，UI 挂在 `shell.overlay` 槽位（id `dsh-find-dialog`），
  键盘捕获挂在 `document` 的 `keydown`（捕获阶段，`preventDefault` 掉浏览器原生查找）。
- **命令桥**（`/find-text-ui`）：命令只能在 Host 半注册（`ctx.commands.register`），而面板在页面里，
  所以用一个长轮询把手：
  1. 命令 handler 把 `{seq, query, at}` 写进 Host 内存队列（`publishFind`）并返回一条成功提示；
  2. Client 半启动 `startPendingPoll()`，请求 `GET /dsh-find/pending?since=<seq>`；
  3. 服务端没有新请求就把这条 HTTP 请求挂起最多 20 秒，有新请求立即返回；`at` 超过 60 秒的旧请求不再下发，避免刷新页面时重放；
  4. 页面收到 `query` 就调 `openPaletteWith(query)` 打开面板并开始搜索。

  整个过程没有任何模型调用。

### 返回结构

```jsonc
{
  "query": "...", "tookMs": 1291, "sessionsScanned": 27, "sessionsMatched": 4,
  "counts": { "thinking": 3, "conversation": 3 },
  "truncated": false,
  "truncatedChannels": { "thinking": false, "conversation": false },
  "archivedHits": 4,
  "totalHits": 6,
  "hits": [
    { "sessionId": "...", "title": "...", "workspaceTitle": "插件", "archived": true,
      "seq": 412, "type": "assistant/message", "role": "assistant",
      "channel": "thinking",          // thinking | conversation
      "snippet": "...", "occurrences": 2,
      "clippedStart": false, "clippedEnd": true }
  ]
}
```

### 查询参数

`GET /dsh-find/search?q=<关键词>&maxChars=420&perSession=3&total=150`

| 参数 | 默认 | 范围 | 含义 |
| --- | --- | --- | --- |
| `q` | — | ≤ 200 字符 | 关键词（空则返回空结果） |
| `maxChars` | 420 | 120–2000 | 每条命中片段的字数上限 |
| `perSession` | 3 | 1–12 | 每个对话**每栏**最多展示几处命中 |
| `total` | 150 | 1–400 | 每栏命中上限（超过则 `truncated: true`） |

### 媒体接口

`GET /dsh-find/media?total=400` 会逐个会话 `readSession()` 扫一遍媒体，返回：

```jsonc
{
  "tookMs": 3674, "sessionsScanned": 32, "sessionsMatched": 16,
  "total": 282, "truncated": false,
  "counts": { "user": 17, "assistant": 265, "image": 277, "video": 5 },
  "items": [
    { "sessionId": "...", "title": "...", "workspaceTitle": "插件", "archived": false,
      "kind": "image",            // image | video
      "speaker": "user",          // user | assistant
      "source": "attachment",     // attachment = 日志里的 image 块；file = 文本里的本地路径
      "name": "screenshot.png", "mediaType": "image/png", "bytes": 66356,
      "width": 1280, "height": 720,
      "seq": 42, "type": "user/message",
      "url": "/dsh-find/media/attachment?sha=<hex>" }
  ]
}
```

`GET /dsh-find/media/file?path=<绝对路径>` 与 `GET /dsh-find/media/attachment?sha=<hex>`
只接受媒体扩展名 / 64 位 hex，文件不存在返回 404，超过 600 MB 返回 413。

### 文件接口

- `GET /dsh-find/files/tree`：列出工作区和对话，不扫描对话正文。
- `GET /dsh-find/files/session?id=<对话 ID>`：读取一段对话，返回 `{ items, truncated }`。每项包含 `id`、`name`、`speaker`、`kind` 和 `canReveal`。每段对话最多返回 1000 项。
- `POST /dsh-find/files/reveal?id=<文件 ID>`：在 Windows 宿主上打开文件所在目录。浏览器只传宿主发给它的文件 ID，不传本地路径。

## 更新日志

### 0.4.0

- 新增「文件」页：按工作区和对话浏览上传、创建和交付过的文件，包括图片和视频；可筛选来源、隐藏归档和媒体，点击文件名在 Windows 宿主上打开所在目录。
- 修改文本关键词时清除旧结果，避免把上一轮搜索的结果误当成新关键词的结果。
- README 重写为新手指南，接口细节和旧版更新日志集中到开发参考。

### 0.3.11

- **设置页新增「查找」**：DSH 设置左栏多一项「查找」，里面三张卡片 —— **跟随DSH（默认）/ 深色 / 浅色**，点一下面板立刻换色，打开着的面板也会当场变化。
- 选择保存在 `$DSH_HOME/storages/dsh-find/settings.json`（新增 `GET/POST /dsh-find/settings` 接口），重启 DSH 后仍然有效；宿主尚未更新时先在浏览器里记住，等新版本加载后自动写进配置。
- 深色 / 浅色各自重排了一整套面板 token（底栏、卡片、边框、文字、命中高亮、黑色按钮），不再只能跟着 DSH 当前的系统主题走。

### 0.3.10

- **修复深色模式下的配色**：命中关键词的高亮块和黑色「查找」按钮原本是白底白字（深色主题里 `brand-primary` 就是白色），文字根本看不见；现在文字色跟随面板基色，深浅两种主题下都清晰。
- 「用户 / AI / 工具 / 系统」来源徽章与筛选 chips 原来用写死的深色色码，在深灰面板上对比不足；改用 `color-mix` 与主题底色混合，深色下更亮、浅色下更稳。
- 面板整体配色按 DSH 原生色阶重排：面板底 `bg-layer-1`(#232324)、底部状态栏 `sidebar-fill`(#1b1b1c)、结果卡片 `bg-base`(#151517)、选中页签 / 按钮 / 右键菜单 `bg-layer-2`(#2c2c2e)。层次由浅到深，不再是一整片中灰。

### 0.3.9

- **删除斜杠命令 `/find-text`（文本回复版）**。原因：文本回复本身就是一次 AI 对话，要消耗 token；
  查找结果改为统一走 UI 面板（`Ctrl+F` / `/find-text-ui`），纯本地渲染、零 token。
- 移除 0.3.8 为它加的自定义命令卡片渲染（`conversation.chat.commandview` 里的 `find-text` 槽位），命令只剩 `/find-text-ui` 一条。
- `find_text` 工具保留：扫描零 token，只有返回的报告会进上下文，供模型在需要时自查。

### 0.3.8

- `/find-text 关键词` 的结果改用自己的聊天卡片渲染（接管 `conversation.chat.commandview` 里 `find-text` 这一格）：工作区一节、对话一张小卡、每条命中一行，带来源徽章和正常行高，不再是挤成一行的小灰字 + 可展开的 `<pre>`。默认展开，点标题行可收起。
- 报告首行改短（只放「找到 N 处、涉及 M 个对话」），扫描耗时与截断提示挪到第二行。

### 0.3.7

- 新增 agent 工具 **`find_text`**：模型可以自己调用本地索引，参数 `query` / `maxChars` / `perSession` / `total`，返回按工作区、对话分组的文本报告（含思考链 / 对话文本、说话人、seq、是否归档）。
- 新增斜杠命令 **`/find-text 关键词`**：同样的文本报告，直接在对话里回复；`/find-text-ui` 仍然负责打开窗口。
- 文本报告默认更紧凑：每条片段 220 字符、每个对话每栏 2 条、总共 40 条。

### 0.3.6

- 斜杠命令 `/find-text` 改名为 **`/find-text-ui`**（避免和别处注册的同名命令冲突）。旧的 `/find-text` 不再注册。

### 0.3.5

- 图片/视频页：「一键展开」和「重新扫描」之间新增「一键折叠」，一次收起所有工作区与已加载的对话。

### 0.3.4

- 图片/视频页：已加载的对话可以**点击收起/展开**缩略图（行首 ▾ / ▸ 指示状态），收起不重新读日志。

### 0.3.3

- 修复媒体页右键菜单失效（0.3.2 重构时误删了菜单相关函数，菜单打不开、两项都点了没反应）。
- 右键菜单新增**「另存为…」**：用系统保存对话框把文件复制到自选位置；不支持时退化为普通下载。

### 0.3.2

- 图片/视频页改成**懒加载**：打开页面只列工作区，点工作区才展开对话、点对话才读取那一个对话的媒体，
  没有媒体时显示「无」；新增「一键展开」按钮（等价于旧版的整页扫描）。
- 新增路由 `GET /dsh-find/media/tree` 与 `GET /dsh-find/media/session?id=`；`/health` 的 `version` 升到 6。

### 0.3.1

- 媒体页缩略图支持**右键菜单**：「打开文件所在位置」（资源管理器里选中文件 / 打开附件目录）与「删除」（红字，二次确认）。
- 删除只允许作用于插件这次扫描真实列出过的本地文件（按 `id` 白名单，路径不来自浏览器）；对话附件拒绝删除，避免破坏会话历史。

### 0.3.0

- 新增**标签页**：面板顶部多了「文本」与「图片/视频」两个页签，Ctrl+F 仍默认打开「文本」。
- 新增**图片/视频页**：把本机所有对话里出现过的图片和视频列成缩略图墙，按工作区卡片分组，
  每个缩略图标出是「用户」发的还是「AI」生成的；支持「只看用户 / 只看 AI」与「隐藏已归档」，
  点缩略图放大（视频可直接播放），头部按钮区可重新扫描。
- 新增路由 `GET /dsh-find/media`、`GET /dsh-find/media/attachment?sha=`、`GET /dsh-find/media/file?path=`；
  `/health` 的 `version` 升到 4。

### 0.2.0

- 新增**来源标注**：右栏每条命中带徽章 —— 蓝「用户」、绿「AI」、紫「工具」、琥珀「系统」。
  系统注入（长期记忆、runtime context、技能目录、复盘任务等）同样以 user 消息入库，
  这里按消息的 `source.kind` 判定，只有真正由人输入的消息才算「用户」。
- 新增**来源筛选**：右栏标题旁「用户 / AI / 工具 / 系统」四个标签，默认全亮，点一下隐藏该来源；
  纯前端过滤，不重新搜索，左栏思考链不受影响。
- 变更：徽章文案「你」改为「用户」；AI 来源从灰色改成绿色，四种来源各有一种颜色。

### 0.1.0

- 首个版本：Ctrl+F 全局查找面板、思考链 / 对话文本双栏、整段展示与高亮、点击跳转定位、
  卡片式工作区分组、已归档对话标注与置底、`/find-text-ui` 命令、隐藏已归档开关、手动「查找」按钮。
