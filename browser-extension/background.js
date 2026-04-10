// background.js — Manifest V3 service worker
// Routes messages between content.js and the side panel

console.log('[AI Brain] Background service worker loaded');

// Open side panel when video is detected on a YouTube tab
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'YOUTUBE_VIDEO_DETECTED' && sender.tab?.id) {
    console.log('[AI Brain] Video detected, opening side panel for tab', sender.tab.id);
    
    // Open the side panel for this tab
    chrome.sidePanel.open({ tabId: sender.tab.id });

    // Store current video URL in session storage so side panel can read it on mount
    chrome.storage.session.set({
      currentYouTubeUrl: msg.url,
      currentVideoId: msg.videoId,
    }, () => {
      console.log('[AI Brain] Stored video URL in session storage');
    });

    // Broadcast to side panel (if already open)
    chrome.runtime.sendMessage({
      type: 'LOAD_VIDEO',
      url: msg.url,
      videoId: msg.videoId,
    }).catch(() => {
      // Side panel not open yet — it will read from storage.session on mount
    });

    sendResponse({ status: 'Side panel opened' });
  }
});

// Enable side panel only on YouTube tabs, disable on all others
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const isYouTube = tab.url?.includes('youtube.com/watch');
  chrome.sidePanel.setOptions({
    tabId,
    enabled: !!isYouTube,
  });
});

console.log('[AI Brain] Background listeners registered');
