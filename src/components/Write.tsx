import React, { useState } from 'react';
import { PenTool, Mic, Wand2, Loader2, Copy, Check } from 'lucide-react';
import { getCurrentMode, getApiKey } from '../utils/modeHelper';

const API = 'http://127.0.0.1:8001';

type WriteFormat = 'Essay' | 'Paragraph' | 'Email' | 'Idea' | 'Blog Post' | 'Outline';
type WriteStyle = 'professional' | 'casual' | 'concise' | 'formal';

export const Write: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState<WriteFormat>('Essay');
  const [style, setStyle] = useState<WriteStyle>('professional');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const formats: WriteFormat[] = ['Essay', 'Paragraph', 'Email', 'Idea', 'Blog Post', 'Outline'];
  const styles: WriteStyle[] = ['professional', 'casual', 'concise', 'formal'];

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError('');
    setResult('');

    try {
      const mode = getCurrentMode();
      const apiKey = getApiKey();
      
      const prompt = `Write a ${format} about the following topic: ${topic}`;
      const response = await fetch(`${API}/api/summarize/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: prompt, 
          style,
          force_mode: mode === 'online' ? 'online' : 'offline',
          api_key: mode === 'online' ? apiKey : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate content. Ensure backend and Ollama are running.');
      }

      const data = await response.json();
      setResult(data.result || '');
    } catch (err: any) {
      setError(err.message || 'An error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <PenTool className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Write</h1>
            <p className="text-xs text-slate-500">Generate drafted content side by side with AI</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[500px]">
          
          {/* Input Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-lg">
            
            {/* Format Selection Header */}
            <div className="p-3 border-b border-slate-800 flex flex-wrap gap-2 bg-slate-800/50">
              {formats.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    format === f
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Additional Settings */}
            <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-slate-300 font-medium">Writing Tone</span>
              </div>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as WriteStyle)}
                className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-full px-3 py-1 outline-none focus:border-indigo-500 capitalize"
              >
                {styles.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Input Area */}
            <div className="flex-1 relative p-4 flex flex-col">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter the topic you want to write about..."
                className="w-full h-full min-h-[200px] bg-transparent text-slate-200 placeholder-slate-600 resize-none outline-none text-sm leading-relaxed"
              />
              
              <div className="flex justify-between items-center mt-4">
                <button className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!topic.trim() || isGenerating}
                  className={`px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
                    topic.trim() && !isGenerating
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-900/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                </button>
              </div>
            </div>
          </div>

          {/* Output Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-lg relative">
            <div className="px-5 py-4 flex items-center gap-2">
              <div className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
              <span className="text-sm font-bold text-slate-200">AI Output</span>
            </div>
            
            <div className="flex-1 px-5 pb-5 overflow-y-auto">
              {error ? (
                <div className="bg-red-950/30 border border-red-900/50 text-red-400 p-4 rounded-xl text-sm flex gap-3">
                  <span className="text-lg">⚠️</span>
                  {error}
                </div>
              ) : result ? (
                <div className="flex flex-col h-full">
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap flex-1">
                    {result}
                  </div>
                  
                  {/* Footer Actions */}
                  <div className="flex justify-between items-center pt-6 mt-auto">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleCopy}
                        className="text-slate-400 hover:text-white transition-colors"
                        title="Copy"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button className="text-slate-400 hover:text-white transition-colors" title="Retry">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                      </button>
                      <button className="text-slate-400 hover:text-white transition-colors" title="Listen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                      </button>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors text-sm font-medium">
                      <PenTool className="w-3.5 h-3.5" /> Edit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-3 opacity-60">
                  <PenTool className="w-12 h-12" />
                  <p className="text-sm">Your generated content will appear here</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
