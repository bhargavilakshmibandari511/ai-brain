import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, Copy, Send,
  Trash2, History, AlertCircle, Loader2, Maximize2,
  Zap
} from 'lucide-react';

const API_BASE = "http://127.0.0.1:8001/api/ocr";

interface OCRResult {
  text: string;
  confidence: number;
  word_count: number;
  char_count: number;
  filename: string;
  job_id: string;
  timestamp: number;
}

export const OCRReader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [lang, setLang] = useState("eng");
  const [mode, setMode] = useState("auto");
  const [psm, setPsm] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<OCRResult[]>([]);
  const [availableLangs, setAvailableLangs] = useState<string[]>(["eng"]);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch available languages on mount
  useEffect(() => {
    fetch(`${API_BASE}/languages`)
      .then(r => r.json())
      .then(d => setAvailableLangs(d.languages || ["eng"]))
      .catch(() => setAvailableLangs(["eng"]));
    
    // Load history from localStorage
    const saved = localStorage.getItem('ocr_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
      setError(null);
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lang", lang);
    formData.append("mode", mode);
    formData.append("psm", psm.toString());

    try {
      const res = await fetch(`${API_BASE}/extract`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("OCR extraction failed");

      const data = await res.json();
      setResult(data);
      
      const newHistory = [data, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('ocr_history', JSON.stringify(newHistory));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result.text);
    }
  };

  const sendToChat = () => {
    if (result) {
      // Dispatches a custom event that ChatInterface can listen to
      window.dispatchEvent(new CustomEvent('ai-brain:send-to-chat', {
        detail: { text: result.text }
      }));
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <style>{`
        @keyframes scan {
          0% { top: 0%; }
          100% { top: 100%; }
        }
        .scan-line {
          height: 2px;
          background: linear-gradient(to right, transparent, #8b5cf6, transparent);
          box-shadow: 0 0 8px #8b5cf6;
          position: absolute;
          width: 100%;
          z-index: 10;
          animation: scan 2s linear infinite;
        }
      `}</style>

      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ScanIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">OCR Reader</h1>
            <p className="text-xs text-slate-500 font-medium">Extract text from images locally</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col lg:flex-row p-4 gap-4">
        {/* Left Panel: Input & Settings */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          {/* Upload Area */}
          <div className="flex-1 min-h-[300px] rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 flex flex-col items-center justify-center p-6 relative group transition-all hover:border-indigo-500/50 hover:bg-slate-900/50">
            {preview ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-xl">
                <img src={preview} alt="Upload Preview" className="max-w-full max-h-full object-contain" />
                {loading && <div className="scan-line" />}
                <button 
                  onClick={() => { setFile(null); setPreview(null); setResult(null); }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white/70 hover:text-white hover:bg-red-500/80 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-slate-500 group-hover:text-indigo-400" />
                </div>
                <p className="text-slate-300 font-semibold mb-1">Drag & drop your image here</p>
                <p className="text-slate-500 text-xs mb-6">Supports JPG, PNG, WEBP (Max 10MB)</p>
                <label className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl cursor-pointer transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                  Browse Files
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
              </>
            )}
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Language</label>
              <select 
                value={lang} onChange={(e) => setLang(e.target.value)}
                className="w-full bg-transparent text-sm font-medium outline-none text-slate-200"
              >
                {availableLangs.map(l => <option key={l} value={l} className="bg-slate-900">{l.toUpperCase()}</option>)}
              </select>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Processing Mode</label>
              <select 
                value={mode} onChange={(e) => setMode(e.target.value)}
                className="w-full bg-transparent text-sm font-medium outline-none text-slate-200"
              >
                <option value="auto" className="bg-slate-900">Auto</option>
                <option value="document" className="bg-slate-900">Document</option>
                <option value="photo" className="bg-slate-900">Photo</option>
              </select>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Text Layout (PSM)</label>
              <select 
                value={psm} onChange={(e) => setPsm(parseInt(e.target.value))}
                className="w-full bg-transparent text-sm font-medium outline-none text-slate-200"
              >
                <option value={3} className="bg-slate-900">Auto (3)</option>
                <option value={6} className="bg-slate-900">Block (6)</option>
                <option value={1} className="bg-slate-900">Orient (1)</option>
              </select>
            </div>
          </div>

          <button 
            disabled={!file || loading}
            onClick={handleProcess}
            className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold transition-all ${
              !file || loading 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-600/20 hover:brightness-110 active:scale-[0.98]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                <span>Extract Text Now</span>
              </>
            )}
          </button>
        </div>

        {/* Right Panel: Result */}
        <div className="w-full lg:w-1/2 flex flex-col bg-slate-900/40 rounded-2xl border border-slate-800/50 overflow-hidden">
          {result ? (
            <>
              {/* Stats Bar */}
              <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
                <div className="flex gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Confidence</span>
                    <span className={`text-sm font-bold ${result.confidence > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {result.confidence}%
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Words</span>
                    <span className="text-sm font-bold text-white">{result.word_count}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={copyToClipboard} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Copy text">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={sendToChat} className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors border border-indigo-500/30">
                    <Send className="w-3.5 h-3.5" />
                    Send to Chat
                  </button>
                </div>
              </div>

              {/* Text Area */}
              <div className="flex-1 p-6 overflow-y-auto">
                <textarea 
                  readOnly 
                  value={result.text}
                  className="w-full h-full bg-transparent border-none outline-none resize-none text-slate-300 font-mono text-sm leading-relaxed"
                />
              </div>
            </>
          ) : showHistory ? (
             <div className="flex-1 flex flex-col p-4 overflow-y-auto gap-3">
               <h3 className="text-sm font-bold text-slate-400 px-2 flex items-center gap-2">
                 <History className="w-4 h-4" /> Recent OCR Jobs
               </h3>
               {history.length > 0 ? history.map((h, i) => (
                 <div 
                   key={i} 
                   onClick={() => setResult(h)}
                   className="p-3 bg-slate-800/30 border border-slate-800 rounded-xl hover:border-indigo-500/50 hover:bg-slate-800/50 cursor-pointer transition-all"
                 >
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-xs font-bold text-white truncate max-w-[200px]">{h.filename}</span>
                     <span className="text-[10px] text-slate-500">{new Date(h.timestamp * 1000).toLocaleDateString()}</span>
                   </div>
                   <p className="text-[11px] text-slate-400 line-clamp-2 italic font-mono">"{h.text.slice(0, 100)}..."</p>
                 </div>
               )) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                    <History className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm">No history found</p>
                 </div>
               )}
             </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-slate-700" />
              </div>
              <h3 className="text-lg font-bold text-slate-400 mb-2">Ready to Extract</h3>
              <p className="text-sm text-slate-600 max-w-[280px]">Upload an image on the left to see the extracted text results here.</p>
            </div>
          )}
        </div>
      </main>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-red-950/90 border border-red-500/50 p-4 rounded-2xl flex items-center gap-3 text-red-200 shadow-2xl animate-bounce-in">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-sm font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-white">
            <Maximize2 className="w-4 h-4 rotate-45" />
          </button>
        </div>
      )}
    </div>
  );
};

// Internal icon component
const ScanIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 4H6C4.89543 4 4 4.89543 4 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 4H18C19.1046 4 20 4.89543 20 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 14V18C4 19.1046 4.89543 20 6 20H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 14V18C20 19.1046 19.1046 20 18 20H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
