# dsh-find

在 DSH 里按下 **Ctrl+F**（macOS 用 ⌘F），弹出全局查找面板：输入文字就遍历**所有工作区、所有对话**，
本地找出包含该文字的对话，命中结果分左右两栏显示 —— 左边是**思考链**，右边是**对话文本**（用户消息、
助手回复、工具输出），整段显示并高亮关键词，点击结果直接跳到那段话所在的位置。

**搜索全程本地执行，不调用任何模型，不消耗 token。**

## 用法

| 操作 | 说明 |
| --- | --- |
| `Ctrl+F` / `⌘F` | 打开查找面板。若页面上有选中的文字，会先用它作为关键词 |
| `/find-text 关键词` | 在对话输入框里发这条指令，直接打开面板并开始查找该关键词（不经过模型） |
| 输入文字 → `Enter` 或点蓝色「查找」按钮 | **手动触发查找**：打字不会自动搜，避免半截关键词就扫全部对话 |
| 勾「隐藏已归档」 | 结果里不再列出已归档对话的命中（默认不勾，即照常显示并排在最后） |
| 点击命中条目 | 跳到该段话所在的位置（面板里没有键盘选择，也没有切栏操作） |
| `Esc` / 点遮罩 | 关闭面板 |

## 结果怎么显示

- 面板分左右两栏：左栏标题 **思考链**（模型 reasoning 块里的文字），右栏标题 **对话文本**
  （用户消息、助手输出、工具结果）。两栏同时显示、各自独立滚动，标题上显示该栏命中数；
  两栏都只靠鼠标点击结果跳转，没有键盘选择，也没有切栏操作。
- 每栏内**一个工作区一张卡片**，卡片之间留小间隔：卡片头是工作区名 + 该工作区命中数；
  卡片内再按对话分节（对话标题 + 该对话命中数），节下面是命中段落。
- 每条命中显示**命中所在的整段**（按空行分段）；段落比窗口允许的长度更长时，以命中为中心截取窗口并加省略号，
  保证不会撑爆面板。
- 字数上限随窗口高度自适应：约 `窗口高度 / 2.6`，夹在 200–900 字符之间。
- 关键词用 `<mark>` 高亮。
- **已归档的对话**照样会被找到：对话标题后带一个红字「已归档」标签，并且这些对话排到卡片底部、整张只含归档对话的卡片排到最底部。
  归档对话在界面上不会被挂载出来，所以点它不会跳转，面板底部会给出提示；先取消归档再点即可。

## 点击之后发生什么

1. 切到命中所在的工作区/对话（`uiWorkspace.openSession`）；
2. 把会话事件加载到命中的那条消息（`sessions.using` + `ISession.loadThrough(seq)`）；
3. 在页面上轮询找到这段文字的可见节点，滚动到视口中央并脉冲高亮 4 秒。

## 实现

- **Host 半**（`index.js`）：注册同源路由 `GET /dsh-find/search`（先 `GET /dsh-find/health` 可探活，返回 `version: 3`）。
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
- **命令桥**（`/find-text`）：命令只能在 Host 半注册（`ctx.commands.register`），而面板在页面里，
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

## 安装

先从 GitHub 取一份源码（或直接用本地工作副本）：

```bash
git clone https://github.com/A-2788553793/dsh-find.git
```

再把它以 source link 方式装进当前 profile：

```bash
plugin_manager install_bundle  <克隆下来的 dsh-find 目录>

# 改过代码要重装：先移除再安装（重复 install 会报 already-installed）
plugin_manager remove_bundle  dsh-find
plugin_manager install_bundle  <克隆下来的 dsh-find 目录>
```

装/重装后刷新一次页面（Client 半的 JS 由 bundle 提供）。

## 已知边界

- 只在**会话事件**里搜（用户消息、助手消息、工具结果），不含压缩摘要之外的隐藏状态。
- 工具调用的参数（`{type:'tool-call'}` 块）不参与匹配，避免搜到一堆命令噪音。
- 命中定位依赖文字真的出现在页面上；若目标对话被虚拟列表折叠得很远，`loadThrough` 之后仍需滚动加载，
  轮询 7 秒仍未找到时只完成跳转、不高亮。
- 已归档的对话能搜到但打不开（界面不挂载它），点击只在面板底部给提示、不跳转；它们也总排在结果最后。
- 面板本身是 `shell.overlay` 的常驻占用者，未打开时渲染 `null`。
