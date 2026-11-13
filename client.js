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
    const MEDIA_TOTAL = 800;
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
        archivedNotice: '这个对话已经归档，不能跳转。可以在侧栏的归档列表里取消归档后再试。',
        menuSaveAs: '另存为…',
        savedAs: '已另存为 {name}',
        savedDownload: '已下载到默认下载目录：{name}',
        saveFailed: '另存为失败',
        menuReveal: '打开文件所在位置',
        menuDelete: '删除',
        menuDeleteConfirm: '确认删除',
        deleteProtected: '这是对话里的附件，删掉会让那段对话的图片永久失效，只能打开所在文件夹。',
        deleteFailed: '删除失败',
        deleted: '已删除 {name}',
        revealMissing: '文件已经不在原来的位置了',
        revealFailed: '打开失败',
      },
      en: {
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
      },
    };

    const CSS = [
      '.dsh-find-overlay{position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding:8vh 16px 16px;box-sizing:border-box;pointer-events:auto;z-index:2147480000;}',
      '.dsh-find-backdrop{position:absolute;inset:0;background:var(--dsw-alias-bg-base);opacity:.42;}',
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
      '.dsh-find-pane{flex:1 1 50%;min-width:0;display:flex;flex-direction:column;min-height:0;}',
      '.dsh-find-pane + .dsh-find-pane{border-left:2px solid var(--dsw-alias-border-l1);}',
      '.dsh-find-pane-head{flex:none;display:flex;align-items:center;gap:8px;padding:10px 14px 8px;font-size:14px;font-weight:700;letter-spacing:.01em;color:var(--dsw-alias-label-primary);border-bottom:0.5px solid var(--dsw-alias-border-l1);}',
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
      `.${FLASH_CLASS}{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px;border-radius:8px;transition:outline-color .4s ease;animation:dsh-find-pulse 1.4s ease-out 2;}`,
      '@keyframes dsh-find-pulse{0%{outline-offset:3px;}50%{outline-offset:7px;}100%{outline-offset:3px;}}',
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
      '.dsh-find-tile{position:relative;display:block;aspect-ratio:4/3;border-radius:9px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l1);cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;}',
      '.dsh-find-tile:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.14);}',
      '.dsh-find-tile[data-archived="true"]{opacity:.7;}',
      '.dsh-find-thumb{width:100%;height:100%;object-fit:cover;display:block;background:var(--dsw-alias-bg-layer-2);}',
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
      mediaSpeakers: { user: true, assistant: true },
      preview: null,
      menu: null,
      notice: '',
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

    /* ------------------------------------------------------------- search */

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

    function scheduleSearch(query) {
      cancelSearch();
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        setStore({ loading: false, error: '', payload: null, searched: '' });
        return;
      }
      setStore({ loading: true, error: '' });
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
        setStore({
          loading: false,
          error: '',
          payload: null,
          searched: '',
        });
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
      if (tab !== 'text' && tab !== 'media') return;
      setStore({ tab, preview: null, menu: null });
      if (tab === 'media' && store.mediaTree === null && !store.mediaTreeLoading) void loadMediaTree();
    }

    function toggleMediaSpeaker(key) {
      const next = Object.assign({}, store.mediaSpeakers || {});
      next[key] = next[key] !== true;
      setStore({ mediaSpeakers: next });
    }

    /**
     * The outline is cheap: workspaces and their conversation titles, no session
     * log is read. Reading media stays an explicit action per conversation, so
     * opening the tab never stalls the page.
     */
    async function loadMediaTree(force) {
      if (store.mediaTreeLoading) return;
      if (!force && store.mediaTree !== null) return;
      setStore({ mediaTreeLoading: true, mediaTreeError: '' });
      try {
        const response = await fetch(ROUTE + '/media/tree', { headers: { accept: 'application/json' } });
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error('HTTP ' + response.status + (detail ? ' — ' + detail.slice(0, 200) : ''));
        }
        const payload = await response.json();
        setStore({ mediaTree: payload, mediaTreeLoading: false, mediaTreeError: '' });
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        setStore({
          mediaTree: null,
          mediaTreeLoading: false,
          mediaTreeError: err instanceof Error ? err.message : String(err),
        });
      }
    }

    function workspaceKey(workspace) {
      return workspace.workspaceId === null || workspace.workspaceId === undefined
        ? '__unowned__'
        : String(workspace.workspaceId);
    }

    function toggleWorkspace(workspace) {
      const key = workspaceKey(workspace);
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

    /** Removes one item from the loaded grid without re-reading the session. */
    function dropMedia(item) {
      const sessions = Object.assign({}, store.sessionMedia || {});
      const entry = sessions[item.sessionId];
      if (entry === undefined) return;
      const items = (entry.items || []).filter((each) => each.id !== item.id);
      sessions[item.sessionId] = Object.assign({}, entry, {
        items,
        counts: {
          user: items.filter((each) => each.speaker === 'user').length,
          assistant: items.filter((each) => each.speaker !== 'user').length,
          image: items.filter((each) => each.kind === 'image').length,
          video: items.filter((each) => each.kind === 'video').length,
        },
      });
      setStore({ sessionMedia: sessions });
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

    function patchSession(sessionId, patch) {
      const next = Object.assign({}, store.sessionMedia || {});
      next[sessionId] = Object.assign({}, next[sessionId] || {}, patch);
      setStore({ sessionMedia: next });
    }

    /**
     * Folds every workspace and every conversation that was already read.
     * The loaded items stay in memory, so unfolding is instant.
     */
    function collapseAll() {
      const current = store.sessionMedia || {};
      const next = {};
      for (const id of Object.keys(current)) {
        next[id] = Object.assign({}, current[id], { open: false });
      }
      setStore({ sessionMedia: next, expanded: {}, preview: null, menu: null });
    }

    /** Reads exactly one conversation's media — the click that follows. */
    async function loadSessionMedia(sessionId, force) {
      const current = (store.sessionMedia || {})[sessionId];
      if (current !== undefined && current.status === 'loading') return;
      if (!force && current !== undefined && current.status === 'ready') return;
      patchSession(sessionId, { status: 'loading', error: '' });
      try {
        const response = await fetch(ROUTE + '/media/session?id=' + encodeURIComponent(sessionId), {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error('HTTP ' + response.status + (detail ? ' — ' + detail.slice(0, 200) : ''));
        }
        const payload = await response.json();
        patchSession(sessionId, {
          status: 'ready',
          items: Array.isArray(payload.items) ? payload.items : [],
          counts: payload.counts || { user: 0, assistant: 0, image: 0, video: 0 },
          tookMs: payload.tookMs || 0,
          error: '',
        });
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        patchSession(sessionId, { status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    }

    /**
     * Clicking a conversation row either reads it for the first time or folds /
     * unfolds the grid it already produced. Nothing is re-read on a fold.
     */
    function toggleSessionMedia(sessionId) {
      const entry = (store.sessionMedia || {})[sessionId];
      if (entry === undefined || entry.status === 'error') {
        void loadSessionMedia(sessionId, entry !== undefined);
        return;
      }
      if (entry.status !== 'ready') return;
      patchSession(sessionId, { open: entry.open === false });
    }

    /**
     * "Expand all" is the old behaviour: one full scan, then every conversation
     * is filled from the result. It stays opt-in because it reads every log.
     */
    async function expandAll() {
      if (store.mediaTree === null) void loadMediaTree();
      if (store.expanding === true) return;
      setStore({ expanding: true });
      try {
        const response = await fetch(ROUTE + '/media?total=' + String(MEDIA_TOTAL), {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error('HTTP ' + response.status + (detail ? ' — ' + detail.slice(0, 200) : ''));
        }
        const payload = await response.json();
        const items = Array.isArray(payload.items) ? payload.items : [];
        const grouped = new Map();
        for (const item of items) {
          const list = grouped.get(item.sessionId);
          if (list === undefined) grouped.set(item.sessionId, [item]);
          else list.push(item);
        }
        const sessions = {};
        for (const [sessionId, list] of grouped) {
          sessions[sessionId] = {
            status: 'ready',
            items: list,
            counts: {
              user: list.filter((item) => item.speaker === 'user').length,
              assistant: list.filter((item) => item.speaker !== 'user').length,
              image: list.filter((item) => item.kind === 'image').length,
              video: list.filter((item) => item.kind === 'video').length,
            },
            tookMs: payload.tookMs || 0,
            error: '',
          };
        }
        const expanded = {};
        for (const workspace of (store.mediaTree && store.mediaTree.workspaces) || []) {
          expanded[workspaceKey(workspace)] = true;
          for (const session of workspace.sessions) {
            if (sessions[session.sessionId] === undefined) {
              sessions[session.sessionId] = { status: 'ready', items: [], counts: { user: 0, assistant: 0, image: 0, video: 0 }, tookMs: 0, error: '' };
            }
          }
        }
        setStore({ sessionMedia: sessions, expanded, expanding: false, mediaTotals: payload });
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        setStore({ expanding: false, mediaTreeError: err instanceof Error ? err.message : String(err) });
      }
    }

    /* ------------------------------------------------------------ palette */

    function openPalette() {
      const selection = readSelectionText();
      const query = selection !== null ? selection : store.query;
      setStore({ open: true, tab: 'text', notice: '', preview: null, menu: null });
      if (selection !== null && selection !== store.query) {
        setStore({ query: selection });
        scheduleSearch(selection);
      }
    }

    function openPaletteWith(query) {
      cancelSearch();
      setStore({ open: true, tab: 'text', query, notice: '', preview: null, menu: null });
      scheduleSearch(query);
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
      const list = [];
      for (const card of cards) {
        for (const session of card.sessions) {
          for (const hit of session.hits) list.push(hit);
        }
      }
      let flat = 0;
      for (const hit of list) hit.flatIndex = flat++;
      return { cards, flat, list };
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

      const payload = state.payload;
      const tab = state.tab === 'media' ? 'media' : 'text';
      const mediaTree = state.mediaTree;
      const mediaWorkspaces = mediaTree !== null && Array.isArray(mediaTree.workspaces) ? mediaTree.workspaces : [];
      const mediaSpeakers = state.mediaSpeakers || {};
      const expandedMap = state.expanded || {};
      const sessionMedia = state.sessionMedia || {};
      const mediaSpeakerOf = (item) => (item.speaker === 'user' ? 'user' : 'assistant');
      const shownMediaOf = (sessionId) => {
        const entry = sessionMedia[sessionId];
        if (entry === undefined || entry.status !== 'ready') return [];
        const kept = (entry.items || []).filter((item) => mediaSpeakers[mediaSpeakerOf(item)] !== false);
        return state.hideArchived === true ? kept.filter((item) => item.archived !== true) : kept;
      };
      const loadedSessions = Object.keys(sessionMedia).filter((id) => sessionMedia[id] && sessionMedia[id].status === 'ready');
      const loadedMediaCount = loadedSessions.reduce((total, id) => total + shownMediaOf(id).length, 0);
      const loaded = state.open ? flattenHits(payload) : [];
      /* Archived conversations stay searchable; the toggle only hides them from
         the two panes, it never changes what the Host scanned. */
      const hits = state.hideArchived ? loaded.filter((hit) => hit.archived !== true) : loaded;
      const split = splitHits(hits);
      /* The right pane can show every side at once or any subset of them; the
         thinking pane is entirely model reasoning and is never filtered. */
      const speakers = state.speakers || {};
      const speakerOf = (hit) => (SPEAKER_LABELS[hit.speaker] ? hit.speaker : 'assistant');
      const shownConversation = split.conversation.filter((hit) => speakers[speakerOf(hit)] !== false);
      const speakerHidden = split.conversation.length - shownConversation.length;
      const grouped = {
        thinking: groupHits(split.thinking),
        conversation: groupHits(shownConversation),
      };

      if (!state.open) return null;

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
          h(
            'div',
            { className: 'dsh-find-pane-head' },
            h('span', null, t(labelKey)),
            channel === 'conversation' ? renderSpeakerChips() : null,
            h('span', { className: 'dsh-find-pane-count' }, String(bundle.flat)),
          ),
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
              checked: state.hideArchived === true,
              onChange: (event) => setStore({ hideArchived: event.target.checked }),
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
              disabled: Object.keys(expandedMap).length === 0 && Object.keys(sessionMedia).length === 0,
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
                setStore({ sessionMedia: {}, expanded: {}, preview: null, menu: null });
                void loadMediaTree(true);
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
            ? h('video', { className: 'dsh-find-thumb', src: item.url, preload: 'metadata' })
            : h('img', { className: 'dsh-find-thumb', src: item.url, loading: 'lazy', alt: item.name }),
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
            ? h('div', { className: 'dsh-find-media-grid' }, shown.map(renderTile))
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
              (session) => state.hideArchived !== true || session.archived !== true,
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
              ? loadedSessions.length > 0
                ? t('mediaLoadedTotal', { count: loadedMediaCount, sessions: loadedSessions.length })
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
        const hiddenCount = state.hideArchived ? loaded.filter((hit) => hit.archived === true).length : 0;
        standalone = h(
          'div',
          { className: 'dsh-find-hint' },
          hiddenCount > 0 ? t('noResultsHidden', { count: hiddenCount }) : t('noResults'),
        );
      } else if (hits.length === 0) {
        standalone = h('div', { className: 'dsh-find-hint' }, t('empty'));
      }

      const body =
        standalone !== null
          ? h('div', { className: 'dsh-find-body' }, standalone)
          : h('div', { className: 'dsh-find-panes' }, PANES.map((entry) => renderPane(entry.channel, entry.labelKey)));

      const summary =
        payload !== null && hits.length > 0
          ? t('results', {
              count: hits.length,
              sessions: new Set(hits.map((hit) => hit.sessionId)).size,
            })
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
        setStore({ query: value });
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
              : renderMediaHead(),
            tab === 'text' ? body : renderMediaBody(),
            renderFoot(),
          ),
          renderPreview(),
          renderMenu(),
        ),
      );
    }

    /* --------------------------------------------------------------- jump */

    function isVisible(element) {
      if (!element || !element.isConnected) return false;
      try {
        if (element.getClientRects().length === 0) return false;
        const style = window.getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        return true;
      } catch (err) {
        return false;
      }
    }

    function findVisibleText(query) {
      const needle = query.toLowerCase();
      if (needle.length === 0) return null;
      const dialog = document.querySelector('[' + DIALOG_ATTR + ']');
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node = walker.nextNode();
      while (node) {
        const value = node.nodeValue;
        if (typeof value === 'string' && value.toLowerCase().includes(needle)) {
          const parent = node.parentElement;
          if (parent && !(dialog && dialog.contains(parent)) && isVisible(parent)) return parent;
        }
        node = walker.nextNode();
      }
      return null;
    }

    function closestBlock(element) {
      let node = element;
      for (let depth = 0; depth < 8 && node && node !== document.body; depth += 1) {
        const rect = node.getBoundingClientRect();
        if (rect.width >= 220 && rect.height >= 24) return node;
        node = node.parentElement;
      }
      return element;
    }

    function flashElement(element) {
      const target = closestBlock(element);
      try {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (err) {
        /* older engines */
      }
      target.classList.add(FLASH_CLASS);
      setTimeout(() => {
        try {
          target.classList.remove(FLASH_CLASS);
        } catch (err) {
          /* ignore */
        }
      }, 4000);
    }

    function waitForText(query, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      return new Promise((resolve) => {
        const tick = () => {
          const found = findVisibleText(query);
          if (found) {
            flashElement(found);
            resolve(true);
            return;
          }
          if (Date.now() > deadline) {
            resolve(false);
            return;
          }
          setTimeout(tick, 160);
        };
        setTimeout(tick, 260);
      });
    }

    async function jumpToHit(hit) {
      /* An archived conversation is not mounted by the UI, so opening it lands
         nowhere; say so instead of closing the palette onto a blank screen. */
      if (hit && hit.archived === true) {
        const t = makeT();
        setStore({ notice: t('archivedNotice') });
        setTimeout(() => {
          if (store.notice.length > 0) setStore({ notice: '' });
        }, 6000);
        return;
      }

      const query = String(store.searched || store.query || '').trim();
      closePalette();

      const uiWorkspace = safeService('uiWorkspace');
      try {
        if (uiWorkspace && typeof uiWorkspace.openSession === 'function') {
          uiWorkspace.openSession(hit.sessionId);
        }
      } catch (err) {
        console.warn('[dsh-find] openSession failed', err);
      }

      const sessions = safeService('sessions');
      if (sessions && typeof sessions.using === 'function' && hit.seq !== undefined && hit.seq !== null) {
        try {
          await sessions.using(hit.sessionId, { source: 'controllerOperation' }, async (reference) => {
            await reference.ready;
            const face = reference.binding && reference.binding.session;
            if (face && typeof face.loadThrough === 'function') {
              await face.loadThrough(hit.seq);
            }
          });
        } catch (err) {
          console.warn('[dsh-find] loadThrough failed', err);
        }
      }

      if (query.length > 0) {
        await waitForText(query, 7000);
      }
    }

    /* -------------------------------------------------------------- mount */

    function install(ctx) {
      ctxRef = ctx;

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
