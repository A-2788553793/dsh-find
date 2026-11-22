window.__ModuleLoader__.load({
  id: 'dsh-find',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-find';
    const ROUTE = '/dsh-find';
    const DIALOG_ATTR = 'data-dsh-find-dialog';
    const MAX_QUERY = 200;
    const DEBOUNCE_MS = 200;
    const TOTAL_HITS = 120;
    const PER_SESSION = 3;
    const FLASH_CLASS = 'dsh-find-flash';
    const HIT_HIGHLIGHT = 'dsh-find-hit';
    const HIT_DURATION_MS = 3000;
    // Paired colors keep syntax-colored and linked text readable in both themes.
    const JUMP_CSS = [
      '::highlight(' + HIT_HIGHLIGHT + '){background-color:#ffe066;color:#1b1b1b;text-shadow:none;}',
      '.' + FLASH_CLASS + '{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px;border-radius:8px;}',
    ].join('');
    const MEDIA_TOTAL = 800;
    const FILES_CONCURRENCY = 4;
    const SPEAKER_LABELS = {
      user: 'speakerUser',
      assistant: 'speakerAssistant',
      tool: 'speakerTool',
      system: 'speakerSystem',
    };
    const SPEAKER_ORDER = ['user', 'assistant', 'tool', 'system'];

    const DICTS = {
      zh: {
        title: '全局查找',
        placeholder: '输入要查找的文字，回车跳转…',
        empty: '输入文字后按 Enter 或点「查找」开始。',
        ready: '按 Enter 或点「查找」开始查找。',
        searching: '正在本地查找…',
        noResults: '没有找到匹配的对话',
        noResultsHidden: '没有可显示的命中：另外 {count} 条都在已归档对话里（已按你的选择隐藏）',
        results: '{count} 处命中 · {sessions} 个对话',
        occurrences: '{count} 处',
        ungrouped: '未归属工作区',
        elapsed: '{ms} ms',
        truncated: '结果较多，仅显示前 {count} 条',
        hint: 'Enter 或点「查找」开始 · 点结果跳转 · Esc 关闭',
        failed: '查找失败：{message}',
        search: '查找',
        hideArchived: '隐藏已归档',
        hideArchivedHint: '勾选后结果里不再列出已归档对话的命中',
        thinkingTitle: '思考链',
        conversationTitle: '对话文本',
        paneEmpty: '此栏没有命中',
        tabText: '文本',
        tabMedia: '图片/视频',
        tabFiles: '文件',
        filesHint: '展开工作区和对话 · 点文件名打开所在文件夹 · Esc 关闭',
        filesOutline: '{workspaces} 个工作区 · {sessions} 个对话 · 已加载 {loaded} 个文件',
        filesCount: '{count} 个文件',
        filesTreeEmpty: '没有找到工作区或对话。',
        filesEmpty: '这个对话没有文件。',
        filesFiltered: '没有符合当前筛选条件的文件。',
        filesTruncated: '只显示了部分文件。',
        filesExpandAllHint: '读取当前可见的所有对话并载入文件（可能较慢）',
        filesRefreshHint: '清除文件缓存，重新读取工作区与对话列表',
        filesHideMedia: '隐藏图片/视频',
        filesRetry: '重试',
        filesTreeFailed: '读取文件目录失败。',
        filesSessionFailed: '读取文件失败。',
        filesReveal: '打开所在文件夹',
        filesRevealing: '正在打开文件夹…',
        filesMissing: '找不到文件，可能已被移除。',
        filesUnavailable: '此文件无法在本机定位。',
        filesRevealFailed: '无法打开所在文件夹，请重试。',
        mediaSummary: '{count} 个媒体 · {sessions} 个对话',
        mediaCount: '{count} 个',
        mediaEmpty: '还没有找到图片或视频。',
        mediaLoading: '正在扫描本机媒体…',
        mediaRefresh: '重新扫描',
        mediaHint: '点工作区/对话可展开收起 · 点缩略图放大 · Esc 关闭',
        mediaVideo: '视频',
        mediaRefreshHint: '重新读取工作区与对话列表（不会读取对话内容）',
        mediaOutline: '{workspaces} 个工作区 · {sessions} 个对话 · 已加载 {loaded} 个媒体',
        mediaCollapseAll: '一键折叠',
        mediaCollapseAllHint: '收起所有工作区和对话，只留下目录（不重新读取）',
        mediaExpandAll: '一键展开',
        mediaExpandAllHint: '读取全部对话，载入所有图片和视频（较慢）',
        mediaExpanding: '展开中…',
        mediaTreeLoading: '正在整理工作区与对话…',
        mediaReading: '读取中…',
        mediaReadFailed: '读取失败，点一下重试',
        mediaNone: '无',
        mediaPartial: '仅显示部分，点击读取完整列表',
        mediaSessionCount: '{count} 个对话',
        mediaCountTwo: '{count} 个媒体 · {sessions} 个对话',
        mediaNoSessions: '这个工作区没有对话',
        mediaLoadedTotal: '已加载 {count} 个媒体 · {sessions} 个对话',
        archivedBadge: '已归档',
        speakerUser: '用户',
        speakerAssistant: 'AI',
        speakerTool: '工具',
        speakerSystem: '系统',
        speakerFiltered: '没有可显示的命中：{count} 条已按来源筛选隐藏',
        jumpLoading: '正在定位原消息…',
        jumpMessage: '已定位到原消息；具体文字可能被折叠或格式化。',
        jumpFailed: '未能定位原消息，请重新查找后重试。',
        jumpDismiss: '关闭提示',
        archivedNotice: '这个对话已经归档，不能跳转。可以在侧栏的归档列表里取消归档后再试。',
        menuSaveAs: '另存为…',
        savedAs: '已另存为 {name}',
        savedDownload: '已下载到默认下载目录：{name}',
        saveFailed: '另存为失败',
        menuReveal: '打开文件所在位置',
        menuDelete: '删除',
        menuDeleteConfirm: '确认删除',
        deleteProtected: '作为附件的图片无法通过本插件删除',
        deleteFailed: '删除失败',
        deleted: '已删除 {name}',
        revealMissing: '文件已经不在原来的位置了',
        revealFailed: '打开失败',
        themeTitle: '窗口配色',
        themeDesc: '只影响 Ctrl+F 查找面板；「跟随 DSH」会随 DSH 的深浅色自动切换。',
        themeAuto: '跟随DSH',
        themeAutoHint: 'DSH 切换深浅色时一起变',
        themeDark: '深色',
        themeDarkHint: '面板固定深色，不跟随 DSH',
        themeLight: '浅色',
        themeLightHint: '面板固定浅色，不跟随 DSH',
        themeSaving: '正在保存…',
        themeSaved: '已保存，打开 Ctrl+F 面板就能看到效果',
        themeLocal: '已应用到本窗口；重启 DSH 后会写进配置',
        themeFailed: '设置没能保存：{message}',
      },
      en: {
        jumpLoading: 'Locating the original message…',
        jumpMessage: 'Located the original message; the exact text may be folded or formatted.',
        jumpFailed: 'Could not locate the original message. Search again and retry.',
        jumpDismiss: 'Dismiss',
        title: 'Find in conversations',
        placeholder: 'Type text to find, Enter to jump…',
        empty: 'Type text, then press Enter or click Find.',
        ready: 'Press Enter or click Find to search.',
        searching: 'Searching locally…',
        noResults: 'No conversation contains that text',
        noResultsHidden: 'Nothing to show: {count} more match(es) sit in archived conversations, which you chose to hide',
        results: '{count} matches · {sessions} conversations',
        occurrences: '{count} hits',
        ungrouped: 'No workspace',
        elapsed: '{ms} ms',
        truncated: 'Many results; showing the first {count}',
        hint: 'Enter or Find to search · click a result to jump · Esc close',
        failed: 'Search failed: {message}',
        search: 'Find',
        hideArchived: 'Hide archived',
        hideArchivedHint: 'Leave hits from archived conversations out of the panes',
        thinkingTitle: 'Reasoning',
        conversationTitle: 'Conversation',
        paneEmpty: 'No match in this pane',
        tabText: 'Text',
        tabMedia: 'Images/Videos',
        tabFiles: 'Files',
        filesHint: 'Expand workspaces and conversations · click a filename to open its folder · Esc to close',
        filesOutline: '{workspaces} workspaces · {sessions} conversations · {loaded} files loaded',
        filesCount: '{count} files',
        filesTreeEmpty: 'No workspaces or conversations found.',
        filesEmpty: 'This conversation has no files.',
        filesFiltered: 'No files match the current filters.',
        filesTruncated: 'Only some files are shown.',
        filesExpandAllHint: 'Read all visible conversations and load their files (may take a while)',
        filesRefreshHint: 'Clear cached files and re-read the workspace and conversation list',
        filesHideMedia: 'Hide Images/Videos',
        filesRetry: 'Retry',
        filesTreeFailed: 'Could not load the file tree.',
        filesSessionFailed: 'Could not load files.',
        filesReveal: 'Open containing folder',
        filesRevealing: 'Opening folder…',
        filesMissing: 'File not found. It may have been removed.',
        filesUnavailable: 'This file cannot be located on this machine.',
        filesRevealFailed: 'Could not open the containing folder. Try again.',
        mediaSummary: '{count} media · {sessions} conversations',
        mediaCount: '{count}',
        mediaEmpty: 'No images or videos found yet.',
        mediaLoading: 'Scanning local media…',
        mediaRefresh: 'Rescan',
        mediaHint: 'Click a workspace or conversation to fold it · click a thumbnail to enlarge · Esc to close',
        mediaVideo: 'Video',
        mediaRefreshHint: 'Re-read the workspace and conversation list (no conversation is read)',
        mediaOutline: '{workspaces} workspaces · {sessions} conversations · {loaded} media loaded',
        mediaCollapseAll: 'Collapse all',
        mediaCollapseAllHint: 'Fold every workspace and conversation, leaving only the outline (nothing re-read)',
        mediaExpandAll: 'Expand all',
        mediaExpandAllHint: 'Read every conversation and load all images and videos (slow)',
        mediaExpanding: 'Expanding…',
        mediaTreeLoading: 'Listing workspaces and conversations…',
        mediaReading: 'Reading…',
        mediaReadFailed: 'Read failed; click to retry',
        mediaNone: 'none',
        mediaPartial: 'Partial results; click to load the full list',
        mediaSessionCount: '{count} conversations',
        mediaCountTwo: '{count} media · {sessions} conversations',
        mediaNoSessions: 'This workspace has no conversations',
        mediaLoadedTotal: '{count} media loaded · {sessions} conversations',
        archivedBadge: 'Archived',
        speakerUser: 'User',
        speakerAssistant: 'AI',
        speakerTool: 'Tool',
        speakerSystem: 'System',
        speakerFiltered: 'Nothing to show: {count} hit(s) hidden by the source filter',
        archivedNotice: 'This conversation is archived and cannot be opened. Unarchive it from the sidebar list, then try again.',
        menuSaveAs: 'Save as…',
        savedAs: 'Saved as {name}',
        savedDownload: 'Downloaded to your default folder: {name}',
        saveFailed: 'Save failed',
        menuReveal: 'Open file location',
        menuDelete: 'Delete',
        menuDeleteConfirm: 'Confirm delete',
        deleteProtected: 'This is a conversation attachment; deleting it would break that conversation permanently, so only the folder can be opened.',
        deleteFailed: 'Delete failed',
        deleted: 'Deleted {name}',
        revealMissing: 'The file is no longer at that location',
        revealFailed: 'Could not open it',
        themeTitle: 'Panel theme',
        themeDesc: 'Only affects the Ctrl+F panel; “Follow DSH” tracks the DSH light/dark theme.',
        themeAuto: 'Follow DSH',
        themeAutoHint: 'Switches together with DSH',
        themeDark: 'Dark',
        themeDarkHint: 'Always dark, regardless of DSH',
        themeLight: 'Light',
        themeLightHint: 'Always light, regardless of DSH',
        themeSaving: 'Saving…',
        themeSaved: 'Saved — open the Ctrl+F panel to see it',
        themeLocal: 'Applied in this window; DSH will persist it after a restart',
        themeFailed: 'Could not save the setting: {message}',
      },
    };

    const CSS = [
      '.dsh-find-jump-notice{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:1000;max-width:min(640px,85vw);padding:12px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 4px 20px var(--dsw-alias-border-l1);font-size:13px;display:flex;align-items:center;gap:16px;}',
      '.dsh-find-jump-notice button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:18px;}',
      '.dsh-find-overlay{position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding:8vh 16px 16px;box-sizing:border-box;pointer-events:auto;z-index:2147480000;}',
      '.dsh-find-backdrop{position:absolute;inset:0;background:var(--df-backdrop,var(--dsw-alias-bg-base));opacity:.42;}',
      '.dsh-find-panel{position:relative;width:100%;max-width:1080px;height:76vh;display:flex;flex-direction:column;border-radius:14px;background:var(--dsw-alias-bg-layer-1);border:0.5px solid var(--dsw-alias-border-l1);box-shadow:0 20px 60px rgba(0,0,0,.28);overflow:hidden;box-sizing:border-box;}',
      '.dsh-find-head{flex:none;display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:0.5px solid var(--dsw-alias-border-l1);}',
      '.dsh-find-icon{flex:none;width:16px;height:16px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;justify-content:center;}',
      '.dsh-find-input{flex:1;min-width:0;height:26px;border:none;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14.5px;line-height:1.4;}',
      '.dsh-find-input::placeholder{color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-submit{flex:none;height:26px;padding:0 14px;border:none;border-radius:7px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-family:inherit;font-size:12.5px;font-weight:500;cursor:pointer;}',
      '.dsh-find-submit:hover{filter:brightness(1.08);}',
      '.dsh-find-submit:disabled{opacity:.45;cursor:default;filter:none;}',
      '.dsh-find-toggle{flex:none;display:flex;align-items:center;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none;white-space:nowrap;}',
      '.dsh-find-toggle:hover{color:var(--dsw-alias-label-primary);}',
      '.dsh-find-toggle input{margin:0;width:13px;height:13px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;}',
      '.dsh-find-submit:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;}',
      '.dsh-find-status{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap;}',
      '.dsh-find-panes{flex:1;min-height:0;display:flex;align-items:stretch;}',
      '.dsh-find-pane{flex:1 1 50%;min-width:0;display:flex;flex-direction:column;min-height:0;box-sizing:border-box;}',
      '.dsh-find-pane + .dsh-find-pane{border-left:2px solid var(--dsw-alias-border-l1);}',
      '.dsh-find-pane-head{flex:none;display:flex;align-items:center;gap:8px;height:40px;box-sizing:border-box;padding:10px 14px 8px;font-size:14px;line-height:20px;white-space:nowrap;font-weight:700;letter-spacing:.01em;color:var(--dsw-alias-label-primary);border-bottom:0.5px solid var(--dsw-alias-border-l1);}',
      '.dsh-find-pane-count{margin-left:auto;font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-chips{display:flex;align-items:center;gap:5px;margin-left:12px;}',
      '.dsh-find-chip{font-family:inherit;font-size:11px;font-weight:500;line-height:1.7;padding:0 9px;border-radius:999px;border:0.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;transition:background .12s,color .12s,border-color .12s;}',
      '.dsh-find-chip:hover{color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-chip[data-on="true"]{font-weight:600;}',
      '.dsh-find-chip[data-speaker="user"][data-on="true"]{background:color-mix(in srgb,#3b82f6 22%,var(--dsw-alias-bg-layer-2));border-color:color-mix(in srgb,#3b82f6 62%,transparent);color:color-mix(in srgb,#3b82f6 42%,var(--dsw-alias-label-primary));}',
      '.dsh-find-chip[data-speaker="assistant"][data-on="true"]{background:color-mix(in srgb,#10b981 22%,var(--dsw-alias-bg-layer-2));border-color:color-mix(in srgb,#10b981 62%,transparent);color:color-mix(in srgb,#10b981 40%,var(--dsw-alias-label-primary));}',
      '.dsh-find-chip[data-speaker="tool"][data-on="true"]{background:color-mix(in srgb,#8b5cf6 22%,var(--dsw-alias-bg-layer-2));border-color:color-mix(in srgb,#8b5cf6 62%,transparent);color:color-mix(in srgb,#8b5cf6 42%,var(--dsw-alias-label-primary));}',
      '.dsh-find-chip[data-speaker="system"][data-on="true"]{background:color-mix(in srgb,#f59e0b 22%,var(--dsw-alias-bg-layer-2));border-color:color-mix(in srgb,#f59e0b 62%,transparent);color:color-mix(in srgb,#f59e0b 40%,var(--dsw-alias-label-primary));}',
      '.dsh-find-pane-body{flex:1;min-height:0;overflow:auto;padding:8px 0 10px;}',
      '.dsh-find-pane-empty{padding:26px 16px;text-align:center;font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.8;}',
      '.dsh-find-body{flex:1;min-height:0;overflow:auto;padding:4px 0 6px;}',
      '.dsh-find-hint{padding:30px 18px;text-align:center;font-size:12.5px;line-height:1.7;color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-card{margin:0 10px 8px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);overflow:hidden;}',
      '.dsh-find-card-head{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:0.5px solid var(--dsw-alias-border-l1);}',
      '.dsh-find-card-icon{flex:none;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);}',
      '.dsh-find-card-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);}',
      '.dsh-find-card-count{flex:none;font-size:11.5px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-session-head{display:flex;align-items:center;gap:8px;padding:7px 12px 4px;font-size:12px;color:var(--dsw-alias-label-secondary);min-width:0;}',
      '.dsh-find-session{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:12px;}',
      '.dsh-find-count{flex:none;font-size:11.5px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-archived{flex:none;font-size:11px;line-height:1.35;padding:1px 6px;border-radius:4px;border:0.5px solid rgba(229,72,77,.45);background:rgba(229,72,77,.10);color:#e5484d;font-weight:600;letter-spacing:.02em;white-space:nowrap;}',
      '.dsh-find-row[data-archived="true"] .dsh-find-snippet{opacity:.62;}',
      '.dsh-find-notice{color:var(--dsw-alias-brand-primary);}',
      '.dsh-find-row{display:block;width:100%;text-align:left;padding:7px 12px 9px;border:none;background:transparent;cursor:pointer;font-family:inherit;color:var(--dsw-alias-label-primary);box-sizing:border-box;}',
      '.dsh-find-row + .dsh-find-row{border-top:0.5px solid var(--dsw-alias-border-l1);}',
      '.dsh-find-session-head + .dsh-find-row{border-top:0.5px solid var(--dsw-alias-border-l1);}',
      '.dsh-find-row:hover{background:var(--dsw-alias-bg-layer-1);}',
      '.dsh-find-snippet{margin:0;font-size:13px;line-height:1.62;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary);max-height:7.4em;overflow:hidden;}',
      '.dsh-find-snippet mark{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);border-radius:3px;padding:0 1px;}',
      '.dsh-find-speaker{display:inline-block;margin:0 0 4px;font-size:11px;line-height:1.3;padding:1px 6px;border-radius:4px;border:0.5px solid transparent;font-weight:600;letter-spacing:.01em;white-space:nowrap;}',
      '.dsh-find-speaker[data-speaker="user"]{background:color-mix(in srgb,#3b82f6 16%,var(--dsw-alias-bg-layer-2));border-color:color-mix(in srgb,#3b82f6 55%,transparent);color:color-mix(in srgb,#3b82f6 42%,var(--dsw-alias-label-primary));}',
      '.dsh-find-speaker[data-speaker="assistant"]{background:color-mix(in srgb,#10b981 16%,var(--dsw-alias-bg-layer-2));border-color:color-mix(in srgb,#10b981 55%,transparent);color:color-mix(in srgb,#10b981 40%,var(--dsw-alias-label-primary));}',
      '.dsh-find-speaker[data-speaker="tool"]{background:color-mix(in srgb,#8b5cf6 16%,var(--dsw-alias-bg-layer-2));border-color:color-mix(in srgb,#8b5cf6 55%,transparent);color:color-mix(in srgb,#8b5cf6 42%,var(--dsw-alias-label-primary));}',
      '.dsh-find-speaker[data-speaker="system"]{background:color-mix(in srgb,#f59e0b 16%,var(--dsw-alias-bg-layer-2));border-color:color-mix(in srgb,#f59e0b 55%,transparent);color:color-mix(in srgb,#f59e0b 40%,var(--dsw-alias-label-primary));}',
      '.dsh-find-ellipsis{color:var(--dsw-alias-label-secondary);opacity:.7;}',
      '.dsh-find-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 14px;background:var(--dsw-specific-sidebar-fill);border-top:0.5px solid var(--dsw-alias-border-l1);font-size:11.5px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-foot-right{white-space:nowrap;}',
      '.dsh-find-error{padding:18px 16px;font-size:12.5px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-spinner{display:inline-block;width:11px;height:11px;border-radius:50%;border:1.6px solid var(--dsw-alias-border-l1);border-top-color:var(--dsw-alias-label-secondary);animation:dsh-find-spin .8s linear infinite;vertical-align:-1px;margin-right:6px;}',
      '@keyframes dsh-find-spin{to{transform:rotate(360deg)}}',
      '.dsh-find-tabs{flex:none;display:flex;align-items:flex-end;gap:4px;padding:8px 12px 0;border-bottom:0.5px solid var(--dsw-alias-border-l1);}',
      '.dsh-find-tab{appearance:none;border:0;background:transparent;font-family:inherit;font-size:12.5px;font-weight:500;color:var(--dsw-alias-label-secondary);padding:7px 16px 8px;border-radius:8px 8px 0 0;cursor:pointer;transition:background .12s ease,color .12s ease;}',
      '.dsh-find-tab:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}',
      '.dsh-find-tab[data-active="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600;box-shadow:inset 0 -2px 0 var(--dsw-alias-brand-primary);}',
      '.dsh-find-media-summary{flex:1 1 auto;min-width:0;font-size:12.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.dsh-find-refresh{flex:none;height:26px;padding:0 12px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;cursor:pointer;}',
      '.dsh-find-refresh:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);}',
      '.dsh-find-refresh:disabled{opacity:.5;cursor:default;}',
      '.dsh-find-media-body{flex:1 1 auto;min-height:0;overflow:auto;padding:10px 0 12px;}',
      '.dsh-find-media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(124px,1fr));gap:8px;padding:10px 12px 12px;}',
      '.dsh-find-media-grid[data-windowed]{box-sizing:border-box;align-content:start;}',
      '.dsh-find-media-grid[data-windowed]>.dsh-find-tile{box-sizing:border-box;aspect-ratio:auto;overflow-anchor:none;}',
      '.dsh-find-tile{position:relative;display:block;aspect-ratio:4/3;border-radius:9px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l1);cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;}',
      '.dsh-find-tile:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.14);}',
      '.dsh-find-tile[data-archived="true"]{opacity:.7;}',
      '.dsh-find-thumb{width:100%;height:100%;object-fit:cover;display:block;background:var(--dsw-alias-bg-layer-2);}',
      '.dsh-find-image-thumb:not([data-ready]){visibility:hidden;}',
      '.dsh-find-tile-badge{position:absolute;top:6px;left:6px;font-size:10.5px;font-weight:600;line-height:1.5;padding:0 6px;border-radius:999px;border:0.5px solid transparent;background:rgba(255,255,255,.86);color:#1f2328;}',
      '.dsh-find-tile-badge[data-speaker="user"]{border-color:rgba(59,130,246,.45);color:#2563eb;}',
      '.dsh-find-tile-badge[data-speaker="assistant"]{border-color:rgba(13,159,116,.45);color:#0d9f74;}',
      '.dsh-find-tile-archived{position:absolute;top:6px;right:6px;font-size:10.5px;font-weight:600;line-height:1.5;padding:0 6px;border-radius:999px;border:0.5px solid rgba(229,72,77,.45);background:rgba(255,255,255,.9);color:#e5484d;}',
      '.dsh-find-tile-kind{position:absolute;bottom:22px;right:6px;font-size:10px;font-weight:600;line-height:1.5;padding:0 6px;border-radius:999px;background:rgba(0,0,0,.62);color:#fff;}',
      '.dsh-find-tile-name{position:absolute;left:0;right:0;bottom:0;padding:14px 7px 5px;font-size:10.5px;line-height:1.35;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.72));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.dsh-find-ws-head{cursor:pointer;user-select:none;}',
      '.dsh-find-ws-head:hover{background:var(--dsw-alias-bg-layer-2);}',
      '.dsh-find-ws-caret{flex:none;width:12px;font-size:10px;color:var(--dsw-alias-label-tertiary);}',
      '.dsh-find-ws-body{padding:2px 0 6px;}',
      '.dsh-find-session-block{border-top:0.5px solid var(--dsw-alias-border-l1);}',
      '.dsh-find-session-block:first-child{border-top:none;}',
      '.dsh-find-session-row{display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;}',
      '.dsh-find-session-caret{flex:none;width:12px;font-size:10px;color:var(--dsw-alias-label-tertiary);}',
      '.dsh-find-session-row:hover{background:var(--dsw-alias-bg-layer-2);}',
      '.dsh-find-session-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;color:var(--dsw-alias-label-primary);}',
      '.dsh-find-session-title[data-archived="true"]{color:var(--dsw-alias-label-tertiary);}',
      '.dsh-find-session-state{flex:none;font-size:11.5px;color:var(--dsw-alias-label-tertiary);}',
      '.dsh-find-session-state[data-status="ready"]{color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-session-state[data-status="error"]{color:#e5484d;}',
      '.dsh-find-files-head{flex-wrap:nowrap;white-space:nowrap;overflow-x:auto;}',
      '.dsh-find-files-head .dsh-find-media-summary{flex:1 0 auto;}',
      '.dsh-find-files-branch{width:100%;box-sizing:border-box;appearance:none;border:0;background:transparent;font:inherit;text-align:left;}',
      '.dsh-find-files-branch.dsh-find-card-head{border-bottom:0.5px solid var(--dsw-alias-border-l1);}',
      '.dsh-find-files-branch:focus-visible,.dsh-find-file-name:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px;}',
      '.dsh-find-file-list{margin:0;padding:4px 12px 6px 32px;list-style:none;}',
      '.dsh-find-file-line{display:flex;align-items:center;gap:8px;padding:2px 0;}',
      '.dsh-find-file-line .dsh-find-speaker{flex:none;margin:0;}',
      '.dsh-find-file-name{appearance:none;min-width:0;max-width:100%;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 6px;}',
      '.dsh-find-file-name:not([aria-disabled="true"]){cursor:pointer;}',
      '.dsh-find-file-name:hover,.dsh-find-file-name:focus-visible{background:var(--dsw-alias-bg-layer-2);}',
      '.dsh-find-files-message{padding:4px 12px 6px 32px;font-size:11.5px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-file-list .dsh-find-files-message{padding:0 0 4px 6px;}',
      '.dsh-find-files-message[data-error="true"]{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary));}',
      '.dsh-find-files-message .dsh-find-refresh{margin-inline-start:8px;}',
      '.dsh-find-preview{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:28px;background:rgba(0,0,0,.76);cursor:zoom-out;}',
      '.dsh-find-preview-media{max-width:92vw;max-height:82vh;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.45);cursor:default;background:#000;}',
      '.dsh-find-preview-caption{position:absolute;bottom:18px;left:0;right:0;text-align:center;font-size:12px;color:rgba(255,255,255,.86);}',
      '.dsh-find-menu-layer{position:fixed;inset:0;z-index:1200;}',
      '.dsh-find-menu{position:fixed;z-index:1201;min-width:190px;max-width:260px;padding:4px;display:flex;flex-direction:column;border-radius:9px;border:0.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);box-shadow:0 12px 32px rgba(0,0,0,.22);box-sizing:border-box;}',
      '.dsh-find-menu-item{appearance:none;border:none;background:transparent;text-align:left;font-family:inherit;font-size:12.5px;line-height:1.4;padding:7px 10px;border-radius:6px;cursor:pointer;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.dsh-find-menu-item:hover{background:var(--dsw-alias-bg-layer-2);}',
      '.dsh-find-menu-danger{color:#e5484d;font-weight:600;}',
      '.dsh-find-menu-danger:hover{background:rgba(229,72,77,.10);}',
      '.dsh-find-menu-error{padding:6px 10px 7px;font-size:11.5px;line-height:1.5;color:#e5484d;white-space:normal;}',
      /* Theme pinning: the palette only ever paints through these tokens, so
         overriding them on the overlay root re-themes the whole panel. */
      '.dsh-find-overlay[data-dfind-theme="dark"]{--df-backdrop:rgba(0,0,0,.46);--dsw-alias-bg-base:#151517;--dsw-alias-bg-layer-1:#232324;--dsw-alias-bg-layer-2:#2c2c2e;--dsw-alias-border-l1:rgba(255,255,255,.08);--dsw-alias-border-l2:rgba(255,255,255,.16);--dsw-alias-label-primary:#eceef1;--dsw-alias-label-secondary:#a4a9b0;--dsw-alias-label-tertiary:#7d838a;--dsw-alias-brand-primary:#f3f4f6;--dsw-specific-sidebar-fill:#1b1b1c;}',
      '.dsh-find-overlay[data-dfind-theme="light"]{--df-backdrop:rgba(0,0,0,.32);--dsw-alias-bg-base:#ffffff;--dsw-alias-bg-layer-1:#f6f7f9;--dsw-alias-bg-layer-2:#eceef2;--dsw-alias-border-l1:rgba(15,17,21,.10);--dsw-alias-border-l2:rgba(15,17,21,.18);--dsw-alias-label-primary:#14171c;--dsw-alias-label-secondary:#5b616a;--dsw-alias-label-tertiary:#8a9099;--dsw-alias-brand-primary:#14171c;--dsw-specific-sidebar-fill:#f2f4f7;}',
      /* Settings page (lives in the native settings modal, never in the panel). */
      '.df-theme-page{padding:4px 0 12px;max-width:680px;box-sizing:border-box;}',
      '.df-theme-title{margin:0 0 6px;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);}',
      '.df-theme-desc{margin:0 0 12px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);}',
      '.df-theme-cards{display:flex;gap:10px;flex-wrap:wrap;}',
      '.df-theme-card{flex:1 1 130px;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:16px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;cursor:pointer;transition:background .12s,border-color .12s;}',
      '.df-theme-card:hover{background:var(--dsw-alias-bg-layer-1);}',
      '.df-theme-card[data-active="true"]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1);}',
      '.df-theme-icon{display:flex;align-items:center;justify-content:center;width:22px;height:22px;color:var(--dsw-alias-label-primary);}',
      '.df-theme-name{font-size:13px;line-height:1.3;}',
      '.df-theme-hint{font-size:11.5px;line-height:1.45;text-align:center;color:var(--dsw-alias-label-secondary);}',
      '.df-theme-status{margin:10px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);}',
      '.df-theme-status[data-error="true"]{color:var(--dsw-alias-state-error-primary,#e5484d);}',
    ].join('');

    /* -------------------------------------------------------------- store */

    let store = {
      open: false,
      tab: 'text',
      query: '',
      searched: '',
      loading: false,
      error: '',
      payload: null,
      hideArchived: false,
      speakers: { user: true, assistant: true, tool: true, system: true },
      mediaTree: null,
      mediaTreeLoading: false,
      mediaTreeError: '',
      expanding: false,
      expanded: {},
      sessionMedia: {},
      mediaHideArchived: false,
      mediaSpeakers: { user: true, assistant: true },
      files: {
        tree: null,
        loading: false,
        error: false,
        expanding: false,
        workspacesOpen: new Set(),
        sessionsOpen: new Set(),
        sessions: new Map(),
        reveals: new Map(),
        speakers: { user: true, assistant: true },
        hideArchived: false,
        hideMedia: false,
      },
      preview: null,
      menu: null,
      notice: '',
      jumpNotice: '',
      theme: 'auto',
    };
    const listeners = new Set();
    let ctxRef = null;

    function getStore() {
      return store;
    }

    function setStore(patch) {
      store = Object.assign({}, store, patch);
      for (const listener of Array.from(listeners)) {
        try {
          listener();
        } catch (err) {
          /* a subscriber must never break the palette */
        }
      }
    }

    function toggleSpeaker(key) {
      const next = Object.assign({}, store.speakers || {});
      next[key] = next[key] !== true;
      setStore({ speakers: next });
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    function useStore() {
      const [snapshot, setSnapshot] = React.useState(getStore());
      React.useEffect(() => subscribe(() => setSnapshot(getStore())), []);
      return snapshot;
    }

    function pickLang() {
      try {
        const locale = safeService('locale');
        if (locale) {
          const current = typeof locale.current === 'function' ? locale.current() : locale.current;
          const tag =
            typeof current === 'string'
              ? current
              : current && typeof current.locale === 'string'
                ? current.locale
                : '';
          if (tag.toLowerCase().startsWith('zh')) return 'zh';
          if (tag.length > 0) return 'en';
        }
      } catch (err) {
        /* fall through to the browser language */
      }
      try {
        const tag = String(navigator.language || '').toLowerCase();
        if (tag.startsWith('zh')) return 'zh';
        if (tag.length > 0) return 'en';
      } catch (err) {
        /* ignore */
      }
      return 'zh';
    }

    function fillVars(text, vars) {
      if (!vars) return text;
      let out = text;
      for (const [name, value] of Object.entries(vars)) {
        out = out.split('{' + name + '}').join(String(value));
      }
      return out;
    }

    function makeT() {
      const locale = safeService('locale');
      let bound = null;
      if (locale && typeof locale.bind === 'function') {
        try {
          bound = locale.bind(NS);
        } catch (err) {
          bound = null;
        }
      }
      const dict = DICTS[pickLang()] || DICTS.zh;
      return (key, vars) => {
        let text = '';
        if (bound) {
          try {
            const value = bound(key, vars);
            /* A translator that does not know this namespace echoes the key back. */
            if (typeof value === 'string' && value.length > 0 && value !== key) text = value;
          } catch (err) {
            text = '';
          }
        }
        if (text.length === 0) text = dict[key] || DICTS.zh[key] || key;
        return fillVars(text, vars);
      };
    }

    function safeService(name) {
      const ctx = ctxRef;
      if (!ctx) return null;
      try {
        const value = typeof ctx.get === 'function' ? ctx.get(name) : ctx[name];
        return value === undefined ? null : value;
      } catch (err) {
        return null;
      }
    }

    /* ----------------------------------------------------------- settings */

    const THEMES = ['auto', 'dark', 'light'];

    function normalizeTheme(value) {
      return THEMES.indexOf(value) >= 0 ? value : 'auto';
    }

    /* The preference belongs to the Host so it survives a reload and is shared
       by every window. The local copy is a mirror: it keeps the choice working
       in a window whose Host build predates the settings route, and once such a
       Host is reloaded the stored value migrates up on the next page load. */
    const THEME_STORAGE_KEY = 'dsh-find.theme';

    function readLocalTheme() {
      try {
        const value = window.localStorage.getItem(THEME_STORAGE_KEY);
        return THEMES.indexOf(value) >= 0 ? value : '';
      } catch (err) {
        return '';
      }
    }

    function writeLocalTheme(theme) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch (err) {
        /* private browsing and similar modes simply skip the mirror */
      }
    }

    function postTheme(theme) {
      return fetch(ROUTE + '/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ theme }),
      }).then((response) => {
        /* A Host build without the settings route answers 404 here; that is an
           old build, not a failure worth surfacing as an error. */
        if (response.status === 404 || response.status === 405) throw new Error('unsupported');
        return response.json().then((data) => ({ ok: response.ok, data }));
      });
    }

    function loadSettings() {
      const local = readLocalTheme();
      if (local !== '') setStore({ theme: local });
      return fetch(ROUTE + '/settings', { headers: { accept: 'application/json' } })
        .then((response) => {
          if (!response.ok) throw new Error('unsupported');
          return response.json();
        })
        .then((data) => {
          if (data === null || typeof data !== 'object' || typeof data.theme !== 'string') return;
          if (data.saved === true) {
            const theme = normalizeTheme(data.theme);
            setStore({ theme });
            writeLocalTheme(theme);
            return;
          }
          /* Nothing stored on the Host yet: push the local mirror up once. */
          if (local === '') return;
          postTheme(local)
            .then((result) => {
              if (result.ok && result.data && result.data.ok === true) writeLocalTheme(local);
            })
            .catch(() => {
              /* the Host may still be read-only; the mirror keeps working */
            });
        })
        .catch(() => {
          /* no settings route: the mirror alone drives the palette */
        });
    }

    /* ------------------------------------------------------------- search */

    const TEXT_SEARCH_IDLE = { searched: '', loading: false, error: '', payload: null };
    let searchToken = 0;
    let inflight = null;
    let debounceTimer = null;

    function snippetBudget() {
      const height = (typeof window !== 'undefined' && window.innerHeight) || 800;
      return Math.max(200, Math.min(900, Math.round(height / 2.6)));
    }

    function cancelSearch() {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (inflight) {
        try {
          inflight.abort();
        } catch (err) {
          /* ignore */
        }
        inflight = null;
      }
      searchToken += 1;
    }

    function scheduleSearch(query, patch) {
      cancelSearch();
      const trimmed = query.trim();
      setStore({ ...patch, ...TEXT_SEARCH_IDLE, query, searched: trimmed, loading: trimmed.length > 0 });
      if (trimmed.length === 0) return;
      const token = searchToken;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void runSearch(trimmed, token);
      }, DEBOUNCE_MS);
    }

    /**
     * Typing alone no longer searches: the 查找 button or Enter submits. That
     * keeps a half-typed keyword from firing a scan over every conversation.
     */
    function submitSearch() {
      const query = store.query.trim();
      if (query.length === 0) {
        setStore(TEXT_SEARCH_IDLE);
        return;
      }
      cancelSearch();
      const token = searchToken;
      setStore({
        loading: true,
        error: '',
        searched: query,
        notice: '',
      });
      void runSearch(query, token);
    }

    async function runSearch(query, token) {
      const controller = new AbortController();
      inflight = controller;
      try {
        const params = new URLSearchParams({
          q: query,
          maxChars: String(snippetBudget()),
          perSession: String(PER_SESSION),
          total: String(TOTAL_HITS),
        });
        const response = await fetch(ROUTE + '/search?' + params.toString(), {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error('HTTP ' + response.status + (detail ? ' — ' + detail.slice(0, 200) : ''));
        }
        const payload = await response.json();
        if (token !== searchToken) return;
        setStore({
          loading: false,
          payload,
          searched: query,
          error: '',
        });
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        if (token !== searchToken) return;
        setStore({
          loading: false,
          payload: null,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        if (inflight === controller) inflight = null;
      }
    }

    /* -------------------------------------------------------------- media */

    /**
     * The media tab is a separate scan: it asks the Host which pictures and
     * clips live in each conversation. The result is cached in the store, so
     * flipping tabs does not re-walk every session log.
     */
    function switchTab(tab) {
      if (tab !== 'text' && tab !== 'media' && tab !== 'files') return;
      setStore({ tab, preview: null, menu: null });
      if (tab === 'media' && store.mediaTree === null) void loadMediaTree();
      if (tab === 'files' && filesScan === null) void rescanFiles();
    }

    function toggleMediaSpeaker(key) {
      const next = Object.assign({}, store.mediaSpeakers || {});
      next[key] = next[key] !== true;
      setStore({ mediaSpeakers: next });
    }

    let mediaTreeRequest = null;
    let mediaBatch = null;
    const mediaSessionRequests = new Map();

    async function fetchMediaJson(path, signal) {
      const response = await fetch(ROUTE + path, { signal, headers: { accept: 'application/json' } });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error('HTTP ' + response.status + (detail ? ' — ' + detail.slice(0, 200) : ''));
      }
      return response.json();
    }

    /** The outline only lists workspaces and titles. Share an in-flight read. */
    function loadMediaTree() {
      if (mediaTreeRequest !== null) return mediaTreeRequest.promise;
      if (store.mediaTree !== null) return Promise.resolve(store.mediaTree);
      const request = { controller: new AbortController(), promise: null };
      mediaTreeRequest = request;
      request.promise = fetchMediaJson('/media/tree', request.controller.signal)
        .then((tree) => {
          if (mediaTreeRequest !== request) return null;
          setStore({ mediaTree: tree, mediaTreeLoading: false, mediaTreeError: '' });
          return tree;
        })
        .catch((err) => {
          if (mediaTreeRequest === request) {
            setStore({ mediaTree: null, mediaTreeLoading: false, mediaTreeError: err instanceof Error ? err.message : String(err) });
          }
          return null;
        })
        .finally(() => {
          if (mediaTreeRequest === request) mediaTreeRequest = null;
        });
      setStore({ mediaTreeLoading: true, mediaTreeError: '' });
      return request.promise;
    }

    function cancelMediaBatch() {
      const previous = mediaBatch;
      mediaBatch = null;
      previous?.controller.abort();
    }

    function refreshMedia() {
      cancelMediaBatch();
      const previous = mediaTreeRequest;
      mediaTreeRequest = null;
      previous?.controller.abort();
      const requests = [...mediaSessionRequests.values()];
      mediaSessionRequests.clear();
      for (const request of requests) request.controller.abort();
      setStore({
        mediaTree: null, expanding: false, sessionMedia: {}, expanded: {}, preview: null, menu: null,
      });
      return loadMediaTree();
    }

    function workspaceKey(workspace) {
      return workspace.workspaceId === null || workspace.workspaceId === undefined
        ? '__unowned__'
        : String(workspace.workspaceId);
    }

    function toggleWorkspace(workspace) {
      const key = workspaceKey(workspace);
      mediaBatch?.touchedWorkspaces.add(key);
      const next = Object.assign({}, store.expanded || {});
      if (next[key] === true) delete next[key];
      else next[key] = true;
      setStore({ expanded: next });
    }

    function setWorkspaceExpanded(keys, value) {
      const next = Object.assign({}, store.expanded || {});
      for (const key of keys) {
        if (value) next[key] = true;
        else delete next[key];
      }
      setStore({ expanded: next });
    }

    /* --------------------------------------------------- media row menu */

    function openMediaMenu(item, event) {
      if (!item) return;
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      const width = 210;
      const height = 168;
      const left = Math.min(Math.max(8, event.clientX), Math.max(8, window.innerWidth - width - 8));
      const top = Math.min(Math.max(8, event.clientY), Math.max(8, window.innerHeight - height - 8));
      setStore({ menu: { item, x: left, y: top, confirming: false, error: '' } });
    }

    function closeMediaMenu() {
      if (store.menu !== null) setStore({ menu: null });
    }

    function patchMenu(patch) {
      const menu = store.menu;
      if (menu === null) return;
      setStore({ menu: Object.assign({}, menu, patch) });
    }

    function flashNotice(text) {
      setStore({ notice: text });
      window.setTimeout(() => {
        if (store.notice === text) setStore({ notice: '' });
      }, 6000);
    }

    /** Removes the same file from loaded grids and any outstanding scan result. */
    function dropMedia(item) {
      mediaBatch?.deletedIds.add(item.id);
      for (const request of mediaSessionRequests.values()) request.deletedIds.add(item.id);
      const sessions = { ...store.sessionMedia };
      for (const [id, entry] of Object.entries(sessions)) {
        if (!entry.items?.some((each) => each.id === item.id)) continue;
        const items = entry.items.filter((each) => each.id !== item.id);
        sessions[id] = { ...entry, items, counts: mediaCounts(items) };
      }
      setStore({ sessionMedia: sessions, preview: store.preview?.id === item.id ? null : store.preview });
    }

    async function revealMedia(item) {
      const tr = makeT();
      try {
        const response = await fetch(ROUTE + '/media/reveal?id=' + encodeURIComponent(item.id), {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const code = payload && payload.error ? payload.error : '';
          patchMenu({ error: code === 'not-found' ? tr('revealMissing') : tr('revealFailed') });
          return;
        }
        closeMediaMenu();
      } catch (err) {
        patchMenu({ error: tr('revealFailed') });
      }
    }

    async function deleteMedia(item) {
      const tr = makeT();
      try {
        const response = await fetch(ROUTE + '/media/delete?id=' + encodeURIComponent(item.id), {
          method: 'POST',
          headers: { accept: 'application/json' },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const code = payload && payload.error ? payload.error : '';
          patchMenu({ error: code === 'attachment-protected' ? tr('deleteProtected') : tr('deleteFailed') });
          return;
        }
        closeMediaMenu();
        dropMedia(item);
        flashNotice(tr('deleted', { name: item.name }));
      } catch (err) {
        patchMenu({ error: tr('deleteFailed') });
      }
    }

    function confirmDelete(menu) {
      if (menu === null) return;
      const tr = makeT();
      if (menu.item && menu.item.source === 'attachment') {
        patchMenu({ error: tr('deleteProtected') });
        return;
      }
      if (menu.confirming === true) {
        void deleteMedia(menu.item);
        return;
      }
      patchMenu({ confirming: true, error: '' });
    }

    /**
     * Copies one media file wherever the user points. The save picker has to be
     * opened on the click itself (transient activation), so it runs before the
     * download; browsers without it fall back to a normal download.
     */
    async function saveMediaAs(item) {
      const tr = makeT();
      const fallbackName = item.kind === 'video' ? 'media.mp4' : item.kind === 'image' ? 'media.png' : 'media.bin';
      const name = typeof item.name === 'string' && item.name.length > 0 ? item.name : fallbackName;
      let handle = null;
      if (typeof window.showSaveFilePicker === 'function') {
        try {
          handle = await window.showSaveFilePicker({ suggestedName: name });
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          handle = null;
        }
      }
      try {
        const response = await fetch(item.url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const blob = await response.blob();
        if (handle !== null) {
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } else {
          const objectUrl = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = objectUrl;
          anchor.download = name;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
        }
        closeMediaMenu();
        flashNotice(handle !== null ? tr('savedAs', { name }) : tr('savedDownload', { name }));
      } catch (err) {
        patchMenu({ error: tr('saveFailed') });
      }
    }

    function mediaCounts(items) {
      const counts = { user: 0, assistant: 0, image: 0, video: 0 };
      for (const item of items) {
        counts[item.speaker === 'user' ? 'user' : 'assistant'] += 1;
        if (item.kind === 'image' || item.kind === 'video') counts[item.kind] += 1;
      }
      return counts;
    }

    function patchSession(sessionId, patch) {
      const next = Object.assign({}, store.sessionMedia);
      next[sessionId] = Object.assign({}, next[sessionId], patch);
      setStore({ sessionMedia: next });
    }

    /** Fold the outline, retaining everything already loaded or manually requested. */
    function collapseAll() {
      cancelMediaBatch();
      const next = {};
      for (const [id, entry] of Object.entries(store.sessionMedia)) {
        next[id] = { ...entry, open: false };
      }
      setStore({ sessionMedia: next, expanded: {}, expanding: false, preview: null, menu: null });
    }

    async function loadSessionMedia(sessionId) {
      if (mediaSessionRequests.has(sessionId)) return;
      const request = { controller: new AbortController(), deletedIds: new Set() };
      mediaSessionRequests.set(sessionId, request);
      mediaBatch?.touchedSessions.add(sessionId);
      patchSession(sessionId, { status: 'loading', open: true, error: '' });
      try {
        const payload = await fetchMediaJson('/media/session?id=' + encodeURIComponent(sessionId), request.controller.signal);
        if (mediaSessionRequests.get(sessionId) !== request) return;
        const items = (Array.isArray(payload.items) ? payload.items : []).filter((item) => !request.deletedIds.has(item.id));
        patchSession(sessionId, { status: 'ready', items, counts: mediaCounts(items), tookMs: payload.tookMs || 0, error: '' });
      } catch (err) {
        if (mediaSessionRequests.get(sessionId) !== request) return;
        patchSession(sessionId, { status: 'error', error: err instanceof Error ? err.message : String(err) });
      } finally {
        if (mediaSessionRequests.get(sessionId) === request) mediaSessionRequests.delete(sessionId);
      }
    }

    function toggleSessionMedia(sessionId) {
      const entry = store.sessionMedia[sessionId];
      if (entry?.status === 'loading') return;
      if (entry?.status !== 'ready') {
        void loadSessionMedia(sessionId);
        return;
      }
      mediaBatch?.touchedSessions.add(sessionId);
      patchSession(sessionId, { open: entry.open === false });
    }

    /** Keep the batch opt-in: the Host still scans every conversation. */
    async function expandAll() {
      if (mediaBatch !== null) return;
      const request = {
        controller: new AbortController(),
        touchedSessions: new Set(mediaSessionRequests.keys()),
        touchedWorkspaces: new Set(),
        deletedIds: new Set(),
      };
      mediaBatch = request;
      setStore({ expanding: true, mediaTreeError: '' });
      try {
        const tree = await loadMediaTree();
        if (mediaBatch !== request || tree === null) return;
        const payload = await fetchMediaJson('/media?total=' + String(MEDIA_TOTAL), request.controller.signal);
        if (mediaBatch !== request) return;
        const grouped = new Map();
        for (const item of Array.isArray(payload.items) ? payload.items : []) {
          if (request.deletedIds.has(item.id)) continue;
          const list = grouped.get(item.sessionId);
          if (list === undefined) grouped.set(item.sessionId, [item]);
          else list.push(item);
        }
        const sessions = { ...store.sessionMedia };
        const expanded = { ...store.expanded };
        const partial = payload.truncated === true;
        for (const workspace of tree.workspaces || []) {
          const key = workspaceKey(workspace);
          if (!request.touchedWorkspaces.has(key)) expanded[key] = true;
          for (const session of workspace.sessions) {
            const id = session.sessionId;
            if (request.touchedSessions.has(id)) continue;
            const current = sessions[id];
            const items = grouped.get(id);
            if ((partial && items === undefined) || (current?.status === 'ready' && (partial || items === undefined))) {
              // When capped, missing rows must remain eligible for a per-session read.
              if (current !== undefined) sessions[id] = { ...current, open: true };
              continue;
            }
            const kept = items ?? [];
            sessions[id] = {
              status: partial ? 'partial' : 'ready', open: true, items: kept,
              counts: mediaCounts(kept), tookMs: items === undefined ? 0 : (payload.tookMs || 0), error: '',
            };
          }
        }
        setStore({ sessionMedia: sessions, expanded });
      } catch (err) {
        if (mediaBatch !== request) return;
        setStore({ mediaTreeError: err instanceof Error ? err.message : String(err) });
      } finally {
        if (mediaBatch === request) {
          mediaBatch = null;
          setStore({ expanding: false });
        }
      }
    }

    /* -------------------------------------------------------------- files */

    // A rescan owns its queue and writes; active slots are shared even across rescans.
    let filesScan = null;
    let activeFileReads = 0;

    function setFiles(patch) {
      setStore({ files: { ...store.files, ...patch } });
    }

    function filesWorkspaces(files) {
      return files.tree === null ? [] : files.tree.workspaces;
    }

    function visibleFileSessions(files, workspace) {
      return files.hideArchived ? workspace.sessions.filter((session) => session.archived !== true) : workspace.sessions;
    }

    async function rescanFiles() {
      if (filesScan !== null) {
        const previous = filesScan;
        filesScan = null;
        previous.controller.abort();
        if (previous.publishTimer !== null) clearTimeout(previous.publishTimer);
      }
      const scan = {
        controller: new AbortController(), pending: new Set(), manual: new Set(), batch: null,
        changes: new Map(), publishTimer: null,
      };
      filesScan = scan;
      setFiles({
        tree: null, loading: true, error: false, expanding: false,
        workspacesOpen: new Set(), sessionsOpen: new Set(), sessions: new Map(), reveals: new Map(),
      });
      try {
        const response = await fetch(ROUTE + '/files/tree', {
          headers: { accept: 'application/json' }, cache: 'no-store', signal: scan.controller.signal,
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const tree = await response.json();
        if (!Array.isArray(tree.workspaces) || !tree.workspaces.every((workspace) =>
          workspace && Array.isArray(workspace.sessions) && workspace.sessions.every((session) =>
            session && typeof session.sessionId === 'string' && session.sessionId !== '',
          ),
        )) throw new Error('Invalid file tree');
        if (scan === filesScan) setFiles({ tree, loading: false });
      } catch (err) {
        if (scan === filesScan) setFiles({ loading: false, error: true });
      }
    }

    function toggleFileBranch(field, key) {
      const next = new Set(store.files[field]);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setFiles({ [field]: next });
      return next.has(key);
    }

    function scheduleFilePublish(scan) {
      if (scan.publishTimer !== null) return;
      // Publish nearby completions together rather than copying the entire Map per request.
      scan.publishTimer = setTimeout(() => {
        scan.publishTimer = null;
        if (scan !== filesScan) return;
        const patch = {};
        if (scan.changes.size > 0) {
          const sessions = new Map(store.files.sessions);
          for (const [id, entry] of scan.changes) sessions.set(id, entry);
          scan.changes.clear();
          patch.sessions = sessions;
        }
        const expanding = scan.batch !== null;
        if (store.files.expanding !== expanding) patch.expanding = expanding;
        if (Object.keys(patch).length > 0) setFiles(patch);
      }, 16);
    }

    function fileSessionEntry(scan, sessionId) {
      return scan.changes.get(sessionId) ?? store.files.sessions.get(sessionId);
    }

    async function readFileSession(scan, sessionId) {
      let entry;
      try {
        const response = await fetch(ROUTE + '/files/session?id=' + encodeURIComponent(sessionId), {
          headers: { accept: 'application/json' }, cache: 'no-store', signal: scan.controller.signal,
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const payload = await response.json();
        if (!Array.isArray(payload.items)) throw new Error('Invalid file items');
        const items = payload.items.filter((item) => item && typeof item.id === 'string' && item.id !== '' &&
          typeof item.name === 'string' && (item.speaker === 'user' || item.speaker === 'assistant') &&
          (item.kind === 'image' || item.kind === 'video' || item.kind === 'file'));
        entry = { status: 'ready', items, truncated: payload.truncated === true };
      } catch (err) {
        entry = { status: 'error' };
      }
      activeFileReads -= 1;
      scan.pending.delete(sessionId);
      if (scan === filesScan) {
        scan.changes.set(sessionId, entry);
        if (scan.batch !== null) {
          scan.batch.remaining.delete(sessionId);
          if (scan.batch.remaining.size === 0) scan.batch = null;
        }
        scheduleFilePublish(scan);
      }
      if (filesScan !== null) pumpFileReads(filesScan);
    }

    function pumpFileReads(scan) {
      while (scan === filesScan && activeFileReads < FILES_CONCURRENCY) {
        const id = scan.manual.values().next().value ?? scan.batch?.queued.values().next().value;
        if (id === undefined) return;
        scan.manual.delete(id);
        scan.batch?.queued.delete(id);
        scan.pending.add(id);
        activeFileReads += 1;
        if (fileSessionEntry(scan, id)?.status === 'error') {
          scan.changes.set(id, { status: 'loading' });
          scheduleFilePublish(scan);
        }
        void readFileSession(scan, id);
      }
    }

    function loadFileSession(scan, sessionId) {
      if (scan !== filesScan || scan.pending.has(sessionId) || scan.manual.has(sessionId) ||
          fileSessionEntry(scan, sessionId)?.status === 'ready') return;
      scan.manual.add(sessionId);
      scan.changes.set(sessionId, { status: 'loading' });
      scheduleFilePublish(scan);
      pumpFileReads(scan);
    }

    function toggleFileSession(sessionId) {
      if (toggleFileBranch('sessionsOpen', sessionId) && filesScan !== null) {
        loadFileSession(filesScan, sessionId);
      }
    }

    function expandAllFiles() {
      const files = store.files;
      const scan = filesScan;
      if (scan === null || scan.batch !== null || files.tree === null) return;
      const workspaces = filesWorkspaces(files);
      const sessionsOpen = new Set(workspaces.flatMap((workspace) =>
        visibleFileSessions(files, workspace).map((session) => session.sessionId),
      ));
      if (sessionsOpen.size === 0) return;
      const remaining = new Set([...sessionsOpen].filter((id) => fileSessionEntry(scan, id)?.status !== 'ready'));
      if (remaining.size > 0) {
        scan.batch = { remaining, queued: new Set([...remaining].filter((id) => !scan.pending.has(id))) };
      }
      setFiles({ expanding: scan.batch !== null, workspacesOpen: new Set(workspaces.map(workspaceKey)), sessionsOpen });
      pumpFileReads(scan);
    }

    function collapseAllFiles() {
      if (filesScan !== null) filesScan.batch = null;
      setFiles({ expanding: false, workspacesOpen: new Set(), sessionsOpen: new Set() });
    }

    function setFileReveal(id, status) {
      const reveals = new Map(store.files.reveals);
      if (status) reveals.set(id, status);
      else reveals.delete(id);
      setFiles({ reveals });
    }

    async function revealFile(sessionId, item) {
      const scan = filesScan;
      // A stale handler or an item without a Host-issued reveal capability may not POST.
      if (scan === null || item.canReveal !== true ||
          !store.files.sessions.get(sessionId)?.items?.includes(item) ||
          store.files.reveals.get(item.id) === 'filesRevealing') return;
      setFileReveal(item.id, 'filesRevealing');
      let status = 'filesRevealFailed';
      try {
        const response = await fetch(ROUTE + '/files/reveal?id=' + encodeURIComponent(item.id), {
          method: 'POST', headers: { accept: 'application/json' }, signal: scan.controller.signal,
        });
        const payload = await response.json();
        if (response.ok && payload.ok === true) status = null;
        else if (payload.error === 'not-found' || payload.error === 'unknown-file') status = 'filesMissing';
        else if (payload.error === 'unavailable') status = 'filesUnavailable';
      } catch (err) {
        // Transport and malformed responses use the generic inline error.
      }
      if (scan === filesScan) setFileReveal(item.id, status);
    }

    /* ------------------------------------------------------------ palette */

    function openPalette() {
      cancelJump();
      setStore({ jumpNotice: '' });
      const selection = readSelectionText();
      if (selection !== null && selection !== store.query) {
        openPaletteWith(selection);
        return;
      }
      setStore({ open: true, tab: 'text', notice: '', preview: null, menu: null });
    }

    function openPaletteWith(query) {
      cancelJump();
      setStore({ jumpNotice: '' });
      scheduleSearch(query, { open: true, tab: 'text', notice: '', preview: null, menu: null });
    }

    /**
     * `/find-text-ui` runs in the Host half; this long-poll carries the request into
     * the page and opens the palette with it. The server holds the request for up
     * to 20s, so an idle page costs one open connection and no model call.
     */
    function startPendingPoll() {
      const controller = new AbortController();
      let since = 0;
      let stopped = false;
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const loop = async () => {
        while (!stopped) {
          try {
            const response = await fetch(ROUTE + '/pending?since=' + String(since), {
              signal: controller.signal,
              headers: { accept: 'application/json' },
            });
            if (stopped) return;
            if (!response.ok) {
              await sleep(3000);
              continue;
            }
            const data = await response.json();
            if (typeof data.seq === 'number' && data.seq > since) since = data.seq;
            if (typeof data.query === 'string' && data.query.trim().length > 0) {
              openPaletteWith(data.query.trim());
            }
          } catch (err) {
            if (stopped) return;
            await sleep(3000);
          }
        }
      };

      void loop();

      return () => {
        stopped = true;
        try {
          controller.abort();
        } catch (err) {
          /* ignore */
        }
      };
    }

    function closePalette() {
      cancelSearch();
      setStore({ open: false, notice: '', preview: null, menu: null });
    }

    function readSelectionText() {
      try {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return null;
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return null;
        const text = String(selection.toString() || '').trim();
        if (text.length === 0 || text.length > MAX_QUERY) return null;
        if (text.includes('\n')) return null;
        return text;
      } catch (err) {
        return null;
      }
    }

    function flattenHits(payload) {
      if (!payload || !Array.isArray(payload.hits)) return [];
      return payload.hits;
    }

    function splitHits(hits) {
      const thinking = [];
      const conversation = [];
      for (const hit of hits) {
        if (hit.channel === 'thinking') thinking.push(hit);
        else conversation.push(hit);
      }
      return { thinking, conversation };
    }

    /**
     * Group hits into one card per workspace, then into one block per session
     * inside the card. Archived conversations stay searchable but cannot be
     * opened, so they always sink to the bottom (inside and across cards).
     */
    function groupHits(hits) {
      const cards = [];
      const cardIndex = new Map();
      for (const hit of hits) {
        const workspaceKey = String(hit.workspaceTitle || '');
        let card = cardIndex.get(workspaceKey);
        if (card === undefined) {
          card = {
            key: workspaceKey,
            workspaceTitle: hit.workspaceTitle || '',
            workspacePath: hit.workspacePath || '',
            occurrences: 0,
            archivedOnly: true,
            sessions: [],
            sessionIndex: new Map(),
          };
          cardIndex.set(workspaceKey, card);
          cards.push(card);
        }
        let session = card.sessionIndex.get(hit.sessionId);
        if (session === undefined) {
          session = {
            sessionId: hit.sessionId,
            title: hit.title,
            archived: hit.archived === true,
            occurrences: 0,
            hits: [],
          };
          card.sessionIndex.set(hit.sessionId, session);
          card.sessions.push(session);
        }
        session.occurrences += hit.occurrences || 0;
        session.hits.push(hit);
        card.occurrences += hit.occurrences || 0;
        if (hit.archived !== true) card.archivedOnly = false;
      }
      for (const card of cards) {
        card.sessions.sort((left, right) => (left.archived ? 1 : 0) - (right.archived ? 1 : 0));
      }
      cards.sort((left, right) => (left.archivedOnly ? 1 : 0) - (right.archivedOnly ? 1 : 0));
      return { cards, flat: hits.length };
    }

    function Highlighted(props) {
      const text = String(props.text || '');
      const query = String(props.query || '');
      if (query.length === 0) return h('span', null, text);
      const lower = text.toLowerCase();
      const needle = query.toLowerCase();
      const parts = [];
      let from = 0;
      let guard = 0;
      for (;;) {
        const at = lower.indexOf(needle, from);
        if (at < 0 || guard > 40) break;
        if (at > from) parts.push(text.slice(from, at));
        parts.push(h('mark', { key: 'm' + at }, text.slice(at, at + query.length)));
        from = at + query.length;
        guard += 1;
      }
      if (from < text.length) parts.push(text.slice(from));
      return h('span', null, ...parts);
    }

    const PANES = [
      { channel: 'thinking', labelKey: 'thinkingTitle' },
      { channel: 'conversation', labelKey: 'conversationTitle' },
    ];

    function FilesPanel({ files, t }) {
      const workspaces = filesWorkspaces(files).map((workspace) => ({
        workspace,
        sessions: visibleFileSessions(files, workspace),
      }));
      const shownItems = (sessionId) => {
        const entry = files.sessions.get(sessionId);
        return entry?.status === 'ready'
          ? entry.items.filter((item) => files.speakers[item.speaker] && (!files.hideMedia || item.kind === 'file'))
          : [];
      };
      const counts = workspaces.map(({ sessions }) => ({
        sessions: sessions.length,
        files: sessions.reduce((sum, session) => sum + shownItems(session.sessionId).length, 0),
      }));
      const sessionCount = counts.reduce((sum, count) => sum + count.sessions, 0);
      const fileCount = counts.reduce((sum, count) => sum + count.files, 0);

      const button = (text, onClick, disabled, title) => h('button', {
        type: 'button', className: 'dsh-find-refresh', onClick, disabled, title,
      }, t(text));
      const toggle = (key, label, hint) => h(
        'label', { className: 'dsh-find-toggle', title: hint ? t(hint) : undefined },
        h('input', { type: 'checkbox', checked: files[key], onChange: (event) => setFiles({ [key]: event.target.checked }) }),
        h('span', null, t(label)),
      );
      const message = (text, error, action) => h(
        'div', { className: 'dsh-find-files-message', 'data-error': error ? 'true' : undefined },
        h('span', { role: error ? 'alert' : 'status' }, t(text)), action || null,
      );
      const head = h(
        'div', { className: 'dsh-find-head dsh-find-files-head' },
        h('span', { className: 'dsh-find-media-summary' }, files.tree === null ? null : t('filesOutline', {
          workspaces: workspaces.length, sessions: sessionCount, loaded: fileCount,
        })),
        h('div', { className: 'dsh-find-chips' }, ['user', 'assistant'].map((speaker) => h('button', {
          key: speaker, type: 'button', className: 'dsh-find-chip', 'data-speaker': speaker,
          'data-on': String(files.speakers[speaker]), 'aria-pressed': files.speakers[speaker],
          onClick: () => setFiles({ speakers: { ...store.files.speakers, [speaker]: !store.files.speakers[speaker] } }),
        }, t(SPEAKER_LABELS[speaker])))),
        toggle('hideArchived', 'hideArchived', 'hideArchivedHint'),
        toggle('hideMedia', 'filesHideMedia'),
        button(files.expanding ? 'mediaExpanding' : 'mediaExpandAll', expandAllFiles,
          files.expanding || sessionCount === 0, t('filesExpandAllHint')),
        button('mediaCollapseAll', collapseAllFiles,
          files.workspacesOpen.size === 0 && files.sessionsOpen.size === 0, t('mediaCollapseAllHint')),
        button('mediaRefresh', rescanFiles, files.loading, t('filesRefreshHint')),
      );

      const renderItem = (sessionId, item) => {
        const available = item.canReveal === true;
        const reveal = available ? files.reveals.get(item.id) : 'filesUnavailable';
        const busy = reveal === 'filesRevealing';
        return h(
          'li', { key: item.id },
          h('div', { className: 'dsh-find-file-line' },
            h('button', {
              type: 'button', className: 'dsh-find-file-name',
              title: item.name + ' — ' + t(available ? 'filesReveal' : 'filesUnavailable'),
              'aria-disabled': !available || busy, 'aria-busy': busy || undefined,
              onClick: available && !busy ? () => void revealFile(sessionId, item) : undefined,
            }, item.name),
            h('span', { className: 'dsh-find-speaker', 'data-speaker': item.speaker }, t(SPEAKER_LABELS[item.speaker])),
          ),
          reveal ? message(reveal, available && !busy) : null,
        );
      };

      const renderSession = (session) => {
        const id = session.sessionId;
        const entry = files.sessions.get(id);
        const open = files.sessionsOpen.has(id);
        const items = shownItems(id);
        const loading = entry?.status === 'loading' || (open && files.expanding && !entry);
        return h(
          'div', { key: id, className: 'dsh-find-session-block' },
          h('button', {
            type: 'button', className: 'dsh-find-session-row dsh-find-files-branch',
            'aria-expanded': open, onClick: () => toggleFileSession(id),
          },
            h('span', { className: 'dsh-find-session-caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
            h('span', { className: 'dsh-find-session-title', 'data-archived': String(session.archived === true) }, session.title || id),
            session.archived === true ? h('span', { className: 'dsh-find-archived' }, t('archivedBadge')) : null,
            h('span', { className: 'dsh-find-session-state', 'data-status': entry?.status },
              loading ? t('mediaReading')
                : entry?.status === 'ready' ? t('filesCount', { count: items.length })
                : entry?.status === 'error' ? t('filesSessionFailed') : '',
            ),
          ),
          !open ? null : h(React.Fragment, null,
            entry?.status === 'error' ? message('filesSessionFailed', true,
              button('filesRetry', () => { if (filesScan !== null) void loadFileSession(filesScan, id); })) : null,
            entry?.status !== 'ready' ? null : items.length === 0
              ? message(entry.items.length > 0 ? 'filesFiltered' : 'filesEmpty')
              : h('ul', { className: 'dsh-find-file-list' }, items.map((item) => renderItem(id, item))),
            entry?.truncated ? message('filesTruncated') : null,
          ),
        );
      };

      const body = files.loading ? h('div', { className: 'dsh-find-body' },
        h('div', { className: 'dsh-find-hint', role: 'status' },
          h('span', { className: 'dsh-find-spinner', 'aria-hidden': 'true' }), t('mediaTreeLoading')),
      ) : files.error ? h('div', { className: 'dsh-find-body' },
        message('filesTreeFailed', true, button('filesRetry', rescanFiles)),
      ) : workspaces.length === 0 ? h('div', { className: 'dsh-find-body' },
        h('div', { className: 'dsh-find-hint' }, t('filesTreeEmpty')),
      ) : h('div', { className: 'dsh-find-media-body' }, workspaces.map(({ workspace, sessions }, index) => {
        const key = workspaceKey(workspace);
        const open = files.workspacesOpen.has(key);
        const count = counts[index];
        return h('div', { key, className: 'dsh-find-card' },
          h('button', {
            type: 'button', className: 'dsh-find-card-head dsh-find-ws-head dsh-find-files-branch',
            'aria-expanded': open, title: workspace.workspacePath || workspace.workspaceTitle,
            onClick: () => toggleFileBranch('workspacesOpen', key),
          },
            h('span', { className: 'dsh-find-ws-caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
            h('span', { className: 'dsh-find-card-icon', 'aria-hidden': 'true' }, h('svg', {
              width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
              strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
            }, h('path', { d: 'M3 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }))),
            h('span', { className: 'dsh-find-card-title' }, workspace.workspaceTitle || t('ungrouped')),
            h('span', { className: 'dsh-find-card-count' },
              t('mediaSessionCount', { count: count.sessions }) +
                (count.files > 0 ? ' · ' + t('filesCount', { count: count.files }) : '')),
          ),
          open ? h('div', { className: 'dsh-find-ws-body' },
            sessions.length === 0 ? message('mediaNoSessions') : sessions.map(renderSession),
          ) : null,
        );
      }));

      return h(React.Fragment, null, head, body,
        h('div', { className: 'dsh-find-foot' }, h('span', { className: 'dsh-find-notice' }, t('filesHint'))),
      );
    }

    function mediaSpeakerOf(item) {
      return item.speaker === 'user' ? 'user' : 'assistant';
    }

    // Share one observer per media scroller. Off-screen thumbnails have no src.
    const thumbnailObservers = new WeakMap();
    function watchThumbnail(node, url) {
      const root = node.closest('.dsh-find-media-body');
      if (typeof window.IntersectionObserver !== 'function' || root === null) {
        node.setAttribute('src', url);
        return () => {};
      }
      let watcher = thumbnailObservers.get(root);
      if (watcher === undefined) {
        const sources = new Map();
        const observer = new window.IntersectionObserver((entries) => {
          for (const { target, isIntersecting } of entries) {
            if (!isIntersecting || !sources.has(target)) continue;
            const source = sources.get(target);
            sources.delete(target);
            observer.unobserve(target);
            target.setAttribute('src', source);
          }
        }, { root, rootMargin: '160px 0px' });
        watcher = { sources, observer };
        thumbnailObservers.set(root, watcher);
      }
      watcher.sources.set(node, url);
      watcher.observer.observe(node);
      return () => {
        if (watcher.sources.delete(node)) watcher.observer.unobserve(node);
      };
    }

    function useThumbnailRef(url, isVideo) {
      return React.useMemo(() => {
        let node = null;
        let stop = null;
        return (next) => {
          if (node !== null) {
            stop();
            if (node.hasAttribute('src')) {
              node.removeAttribute('src');
              if (isVideo) node.load();
            }
          }
          node = next;
          if (node !== null && !isVideo) node.removeAttribute('data-ready');
          stop = next === null ? null : watchThumbnail(next, url);
        };
      }, [url, isVideo]);
    }

    function VideoThumbnail({ url }) {
      const ref = useThumbnailRef(url, true);
      return h('video', { className: 'dsh-find-thumb', ref, preload: 'metadata' });
    }

    const IMAGE_THUMB_CONCURRENCY = 4;
    const IMAGE_THUMB_RETRY_MS = [250, 700, 1600];
    const imageThumbnailObservers = new WeakMap();
    const imageThumbnailQueue = new Set();
    let activeImageThumbnails = 0;
    let imagePumpScheduled = false;

    function imageThumbDistance({ node, root }) {
      if (root === null) return 0;
      const image = node.getBoundingClientRect();
      const viewport = root.getBoundingClientRect();
      const top = viewport.top + root.clientTop;
      return Math.max(0, top - image.bottom, image.top - (top + root.clientHeight));
    }

    function scheduleImageThumbnails() {
      if (imagePumpScheduled) return;
      imagePumpScheduled = true;
      void Promise.resolve().then(() => {
        imagePumpScheduled = false;
        if (activeImageThumbnails >= IMAGE_THUMB_CONCURRENCY || imageThumbnailQueue.size === 0) return;
        // Intersection callbacks can report a whole screen at once. Batch the
        // dispatch, then rank using the current viewport, not callback order.
        const ranked = Array.from(imageThumbnailQueue, (job) => [job, imageThumbDistance(job)]);
        ranked.sort((left, right) => left[1] - right[1]);
        for (const [job] of ranked) {
          if (activeImageThumbnails >= IMAGE_THUMB_CONCURRENCY) break;
          imageThumbnailQueue.delete(job);
          if (!job.near) continue;
          activeImageThumbnails += 1;
          void readImageThumbnail(job);
        }
      });
    }

    async function readImageThumbnail(job) {
      const controller = new AbortController();
      job.controller = controller;
      let retry = false;
      try {
        const response = await fetch(job.url, { signal: controller.signal, headers: { accept: 'image/png' } });
        retry = response.status === 409 || response.status === 429 || response.status >= 500;
        if (!response.ok) {
          if (response.status === 503) {
            const body = await response.json().catch(() => null);
            if (body?.error === 'thumbnail-decoder-unavailable') retry = false;
          }
        } else {
          const blob = await response.blob();
          if (!job.stopped && !controller.signal.aborted) {
            job.objectUrl = URL.createObjectURL(blob);
            job.node.setAttribute('src', job.objectUrl);
          }
        }
      } catch {
        retry = !controller.signal.aborted;
      } finally {
        job.controller = null;
        activeImageThumbnails -= 1;
        if (!job.stopped && controller.signal.aborted) enqueueImageThumbnail(job);
        else if (!job.stopped) {
          const delay = IMAGE_THUMB_RETRY_MS[job.attempt++];
          if (retry && delay !== undefined) {
            job.timer = setTimeout(() => {
              job.timer = null;
              enqueueImageThumbnail(job);
            }, delay);
          } else {
            job.done = true;
            job.observer?.unobserve(job.node);
          }
        }
        scheduleImageThumbnails();
      }
    }

    function enqueueImageThumbnail(job) {
      if (job.stopped || job.done || !job.near || job.controller !== null || job.timer !== null) return;
      imageThumbnailQueue.add(job);
      scheduleImageThumbnails();
    }

    function watchImageThumbnail(node, url) {
      const root = node.closest('.dsh-find-media-body');
      const job = { node, root, url, near: false, stopped: false, done: false, attempt: 0,
        observer: null, controller: null, timer: null, objectUrl: null };
      let jobs;
      if (root !== null && typeof window.IntersectionObserver === 'function') {
        let watcher = imageThumbnailObservers.get(root);
        if (watcher === undefined) {
          const jobsByNode = new Map();
          const observer = new window.IntersectionObserver((entries) => {
            for (const { target, isIntersecting } of entries) {
              const entry = jobsByNode.get(target);
              if (entry === undefined || entry.done) continue;
              entry.near = isIntersecting;
              if (isIntersecting) enqueueImageThumbnail(entry);
              else {
                imageThumbnailQueue.delete(entry);
                entry.controller?.abort();
              }
            }
          }, { root, rootMargin: '160px 0px' });
          watcher = { jobs: jobsByNode, observer };
          imageThumbnailObservers.set(root, watcher);
        }
        jobs = watcher.jobs;
        job.observer = watcher.observer;
        jobs.set(node, job);
        job.observer.observe(node);
      } else {
        job.near = true;
        enqueueImageThumbnail(job);
      }
      return () => {
        job.stopped = true;
        imageThumbnailQueue.delete(job);
        jobs?.delete(node);
        job.observer?.unobserve(node);
        job.controller?.abort();
        if (job.timer !== null) clearTimeout(job.timer);
        if (job.objectUrl !== null) {
          node.removeAttribute('src');
          URL.revokeObjectURL(job.objectUrl);
        }
      };
    }

    function ImageThumbnail({ id, name }) {
      const ref = React.useMemo(() => {
        let stop;
        return (node) => {
          stop?.();
          if (node !== null) node.removeAttribute('data-ready');
          stop = node === null ? undefined : watchImageThumbnail(node, ROUTE + '/media/thumbnail?id=' + encodeURIComponent(id));
        };
      }, [id]);
      return h('img', {
        className: 'dsh-find-thumb dsh-find-image-thumb', ref, alt: name, decoding: 'async',
        onLoad: (event) => event.currentTarget.setAttribute('data-ready', ''),
        onError: (event) => event.currentTarget.removeAttribute('data-ready'),
      });
    }

    // Keep the CSS grid geometry and the row-window calculation in sync.
    const MEDIA_GRID = { minWidth: 124, gap: 8, inset: 12, top: 10, bottom: 12 };
    const mediaWindows = new WeakMap();

    function watchMediaGrid(grid, count, publish) {
      const root = grid.closest('.dsh-find-media-body');
      if (root === null) {
        publish({ first: 0, last: count });
        return () => {};
      }
      let windowing = mediaWindows.get(root);
      if (windowing === undefined) {
        const grids = new Map();
        let frame = null;
        function update() {
          frame = null;
          const bounds = root.getBoundingClientRect();
          const viewportTop = bounds.top + root.clientTop;
          const viewportHeight = root.clientHeight;
          // Read geometry for every group before publishing any React updates.
          const updates = [];
          for (const [node, entry] of grids) {
            const width = Math.max(0, node.clientWidth - MEDIA_GRID.inset * 2);
            const columns = Math.max(1, Math.floor((width + MEDIA_GRID.gap) / (MEDIA_GRID.minWidth + MEDIA_GRID.gap)));
            const rowHeight = Math.max(MEDIA_GRID.minWidth, (width - MEDIA_GRID.gap * (columns - 1)) / columns) * 3 / 4;
            const stride = rowHeight + MEDIA_GRID.gap;
            const rows = Math.ceil(entry.count / columns);
            const height = MEDIA_GRID.top + MEDIA_GRID.bottom + rows * stride - MEDIA_GRID.gap;
            const y = viewportTop - node.getBoundingClientRect().top - MEDIA_GRID.top;
            // One window of lookahead in each direction, including fast scrolls.
            const firstRow = Math.min(rows, Math.max(0, Math.floor((y - viewportHeight) / stride)));
            const lastRow = Math.max(firstRow, Math.min(rows, Math.ceil((y + viewportHeight * 2) / stride)));
            const next = { first: firstRow * columns, last: Math.min(entry.count, lastRow * columns),
              top: MEDIA_GRID.top + firstRow * stride, height, columns, rowHeight };
            const previous = entry.previous;
            if (previous === null || Object.keys(next).some((key) => previous[key] !== next[key])) {
              entry.previous = next;
              updates.push([entry, next]);
            }
          }
          for (const [entry, next] of updates) entry.publish(next);
        }
        function schedule() {
          if (frame === null) frame = window.requestAnimationFrame(update);
        }
        const resize = new window.ResizeObserver(schedule);
        resize.observe(root);
        root.addEventListener('scroll', schedule, { passive: true });
        windowing = { grids, resize, schedule, stop() {
          if (frame !== null) window.cancelAnimationFrame(frame);
          resize.disconnect();
          root.removeEventListener('scroll', schedule);
          mediaWindows.delete(root);
        } };
        mediaWindows.set(root, windowing);
      }
      windowing.grids.set(grid, { count, publish, previous: null });
      windowing.resize.observe(grid);
      windowing.schedule();
      return () => {
        windowing.resize.unobserve(grid);
        windowing.grids.delete(grid);
        if (windowing.grids.size === 0) windowing.stop();
        else windowing.schedule();
      };
    }

    function MediaGrid({ items, renderTile }) {
      const supported = typeof window.ResizeObserver === 'function' && typeof window.requestAnimationFrame === 'function';
      const [range, setRange] = React.useState(null);
      const ref = React.useMemo(() => {
        let stop;
        return (node) => {
          stop?.();
          stop = node === null ? undefined : watchMediaGrid(node, items.length, setRange);
        };
      }, [items.length]);
      const visible = !supported ? items : range === null ? [] : items.slice(range.first, range.last);
      const fixed = supported && range?.height !== undefined;
      return h('div', {
        className: 'dsh-find-media-grid', ref: supported ? ref : undefined,
        'data-windowed': fixed ? '' : undefined,
        style: fixed ? { height: range.height, paddingTop: Math.min(range.top, range.height - MEDIA_GRID.bottom),
          gridTemplateColumns: 'repeat(' + range.columns + ', minmax(' + MEDIA_GRID.minWidth + 'px, 1fr))',
          gridAutoRows: range.rowHeight } : undefined,
      }, visible.map(renderTile));
    }

    function Palette() {
      const state = useStore();
      const t = React.useMemo(makeT, []);
      const inputRef = React.useRef(null);

      React.useEffect(() => {
        if (!state.open) return undefined;
        const focus = () => {
          const input = inputRef.current;
          if (input) {
            input.focus();
            input.select();
          }
        };
        focus();
        const timer = setTimeout(focus, 30);
        return () => clearTimeout(timer);
      }, [state.open]);

      const { payload, tab, mediaTree, mediaSpeakers, sessionMedia, speakers, hideArchived, mediaHideArchived } = state;
      const isText = state.open && tab === 'text';
      const isMedia = state.open && tab === 'media';
      const textView = React.useMemo(() => {
        if (!isText) return null;
        const loaded = flattenHits(payload);
        // Archive and speaker filters change display only, not the Host scan.
        const hits = hideArchived ? loaded.filter((hit) => hit.archived !== true) : loaded;
        const split = splitHits(hits);
        const shownConversation = split.conversation.filter((hit) => speakers[SPEAKER_LABELS[hit.speaker] ? hit.speaker : 'assistant'] !== false);
        return {
          hits,
          hiddenArchived: loaded.length - hits.length,
          speakerHidden: split.conversation.length - shownConversation.length,
          grouped: { thinking: groupHits(split.thinking), conversation: groupHits(shownConversation) },
        };
      }, [isText, payload, hideArchived, speakers]);
      const mediaView = React.useMemo(() => {
        if (!isMedia) return null;
        const shownBySession = new Map();
        let loadedMediaCount = 0;
        for (const [id, entry] of Object.entries(sessionMedia)) {
          if (entry.status !== 'ready' && !Array.isArray(entry.items)) continue;
          const shown = (entry.items || []).filter((item) =>
            mediaSpeakers[mediaSpeakerOf(item)] !== false && (!mediaHideArchived || item.archived !== true),
          );
          shownBySession.set(id, shown);
          loadedMediaCount += shown.length;
        }
        return { shownBySession, loadedMediaCount };
      }, [isMedia, sessionMedia, mediaSpeakers, mediaHideArchived]);

      if (!state.open) return state.jumpNotice ? h(React.Fragment, null,
        h('style', null, CSS),
        h('div', { className: 'dsh-find-jump-notice', role: 'status', 'aria-live': 'polite' },
          state.jumpNotice,
          h('button', { type: 'button', 'aria-label': t('jumpDismiss'), onClick: () => {
            cancelJump(); setStore({ jumpNotice: '' });
          } }, '×'),
        ),
      ) : null;

      const { grouped, speakerHidden } = textView || {};
      const mediaWorkspaces = isMedia && Array.isArray(mediaTree?.workspaces) ? mediaTree.workspaces : [];
      const expandedMap = state.expanded;
      const loadedMediaCount = mediaView?.loadedMediaCount ?? 0;
      const loadedSessions = mediaView?.shownBySession.size ?? 0;
      const shownMediaOf = (sessionId) => mediaView.shownBySession.get(sessionId) || [];

      const renderSpeakerChips = () =>
        h(
          'div',
          { className: 'dsh-find-chips' },
          SPEAKER_ORDER.map((key) =>
            h(
              'button',
              {
                key,
                type: 'button',
                className: 'dsh-find-chip',
                'data-speaker': key,
                'data-on': speakers[key] === true ? 'true' : 'false',
                title: t(SPEAKER_LABELS[key]),
                onClick: () => toggleSpeaker(key),
              },
              t(SPEAKER_LABELS[key]),
            ),
          ),
        );

      const renderPaneHead = (channel, labelKey) => h(
        'div',
        { className: 'dsh-find-pane-head' },
        h('span', null, t(labelKey)),
        channel === 'conversation' ? renderSpeakerChips() : null,
        payload !== null && !state.loading && !state.error && state.searched.trim().length > 0
          ? h('span', { className: 'dsh-find-pane-count' }, String(grouped[channel].flat))
          : null,
      );

      const renderPane = (channel, labelKey) => {
        const bundle = grouped[channel];
        const cards = [];
        for (const card of bundle.cards) {
          const inner = [];
          for (const session of card.sessions) {
            const sessionLabel = session.title || session.sessionId.slice(0, 12);
            inner.push(
              h(
                'div',
                {
                  key: 's:' + channel + ':' + card.key + ':' + session.sessionId,
                  className: 'dsh-find-session-head',
                },
                h('span', { className: 'dsh-find-session', title: sessionLabel }, sessionLabel),
                session.archived
                  ? h('span', { className: 'dsh-find-archived', key: 'archived' }, t('archivedBadge'))
                  : null,
                h('span', { className: 'dsh-find-count' }, t('occurrences', { count: session.occurrences })),
              ),
            );
            for (const hit of session.hits) {
              const speaker = SPEAKER_LABELS[hit.speaker] ? hit.speaker : 'assistant';
              const snippet = String(hit.snippet || '');
              const head = hit.clippedStart ? h('span', { className: 'dsh-find-ellipsis', key: 'cs' }, '…') : null;
              const tail = hit.clippedEnd ? h('span', { className: 'dsh-find-ellipsis', key: 'ce' }, '…') : null;
              inner.push(
                h(
                  'div',
                  {
                    key: 'h:' + channel + ':' + session.sessionId + ':' + hit.seq,
                    className: 'dsh-find-row',
                    role: 'option',
                    'data-archived': hit.archived === true ? 'true' : 'false',
                    onClick: () => jumpToHit(hit),
                  },
                  channel === 'conversation'
                    ? h(
                        'span',
                        { className: 'dsh-find-speaker', key: 'speaker', 'data-speaker': speaker },
                        t(SPEAKER_LABELS[speaker]),
                      )
                    : null,
                  h(
                    'p',
                    { className: 'dsh-find-snippet' },
                    head,
                    h(Highlighted, { text: snippet, query: state.searched }),
                    tail,
                  ),
                ),
              );
            }
          }
          cards.push(
            h(
              'div',
              { key: 'c:' + channel + ':' + card.key + ':' + String(cards.length), className: 'dsh-find-card' },
              h(
                'div',
                { className: 'dsh-find-card-head' },
                h(
                  'span',
                  { className: 'dsh-find-card-icon', 'aria-hidden': 'true' },
                  h(
                    'svg',
                    {
                      width: 13,
                      height: 13,
                      viewBox: '0 0 24 24',
                      fill: 'none',
                      stroke: 'currentColor',
                      strokeWidth: 2,
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                    },
                    h('path', { d: 'M3 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
                  ),
                ),
                h(
                  'span',
                  { className: 'dsh-find-card-title', title: card.workspacePath || card.workspaceTitle },
                  card.workspaceTitle || t('ungrouped'),
                ),
                h('span', { className: 'dsh-find-card-count' }, t('occurrences', { count: card.occurrences })),
              ),
              inner,
            ),
          );
        }
        return h(
          'div',
          { key: channel, className: 'dsh-find-pane' },
          renderPaneHead(channel, labelKey),
          h(
            'div',
            { className: 'dsh-find-pane-body' },
            cards.length === 0
              ? h(
                  'div',
                  { className: 'dsh-find-pane-empty' },
                  channel === 'conversation' && speakerHidden > 0
                    ? t('speakerFiltered', { count: speakerHidden })
                    : t('paneEmpty'),
                )
              : cards,
          ),
        );
      };

      const renderTabs = () =>
        h(
          'div',
          { className: 'dsh-find-tabs', role: 'tablist' },
          [
            { key: 'text', labelKey: 'tabText' },
            { key: 'media', labelKey: 'tabMedia' },
            { key: 'files', labelKey: 'tabFiles' },
          ].map((entry) =>
            h(
              'button',
              {
                key: entry.key,
                type: 'button',
                role: 'tab',
                className: 'dsh-find-tab',
                'data-active': tab === entry.key ? 'true' : 'false',
                'aria-selected': tab === entry.key ? 'true' : 'false',
                onClick: () => switchTab(entry.key),
              },
              t(entry.labelKey),
            ),
          ),
        );

      const renderMediaChips = () =>
        h(
          'div',
          { className: 'dsh-find-chips' },
          ['user', 'assistant'].map((key) =>
            h(
              'button',
              {
                key,
                type: 'button',
                className: 'dsh-find-chip',
                'data-speaker': key,
                'data-on': mediaSpeakers[key] === true ? 'true' : 'false',
                title: t(SPEAKER_LABELS[key]),
                onClick: () => toggleMediaSpeaker(key),
              },
              t(SPEAKER_LABELS[key]),
            ),
          ),
        );

      const renderMediaHead = () => {
        const totalSessions = mediaWorkspaces.reduce((total, workspace) => total + workspace.sessions.length, 0);
        return h(
          'div',
          { className: 'dsh-find-head' },
          h(
            'span',
            { className: 'dsh-find-icon', 'aria-hidden': 'true' },
            h(
              'svg',
              {
                width: 16,
                height: 16,
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 2,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              },
              h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
              h('circle', { cx: 8.5, cy: 9.5, r: 1.6 }),
              h('path', { d: 'M21 15.5 16 10.5 9 17.5' }),
            ),
          ),
          h(
            'span',
            { className: 'dsh-find-media-summary' },
            mediaTree === null
              ? ''
              : t('mediaOutline', {
                  workspaces: mediaWorkspaces.length,
                  sessions: totalSessions,
                  loaded: loadedMediaCount,
                }),
          ),
          renderMediaChips(),
          h(
            'label',
            { className: 'dsh-find-toggle', title: t('hideArchivedHint') },
            h('input', {
              type: 'checkbox',
              checked: mediaHideArchived === true,
              onChange: (event) => setStore({ mediaHideArchived: event.target.checked }),
            }),
            h('span', null, t('hideArchived')),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-find-refresh',
              title: t('mediaExpandAllHint'),
              onClick: () => void expandAll(),
              disabled: state.expanding === true,
            },
            state.expanding === true ? t('mediaExpanding') : t('mediaExpandAll'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-find-refresh',
              title: t('mediaCollapseAllHint'),
              onClick: () => collapseAll(),
              disabled: !state.expanding && Object.keys(expandedMap).length === 0 && Object.keys(sessionMedia).length === 0,
            },
            t('mediaCollapseAll'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-find-refresh',
              title: t('mediaRefreshHint'),
              onClick: () => {
                void refreshMedia();
              },
              disabled: state.mediaTreeLoading === true,
            },
            t('mediaRefresh'),
          ),
        );
      };

      const renderTile = (item) =>
        h(
          'div',
          {
            key: item.id,
            className: 'dsh-find-tile',
            title: item.name,
            'data-archived': item.archived === true ? 'true' : 'false',
            onClick: () => setStore({ preview: item }),
            onContextMenu: (event) => openMediaMenu(item, event),
          },
          item.kind === 'video'
            ? h(VideoThumbnail, { url: item.url })
            : h(ImageThumbnail, { id: item.id, name: item.name }),
          h(
            'span',
            { className: 'dsh-find-tile-badge', 'data-speaker': mediaSpeakerOf(item) },
            t(mediaSpeakerOf(item) === 'user' ? 'speakerUser' : 'speakerAssistant'),
          ),
          item.archived === true
            ? h('span', { className: 'dsh-find-tile-archived', key: 'a' }, t('archivedBadge'))
            : null,
          item.kind === 'video'
            ? h('span', { className: 'dsh-find-tile-kind', key: 'v' }, t('mediaVideo'))
            : null,
          h('span', { className: 'dsh-find-tile-name' }, item.name),
        );

      const renderSessionRow = (workspace, session) => {
        const entry = sessionMedia[session.sessionId];
        const status = entry === undefined ? 'idle' : entry.status;
        const shown = shownMediaOf(session.sessionId);
        const open = entry !== undefined && entry.open === false ? false : true;
        const foldable = status === 'ready' && shown.length > 0;
        const stateText =
          status === 'loading'
            ? t('mediaReading')
            : status === 'error'
              ? t('mediaReadFailed')
              : status === 'partial'
                ? t('mediaPartial')
                : status === 'ready'
                  ? shown.length === 0
                    ? t('mediaNone')
                    : t('mediaCount', { count: shown.length })
                  : '';
        return h(
          'div',
          { key: 's:' + session.sessionId, className: 'dsh-find-session-block' },
          h(
            'div',
            {
              className: 'dsh-find-session-row',
              'data-open': foldable && open ? 'true' : 'false',
              onClick: () => toggleSessionMedia(session.sessionId),
              title: session.cwd || session.sessionId,
            },
            h(
              'span',
              { className: 'dsh-find-session-caret', 'aria-hidden': 'true' },
              foldable ? (open ? '▾' : '▸') : '·',
            ),
            h(
              'span',
              { className: 'dsh-find-session-title', 'data-archived': session.archived === true ? 'true' : 'false' },
              session.title || session.sessionId,
            ),
            session.archived === true
              ? h('span', { className: 'dsh-find-archived', key: 'a' }, t('archivedBadge'))
              : null,
            status === 'loading'
              ? h('span', { className: 'dsh-find-spinner', key: 'sp' })
              : null,
            h(
              'span',
              { className: 'dsh-find-session-state', 'data-status': status },
              stateText,
            ),
          ),
          status === 'error' && entry && entry.error
            ? h('div', { className: 'dsh-find-menu-error' }, entry.error)
            : null,
          shown.length > 0 && open
            ? h(MediaGrid, { items: shown, renderTile })
            : null,
        );
      };

      const renderMediaBody = () => {
        if (state.mediaTreeError) {
          return h(
            'div',
            { className: 'dsh-find-body' },
            h('div', { className: 'dsh-find-error' }, t('failed', { message: state.mediaTreeError })),
          );
        }
        if (state.mediaTreeLoading && mediaTree === null) {
          return h(
            'div',
            { className: 'dsh-find-body' },
            h('div', { className: 'dsh-find-hint' }, h('span', { className: 'dsh-find-spinner' }), t('mediaTreeLoading')),
          );
        }
        if (mediaWorkspaces.length === 0) {
          return h('div', { className: 'dsh-find-body' }, h('div', { className: 'dsh-find-hint' }, t('mediaEmpty')));
        }
        return h(
          'div',
          { className: 'dsh-find-media-body' },
          mediaWorkspaces.map((workspace) => {
            const key = workspaceKey(workspace);
            const isOpen = expandedMap[key] === true;
            const sessions = workspace.sessions.filter(
              (session) => mediaHideArchived !== true || session.archived !== true,
            );
            const loadedHere = sessions.reduce((total, session) => total + shownMediaOf(session.sessionId).length, 0);
            return h(
              'div',
              { key: 'mc:' + key, className: 'dsh-find-card' },
              h(
                'div',
                {
                  className: 'dsh-find-card-head dsh-find-ws-head',
                  'data-open': isOpen ? 'true' : 'false',
                  title: workspace.workspacePath || workspace.workspaceTitle,
                  onClick: () => toggleWorkspace(workspace),
                },
                h(
                  'span',
                  { className: 'dsh-find-ws-caret', 'aria-hidden': 'true' },
                  isOpen ? '▾' : '▸',
                ),
                h(
                  'span',
                  { className: 'dsh-find-card-icon', 'aria-hidden': 'true' },
                  h(
                    'svg',
                    {
                      width: 13,
                      height: 13,
                      viewBox: '0 0 24 24',
                      fill: 'none',
                      stroke: 'currentColor',
                      strokeWidth: 2,
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                    },
                    h('path', { d: 'M3 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
                  ),
                ),
                h(
                  'span',
                  { className: 'dsh-find-card-title' },
                  workspace.workspaceTitle || t('ungrouped'),
                ),
                h(
                  'span',
                  { className: 'dsh-find-card-count' },
                  loadedHere > 0
                    ? t('mediaCountTwo', { count: loadedHere, sessions: sessions.length })
                    : t('mediaSessionCount', { count: sessions.length }),
                ),
              ),
              isOpen
                ? h(
                    'div',
                    { className: 'dsh-find-ws-body' },
                    sessions.length === 0
                      ? h('div', { className: 'dsh-find-pane-empty' }, t('mediaNoSessions'))
                      : sessions.map((session) => renderSessionRow(workspace, session)),
                  )
                : null,
            );
          }),
        );
      };

      const renderFoot = () =>
        h(
          'div',
          { className: 'dsh-find-foot' },
          h(
            'span',
            { className: 'dsh-find-notice' },
            state.notice ? state.notice : tab === 'media' ? t('mediaHint') : t('hint'),
          ),
          h(
            'span',
            { className: 'dsh-find-foot-right' },
            tab === 'media'
              ? loadedSessions > 0
                ? t('mediaLoadedTotal', { count: loadedMediaCount, sessions: loadedSessions })
                : ''

              : payload !== null && payload.totalHits > 0
                ? (payload.truncated ? t('truncated', { count: payload.totalHits }) + ' · ' : '') +
                  t('elapsed', { ms: payload.tookMs })
                : '',
          ),
        );

      const renderPreview = () => {
        const preview = state.preview;
        if (preview === null) return null;
        return h(
          'div',
          { key: 'preview', className: 'dsh-find-preview', onClick: () => setStore({ preview: null }) },
          preview.kind === 'video'
            ? h('video', {
                className: 'dsh-find-preview-media',
                src: preview.url,
                controls: true,
                autoPlay: true,
                onClick: (event) => event.stopPropagation(),
              })
            : h('img', {
                className: 'dsh-find-preview-media',
                src: preview.url,
                alt: preview.name,
                onClick: (event) => event.stopPropagation(),
              }),
          h('div', { className: 'dsh-find-preview-caption' }, preview.name),
        );
      };

      const renderMenu = () => {
        const menu = state.menu;
        if (menu === null) return null;
        return h(
          React.Fragment,
          { key: 'menu-fragment' },
          h('div', {
            key: 'menu-layer',
            className: 'dsh-find-menu-layer',
            onMouseDown: () => closeMediaMenu(),
            onContextMenu: (event) => {
              event.preventDefault();
              closeMediaMenu();
            },
          }),
          h(
            'div',
            {
              key: 'menu',
              className: 'dsh-find-menu',
              style: { left: menu.x + 'px', top: menu.y + 'px' },
              onMouseDown: (event) => event.stopPropagation(),
              onContextMenu: (event) => event.preventDefault(),
            },
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-find-menu-item',
                onClick: () => void saveMediaAs(menu.item),
              },
              t('menuSaveAs'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-find-menu-item',
                onClick: () => void revealMedia(menu.item),
              },
              t('menuReveal'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-find-menu-item dsh-find-menu-danger',
                onClick: () => confirmDelete(menu),
              },
              menu.confirming === true ? t('menuDeleteConfirm') : t('menuDelete'),
            ),
            menu.error ? h('div', { className: 'dsh-find-menu-error' }, menu.error) : null,
          ),
        );
      };

      const renderTextBody = () => {
        const { hits, hiddenArchived } = textView;
        let standalone = null;
        if (state.error) {
          standalone = h('div', { className: 'dsh-find-error' }, t('failed', { message: state.error }));
        } else if (state.query.trim().length === 0) {
          standalone = h('div', { className: 'dsh-find-hint' }, t('empty'));
        } else if (state.searched.trim().length === 0) {
          standalone = h('div', { className: 'dsh-find-hint' }, t('ready'));
        } else if (state.loading && hits.length === 0) {
          standalone = h('div', { className: 'dsh-find-hint' }, t('searching'));
        } else if (!state.loading && hits.length === 0 && payload !== null) {
          standalone = h(
            'div',
            { className: 'dsh-find-hint' },
            hiddenArchived > 0 ? t('noResultsHidden', { count: hiddenArchived }) : t('noResults'),
          );
        } else if (hits.length === 0) {
          standalone = h('div', { className: 'dsh-find-hint' }, t('empty'));
        }

        return standalone !== null
          ? h(React.Fragment, null,
              h('div', { className: 'dsh-find-panes', style: { flex: 'none' } },
                PANES.map((entry) => h('div', { key: entry.channel, className: 'dsh-find-pane' },
                  renderPaneHead(entry.channel, entry.labelKey),
                )),
              ),
              h('div', { className: 'dsh-find-body' }, standalone),
            )
          : h('div', { className: 'dsh-find-panes' }, PANES.map((entry) => renderPane(entry.channel, entry.labelKey)));
      };

      const hits = textView?.hits;
      const summary = hits?.length > 0
        ? t('results', { count: hits.length, sessions: new Set(hits.map((hit) => hit.sessionId)).size })
        : '';

      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          if (store.menu !== null) {
            closeMediaMenu();
            return;
          }
          if (store.preview !== null) {
            setStore({ preview: null });
            return;
          }
          closePalette();
          return;
        }
        if (event.key === 'Enter' && tab === 'text') {
          event.preventDefault();
          event.stopPropagation();
          submitSearch();
        }
      };

      const onChange = (event) => {
        const value = event.target.value.slice(0, MAX_QUERY);
        if (value === store.query) return;
        if (inflight !== null || debounceTimer !== null) cancelSearch();
        setStore({ ...TEXT_SEARCH_IDLE, query: value });
      };

      return h(
        React.Fragment,
        null,
        h('style', { key: 'style' }, CSS),
        h(
          'div',
          {
            className: 'dsh-find-overlay',
            key: 'overlay',
            'data-dsh-find-dialog': 'true',
            'data-dfind-theme': state.theme === 'dark' || state.theme === 'light' ? state.theme : 'auto',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('title'),
            tabIndex: -1,
            onKeyDown,
          },
          h('div', { className: 'dsh-find-backdrop', onMouseDown: () => closePalette() }),
          h(
            'div',
            { className: 'dsh-find-panel' },
            renderTabs(),
            tab === 'text'
              ? h(
                  'div',
                  { className: 'dsh-find-head' },
              h(
                'span',
                { className: 'dsh-find-icon', 'aria-hidden': 'true' },
                h(
                  'svg',
                  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' },
                  h('circle', { cx: 10.5, cy: 10.5, r: 6.5 }),
                  h('path', { d: 'M15.6 15.6 21 21' }),
                ),
              ),
              h('input', {
                ref: inputRef,
                className: 'dsh-find-input',
                value: state.query,
                placeholder: t('placeholder'),
                spellCheck: false,
                autoComplete: 'off',
                onChange,
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-find-submit',
                  onClick: submitSearch,
                  disabled: state.query.trim().length === 0,
                },
                t('search'),
              ),
              h(
                'label',
                { className: 'dsh-find-toggle', title: t('hideArchivedHint') },
                h('input', {
                  type: 'checkbox',
                  checked: state.hideArchived === true,
                  onChange: (event) => setStore({ hideArchived: event.target.checked }),
                }),
                h('span', null, t('hideArchived')),
              ),
              h(
                'span',
                { className: 'dsh-find-status' },
                state.loading
                  ? h(React.Fragment, null, h('span', { className: 'dsh-find-spinner' }), t('searching'))
                  : summary,
              ),
                )
              : tab === 'media' ? renderMediaHead() : null,
            tab === 'files' ? h(FilesPanel, { files: state.files, t }) : tab === 'text' ? renderTextBody() : renderMediaBody(),
            tab !== 'files' ? renderFoot() : null,
          ),
          isMedia ? renderPreview() : null,
          isMedia ? renderMenu() : null,
        ),
      );
    }

    /* --------------------------------------------------------------- jump */

    // Chat has no public message-navigation API yet. Keep this DOM adapter
    // identity-scoped and fail closed if the installed Chat contract changes.
    let activeJump = null;
    let flashCleanup = null;

    function cancelJump() {
      if (activeJump) activeJump.abort();
      activeJump = null;
      if (flashCleanup) flashCleanup();
      if (store.jumpNotice) setStore({ jumpNotice: '' });
    }

    function jumpDelay(signal, ms) {
      return new Promise((resolve) => {
        if (signal.aborted) return resolve();
        const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
        const timer = setTimeout(done, ms);
        signal.addEventListener('abort', done, { once: true });
      });
    }

    function untilJumpAbort(promise, signal) {
      return new Promise((resolve, reject) => {
        const abort = () => { cleanup(); reject(new Error('Jump cancelled')); };
        const cleanup = () => signal.removeEventListener('abort', abort);
        if (signal.aborted) return abort();
        signal.addEventListener('abort', abort, { once: true });
        Promise.resolve(promise).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
      });
    }

    function nodeOwnsHit(node, hit) {
      const data = node.data || {};
      if (data.seq === hit.seq || data.finalNode?.seq === hit.seq) return true;
      // Tool lifecycle nodes may contain nested results.
      const pending = data.root ? [data.root] : [];
      while (pending.length) {
        const call = pending.pop();
        if (call.seq === hit.seq) return true;
        if (Array.isArray(call.subCalls)) pending.push(...call.subCalls);
      }
      return false;
    }

    function hitAnchors(snapshot, hit) {
      if (!snapshot?.nodes || typeof snapshot.nodes.values !== 'function') return [];
      const keys = new Set();
      for (const node of snapshot.nodes.values()) {
        if (nodeOwnsHit(node, hit)) keys.add(String(node.key));
      }
      if (!keys.size) return [];
      // Never confuse a fork/embedded conversation with the selected session.
      // Duplicate visible mounts are ambiguous: fail closed instead of guessing.
      const roots = Array.from(document.querySelectorAll('[data-conversation-content][data-conversation-session]')).filter(element =>
        element.getAttribute('data-conversation-session') === hit.sessionId &&
        element.getAttribute('data-content-phase') === 'active' && visibleForJump(element),
      );
      if (roots.length !== 1) return [];
      const preferred = hit.channel === 'thinking' ? 'reasoning' : 'response';
      return Array.from(roots[0].querySelectorAll('[data-chat-node-key]')).filter(element => {
        const part = element.getAttribute('data-chat-group-part');
        return keys.has(element.getAttribute('data-chat-node-key')) && element.isConnected &&
          element.closest('[data-conversation-content]') === roots[0] && (!part || part === preferred);
      });
    }

    function revealForJump(element) {
      // beforematch runs Chat's own disclosure + reading-interruption handlers.
      // Do not remove hidden attributes behind React's back.
      element.dispatchEvent(new Event('beforematch', { bubbles: true }));
    }

    function visibleForJump(element) {
      if (!element?.isConnected || !element.getClientRects().length) return false;
      for (let current = element; current; current = current.parentElement) {
        if (current.hasAttribute('hidden')) return false;
      }
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function textLanding(anchor, query, sourceText, offset) {
      if (!query) return null;
      const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
      const spans = [];
      let text = '', node, segment = 0;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest('button,script,style,[aria-hidden="true"]')) { segment++; continue; }
        const value = node.nodeValue || '';
        spans.push({ node, segment, start: text.length, end: text.length + value.length });
        text += value;
      }
      // Markdown can split one query across inline text nodes. Source context
      // disambiguates repeated words/blocks; no global-document fallback.
      const needle = query.toLowerCase(), lower = text.toLowerCase();
      // Lowercasing can expand a code point (İ -> i + combining dot).
      // Preserve a folded-to-original UTF-16 map before selecting a DOM span.
      const originalAt = [], originalEndAt = [];
      let original = 0;
      for (const point of text) {
        for (let n = 0; n < point.toLowerCase().length; n++) {
          originalAt.push(original); originalEndAt.push(original + point.length);
        }
        original += point.length;
      }
      const candidates = [];
      let from = 0, index;
      while ((index = lower.indexOf(needle, from)) >= 0) {
        const span = spans.find(item => item.end > originalAt[index]);
        if (span) candidates.push({ element: span.node.parentElement, index });
        from = index + Math.max(1, needle.length);
      }
      const landingFor = candidate => {
        const start = originalAt[candidate.index];
        const end = originalEndAt[candidate.index + needle.length - 1];
        const first = spans.find(item => item.end > start);
        const last = spans.find(item => item.start < end && item.end >= end);
        if (!first || !last) return null;
        let range = null;
        try {
          // A single Range must not paint excluded text between searchable spans.
          if (first.segment !== last.segment) return { element: candidate.element, range: null };
          range = document.createRange();
          range.setStart(first.node, start - first.start);
          range.setEnd(last.node, end - last.start);
        } catch (_) { range = null; }
        return { element: candidate.element, range };
      };
      // A unique word in the group may belong to a different content block.
      // Require the complete source block when available; otherwise only rank
      // genuinely repeated candidates with source context below.
      if (typeof sourceText === 'string' && Number.isInteger(offset)) {
        const block = sourceText.toLowerCase();
        const start = lower.indexOf(block);
        if (start >= 0 && lower.indexOf(block, start + 1) < 0) {
          const expected = start + sourceText.slice(0, offset).toLowerCase().length;
          const exact = candidates.find(candidate => candidate.index === expected);
          if (exact) return landingFor(exact);
        }
      }
      if (candidates.length === 1) return null;
      if (!candidates.length || typeof sourceText !== 'string' || !Number.isInteger(offset)) return null;
      const before = sourceText.slice(Math.max(0, offset - 60), offset).toLowerCase();
      // Find the source match's actual length, not query.length: its original
      // case may occupy a different number of UTF-16 units after folding.
      let matchEnd = offset, foldedLength = 0;
      for (const point of sourceText.slice(offset)) {
        if (foldedLength >= needle.length) break;
        matchEnd += point.length; foldedLength += point.toLowerCase().length;
      }
      const after = sourceText.slice(matchEnd, matchEnd + 60).toLowerCase();
      const scored = candidates.map(candidate => {
        let score = 0;
        const left = lower.slice(0, candidate.index), right = lower.slice(candidate.index + needle.length);
        for (let n = 1; n <= before.length && left.endsWith(before.slice(-n)); n++) score++;
        for (let n = 1; n <= after.length && right.startsWith(after.slice(0, n)); n++) score++;
        return { ...candidate, score };
      }).sort((a, b) => b.score - a.score);
      return scored[0].score >= 8 && scored[0].score > scored[1].score ? landingFor(scored[0]) : null;
    }

    function scrollToHit(element, range, locator = element) {
      const scroller = element.closest('[data-conversation-scroll]');
      if (!scroller) throw new Error('Chat scroll container unavailable');
      revealForJump(element);
      const process = element.closest('[data-step-process-body]');
      if (process) process.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 0 }));
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      // Commit inner first, then outer, before tail-follow can restore bottom.
      if (process) {
        process.dispatchEvent(new Event('scroll'));
        process.dispatchEvent(new Event('scrollend', { bubbles: true }));
      }
      scroller.dispatchEvent(new Event('scroll'));
      scroller.dispatchEvent(new Event('scrollend'));
      if (flashCleanup) flashCleanup();
      // Paint without wrapping React-owned text, changing the user's selection,
      // or affecting line wrapping. Unsupported browsers retain the locator.
      const registry = window.CSS?.highlights;
      let highlight = null;
      if (range && registry && typeof window.Highlight === 'function') {
        try {
          highlight = new window.Highlight(range);
          highlight.priority = 1;
          registry.set(HIT_HIGHLIGHT, highlight);
        } catch (_) { highlight = null; }
      }
      if (!highlight) locator.classList.add(FLASH_CLASS);
      const timer = setTimeout(() => cleanup(), HIT_DURATION_MS);
      const cleanup = () => {
        clearTimeout(timer); locator.classList.remove(FLASH_CLASS);
        if (highlight && registry.get(HIT_HIGHLIGHT) === highlight) registry.delete(HIT_HIGHLIGHT);
        if (flashCleanup === cleanup) flashCleanup = null;
      };
      flashCleanup = cleanup;
      return !!highlight;
    }

    async function locateHit(reference, hit, query, signal) {
      const conversation = safeService('uiConversation');
      if (!conversation || typeof conversation.binding !== 'function') throw new Error('Chat projection unavailable');
      const target = conversation.binding(reference.binding).target('chat');
      const unsubscribe = target.subscribe(() => {});
      try {
        const entries = reference.binding.eventSource.getSnapshot().entries;
        const event = entries.find(entry => entry.type === 'event' && entry.event?.seq === hit.seq)?.event;
        if (!event || event.type !== hit.type) throw new Error('Original record unavailable');
        const message = event.type === 'user/message' ? event.data : event.data?.message;
        if (hit.location?.messageId !== undefined && String(message?.id) !== String(hit.location.messageId)) {
          throw new Error('Original message changed');
        }
        const sourceText = message?.content?.[hit.location?.contentIndex]?.text;
        // Allow the selected Chat mount and its initial history commit to finish.
        await jumpDelay(signal, 160);
        const stableSince = new WeakMap();
        const revealed = new WeakSet();
        const deadline = Date.now() + 7000;
        while (!signal.aborted && Date.now() < deadline) {
          const anchors = hitAnchors(target.getSnapshot(), hit);
          let fallback = null;
          for (const anchor of anchors) {
            revealForJump(anchor);
            if (!stableSince.has(anchor)) stableSince.set(anchor, Date.now());
            // Chat's first layout/restore and disclosure effects must settle
            // after this target mount, not merely after session.ready.
            if (Date.now() - stableSince.get(anchor) < 160) continue;
            // No content-index DOM contract exists. Multiple same-channel
            // blocks (or nested Tool results) cannot be distinguished safely.
            const blockType = hit.channel === 'thinking' ? 'reasoning' : 'text';
            const sourceBlocks = message?.content?.filter(block => block.type === blockType && typeof block.text === 'string' && block.text.trim()) || [];
            let textReady = ['user/message', 'assistant/message'].includes(hit.type) && sourceBlocks.length === 1 &&
              message?.content?.[hit.location?.contentIndex] === sourceBlocks[0];
            if (hit.channel === 'thinking') {
              const rows = Array.from(anchor.querySelectorAll('[data-variant="think"]'));
              const reasoning = message?.content?.filter(block => block.type === 'reasoning') || [];
              // The installed renderer has no content-index DOM attribute.
              // Only auto-open an unambiguous single reasoning block/row.
              if (reasoning.length === 1 && rows.length === 1 && !rows[0].hasAttribute('data-expanded') && !revealed.has(rows[0])) {
                const button = rows[0].querySelector('[data-disclosure-row][role="button"][aria-expanded="false"]');
                if (button) { revealed.add(rows[0]); button.click(); continue; }
              }
              // Collapsed summaries are not the original reasoning body.
              if (rows.some(row => !row.hasAttribute('data-expanded'))) textReady = false;
            }
            // Tool lifecycle groups may include inputs and nested results with
            // the same text. Without a result-specific DOM id, stop at message.
            const landing = textReady ? textLanding(anchor, query, sourceText, hit.location?.matchOffset) : null;
            if (landing) {
              if (!visibleForJump(landing.element)) { revealForJump(landing.element); continue; }
              if (signal.aborted) return;
              return scrollToHit(landing.element, landing.range, anchor) ? 'exact' : 'message';
            }
            if (!fallback && visibleForJump(anchor)) fallback = anchor;
          }
          // Give disclosures and initial mount time to publish. A message-only
          // fallback is honest, and never selects an unrelated repeated word.
          if (fallback && Date.now() > deadline - 6200 && visibleForJump(fallback) &&
            hitAnchors(target.getSnapshot(), hit).includes(fallback)) {
            if (!signal.aborted) scrollToHit(fallback);
            return 'message';
          }
          await jumpDelay(signal, 80);
        }
        if (!signal.aborted) throw new Error('Message anchor unavailable');
      } finally { unsubscribe(); }
    }

    async function jumpToHit(hit) {
      cancelJump();
      if (!hit) return;
      const t = makeT();
      if (hit.archived === true) { flashNotice(t('archivedNotice')); return; }
      const controller = new AbortController();
      activeJump = controller;
      const signal = controller.signal;
      const query = String(store.searched || store.query || '').trim();
      const uiWorkspace = safeService('uiWorkspace'), sessions = safeService('sessions');
      const layout = safeService('layout');
      if (!uiWorkspace?.openSession || !sessions?.using || !layout?.beginNavigation || !Number.isInteger(hit.seq)) {
        flashNotice(t('jumpFailed')); cancelJump(); return;
      }
      closePalette();
      setStore({ jumpNotice: t('jumpLoading') });
      let navigation, timeout;
      const abort = () => controller.abort();
      let timedOut = false;
      const userIntent = event => {
        if (event.isTrusted && (event.type !== 'keydown' || ['Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'].includes(event.key))) abort();
      };
      try {
        uiWorkspace.openSession(hit.sessionId);
        navigation = layout.beginNavigation();
        if (navigation.aborted) controller.abort();
        navigation.addEventListener('abort', abort, { once: true });
        for (const type of ['wheel', 'pointerdown', 'touchstart', 'keydown']) document.addEventListener(type, userIntent, true);
        timeout = setTimeout(() => { timedOut = true; abort(); }, 12000);
        const result = await untilJumpAbort(sessions.using(hit.sessionId, { source: 'controllerOperation', signal }, async reference => {
          await untilJumpAbort(reference.ready, signal);
          await untilJumpAbort(reference.binding.session.loadThrough(hit.seq), signal);
          if (signal.aborted) return;
          return locateHit(reference, hit, query, signal);
        }), signal);
        if (!signal.aborted && activeJump === controller) setStore({ jumpNotice: result === 'exact' ? '' : t('jumpMessage') });
      } catch (error) {
        if (!signal.aborted && activeJump === controller) {
          console.warn('[dsh-find] jump failed', error);
          setStore({ jumpNotice: t('jumpFailed') });
        }
      } finally {
        clearTimeout(timeout);
        navigation?.removeEventListener('abort', abort);
        for (const type of ['wheel', 'pointerdown', 'touchstart', 'keydown']) document.removeEventListener(type, userIntent, true);
        if (activeJump === controller) {
          activeJump = null;
          if (signal.aborted) setStore({ jumpNotice: timedOut ? t('jumpFailed') : '' });
        }
      }
    }

    /* ------------------------------------------------------- settings page */

    /* Rendered inside the native settings modal, never inside the palette, so
       it uses the Host tokens directly and is never re-themed by the palette. */
    function themeIcon(kind) {
      const common = {
        width: 22,
        height: 22,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      };
      if (kind === 'dark') {
        return h('svg', common, h('path', { d: 'M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z' }));
      }
      if (kind === 'light') {
        return h(
          'svg',
          common,
          h('circle', { cx: 12, cy: 12, r: 4 }),
          h('path', {
            d: 'M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5',
          }),
        );
      }
      return h(
        'svg',
        common,
        h('circle', { cx: 12, cy: 12, r: 8.2 }),
        h('path', { d: 'M12 3.8a8.2 8.2 0 0 1 0 16.4z', fill: 'currentColor', stroke: 'none' }),
      );
    }

    const THEME_OPTIONS = [
      { value: 'auto', name: 'themeAuto', hint: 'themeAutoHint' },
      { value: 'dark', name: 'themeDark', hint: 'themeDarkHint' },
      { value: 'light', name: 'themeLight', hint: 'themeLightHint' },
    ];

    function SettingsSection() {
      const state = useStore();
      const t = React.useMemo(makeT, []);
      const theme = normalizeTheme(state.theme);
      const [status, setStatus] = React.useState('idle');
      const [error, setError] = React.useState('');

      React.useEffect(() => {
        void loadSettings();
      }, []);

      const choose = (value) => {
        if (value === theme && status !== 'error' && status !== 'local') return;
        const previous = theme;
        setStore({ theme: value });
        writeLocalTheme(value);
        setStatus('saving');
        setError('');
        postTheme(value)
          .then((result) => {
            const data = result.data;
            if (!result.ok || data === null || typeof data !== 'object' || data.ok !== true) {
              const reason = (data && (data.reason || data.error)) || 'request failed';
              throw new Error(String(reason));
            }
            setStore({ theme: normalizeTheme(data.theme) });
            setStatus('saved');
          })
          .catch((err) => {
            const message = String((err && err.message) || err);
            /* The local mirror already holds the choice; this Host build just
               predates the settings route and will pick it up when reloaded. */
            if (message === 'unsupported') {
              setStatus('local');
              return;
            }
            setStore({ theme: previous });
            setStatus('error');
            setError(message);
          });
      };

      const cards = THEME_OPTIONS.map((option) =>
        h(
          'button',
          {
            key: option.value,
            type: 'button',
            className: 'df-theme-card',
            'data-active': option.value === theme ? 'true' : 'false',
            'aria-pressed': option.value === theme ? 'true' : 'false',
            onClick: () => choose(option.value),
          },
          h('span', { className: 'df-theme-icon' }, themeIcon(option.value)),
          h('span', { className: 'df-theme-name' }, t(option.name)),
          h('span', { className: 'df-theme-hint' }, t(option.hint)),
        ),
      );

      return h(
        'div',
        { className: 'df-theme-page' },
        h('style', { key: 'style' }, CSS),
        h('h3', { className: 'df-theme-title' }, t('themeTitle')),
        h('p', { className: 'df-theme-desc' }, t('themeDesc')),
        h('div', { className: 'df-theme-cards' }, cards),
        status === 'saving' ? h('p', { className: 'df-theme-status' }, t('themeSaving')) : null,
        status === 'saved' ? h('p', { className: 'df-theme-status' }, t('themeSaved')) : null,
        status === 'local' ? h('p', { className: 'df-theme-status' }, t('themeLocal')) : null,
        status === 'error'
          ? h('p', { className: 'df-theme-status', 'data-error': 'true' }, t('themeFailed', { message: error }))
          : null,
      );
    }

    /* -------------------------------------------------------------- mount */

    function install(ctx) {
      ctxRef = ctx;
      // An exact jump closes the palette; its stylesheet must stay alive.
      ctx.effect(() => {
        const style = document.createElement('style');
        style.textContent = JUMP_CSS;
        document.head.appendChild(style);
        return () => style.remove();
      }, 'dsh-find: jump styles');
      ctx.effect(() => () => {
        cancelJump();
        if (flashCleanup) flashCleanup();
      }, 'dsh-find: jump lifecycle');

      const locale = safeService('locale');
      if (locale && typeof locale.register === 'function') {
        try {
          ctx.effect(() => {
            const disposers = [];
            for (const [language, dict] of [
              ['zh', DICTS.zh],
              ['en', DICTS.en],
            ]) {
              try {
                const disposer = locale.register(NS, language, dict);
                if (typeof disposer === 'function') disposers.push(disposer);
              } catch (err) {
                /* a missing dictionary is not fatal */
              }
            }
            return () => {
              for (const disposer of disposers) {
                try {
                  disposer();
                } catch (err) {
                  /* ignore */
                }
              }
            };
          }, 'dsh-find: locale dictionaries');
        } catch (err) {
          /* ignore */
        }
      }

      try {
        ctx.effect(() => startPendingPoll(), 'dsh-find: command bridge');
      } catch (err) {
        console.warn('[dsh-find] failed to start the command bridge', err);
      }

      try {
        ctx.effect(() => {
          const onKeyDown = (event) => {
            const modifier = event.ctrlKey || event.metaKey;
            if (modifier && !event.altKey && !event.shiftKey && (event.key === 'f' || event.key === 'F')) {
              event.preventDefault();
              event.stopPropagation();
              openPalette();
              return;
            }
            if (store.open && event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              closePalette();
            }
          };
          document.addEventListener('keydown', onKeyDown, true);
          return () => document.removeEventListener('keydown', onKeyDown, true);
        }, 'dsh-find: ctrl+f capture');
      } catch (err) {
        console.warn('[dsh-find] failed to install the keyboard capture', err);
      }

      try {
        void loadSettings();
      } catch (err) {
        /* the palette falls back to the host theme */
      }

      try {
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'dsh-find',
              order: 37,
              label: pickLang() === 'en' ? 'Find' : '查找',
            },
            SettingsSection,
          ),
        );
      } catch (err) {
        console.warn('[dsh-find] failed to register the settings section', err);
      }

      try {
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'dsh-find-dialog',
              order: 900,
            },
            Palette,
          ),
        );
      } catch (err) {
        console.warn('[dsh-find] failed to register the palette slot', err);
      }
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        install(ctx);
      },
    };
  },
});
