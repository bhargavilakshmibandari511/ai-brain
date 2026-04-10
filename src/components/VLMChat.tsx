import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, Send, Loader2, Eye,
  Copy, Check, AlertCircle, Layers
} from 'lucide-react';

const API = 'http://127.0.0.1:8001';

const TASKS = [
  { id: 'auto', label: '🤖 Auto', desc: 'Smart routing' },
  { id: 'ocr', label: '📄 OCR', desc: 'Extract text' },
  { id: 'chart', label: '📊 Chart', desc: 'Analyse data' },
  { id: 'ui', label: '🖥️ UI', desc: 'Review design' },
  { id: 'reasoning', label: '💡 Reason', desc: 'General Q&A' },
];

const QUICK_ACTIONS = [
  { label: 'Extract all text', task: 'ocr' },
  { label: 'Summarise this image', task: 'reasoning' },
  { label: 'Analyse the chart', task: 'chart' },
  { label: 'Review the UI design', task: 'ui' },
  { label: 'Describe in detail', task: 'reasoning' },
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  task?: string;
  model?: string;
}

export const VLMChat: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [question, setQuestion] = useState('');
  const [task, setTask] = useState('auto');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadImage = (file: File) => {
    setImageFile(file);
    setImage(URL.createObjectURL(file));
    setMessages([]);
    setError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImage(file);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const ask = async (q: string, t = task) => {
    if (!imageFile || !q.trim() || streaming) return;
    const userMsg: Message = { role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setQuestion('');
    setError(null);
    setStreaming(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const form = new FormData();
      form.append('file', imageFile);
      form.append('question', q);
      form.append('task', t);

      const res = await fetch(`${API}/api/vlm/analyze/stream`, { method: 'POST', body: form });

      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.detail || `Server error ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const token = line.slice(6);
            if (token === '[DONE]') break;
            if (token.startsWith('[ERROR]')) throw new Error(token.slice(8));
            const decoded = token.replace(/\\n/g, '\n');
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: updated[updated.length - 1].content + decoded,
              };
              return updated;
            });
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
      setMessages(prev => prev.slice(0, -1)); // remove empty assistant msg
    } finally {
      setStreaming(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const copyMsg = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex h-full bg-slate-950" style={{ minHeight: 0 }}>

      {/* ── Left panel: image upload ─────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-slate-800 bg-slate-900">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Vision Chat</p>
              <p className="text-[11px] text-slate-500">Powered by llava + Ollama</p>
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <div className="p-4 flex-1 flex flex-col gap-4">
          <div
            onDragEnter={handleDrag} onDragLeave={handleDrag}
            onDragOver={handleDrag} onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center text-center overflow-hidden ${
              dragActive ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
            }`}
            style={{ minHeight: 200 }}
          >
            {image ? (
              <img src={image} alt="Uploaded" className="w-full h-full object-contain rounded-2xl max-h-52" />
            ) : (
              <div className="p-6">
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <p className="text-xs font-semibold text-slate-400">Drop image here</p>
                <p className="text-[11px] text-slate-600 mt-1">PNG · JPG · WebP</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) loadImage(f); e.target.value = ''; }}
          />

          {image && (
            <button
              onClick={() => { setImage(null); setImageFile(null); setMessages([]); }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors text-center"
            >
              ✕ Remove image
            </button>
          )}

          {/* Task picker */}
          <div>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Task Mode</p>
            <div className="grid grid-cols-2 gap-1.5">
              {TASKS.map(t => (
                <button key={t.id} onClick={() => setTask(t.id)}
                  title={t.desc}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all text-left ${
                    task === t.id
                      ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          {image && (
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Quick Actions</p>
              <div className="flex flex-col gap-1">
                {QUICK_ACTIONS.map(a => (
                  <button key={a.label}
                    onClick={() => ask(a.label, a.task)}
                    disabled={streaming}
                    className="text-left text-[11px] px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:border-cyan-500 hover:text-cyan-300 transition-all disabled:opacity-40"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: chat ────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 text-center">
              <Eye className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium">Upload an image and ask anything</p>
              <p className="text-xs mt-1 opacity-60">OCR · Chart analysis · UI review · General Q&amp;A</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${
                msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-cyan-600 text-white'
              }`}>
                {msg.role === 'user' ? 'U' : 'AI'}
              </div>
              <div className={`group relative max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-violet-600/20 border border-violet-500/30 text-slate-200'
                  : 'bg-slate-800 border border-slate-700 text-slate-200'
              }`}>
                {msg.content || (streaming && idx === messages.length - 1
                  ? <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse rounded-sm" />
                  : null)}
                {msg.role === 'assistant' && msg.content && (
                  <button
                    onClick={() => copyMsg(msg.content, idx)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-slate-700 hover:bg-slate-600"
                  >
                    {copied === idx
                      ? <Check className="w-3 h-3 text-green-400" />
                      : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
              {error.includes('llava') || error.includes('model') ? (
                <span className="text-slate-500 ml-1">— run: <code className="text-slate-400">ollama pull llava:7b</code></span>
              ) : null}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          {!imageFile && (
            <p className="text-xs text-slate-600 text-center mb-3">Upload an image on the left to start chatting</p>
          )}
          <div className="flex gap-3">
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(question); } }}
              placeholder={imageFile ? 'Ask anything about the image…' : 'Upload an image first'}
              disabled={!imageFile || streaming}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-40 transition-colors"
            />
            <button
              onClick={() => ask(question)}
              disabled={!imageFile || !question.trim() || streaming}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VLMChat;
