import { useState } from 'react';
import { Send, Copy, Download, Loader } from 'lucide-react';

interface ImageGeneratorProps {
  pendingText?: string;
  onConsumeText?: () => void;
}

export default function ImageGenerator({ pendingText = '', onConsumeText }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState(pendingText);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please describe the image you want to generate');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/imagegen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: prompt,
          style: 'realistic',
          count: 1,
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      setGeneratedPrompt(data.prompts?.[0] || '');
      onConsumeText?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompt');
      console.error('Image gen error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 p-4">
      <h2 className="text-lg font-bold text-white mb-3">🎨 Image Prompt Generator</h2>

      {/* Input */}
      <div className="mb-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What image do you want to generate? Describe it..."
          className="w-full h-24 p-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none resize-none text-sm"
        />
      </div>

      {/* Error */}
      {error && <div className="p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm mb-3">{error}</div>}

      {/* Button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 mb-3 transition-colors"
      >
        {loading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
        {loading ? 'Generating...' : 'Generate Prompt'}
      </button>

      {/* Output */}
      {generatedPrompt && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-slate-800/50 rounded-lg p-3 mb-3 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">AI-ENHANCED PROMPT</span>
            <button
              onClick={copyToClipboard}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
              title="Copy"
            >
              <Copy size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-auto text-sm text-slate-200 whitespace-pre-wrap">{generatedPrompt}</div>
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-slate-500 text-center">
        Perfect prompts for Midjourney, DALL-E, or Stable Diffusion
      </div>
    </div>
  );
}
