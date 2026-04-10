// AI Brain - Background Service Worker (Manifest V3)

// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Create context menu items on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ai-brain-translate',
    title: 'Translate with AI Brain',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'ai-brain-summarize',
    title: 'Summarize this page',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'ai-brain-ask',
    title: 'Ask AI Brain about this',
    contexts: ['selection'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  // Open the side panel first
  chrome.sidePanel.open({ tabId: tab.id });

  // Store the action so the side panel can pick it up
  const action = {
    type: info.menuItemId,
    text: info.selectionText || '',
    pageUrl: info.pageUrl || '',
    timestamp: Date.now(),
  };

  chrome.storage.local.set({ pendingAction: action });
});

// Handle messages from content script or side panel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OPEN_SIDE_PANEL') {
    // Open side panel on the sender's tab
    const tabId = sender?.tab?.id;
    if (tabId) {
      chrome.sidePanel.open({ tabId });
    }
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'GET_PAGE_CONTENT') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_PAGE' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: 'Cannot access this page' });
          } else {
            sendResponse(response || { error: 'No response from page' });
          }
        });
      } else {
        sendResponse({ error: 'No active tab' });
      }
    });
    return true; // Keep channel open for async response
  }

  if (msg.type === 'GET_SELECTED_TEXT') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_SELECTION' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ text: '' });
          } else {
            sendResponse(response || { text: '' });
          }
        });
      } else {
        sendResponse({ text: '' });
      }
    });
    return true;
  }
});
