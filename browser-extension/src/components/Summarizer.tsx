import { useState, useEffect, useRef } from 'react';
import { FileText, Globe, Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import { apiPost, getPageContent } from '../utils/api';
import ReactMarkdown from 'react-markdown';

interface SummarizerProps {
  pendingText?: string;
  onConsumeText?: () => void;
}

export default function Summarizer({ pendingText, onConsumeText }: SummarizerProps) {
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'page' | 'url'>('page');
  const [url, setUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const hasTriggered = useRef(false);

  // Auto-trigger summarize if opened from widget with pendingText
  useEffect(() => {
    if (hasTriggered.current) return;
    if (pendingText !== undefined && pendingText !== null) {
      hasTriggered.current = true;
      onConsumeText?.();
      // Widget clicked "Summarize" — auto-summarize the page
      summarizePage();
    }
  }, [pendingText]);

  const summarizePage = async () => {
    setIsLoading(true);
    setError('');
    setSummary('');

    try {
      const page = await getPageContent();
      if (page.error) {
        setError(page.error);
        return;
      }

      setPageTitle(page.title || 'Current Page');

      // If it's a YouTube page, use the URL endpoint
      if (page.isYouTube) {
        const data = await apiPost('/api/summarize/url', { url: page.url });
        setSummary(data.summary);
        return;
      }

      // Otherwise, send the text for summarization
      const text = page.text?.substring(0, 15000) || '';
      if (!text.trim()) {
        setError('No readable content found on this page.');
        return;
      }

      const data = await apiPost('/api/summarize/text', {
        text,
        title: page.title,
      });
      setSummary(data.summary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to summarize');
    } finally {
      setIsLoading(false);
    }
  };

  const summarizeUrl = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setError('');
    setSummary('');
    setPageTitle(url);

    try {
      const data = await apiPost('/api/summarize/url', { url: url.trim() });
      setSummary(data.summary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to summarize');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mode tabs */}
      <div className="flex border-b border-slate-700/50">
        <button
          onClick={() => setMode('page')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
            mode === 'page'
              ? 'text-purple-300 border-b-2 border-purple-500'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <FileText size={14} />
          Current Page
        </button>
        <button
          onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
            mode === 'url'
              ? 'text-purple-300 border-b-2 border-purple-500'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Globe size={14} />
          Enter URL
        </button>
      </div>

      {/* Action area */}
      <div className="px-3 py-3">
        {mode === 'page' ? (
          <button
            onClick={summarizePage}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Summarizing...
              </>
            ) : (
              <>
                <FileText size={16} />
                Summarize This Page
              </>
            )}
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com or YouTube URL"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
              onKeyDown={(e) => e.key === 'Enter' && summarizeUrl()}
            />
            <button
              onClick={summarizeUrl}
              disabled={isLoading || !url.trim()}
              className="px-3 py-2 bg-purple-600 rounded-lg text-white text-sm hover:bg-purple-500 disabled:opacity-40 transition-colors"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 px-3 py-2 bg-red-900/30 border border-red-700/30 rounded-lg text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Result */}
      {summary && (
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {pageTitle && (
            <div className="text-xs text-slate-400 mb-2 truncate">
              📄 {pageTitle}
            </div>
          )}

          <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-purple-300">Summary</span>
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

      {/* Empty state */}
      {!summary && !error && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm px-6 text-center">
          <FileText size={32} className="mb-2 text-purple-400/30" />
          <p>
            {mode === 'page'
              ? 'Click the button above to summarize the current page'
              : 'Enter a URL to get an AI summary'}
          </p>
        </div>
      )}
    </div>
  );
}
