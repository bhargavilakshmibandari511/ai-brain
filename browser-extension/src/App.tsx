import { useState, useEffect } from 'react';
import {
  MessageSquare,
  FileText,
  Languages,
  Youtube,
  Settings as SettingsIcon,
  Brain,
  Maximize2,
  Search,
  Highlighter,
  Presentation,
  Scissors,
  BookOpen,
  MoreHorizontal,
  PenTool,
} from 'lucide-react';
import Chat from './components/Chat';
import Summarizer from './components/Summarizer';
import Translate from './components/Translate';
import YouTubeSummarizer from './components/YouTubeSummarizer';
import Write from './components/Write';
import ImageGenerator from './components/ImageGenerator';
import Settings from './components/Settings';
import { checkHealth } from './utils/api';
import { getPendingAction } from './utils/storage';

type Tab = 'chat' | 'summarize' | 'translate' | 'youtube' | 'write' | 'images' | 'settings';

const TABS: { id: Tab; icon: typeof MessageSquare; label: string }[] = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'summarize', icon: FileText, label: 'Summary' },
  { id: 'translate', icon: Languages, label: 'Translate' },
  { id: 'write', icon: PenTool, label: 'Write' },
  { id: 'images', icon: Highlighter, label: 'Images' },
  { id: 'youtube', icon: Youtube, label: 'YouTube' },
  { id: 'settings', icon: SettingsIcon, label: 'Settings' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [pendingText, setPendingText] = useState('');
  const [showToolsMenu, setShowToolsMenu] = useState(false);

  // Check server health on mount
  useEffect(() => {
    checkHealth().then(setServerOnline);
  }, []);

  // Handle pending actions from context menu or floating widget
  useEffect(() => {
    const checkPending = async () => {
      const action = await getPendingAction();
      if (!action) return;

      const text = action.text || '';

      if (action.type === 'ai-brain-translate') {
        setPendingText(text);
        setActiveTab('translate');
      } else if (action.type === 'ai-brain-summarize') {
        setPendingText(text);
        setActiveTab('summarize');
      } else if (action.type === 'ai-brain-explain') {
        setPendingText('Explain this:\n\n' + text);
        setActiveTab('chat');
      } else if (action.type === 'ai-brain-ask') {
        setPendingText(text);
        setActiveTab('chat');
      } else if (action.type === 'ai-brain-youtube') {
        setActiveTab('youtube');
      } else if (action.type === 'ai-brain-settings') {
        setActiveTab('settings');
      }
    };

    checkPending();

    // Poll for pending actions (from widget/context menu clicks while panel is open)
    const interval = setInterval(checkPending, 500);
    return () => clearInterval(interval);
  }, []);

  const openFullPage = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
      chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
    }
  };

  // Tools menu items for the 3-dots dropdown
  const tools = [
    { icon: Scissors, label: 'Summarize', action: () => { setActiveTab('summarize'); setShowToolsMenu(false); } },
    { icon: Languages, label: 'Translate', action: () => { setActiveTab('translate'); setShowToolsMenu(false); } },
    { icon: PenTool, label: 'Write', action: () => { setActiveTab('chat'); setPendingText('Help me write: '); setShowToolsMenu(false); } },
    { icon: BookOpen, label: 'Explain', action: () => { setActiveTab('chat'); setPendingText('Explain this: '); setShowToolsMenu(false); } },
    { icon: Search, label: 'Deep Research', action: () => { setActiveTab('chat'); setPendingText('[Deep Research] '); setShowToolsMenu(false); } },
    { icon: Highlighter, label: 'My Highlights', action: () => { setActiveTab('chat'); setPendingText('Show my highlights from this page'); setShowToolsMenu(false); } },
    { icon: Presentation, label: 'AI Slides', action: () => { setActiveTab('chat'); setPendingText('Create presentation slides about: '); setShowToolsMenu(false); } },
    { icon: Youtube, label: 'YouTube Summary', action: () => { setActiveTab('youtube'); setShowToolsMenu(false); } },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <Brain size={16} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white">AI Brain</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                serverOnline === null
                  ? 'bg-yellow-400'
                  : serverOnline
                  ? 'bg-green-400'
                  : 'bg-red-400'
              }`}
            />
            <span className="text-[10px] text-slate-400">
              {serverOnline === null ? 'Checking...' : serverOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
          {/* Full page chat button */}
          <button
            onClick={openFullPage}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md transition-colors"
            title="Full page chat"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'chat' && <Chat pendingText={pendingText} onConsumeText={() => setPendingText('')} />}
        {activeTab === 'summarize' && <Summarizer pendingText={pendingText} onConsumeText={() => setPendingText('')} />}
        {activeTab === 'translate' && <Translate pendingText={pendingText} onConsumeText={() => setPendingText('')} />}
        {activeTab === 'write' && <Write pendingText={pendingText} onConsumeText={() => setPendingText('')} />}
        {activeTab === 'images' && <ImageGenerator pendingText={pendingText} onConsumeText={() => setPendingText('')} />}
        {activeTab === 'youtube' && <YouTubeSummarizer />}
        {activeTab === 'settings' && <Settings />}
      </div>

      {/* Quick Tools Row */}
      <div className="relative px-2 py-1.5 border-t border-slate-700/30 bg-slate-800/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <button onClick={() => setActiveTab('summarize')} className="p-1.5 text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-md transition-all" title="Summarize">
              <Scissors size={15} />
            </button>
            <button onClick={() => setActiveTab('translate')} className="p-1.5 text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-md transition-all" title="Translate">
              <Languages size={15} />
            </button>
            <button onClick={() => setActiveTab('write')} className="p-1.5 text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-md transition-all" title="Write">
              <PenTool size={15} />
            </button>
            <button onClick={() => setActiveTab('images')} className="p-1.5 text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-md transition-all" title="Image Prompt">
              <Highlighter size={15} />
            </button>
            <button onClick={() => setActiveTab('youtube')} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all" title="YouTube">
              <Youtube size={15} />
            </button>
          </div>

          {/* 3-dots tools menu */}
          <div className="relative">
            <button
              onClick={() => setShowToolsMenu(!showToolsMenu)}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded-md transition-all"
              title="More tools"
            >
              <MoreHorizontal size={16} />
            </button>

            {showToolsMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowToolsMenu(false)} />
                <div className="absolute bottom-full right-0 mb-2 w-52 bg-slate-800 border border-slate-700/60 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-slate-700/40">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tools</span>
                  </div>
                  {tools.map((tool, i) => {
                    const ToolIcon = tool.icon;
                    return (
                      <button
                        key={i}
                        onClick={tool.action}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
                      >
                        <ToolIcon size={14} />
                        {tool.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom tab bar */}
      <div className="flex border-t border-slate-700/50 bg-slate-800/80">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                isActive
                  ? 'text-purple-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={16} />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <div className="w-4 h-0.5 rounded-full bg-purple-500 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
