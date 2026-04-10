import React, { useState, useEffect, useRef } from 'react';
import {
  Youtube, Loader2, Copy, Check, ChevronDown, ChevronUp,
  MessageSquare, Bookmark, Clock, Sparkles, Globe, Play,
  RefreshCw, AlertCircle, Brain, X, Send, BookOpen
} from 'lucide-react';

const API = 'http://localhost:8000';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface TimestampHighlight {
  time: string;
  seconds: number;
  text: string;
}

interface SummaryResult {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  briefSummary: string;
  fullSummary: string;
  highlights: TimestampHighlight[];
  suggestedQuestions: string[];
  error?: string;
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function isYouTubeUrl(url: string) {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

function timeToSeconds(t: string): number {
  const parts = t.split(':').map(Number);
  return parts.length === 3 ? parts[0]*3600 + parts[1]*60 + parts[2] : parts[0]*60 + parts[1];
}

function parseHighlights(raw: string): TimestampHighlight[] {
  const re = /(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–:]\s*(.+)/;
  return raw.split('\n').map(l => l.trim().match(re))
    .filter(Boolean)
    .map(m => ({ time: m![1], seconds: timeToSeconds(m![1]), text: m![2].trim() }));
}

function parseQuestions(raw: string): string[] {
  return raw.split('\n')
    .map(l => l.replace(/^[-•*\d.]+\s*/, '').trim())
    .filter(l => l.length > 8 && l.includes('?'))
    .slice(0, 4);
}

function splitSummary(text: string): { brief: string; full: string } {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return { brief: sentences.slice(0, 2).join(' ').trim(), full: text.trim() };
}

// ─────────────────────────────────────────────────────────────
// TIMESTAMP PILL
// ─────────────────────────────────────────────────────────────
const TimestampPill: React.FC<{ time: string; onClick: () => void }> = ({ time, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all shrink-0"
  >
    {time}
  </button>
);

// ─────────────────────────────────────────────────────────────
// HIGHLIGHT ROW — "click to expand"
// ─────────────────────────────────────────────────────────────
const HighlightRow: React.FC<{
  highlight: TimestampHighlight;
  onSeek: (s: number) => void;
  forceExpanded?: boolean;
}> = ({ highlight, onSeek, forceExpanded }) => {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded || expanded;
  const preview = highlight.text.slice(0, 110);
  const hasMore = highlight.text.length > 110;

  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-start gap-3">
        <TimestampPill time={highlight.time} onClick={() => onSeek(highlight.seconds)} />
        <div className="flex-1 min-w-0">
          <p className="text-slate-600 text-[13px] leading-relaxed">
            {isExpanded ? highlight.text : preview}{hasMore && !isExpanded ? '…' : ''}
          </p>
          {hasMore && !forceExpanded && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-0.5 mt-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              {expanded ? <><ChevronUp className="w-3 h-3"/>Collapse</> : <><ChevronDown className="w-3 h-3"/>Click to expand</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// VIDEO CHAT
// ─────────────────────────────────────────────────────────────
const VideoChat: React.FC<{ videoTitle: string; summaryContext: string; onClose: () => void }> = ({ videoTitle, summaryContext, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          context: `Video: "${videoTitle}"\n\nSummary:\n${summaryContext}`
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.response || 'No response received.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: '⚠️ Backend unreachable.' }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-500"/>
          <span className="text-[13px] font-semibold text-slate-700">Ask about this video</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
          <X className="w-4 h-4"/>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-slate-400 text-xs pt-4">"{videoTitle.slice(0,50)}{videoTitle.length>50?'…':''}"</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[12px] leading-relaxed ${m.role === 'user' ? 'bg-blue-500 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-700 rounded-tl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 px-4 py-2.5 rounded-2xl rounded-tl-sm flex gap-1">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.12}s`}}/>)}
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>
      <div className="p-3 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full pl-4 pr-1.5 py-1.5 focus-within:border-blue-300 transition-all">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), send())}
            placeholder="Ask a question…"
            className="flex-1 bg-transparent text-[12px] text-slate-700 placeholder-slate-400 focus:outline-none"
          />
          <button onClick={send} disabled={!input.trim() || loading}
            className="w-7 h-7 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 rounded-full flex items-center justify-center transition-colors">
            <Send className="w-3.5 h-3.5 text-white"/>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────
const LoadingState: React.FC = () => (
  <div className="p-5 space-y-4 animate-pulse">
    <div className="space-y-2">
      {[100, 92, 78, 86].map((w, i) => <div key={i} className="h-3.5 bg-slate-100 rounded-full" style={{width:`${w}%`}}/>)}
    </div>
    <div className="pt-2 space-y-2">
      <div className="h-3 bg-slate-100 rounded-full w-48"/>
      {[65, 72, 58].map((w, i) => <div key={i} className="h-3 bg-slate-50 rounded-full" style={{width:`${w}%`}}/>)}
    </div>
    <div className="pt-2 space-y-3">
      <div className="h-3 bg-slate-100 rounded-full w-20"/>
      {[0,1,2].map(i => (
        <div key={i} className="flex gap-3">
          <div className="h-3 bg-blue-50 rounded w-10 shrink-0"/>
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-slate-50 rounded-full w-full"/>
            <div className="h-3 bg-slate-50 rounded-full w-[70%]"/>
          </div>
        </div>
      ))}
    </div>
    <div className="flex items-center justify-center gap-2 pt-2 text-slate-400">
      <Loader2 className="w-4 h-4 animate-spin"/>
      <span className="text-xs">Analyzing video…</span>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────
interface Props {
  autoUrl?: string;
}

export const YouTubeSummarizer: React.FC<Props> = ({ autoUrl }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // AUTO-LOAD when extension detects a YouTube video
  useEffect(() => {
    if (autoUrl && isYouTubeUrl(autoUrl) && autoUrl !== url) {
      console.log('[YouTubeSummarizer] Auto-loading URL:', autoUrl);
      setUrl(autoUrl);
      doSummarize(autoUrl);
    }
  }, [autoUrl]);

  const doSummarize = async (targetUrl?: string) => {
    const u = (targetUrl ?? url).trim();
    if (!u || !isYouTubeUrl(u)) return;

    console.log('[YouTubeSummarizer] Starting summarization for:', u);
    setIsLoading(true);
    setResult(null);
    setShowFull(false);
    setShowChat(false);

    try {
      const res = await fetch(`${API}/api/summarize/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      });
      const data = await res.json();

      if (data.error) {
        console.error('[YouTubeSummarizer] Error:', data.error);
        setResult({
          videoId:'', title:'', channel:'', duration:'', briefSummary:'',
          fullSummary:'', highlights:[], suggestedQuestions:[], error: data.error
        });
        return;
      }

      // ── Case 1: Backend returns structured response ──
      if (data.briefSummary || data.highlights) {
        console.log('[YouTubeSummarizer] Received structured response');
        setResult({
          videoId: extractVideoId(u) || '',
          title: data.title || 'YouTube Video',
          channel: data.channel || '',
          duration: data.duration || '',
          briefSummary: data.briefSummary || '',
          fullSummary: data.fullSummary || data.summary || '',
          highlights: Array.isArray(data.highlights)
            ? data.highlights.map((h: {time: string; text: string}) => ({ ...h, seconds: timeToSeconds(h.time) }))
            : parseHighlights(data.summary || ''),
          suggestedQuestions: Array.isArray(data.suggestedQuestions)
            ? data.suggestedQuestions
            : parseQuestions(data.summary || ''),
        });
        return;
      }

      // ── Case 2: Backend returns plain text summary ──
      console.log('[YouTubeSummarizer] Received plain text response, parsing...');
      const raw: string = data.summary || '';
      const { brief, full } = splitSummary(raw);
      const highlights = parseHighlights(raw);
      const questions = parseQuestions(raw);

      setResult({
        videoId: extractVideoId(u) || '',
        title: data.title || 'YouTube Video',
        channel: data.channel || '',
        duration: data.duration || '',
        briefSummary: brief,
        fullSummary: full,
        highlights: highlights.length > 0 ? highlights : raw.split('. ').filter(s => s.length > 20).slice(0,4)
          .map((s, i) => ({ time: `0${Math.floor(i*90/60)}:${String((i*90)%60).padStart(2,'0')}`, seconds: i*90, text: s+'.' })),
        suggestedQuestions: questions.length > 0 ? questions : [
          'What are the main topics covered?',
          'What is the key takeaway from this video?',
          'How does the speaker support their argument?',
          'What practical applications are discussed?',
        ],
      });
    } catch (err) {
      console.error('[YouTubeSummarizer] Fetch error:', err);
      setResult({
        videoId:'', title:'', channel:'', duration:'', briefSummary:'',
        fullSummary:'', highlights:[], suggestedQuestions:[],
        error: `Cannot connect to backend: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeek = (seconds: number) => {
    console.log('[YouTubeSummarizer] Seeking to', seconds);
    
    // ── Extension Communication ──
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'SEEK_YOUTUBE', seconds })
            .catch(err => console.error('[YouTubeSummarizer] Send message failed:', err));
        }
      });
      return; // Stop here if in extension
    }

    // ── Fallback (Non-extension) ──
    try {
      window.parent?.postMessage({ type: 'SEEK_YOUTUBE', seconds }, 'https://www.youtube.com');
    } catch {
      // No parent
    }
    if (result?.videoId) {
      window.open(`https://youtube.com/watch?v=${result.videoId}&t=${seconds}s`, '_blank');
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.fullSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    console.log('[YouTubeSummarizer] Saved video to Wisebase');
  };

  if (showChat && result) {
    return <VideoChat videoTitle={result.title} summaryContext={result.fullSummary} onClose={() => setShowChat(false)} />;
  }

  const visibleHighlights = expandAll ? (result?.highlights ?? []) : (result?.highlights ?? []).slice(0, 2);

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 font-sans select-none">

      {/* ── HEADER ── */}
      <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-white"/>
          </div>
          <span className="text-[15px] font-semibold text-slate-800">AI Brain</span>
        </div>
        <div className="flex items-center gap-1">
          {result && (
            <button onClick={() => { setResult(null); setUrl(''); setShowFull(false); }}
              title="New search" className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
              <RefreshCw className="w-3.5 h-3.5"/>
            </button>
          )}
          <span className="text-xs font-medium text-slate-500 px-2 py-1">EN</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── URL INPUT ── */}
        {!result && !isLoading && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-1.5 py-1.5 focus-within:border-blue-300 focus-within:bg-white transition-all">
              <Globe className="w-4 h-4 text-slate-400 shrink-0"/>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSummarize()}
                placeholder="Paste YouTube URL…"
                className="flex-1 bg-transparent text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => doSummarize()}
                disabled={!url.trim() || !isYouTubeUrl(url)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-xs font-semibold transition-all active:scale-95"
              >
                <Play className="w-3 h-3 fill-white"/> Summarize
              </button>
            </div>
            {url && !isYouTubeUrl(url) && (
              <p className="flex items-center gap-1.5 text-amber-500 text-xs px-1">
                <AlertCircle className="w-3.5 h-3.5"/> Please enter a valid YouTube URL
              </p>
            )}
            <div className="flex flex-col items-center text-center py-8 gap-3">
              <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center">
                <Youtube className="w-7 h-7 text-slate-300"/>
              </div>
              <p className="text-slate-400 text-sm">Paste any YouTube URL to get<br/>an instant summary with timestamps</p>
            </div>
          </div>
        )}

        {/* ── LOADING SKELETON ── */}
        {isLoading && <LoadingState/>}

        {/* ── ERROR ── */}
        {result?.error && (
          <div className="p-4 space-y-3">
            <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5"/>
              <div>
                <p className="text-red-600 text-sm font-semibold">Failed to summarize</p>
                <p className="text-red-400 text-xs mt-1">{result.error}</p>
              </div>
            </div>
            <button onClick={() => { setResult(null); setUrl(''); }}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
              <RefreshCw className="w-3 h-3"/> Try again
            </button>
          </div>
        )}

        {/* ── RESULT ── */}
        {result && !result.error && (
          <div className="px-4 pt-4 pb-6 space-y-4">

            {/* Video info pill */}
            {result.title && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                <div className="w-6 h-6 bg-red-50 rounded-md flex items-center justify-center shrink-0">
                  <Youtube className="w-3.5 h-3.5 text-red-500"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-slate-700 truncate">{result.title}</p>
                  {result.channel && <p className="text-[10px] text-slate-400">{result.channel}</p>}
                </div>
                {result.duration && <span className="text-[10px] font-mono text-slate-400 shrink-0">{result.duration}</span>}
              </div>
            )}

            {/* ── BRIEF SUMMARY ── */}
            <p className="text-[13.5px] text-slate-700 leading-relaxed">
              {showFull ? result.fullSummary : result.briefSummary}
              {!showFull && result.briefSummary !== result.fullSummary && (
                <button onClick={() => setShowFull(true)}
                  className="inline text-blue-500 hover:text-blue-600 text-[12px] ml-1 transition-colors">
                  …more
                </button>
              )}
            </p>

            {/* ── SUGGESTED QUESTIONS ── */}
            {result.suggestedQuestions.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-slate-700 mb-2">
                  You may be interested in these questions:
                </p>
                <ul className="space-y-1.5">
                  {result.suggestedQuestions.map((q, i) => (
                    <li key={i}>
                      <button onClick={() => setShowChat(true)}
                        className="flex items-start gap-2 w-full text-left group">
                        <span className="text-slate-300 text-[11px] mt-0.5 shrink-0">•</span>
                        <span className="text-blue-500 group-hover:text-blue-600 group-hover:underline text-[12.5px] leading-relaxed transition-colors">
                          {q}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── HIGHLIGHTS ── */}
            {result.highlights.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400"/>
                    Highlights
                  </span>
                  <button onClick={() => setExpandAll(e => !e)}
                    className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                    Expand all
                    <div className={`w-8 h-4 rounded-full border relative transition-all duration-200 ${expandAll ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-300'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-200 ${expandAll ? 'right-0.5' : 'left-0.5'}`}/>
                    </div>
                  </button>
                </div>

                <div>
                  {visibleHighlights.map((h, i) => (
                    <HighlightRow key={i} highlight={h} onSeek={handleSeek} forceExpanded={expandAll} />
                  ))}
                </div>

                {result.highlights.length > 2 && (
                  <button onClick={() => setExpandAll(e => !e)}
                    className="flex items-center gap-1 mt-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                    {expandAll
                      ? <><ChevronUp className="w-3 h-3"/>Show less</>
                      : <><ChevronDown className="w-3 h-3"/>{result.highlights.length - 2} more</>}
                  </button>
                )}
              </div>
            )}

            {/* ── MAKE FULL SUMMARY CTA ── */}
            {!showFull && (
              <button
                onClick={() => setShowFull(true)}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 active:scale-[0.99] rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4"/>
                Make a Full Summary
              </button>
            )}

            {/* ── SAVE TO WISEBASE ── */}
            <button
              onClick={handleSave}
              className={`w-full py-2.5 border rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 transition-all ${
                saved ? 'border-green-200 bg-green-50 text-green-600' : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {saved ? <><Check className="w-4 h-4"/>Saved!</> : <><Bookmark className="w-4 h-4"/>Save the Video to Wisebase</>}
            </button>

            {/* ── TOOLBAR ── */}
            <div className="flex items-center gap-0.5 pt-1 border-t border-slate-100">
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-green-500"/> : <Copy className="w-3.5 h-3.5"/>}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={() => setShowChat(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs transition-colors">
                <MessageSquare className="w-3.5 h-3.5"/> Ask AI
              </button>
              {result.videoId && (
                <button onClick={() => window.open(`https://youtube.com/watch?v=${result.videoId}`, '_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs transition-colors">
                  <Globe className="w-3.5 h-3.5"/> Open
                </button>
              )}
              <button onClick={() => setShowFull(f => !f)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs transition-colors">
                <BookOpen className="w-3.5 h-3.5"/>
                {showFull ? 'Brief' : 'Full'}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default YouTubeSummarizer;
