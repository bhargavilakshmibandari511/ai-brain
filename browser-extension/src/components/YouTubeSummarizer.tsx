import { useState, useEffect } from 'react';
import { Youtube, Loader2, Copy, Check } from 'lucide-react';
import { apiPost, getPageContent } from '../utils/api';
import ReactMarkdown from 'react-markdown';

export default function YouTubeSummarizer() {
  const [url, setUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  // Auto-detect YouTube page
  useEffect(() => {
    (async () => {
      const page = await getPageContent();
      if (page.isYouTube && page.url) {
        setUrl(page.url);
        setAutoDetected(true);
      }
    })();
  }, []);

  const summarize = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setError('');
    setSummary('');

    try {
      const data = await apiPost('/api/summarize/url', { url: url.trim() });
      // API returns fullSummary, briefSummary, title, channel, duration, etc.
      const summaryText = data.fullSummary || data.briefSummary || data.summary || JSON.stringify(data);
      setSummary(summaryText);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to summarize YouTube video');
    } finally {
      setIsLoading(false);
    }
  };


  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isYouTubeUrl = (u: string) =>
    u.includes('youtube.com/watch') || u.includes('youtu.be/');

  return (
    <div className="flex flex-col h-full">
      {/* Input area */}
      <div className="px-3 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2 mb-2">
          <Youtube size={18} className="text-red-500" />
          <span className="text-sm font-medium text-slate-200">YouTube Summarizer</span>
        </div>

        {autoDetected && (
          <div className="mb-2 px-2 py-1 bg-green-900/20 border border-green-700/30 rounded text-xs text-green-300">
            ✓ YouTube page detected automatically
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setAutoDetected(false);
            }}
            placeholder="Paste YouTube URL..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
            onKeyDown={(e) => e.key === 'Enter' && summarize()}
          />
          <button
            onClick={summarize}
            disabled={isLoading || !url.trim()}
            className="px-4 py-2 bg-red-600 rounded-lg text-white text-sm font-medium hover:bg-red-500 disabled:opacity-40 transition-colors"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Go'}
          </button>
        </div>

        {url && !isYouTubeUrl(url) && (
          <p className="mt-1 text-[10px] text-yellow-400/70">
            ⚠ URL doesn't look like a YouTube link. It will be summarized as a webpage.
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-3 px-3 py-2 bg-red-900/30 border border-red-700/30 rounded-lg text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-red-300">Video Summary</span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-slate-400 hover:text-white bg-slate-700/50 rounded transition-colors"
              >
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="text-sm text-slate-200 markdown-body">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <Loader2 size={24} className="animate-spin mb-2" />
          <p className="text-sm">Analyzing video...</p>
          <p className="text-xs text-slate-500 mt-1">This may take a moment</p>
        </div>
      )}

      {/* Empty state */}
      {!summary && !error && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm px-6 text-center">
          <Youtube size={32} className="mb-2 text-red-400/30" />
          <p>Paste a YouTube URL or navigate to a video to get an AI summary</p>
        </div>
      )}
    </div>
  );
}
