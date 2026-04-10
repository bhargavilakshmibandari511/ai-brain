// content.js — runs on every youtube.com page
// Detects video changes (SPA navigation) and handles timestamp seeking

let lastVideoId = null;

function getVideoId(url) {
  const m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function detectAndNotify() {
  const videoId = getVideoId(window.location.href);
  if (videoId && videoId !== lastVideoId) {
    lastVideoId = videoId;
    console.log('[AI Brain] Detected YouTube video:', videoId);
    chrome.runtime.sendMessage({
      type: 'YOUTUBE_VIDEO_DETECTED',
      videoId,
      url: window.location.href,
    }).catch(err => {
      console.log('[AI Brain] Background not ready:', err.message);
    });
  }
}

// Fire on initial page load
detectAndNotify();

// YouTube is a SPA — watch for URL changes via DOM mutations
const observer = new MutationObserver(() => detectAndNotify());
observer.observe(document.body, { subtree: true, childList: true });

// Handle seek requests from side panel via chrome runtime
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SEEK_YOUTUBE') {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = Number(msg.seconds);
      console.log('[AI Brain] Seeked to', msg.seconds, 'seconds');
      
      // Auto-play if paused
      if (video.paused) {
        video.play().catch(() => {});
      }
    }
  }
});

console.log('[AI Brain] Content script loaded on YouTube');
