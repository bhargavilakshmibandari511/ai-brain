import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { YouTubeSummarizer } from './YouTubeSummarizer';
import './index.css';

function App() {
  const [autoUrl, setAutoUrl] = useState('');

  useEffect(() => {
    // Listen for video detection from background.js
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'LOAD_VIDEO') {
        console.log('[AI Brain] Received LOAD_VIDEO message with URL:', msg.url);
        setAutoUrl(msg.url);
      }
    });

    // Also check storage on mount (for when panel opens after detection)
    chrome.storage.session.get(['currentYouTubeUrl', 'currentVideoId'], (result) => {
      if (result.currentYouTubeUrl) {
        console.log('[AI Brain] Loaded URL from session storage:', result.currentYouTubeUrl);
        setAutoUrl(result.currentYouTubeUrl);
      }
    });
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', background: '#fff' }}>
      <YouTubeSummarizer autoUrl={autoUrl} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
