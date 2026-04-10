import React, { useState, useEffect } from 'react';
import { Star, Search, Trash2, Copy, Check, BookOpen } from 'lucide-react';

interface WiseEntry {
  id: number;
  content: string;
  savedAt: string;
  tags: string[];
}

export const Wisebase: React.FC = () => {
  const [entries, setEntries] = useState<WiseEntry[]>([]);
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState<{ [id: number]: string }>({});

  useEffect(() => {
    const stored = localStorage.getItem('wisebase');
    if (stored) setEntries(JSON.parse(stored));
  }, []);

  const save = (updated: WiseEntry[]) => {
    setEntries(updated);
    localStorage.setItem('wisebase', JSON.stringify(updated));
  };

  const deleteEntry = (id: number) => save(entries.filter(e => e.id !== id));

  const addTag = (id: number) => {
    const tag = tagInput[id]?.trim();
    if (!tag) return;
    const updated = entries.map(e =>
      e.id === id && !e.tags.includes(tag) ? { ...e, tags: [...e.tags, tag] } : e
    );
    save(updated);
    setTagInput(prev => ({ ...prev, [id]: '' }));
  };

  const removeTag = (id: number, tag: string) => {
    save(entries.map(e => e.id === id ? { ...e, tags: e.tags.filter(t => t !== tag) } : e));
  };

  const copy = (id: number, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = entries.filter(e =>
    query === '' ||
    e.content.toLowerCase().includes(query.toLowerCase()) ||
    e.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
            <Star className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Knowledge Base <span className="text-xs font-normal text-slate-500 ml-2">(Wisebase)</span></h1>
            <p className="text-xs text-slate-500">{entries.length} items saved locally</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search notes or tags..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-600 bg-slate-900/40 border border-slate-800/50 rounded-[2rem] p-12 text-center max-w-2xl mx-auto shadow-inner">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
              <BookOpen className="w-8 h-8 text-purple-400 opacity-80" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {query ? 'No matches found' : 'Your Knowledge Base is empty'}
            </h2>
            <p className="text-sm text-slate-400 max-w-sm mb-8 leading-relaxed">
              {query 
                ? `We couldn't find any saved items matching "${query}". Try a different search term.`
                : 'Save important insights, code snippets, or AI responses to build your own personal database. Click the ⭐ icon on any chat response to save it here.'}
            </p>
            {!query && (
              <button
                onClick={() => window.location.hash = 'chat'}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-bold rounded-xl transition-all duration-300 shadow-lg shadow-purple-900/20 active:scale-95"
              >
                Start Chatting with AI
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 max-w-4xl mx-auto">
            {filtered.map(entry => (
              <div
                key={entry.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors"
              >
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mb-3">
                  {entry.content.slice(0, 600)}{entry.content.length > 600 ? '…' : ''}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {entry.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/15 text-purple-300 rounded-full text-xs">
                      {tag}
                      <button onClick={() => removeTag(entry.id, tag)} className="hover:text-red-400">×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput[entry.id] || ''}
                    onChange={e => setTagInput(prev => ({ ...prev, [entry.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addTag(entry.id)}
                    placeholder="+ tag"
                    className="px-2 py-0.5 bg-transparent border border-slate-700 rounded-full text-xs text-slate-400 focus:outline-none focus:border-purple-500 w-16"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-600">
                    {new Date(entry.savedAt).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copy(entry.id, entry.content)}
                      className="p-1 text-slate-600 hover:text-slate-300 transition-colors"
                    >
                      {copiedId === entry.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
