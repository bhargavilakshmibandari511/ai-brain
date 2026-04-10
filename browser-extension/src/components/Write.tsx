import { useState } from 'react';
import { Send, Copy, Download, Loader } from 'lucide-react';

interface WriteProps {
  pendingText?: string;
  onConsumeText?: () => void;
}

export default function Write({ pendingText = '', onConsumeText }: WriteProps) {
  const [input, setInput] = useState(pendingText);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleWrite = async () => {
    if (!input.trim()) {
      setError('Please enter what you want help writing');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/summarize/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: input,
          style: 'professional',
          force_mode: localStorage.getItem('ai_deployment_mode') || 'offline',
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      setOutput(data.improved_text || data.response || '');
      onConsumeText?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to improve writing');
      console.error('Write error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 p-4">
      <h2 className="text-lg font-bold text-white mb-3">✍️ Write Assistant</h2>

      {/* Input */}
      <div className="mb-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What do you need help writing? (essay, email, story...)"
          className="w-full h-24 p-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none resize-none text-sm"
        />
      </div>

      {/* Error */}
      {error && <div className="p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm mb-3">{error}</div>}

      {/* Button */}
      <button
        onClick={handleWrite}
        disabled={loading}
        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 mb-3 transition-colors"
      >
        {loading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
        {loading ? 'Improving...' : 'Improve Writing'}
      </button>

      {/* Output */}
      {output && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-slate-800/50 rounded-lg p-3 mb-3 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">IMPROVED TEXT</span>
            <button
              onClick={copyToClipboard}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
              title="Copy"
            >
              <Copy size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-auto text-sm text-slate-200 whitespace-pre-wrap">{output}</div>
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-slate-500 text-center">
        Use for essays, emails, resumes, and more
      </div>
    </div>
  );
}
