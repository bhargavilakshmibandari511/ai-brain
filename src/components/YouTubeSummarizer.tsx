import React, { useState } from 'react';
import { Youtube, Loader2, Copy, Check, Globe, Play, Clock, FileText } from 'lucide-react';

const API = 'http://127.0.0.1:8001';

interface Summary {
  title?: string;
  summary?: string;
  keyPoints?: string[];
  timestamp?: string;
  error?: string;
}

export const YouTubeSummarizer: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Summary | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSummarize = async () => {
    if (!url.trim()) return;
    
    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${API}/api/summarize/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();
      
      if (data.summary) {
        setResult({ summary: data.summary });
      } else if (data.error) {
        setResult({ error: data.error });
      } else {
        setResult({ error: 'Could not get summary. Please check the URL.' });
      }
    } catch (error) {
      setResult({ 
        error: `Error: ${error instanceof Error ? error.message : 'Failed to connect to backend'}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.summary) return;
    navigator.clipboard.writeText(result.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isValidYouTube = (url: string) => {
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg flex items-center justify-center">
            <Youtube className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">YouTube Summarizer</h1>
            <p className="text-xs text-slate-500">Get key points from any YouTube video</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* URL Input */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Enter YouTube URL
            </label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
              <button
                onClick={handleSummarize}
                disabled={!url.trim() || isLoading}
                className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors ${
                  url.trim() && !isLoading
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Summarize
              </button>
            </div>
            
            {url && !isValidYouTube(url) && (
              <p className="text-xs text-yellow-500 mt-2">
                ⚠️ Please enter a valid YouTube URL
              </p>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-white">Summary</h3>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              
              <div className="p-6">
                {result.error ? (
                  <div className="text-red-400 text-sm">
                    {result.error}
                  </div>
                ) : result.summary ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {result.summary}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!result && !isLoading && (
            <div className="text-center py-12">
              <Youtube className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 text-sm">
                Paste a YouTube URL above to get an instant summary
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

