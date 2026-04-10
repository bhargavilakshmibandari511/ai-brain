# AI Brain - Browser Extension

A Chrome browser extension for your AI Digital Brain — like Sider AI, but powered by your local Ollama LLM.

## Features

- **💬 Chat** — AI chat in the side panel with streaming responses
- **📝 Summarize** — One-click summarization of any web page
- **🌐 Translate** — Translate selected text or full pages (Google → Argos → LLM fallback)
- **📺 YouTube** — Auto-detect YouTube pages and summarize videos
- **⚙️ Settings** — Configure model, temperature, and server connection

### Context Menu Actions
Right-click on any page to:
- **Translate** selected text
- **Summarize** the current page
- **Ask AI Brain** about selected text

## Prerequisites

1. **Backend server** running at `http://localhost:8000`
   ```bash
   cd backend
   python run.py
   ```

2. **Ollama** running with at least one model
   ```bash
   ollama serve
   ```

## Build & Install

```bash
# 1. Install dependencies
cd browser-extension
npm install

# 2. Generate icons
npm run generate-icons

# 3. Build the extension
npm run build
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `browser-extension/dist` folder
5. Click the extension icon → the side panel opens

### Development

```bash
npm run dev   # Watch mode — rebuilds on changes
```

After rebuilding, go to `chrome://extensions/` and click the refresh button on the extension card.

## Architecture

```
browser-extension/
├── public/
│   ├── manifest.json      # Chrome Extension Manifest V3
│   ├── background.js      # Service worker (context menus, side panel)
│   ├── content.js         # Content script (page text extraction)
│   └── icons/             # Extension icons
├── src/
│   ├── App.tsx            # Main app with tab navigation
│   ├── main.tsx           # React entry point
│   ├── components/
│   │   ├── Chat.tsx       # Chat with streaming SSE
│   │   ├── Summarizer.tsx # Page & URL summarization
│   │   ├── Translate.tsx  # Translation with auto-detect
│   │   ├── YouTubeSummarizer.tsx
│   │   └── Settings.tsx   # Server config & status
│   └── utils/
│       ├── api.ts         # API client (fetch to localhost:8000)
│       └── storage.ts     # Chrome storage wrapper
├── sidepanel.html         # Side panel entry HTML
├── vite.config.ts         # Vite build config
└── package.json
```

## How It Works

- The **side panel** runs as a React app inside Chrome's side panel API
- The **background script** manages context menus and coordinates between content script & side panel
- The **content script** is injected into every page — it extracts page text, title, and selected text on demand
- All AI features connect to your **local FastAPI backend** at `localhost:8000`, which routes to **Ollama** for LLM inference
- No data leaves your machine (when using Ollama/Argos). Google Translate is used as the primary online translator when available.
