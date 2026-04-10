import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, Wand2, RefreshCw, Trash2, History, Clock, Heart, HelpCircle } from 'lucide-react';

const API = 'http://127.0.0.1:8001';

const STYLES = [
  { id: 'realistic', label: '📷 Realistic', desc: 'Photorealistic, 8K detail' },
  { id: 'anime', label: '🎌 Anime', desc: 'Vibrant anime style' },
  { id: 'digital-art', label: '🎨 Digital Art', desc: 'Concept art, Artstation' },
  { id: 'oil-painting', label: '🖼️ Oil Painting', desc: 'Classical fine art' },
  { id: 'watercolor', label: '💧 Watercolor', desc: 'Soft, delicate washes' },
  { id: 'cinematic', label: '🎬 Cinematic', desc: 'Film photography look' },
];

const COUNT_OPTIONS = [2, 3, 4, 5, 6];

const QUICK_TEMPLATES = [
  { label: '🧛 Gothic Fantasy', idea: 'A gothic fantasy character with dark elegant clothing and mystical aura in a haunted castle' },
  { label: '🚀 Sci-Fi Hero', idea: 'A futuristic sci-fi hero with advanced armor in a neon-lit cyberpunk city' },
  { label: '🌸 Nature Scene', idea: 'A serene nature landscape with waterfalls, ancient forests and magical glowing elements' },
  { label: '🎭 Portrait Study', idea: 'A beautiful portrait of a character with expressive features and dramatic lighting' },
  { label: '🏰 Architecture', idea: 'A magnificent fantasy palace architecture with intricate details and magical elements' },
  { label: '🐉 Creature Design', idea: 'A unique fantastical creature with creative design and atmospheric background' },
];

interface PromptResult {
  prompts: string[];
  negative_prompt: string;
  style: string;
}

interface HistoryItem {
  id: string;
  idea: string;
  style: string;
  prompts: string[];
  negative_prompt: string;
  timestamp: number;
  favorite: boolean;
}

export const ImageGenerator: React.FC = () => {
  const [idea, setIdea] = useState('');
  const [style, setStyle] = useState('realistic');
  const [count, setCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PromptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedNeg, setCopiedNeg] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('imagegen_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('imagegen_history', JSON.stringify(history));
  }, [history]);

  const handleGenerate = async () => {
    if (!idea.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/imagegen/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea.trim(), style, count }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
      
      // Add to history
      const historyItem: HistoryItem = {
        id: Date.now().toString(),
        idea: idea.trim(),
        style,
        prompts: data.prompts,
        negative_prompt: data.negative_prompt,
        timestamp: Date.now(),
        favorite: false,
      };
      setHistory(prev => [historyItem, ...prev].slice(0, 50));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompts');
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const copyNeg = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNeg(true);
    setTimeout(() => setCopiedNeg(false), 2000);
  };

  const toggleFavorite = (itemId: string) => {
    setHistory(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, favorite: !item.favorite } : item
      )
    );
  };

  const deleteHistoryItem = (itemId: string) => {
    setHistory(prev => prev.filter(item => item.id !== itemId));
  };

  const loadFromHistory = (item: HistoryItem) => {
    setIdea(item.idea);
    setStyle(item.style);
    setResult({
      prompts: item.prompts,
      negative_prompt: item.negative_prompt,
      style: item.style,
    });
    setShowHistory(false);
  };

  const applyTemplate = (template: typeof QUICK_TEMPLATES[0]) => {
    setIdea(template.idea);
    setShowTemplates(false);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">AI Image Prompt Generator</h1>
              <p className="text-xs text-slate-500">Turn your ideas into detailed prompts for Stable Diffusion, Midjourney &amp; more</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowTemplates(v => !v); setShowHistory(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                showTemplates ? 'bg-violet-600/20 border-violet-500 text-violet-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" /> Templates
            </button>
            <button
              onClick={() => { setShowHistory(v => !v); setShowTemplates(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                showHistory ? 'bg-violet-600/20 border-violet-500 text-violet-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" /> History
              {history.length > 0 && (
                <span className="bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{history.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Templates dropdown */}
        {showTemplates && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
            {QUICK_TEMPLATES.map(t => (
              <button
                key={t.label}
                onClick={() => applyTemplate(t)}
                className="text-left px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-violet-500 hover:bg-violet-600/10 transition-all"
              >
                <div className="text-xs font-semibold text-slate-200">{t.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{t.idea}</div>
              </button>
            ))}
          </div>
        )}

        {/* History panel */}
        {showHistory && (
          <div className="mt-3 max-h-72 overflow-y-auto space-y-2">
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No history yet — generate some prompts!</p>
            ) : (
              history.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 group">
                  <button onClick={() => toggleFavorite(item.id)} className="flex-shrink-0" title={item.favorite ? 'Remove favorite' : 'Add to favorites'}>
                    <Heart className={`w-4 h-4 transition-colors ${
                      item.favorite ? 'text-rose-400 fill-rose-400' : 'text-slate-600 hover:text-rose-400'
                    }`} />
                  </button>
                  <button onClick={() => loadFromHistory(item)} className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-medium text-slate-200 truncate">{item.idea}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-500 capitalize">{item.style.replace('-', ' ')}</span>
                      <span className="text-[11px] text-slate-600">·</span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(item.timestamp)}
                      </span>
                      <span className="text-[11px] text-slate-600">·</span>
                      <span className="text-[11px] text-slate-500">{item.prompts.length} prompts</span>
                    </div>
                  </button>
                  <button onClick={() => deleteHistoryItem(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity" title="Delete from history">
                    <Trash2 className="w-3.5 h-3.5 text-slate-600 hover:text-red-400" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="p-8 max-w-4xl mx-auto w-full space-y-6">

        {/* Idea Input */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-300">Your Idea</label>
          <textarea
            value={idea}
            onChange={e => setIdea(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleGenerate(); }}
            placeholder="e.g. a dragon flying over a neon city at night..."
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none text-sm transition-colors"
          />

          {/* Style Grid */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Style</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  title={s.desc}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                    style === s.id
                      ? 'bg-violet-600/30 border-violet-500 text-violet-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Count + Generate Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Prompts:</span>
              <div className="flex gap-1">
                {COUNT_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                      count === n
                        ? 'bg-violet-600/30 border-violet-500 text-violet-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={!idea.trim() || loading}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                idea.trim() && !loading
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              {loading
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Wand2 className="w-4 h-4" /> Generate Prompts</>
              }
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Generated Prompts <span className="text-slate-600 ml-1">({result.prompts.length})</span>
              </h2>
              <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full capitalize">
                {result.style.replace('-', ' ')} style
              </span>
            </div>

            {result.prompts.map((prompt, i) => (
              <div
                key={i}
                className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3 flex-1 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-violet-600/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-200 leading-relaxed break-words">{prompt}</p>
                  </div>
                  <button
                    onClick={() => copyPrompt(prompt, i)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700 opacity-0 group-hover:opacity-100"
                  >
                    {copiedIdx === i
                      ? <><Check className="w-3.5 h-3.5 text-green-400" /> Copied!</>
                      : <><Copy className="w-3.5 h-3.5" /> Copy</>
                    }
                  </button>
                </div>
              </div>
            ))}

            {/* Negative Prompt */}
            <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Negative Prompt</span>
                <button
                  onClick={() => copyNeg(result.negative_prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700"
                >
                  {copiedNeg
                    ? <><Check className="w-3.5 h-3.5 text-green-400" /> Copied!</>
                    : <><Copy className="w-3.5 h-3.5" /> Copy</>
                  }
                </button>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{result.negative_prompt}</p>
            </div>

            {/* Regenerate */}
            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 text-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Regenerate
            </button>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-16 text-slate-600">
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">Enter an idea above and click <strong className="text-slate-500">Generate Prompts</strong></p>
            <p className="text-xs mt-2 opacity-60">Works great with Stable Diffusion, DALL-E, Midjourney, and more</p>
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {QUICK_TEMPLATES.map(t => (
                <button key={t.label} onClick={() => applyTemplate(t)}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:border-violet-500 hover:text-violet-300 transition-all">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGenerator;
