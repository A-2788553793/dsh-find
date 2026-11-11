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
        archivedBadge: '已归档',
        speakerUser: '用户',
        speakerAssistant: 'AI',
        speakerTool: '工具',
        speakerSystem: '系统',
        speakerFiltered: '没有可显示的命中：{count} 条已按来源筛选隐藏',
        archivedNotice: '这个对话已经归档，不能跳转。可以在侧栏的归档列表里取消归档后再试。',
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
        archivedBadge: 'Archived',
        speakerUser: 'User',
        speakerAssistant: 'AI',
        speakerTool: 'Tool',
        speakerSystem: 'System',
        speakerFiltered: 'Nothing to show: {count} hit(s) hidden by the source filter',
        archivedNotice: 'This conversation is archived and cannot be opened. Unarchive it from the sidebar list, then try again.',
      },
    };

    const CSS = [
      '.dsh-find-overlay{position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding:8vh 16px 16px;box-sizing:border-box;pointer-events:auto;z-index:2147480000;}',
      '.dsh-find-backdrop{position:absolute;inset:0;background:var(--dsw-alias-bg-base);opacity:.42;}',
      '.dsh-find-panel{position:relative;width:100%;max-width:1080px;height:76vh;display:flex;flex-direction:column;border-radius:14px;background:var(--dsw-alias-bg-overlay);border:0.5px solid var(--dsw-alias-border-l1);box-shadow:0 20px 60px rgba(0,0,0,.28);overflow:hidden;box-sizing:border-box;}',
      '.dsh-find-head{flex:none;display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:0.5px solid var(--dsw-alias-border-l1);}',
      '.dsh-find-icon{flex:none;width:16px;height:16px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;justify-content:center;}',
      '.dsh-find-input{flex:1;min-width:0;height:26px;border:none;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14.5px;line-height:1.4;}',
      '.dsh-find-input::placeholder{color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-submit{flex:none;height:26px;padding:0 14px;border:none;border-radius:7px;background:var(--dsw-alias-brand-primary);color:#fff;font-family:inherit;font-size:12.5px;font-weight:500;cursor:pointer;}',
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
      '.dsh-find-chip{font-family:inherit;font-size:11px;font-weight:500;line-height:1.7;padding:0 9px;border-radius:999px;border:0.5px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;white-space:nowrap;transition:background .12s,color .12s,border-color .12s;}',
      '.dsh-find-chip:hover{color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-chip[data-on="true"]{font-weight:600;}',
      '.dsh-find-chip[data-speaker="user"][data-on="true"]{background:rgba(59,130,246,.13);border-color:rgba(59,130,246,.42);color:#3b82f6;}',
      '.dsh-find-chip[data-speaker="assistant"][data-on="true"]{background:rgba(16,185,129,.13);border-color:rgba(16,185,129,.42);color:#0d9f74;}',
      '.dsh-find-chip[data-speaker="tool"][data-on="true"]{background:rgba(139,92,246,.13);border-color:rgba(139,92,246,.42);color:#8b5cf6;}',
      '.dsh-find-chip[data-speaker="system"][data-on="true"]{background:rgba(245,158,11,.13);border-color:rgba(245,158,11,.42);color:#d97706;}',
      '.dsh-find-pane-body{flex:1;min-height:0;overflow:auto;padding:8px 0 10px;}',
      '.dsh-find-pane-empty{padding:26px 16px;text-align:center;font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.8;}',
      '.dsh-find-body{flex:1;min-height:0;overflow:auto;padding:4px 0 6px;}',
      '.dsh-find-hint{padding:30px 18px;text-align:center;font-size:12.5px;line-height:1.7;color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-card{margin:0 10px 8px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;}',
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
      '.dsh-find-snippet mark{background:var(--dsw-alias-brand-primary);color:#fff;border-radius:3px;padding:0 1px;}',
      '.dsh-find-speaker{display:inline-block;margin:0 0 4px;font-size:11px;line-height:1.3;padding:1px 6px;border-radius:4px;border:0.5px solid transparent;font-weight:600;letter-spacing:.01em;white-space:nowrap;}',
      '.dsh-find-speaker[data-speaker="user"]{background:rgba(59,130,246,.12);border-color:rgba(59,130,246,.40);color:#3b82f6;}',
      '.dsh-find-speaker[data-speaker="assistant"]{background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.40);color:#0d9f74;}',
      '.dsh-find-speaker[data-speaker="tool"]{background:rgba(139,92,246,.12);border-color:rgba(139,92,246,.40);color:#8b5cf6;}',
      '.dsh-find-speaker[data-speaker="system"]{background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.40);color:#d97706;}',
      '.dsh-find-ellipsis{color:var(--dsw-alias-label-secondary);opacity:.7;}',
      '.dsh-find-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 14px;border-top:0.5px solid var(--dsw-alias-border-l1);font-size:11.5px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-foot-right{white-space:nowrap;}',
      '.dsh-find-error{padding:18px 16px;font-size:12.5px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-find-spinner{display:inline-block;width:11px;height:11px;border-radius:50%;border:1.6px solid var(--dsw-alias-border-l1);border-top-color:var(--dsw-alias-label-secondary);animation:dsh-find-spin .8s linear infinite;vertical-align:-1px;margin-right:6px;}',
      '@keyframes dsh-find-spin{to{transform:rotate(360deg)}}',
      `.${FLASH_CLASS}{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px;border-radius:8px;transition:outline-color .4s ease;animation:dsh-find-pulse 1.4s ease-out 2;}`,
      '@keyframes dsh-find-pulse{0%{outline-offset:3px;}50%{outline-offset:7px;}100%{outline-offset:3px;}}',
    ].join('');

    /* -------------------------------------------------------------- store */

    let store = {
      open: false,
      query: '',
      searched: '',
      loading: false,
      error: '',
      payload: null,
      hideArchived: false,
      speakers: { user: true, assistant: true, tool: true, system: true },
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

    /* ------------------------------------------------------------ palette */

    function openPalette() {
      const selection = readSelectionText();
      const query = selection !== null ? selection : store.query;
      setStore({ open: true, notice: '' });
      if (selection !== null && selection !== store.query) {
        setStore({ query: selection });
        scheduleSearch(selection);
      }
    }

    function openPaletteWith(query) {
      cancelSearch();
      setStore({ open: true, query, notice: '' });
      scheduleSearch(query);
    }

    /**
     * `/find-text` runs in the Host half; this long-poll carries the request into
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
      setStore({ open: false, notice: '' });
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
          closePalette();
          return;
        }
        if (event.key === 'Enter') {
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
            h(
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
            ),
            body,
            h(
              'div',
              { className: 'dsh-find-foot' },
              h('span', { className: 'dsh-find-notice' }, state.notice ? state.notice : t('hint')),
              h(
                'span',
                { className: 'dsh-find-foot-right' },
                payload !== null && payload.totalHits > 0
                  ? (payload.truncated ? t('truncated', { count: payload.totalHits }) + ' · ' : '') + t('elapsed', { ms: payload.tookMs })
                  : '',
              ),
            ),
          ),
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
