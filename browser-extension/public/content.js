// AI Brain - Content Script (injected into web pages)

const CONTEXT_MENU_ID = 'ai-brain-context-menu';
let selectedText = '';
let selectedRange = null;

// ─── Text Selection Handler (for context menu) ───
document.addEventListener('mouseup', (e) => {
  selectedText = window.getSelection().toString();
  
  // Remove old menu
  const oldMenu = document.getElementById(CONTEXT_MENU_ID);
  if (oldMenu) oldMenu.remove();

  // Show context menu if text is selected
  if (selectedText.trim().length > 0 && !e.target.closest(`#${CONTEXT_MENU_ID}`)) {
    showContextMenu(e.pageX, e.pageY);
  }
}, true);

// Hide menu on Escape or click elsewhere
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const menu = document.getElementById(CONTEXT_MENU_ID);
    if (menu) menu.remove();
  }
});

document.addEventListener('mousedown', (e) => {
  const menu = document.getElementById(CONTEXT_MENU_ID);
  if (menu && !e.target.closest(`#${CONTEXT_MENU_ID}`)) {
    menu.remove();
  }
});

// ─── Message handler for side panel communication ───
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXTRACT_PAGE') {
    const content = {
      title: document.title,
      url: window.location.href,
      text: document.body.innerText.substring(0, 50000),
      selectedText: window.getSelection()?.toString() || '',
      isYouTube: window.location.hostname.includes('youtube.com'),
      metaDescription:
        document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    };
    sendResponse(content);
  }

  if (msg.type === 'GET_SELECTION') {
    sendResponse({ text: window.getSelection()?.toString() || '' });
  }

  if (msg.type === 'HIDE_WIDGET') {
    const el = document.getElementById('ai-brain-widget');
    if (el) el.style.display = 'none';
  }

  return true;
});

// ─── Floating Widget (Sider-style) ───
(function injectWidget() {
  // Don't inject on extension pages or chrome:// pages
  if (
    window.location.protocol === 'chrome-extension:' ||
    window.location.protocol === 'chrome:' ||
    window.location.protocol === 'about:'
  ) return;

  // Prevent double injection
  if (document.getElementById('ai-brain-widget')) return;

  // Create shadow host for style isolation
  const host = document.createElement('div');
  host.id = 'ai-brain-widget';
  host.style.cssText = 'all:initial; position:fixed; z-index:2147483647; bottom:24px; right:24px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  // Get page info
  const pageTitle = document.title || window.location.hostname;
  const favicon = document.querySelector('link[rel*="icon"]')?.href || '';
  const isYouTube = window.location.hostname.includes('youtube.com');

  shadow.innerHTML = `
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }

      .ai-brain-bar {
        display: flex;
        align-items: center;
        background: #1e1e2e;
        border: 1px solid rgba(139,92,246,0.3);
        border-radius: 14px;
        padding: 6px 8px;
        gap: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(139,92,246,0.1);
        min-width: 280px;
        max-width: 420px;
        transition: all 0.2s ease;
        cursor: default;
        user-select: none;
      }
      .ai-brain-bar:hover {
        border-color: rgba(139,92,246,0.5);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 12px rgba(139,92,246,0.15);
      }

      .ai-logo {
        width: 28px; height: 28px;
        border-radius: 8px;
        background: linear-gradient(135deg, #7c3aed, #2563eb);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        cursor: pointer;
      }
      .ai-logo svg { width:16px; height:16px; fill:none; stroke:white; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }

      .page-info {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .page-favicon {
        width: 16px; height: 16px;
        border-radius: 3px;
        flex-shrink: 0;
        object-fit: contain;
      }
      .page-title {
        font-size: 12px;
        font-weight: 500;
        color: #e2e8f0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .summarize-btn {
        padding: 5px 14px;
        background: transparent;
        border: none;
        color: #a78bfa;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.15s;
        white-space: nowrap;
        letter-spacing: 0.3px;
      }
      .summarize-btn:hover {
        background: rgba(139,92,246,0.15);
        color: #c4b5fd;
      }

      .pin-btn {
        width: 24px; height: 24px;
        display: flex; align-items: center; justify-content: center;
        background: transparent;
        border: none;
        color: #64748b;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.15s;
        flex-shrink: 0;
      }
      .pin-btn:hover { background: rgba(100,116,139,0.2); color: #94a3b8; }
      .pin-btn svg { width:13px; height:13px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }

      .divider {
        width: 1px;
        height: 18px;
        background: rgba(100,116,139,0.3);
        flex-shrink: 0;
      }

      .quick-actions {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .action-btn {
        width: 28px; height: 28px;
        display: flex; align-items: center; justify-content: center;
        background: transparent;
        border: none;
        color: #64748b;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.15s;
        position: relative;
      }
      .action-btn:hover { background: rgba(139,92,246,0.12); color: #a78bfa; }
      .action-btn svg { width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }

      .action-btn .tooltip {
        display: none;
        position: absolute;
        bottom: 36px;
        left: 50%;
        transform: translateX(-50%);
        background: #0f172a;
        color: #e2e8f0;
        font-size: 10px;
        padding: 4px 8px;
        border-radius: 6px;
        white-space: nowrap;
        border: 1px solid rgba(100,116,139,0.3);
        pointer-events: none;
      }
      .action-btn:hover .tooltip { display: block; }

      /* 3-dots menu */
      .dots-menu-container { position: relative; }
      .tools-dropdown {
        display: none;
        position: absolute;
        bottom: 36px;
        right: 0;
        background: #1e1e2e;
        border: 1px solid rgba(139,92,246,0.3);
        border-radius: 12px;
        padding: 4px 0;
        min-width: 170px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.1);
        z-index: 2147483647;
      }
      .tools-dropdown.visible { display: block; }
      .tools-dropdown-header {
        padding: 6px 12px 4px;
        font-size: 9px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid rgba(100,116,139,0.2);
        margin-bottom: 2px;
      }
      .tool-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 12px;
        font-size: 12px;
        color: #e2e8f0;
        cursor: pointer;
        transition: all 0.12s;
        background: transparent;
        border: none;
        width: 100%;
        text-align: left;
        font-family: inherit;
      }
      .tool-item:hover {
        background: rgba(139,92,246,0.12);
        color: #c4b5fd;
      }
      .tool-item svg { width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0; }

      /* Collapsed state */
      .ai-brain-bar.collapsed {
        min-width: auto;
        max-width: none;
        padding: 4px;
        border-radius: 12px;
      }
      .ai-brain-bar.collapsed .page-info,
      .ai-brain-bar.collapsed .summarize-btn,
      .ai-brain-bar.collapsed .pin-btn,
      .ai-brain-bar.collapsed .divider,
      .ai-brain-bar.collapsed .quick-actions { display: none; }

      /* Selection popup */
      .selection-popup {
        display: none;
        position: fixed;
        background: #1e1e2e;
        border: 1px solid rgba(139,92,246,0.3);
        border-radius: 10px;
        padding: 4px;
        gap: 2px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        z-index: 2147483647;
      }
      .selection-popup.visible {
        display: flex;
        align-items: center;
      }
      .sel-btn {
        padding: 5px 10px;
        background: transparent;
        border: none;
        color: #e2e8f0;
        font-size: 11px;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.15s;
        white-space: nowrap;
        display: flex; align-items: center; gap: 5px;
      }
      .sel-btn:hover { background: rgba(139,92,246,0.2); color:#c4b5fd; }
      .sel-btn svg { width:12px; height:12px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
      .sel-divider { width:1px; height:18px; background:rgba(100,116,139,0.3); }
    </style>

    <!-- Main floating bar -->
    <div class="ai-brain-bar" id="mainBar">
      <div class="ai-logo" id="logoBtn" title="Open AI Brain">
        <svg viewBox="0 0 24 24"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.5V20a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2.5c2.9-1.2 5-4.1 5-7.5a8 8 0 0 0-8-8z"/><path d="M10 22h4"/><path d="M9 10h0"/><path d="M15 10h0"/><path d="M12 14v2"/></svg>
      </div>

      <div class="page-info">
        ${favicon ? `<img class="page-favicon" src="${favicon}" onerror="this.style.display='none'" />` : ''}
        <span class="page-title">${escapeHtml(pageTitle.substring(0, 50))}</span>
      </div>

      <button class="summarize-btn" id="summarizeBtn">Summarize</button>

      <button class="pin-btn" id="pinBtn" title="Minimize">
        <svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </button>

      <div class="divider"></div>

      <div class="quick-actions">
        <button class="action-btn" id="chatBtn" title="Chat">
          <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span class="tooltip">Chat</span>
        </button>
        <button class="action-btn" id="translateBtn" title="Translate">
          <svg viewBox="0 0 24 24"><path d="M5 8l6 10"/><path d="M4 14h6"/><path d="M2 5h12"/><path d="M7 2v3"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>
          <span class="tooltip">Translate</span>
        </button>
        <button class="action-btn" id="youtubeBtn" title="YouTube Summary" style="${isYouTube ? '' : 'display:none'}">
          <svg viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" style="fill:currentColor;stroke:none"/></svg>
          <span class="tooltip">YouTube</span>
        </button>
        <button class="action-btn" id="settingsBtn" title="Settings">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          <span class="tooltip">Settings</span>
        </button>
        <div class="dots-menu-container">
          <button class="action-btn" id="dotsBtn" title="More tools">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>
            <span class="tooltip">More</span>
          </button>
          <div class="tools-dropdown" id="toolsDropdown">
            <div class="tools-dropdown-header">Tools</div>
            <button class="tool-item" data-tool="summarize">
              <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Summarize
            </button>
            <button class="tool-item" data-tool="translate">
              <svg viewBox="0 0 24 24"><path d="M5 8l6 10"/><path d="M4 14h6"/><path d="M2 5h12"/><path d="M7 2v3"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>
              Translate
            </button>
            <button class="tool-item" data-tool="ask">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Write
            </button>
            <button class="tool-item" data-tool="ask">
              <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Explain
            </button>
            <button class="tool-item" data-tool="ask">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              Deep Research
            </button>
            <button class="tool-item" data-tool="ask">
              <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              My Highlights
            </button>
            <button class="tool-item" data-tool="ask">
              <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              AI Slides
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Text selection popup -->
    <div class="selection-popup" id="selPopup">
      <button class="sel-btn" id="selTranslate">
        <svg viewBox="0 0 24 24"><path d="M5 8l6 10"/><path d="M4 14h6"/><path d="M2 5h12"/><path d="M7 2v3"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>
        Translate
      </button>
      <div class="sel-divider"></div>
      <button class="sel-btn" id="selAsk">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Ask AI
      </button>
      <div class="sel-divider"></div>
      <button class="sel-btn" id="selSummarize">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Summarize
      </button>
    </div>
  `;

  // ─── Wire up events ───
  const bar = shadow.getElementById('mainBar');
  const selPopup = shadow.getElementById('selPopup');

  // Open side panel actions
  function openPanel(tab) {
    chrome.storage.local.set({ pendingAction: { type: 'ai-brain-' + tab, text: '', pageUrl: window.location.href, timestamp: Date.now() } });
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
  }

  function openPanelWithText(tab, text) {
    chrome.storage.local.set({ pendingAction: { type: 'ai-brain-' + tab, text: text, pageUrl: window.location.href, timestamp: Date.now() } });
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
  }

  shadow.getElementById('logoBtn').addEventListener('click', () => openPanel('ask'));
  shadow.getElementById('summarizeBtn').addEventListener('click', () => openPanel('summarize'));
  shadow.getElementById('chatBtn').addEventListener('click', () => openPanel('ask'));
  shadow.getElementById('translateBtn').addEventListener('click', () => openPanel('translate'));
  const ytBtn = shadow.getElementById('youtubeBtn');
  if (ytBtn) ytBtn.addEventListener('click', () => openPanel('youtube'));
  shadow.getElementById('settingsBtn').addEventListener('click', () => openPanel('settings'));

  // ─── 3-dots tools menu ───
  const dotsBtn = shadow.getElementById('dotsBtn');
  const toolsDropdown = shadow.getElementById('toolsDropdown');
  if (dotsBtn && toolsDropdown) {
    dotsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toolsDropdown.classList.toggle('visible');
    });
    toolsDropdown.querySelectorAll('.tool-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const tool = item.getAttribute('data-tool');
        const label = item.textContent.trim();
        toolsDropdown.classList.remove('visible');
        if (tool === 'summarize') openPanel('summarize');
        else if (tool === 'translate') openPanel('translate');
        else openPanelWithText('ask', '[' + label + '] ');
      });
    });
    // Close dropdown on outside click
    shadow.addEventListener('click', () => toolsDropdown.classList.remove('visible'));
  }

  // Minimize/expand toggle
  let collapsed = false;
  shadow.getElementById('pinBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    collapsed = !collapsed;
    bar.classList.toggle('collapsed', collapsed);
  });

  // Click on collapsed bar to expand
  bar.addEventListener('click', (e) => {
    if (collapsed && e.target === bar) {
      collapsed = false;
      bar.classList.remove('collapsed');
    }
  });

  // ─── Text selection popup ───
  let selectionTimeout;
  document.addEventListener('mouseup', (e) => {
    clearTimeout(selectionTimeout);
    selectionTimeout = setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text && text.length > 2) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        selPopup.style.left = Math.min(rect.left + rect.width / 2 - 100, window.innerWidth - 260) + 'px';
        selPopup.style.top = (rect.top - 44 + window.scrollY) + 'px';
        // For fixed positioning, we don't add scrollY
        selPopup.style.top = (rect.top - 44) + 'px';
        selPopup.classList.add('visible');
      } else {
        selPopup.classList.remove('visible');
      }
    }, 200);
  });

  document.addEventListener('mousedown', (e) => {
    // Hide popup when clicking outside
    if (!host.contains(e.target)) {
      selPopup.classList.remove('visible');
    }
  });

  shadow.getElementById('selTranslate').addEventListener('click', () => {
    const text = window.getSelection()?.toString().trim() || '';
    openPanelWithText('translate', text);
    selPopup.classList.remove('visible');
  });

  shadow.getElementById('selAsk').addEventListener('click', () => {
    const text = window.getSelection()?.toString().trim() || '';
    openPanelWithText('ask', text);
    selPopup.classList.remove('visible');
  });

  shadow.getElementById('selSummarize').addEventListener('click', () => {
    const text = window.getSelection()?.toString().trim() || '';
    openPanelWithText('summarize', text);
    selPopup.classList.remove('visible');
  });

  // Make the bar draggable
  let isDragging = false, dragOffsetX, dragOffsetY;
  shadow.querySelector('.ai-logo').addEventListener('mousedown', (e) => {
    isDragging = true;
    const barRect = host.getBoundingClientRect();
    dragOffsetX = e.clientX - barRect.left;
    dragOffsetY = e.clientY - barRect.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    host.style.left = (e.clientX - dragOffsetX) + 'px';
    host.style.top = (e.clientY - dragOffsetY) + 'px';
    host.style.right = 'auto';
    host.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { isDragging = false; });
})();

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

// ─── Context Menu UI Creation ───
function showContextMenu(pageX, pageY) {
  const menu = document.createElement('div');
  menu.id = CONTEXT_MENU_ID;

  menu.innerHTML = `
    <style>
      #ai-brain-context-menu {
        position: fixed;
        background: #1e1e2e;
        border: 1px solid #333;
        border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
        z-index: 2147483647;
        min-width: 180px;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      #ai-brain-context-menu-header {
        padding: 8px 12px;
        border-bottom: 1px solid #2a2a2a;
        font-size: 11px;
        color: #888;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .ai-brain-menu-item {
        padding: 10px 12px;
        color: #e2e8f0;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        border-bottom: 1px solid #2a2a2a;
        transition: background-color 0.2s;
      }

      .ai-brain-menu-item:last-child {
        border-bottom: none;
      }

      .ai-brain-menu-item:hover {
        background-color: #2a2a2a;
        color: #c4b5fd;
      }

      .ai-brain-menu-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        font-size: 13px;
        flex-shrink: 0;
      }
    </style>

    <div id="ai-brain-context-menu-header">AI Brain</div>
    
    <div class="ai-brain-menu-item" data-action="summarize">
      <span class="ai-brain-menu-icon">📋</span>
      <span>Summarize</span>
    </div>

    <div class="ai-brain-menu-item" data-action="explain">
      <span class="ai-brain-menu-icon">💡</span>
      <span>Explain</span>
    </div>

    <div class="ai-brain-menu-item" data-action="translate">
      <span class="ai-brain-menu-icon">🌐</span>
      <span>Translate</span>
    </div>

    <div class="ai-brain-menu-item" data-action="ask">
      <span class="ai-brain-menu-icon">❓</span>
      <span>Ask About This</span>
    </div>

    <div class="ai-brain-menu-item" data-action="copy">
      <span class="ai-brain-menu-icon">📋</span>
      <span>Copy Text</span>
    </div>
  `;

  document.body.appendChild(menu);

  // Position menu
  let x = pageX;
  let y = pageY;

  // Adjust if menu goes off-screen
  setTimeout(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      x = window.innerWidth - rect.width - 10;
    }
    if (rect.bottom > window.innerHeight) {
      y = window.innerHeight - rect.height - 10;
    }
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  }, 0);

  menu.style.left = pageX + 'px';
  menu.style.top = pageY + 'px';

  // Add event listeners to menu items
  menu.querySelectorAll('.ai-brain-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      handleContextMenuAction(action, selectedText);
      menu.remove();
    });
  });

  return menu;
}

// Handle context menu action
function handleContextMenuAction(action, text) {
  if (!text.trim()) return;

  if (action === 'copy') {
    navigator.clipboard.writeText(text).then(() => {
      console.log('✅ Text copied to clipboard');
    });
    return;
  }

  // Store the action data
  const actionData = {
    type: 'ai-brain-' + action,
    text: text,
    pageUrl: window.location.href,
    pageTitle: document.title,
    timestamp: Date.now(),
  };

  // Send to background/storage
  chrome.storage.local.set({ pendingAction: actionData });

  // Open the side panel
  chrome.runtime.sendMessage({
    type: 'OPEN_SIDE_PANEL',
  }, (response) => {
    console.log('✅ Action sent:', action);
  });
}

console.log('✅ AI Brain content script loaded with context menu support');
