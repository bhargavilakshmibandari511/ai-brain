import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, Send, FileText, Plus, Search, ChevronLeft, ChevronRight,
  Download, RotateCw, X, Loader2, BookOpen, Sparkles, LayoutList, 
  Gamepad2, Brain, AlertCircle, CheckCircle2, XCircle, RefreshCw, RotateCcw,
  Maximize2, Minimize2, Image as ImageIcon, Trash2
} from 'lucide-react';
import DynamicSimulation from './DynamicSimulation';

const API = 'http://127.0.0.1:8001';

// --- TYPES ---
interface ChatMessage {
  id: number;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  sources?: string[];
  chunksUsed?: number;
  processingTime?: number;
  image?: string;
}

interface PDFDocument {
  id: string;
  name: string;
  status: 'processing' | 'ready' | 'error';
  timestamp: string;
  page_count?: number;
  summary?: string;
  category?: string;
  chunks_count?: number;
}

interface BackendDocument {
  id: string;
  filename: string;
  status: string;
  created_at?: string;
  page_count?: number;
  summary?: string;
  category?: string;
  chunks_count?: number;
}

interface Flashcard {
  question: string;
  answer: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

interface NoteItem {
  heading: string;
  points: string[];
}

interface SimulationData {
  nodes: any[];
  edges: any[];
}

// --- SUB-COMPONENTS ---
const StatusDot: React.FC<{ status: PDFDocument['status'] }> = ({ status }) => {
  const cls = status === 'ready' ? 'bg-emerald-500' : status === 'error' ? 'bg-red-500' : 'bg-amber-500 animate-pulse';
  return <div className={`w-1.5 h-1.5 rounded-full ${cls}`} />;
};

const GamifiedMode: React.FC<{ isGamified: boolean; level: number; xp: number; streak: number; children: React.ReactNode }> = ({ isGamified, level, xp, streak, children }) => {
  if (!isGamified) return <>{children}</>;
  const pct = (xp % 200) / 2;
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      <div className="h-12 border-b border-white/5 flex items-center px-4 justify-between bg-slate-900/50 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none">Level</span>
            <span className="text-sm font-black text-white">{level}</span>
          </div>
          <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] font-bold text-slate-500">{xp} XP</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <span className="text-orange-400 text-xs font-black">🔥 {streak}</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">{children}</div>
    </div>
  );
};

const ChatBubble: React.FC<{ msg: ChatMessage; isGamified: boolean }> = ({ msg, isGamified }) => {
  const isAI = msg.type === 'ai';
  return (
    <div className={`flex gap-3 mb-6 ${isAI ? '' : 'flex-row-reverse'}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${isAI ? (isGamified ? 'bg-indigo-900/30 border-indigo-700/30' : 'bg-blue-50 border-blue-100') : (isGamified ? 'bg-slate-800 border-white/10' : 'bg-slate-100 border-slate-200')}`}>
        {isAI ? <Brain className={`w-4 h-4 ${isGamified ? 'text-indigo-400' : 'text-blue-600'}`} /> : <div className="text-[10px] font-black">ME</div>}
      </div>
      <div className={`max-w-[85%] flex flex-col ${isAI ? 'items-start' : 'items-end'}`}>
        <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${isAI ? (isGamified ? 'bg-slate-900 border border-white/5 text-slate-200 rounded-tl-sm' : 'bg-white border text-slate-800 rounded-tl-sm') : (isGamified ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-900 text-white rounded-tr-sm')}`}>
          {msg.content}
          {msg.image && <img src={msg.image} alt="staged" className="mt-2 rounded-lg max-w-full border border-white/10" />}
        </div>
        {isAI && msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {msg.sources.slice(0, 3).map((s, i) => (
              <span key={i} className={`px-2 py-0.5 rounded text-[9px] font-medium ${isGamified ? 'bg-white/5 text-slate-500 border border-white/5' : 'bg-slate-100 text-slate-500'}`}>Source: {s.substring(0, 15)}...</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- FEATURE PANELS ---
const NotesPanel: React.FC<{ notes: NoteItem[]; hasDoc: boolean; isProcessing: boolean; isGamified: boolean; onGenerate: () => void }> = ({ notes, hasDoc, isProcessing, isGamified, onGenerate }) => (
  <div className="h-full flex flex-col p-5 overflow-hidden">
    <div className="flex items-center justify-between mb-6">
      <h3 className={`font-black text-sm uppercase tracking-widest ${isGamified ? 'text-indigo-400' : 'text-slate-800'}`}>Smart Notes</h3>
      <button onClick={onGenerate} disabled={isProcessing || !hasDoc} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${isGamified ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-900 text-white hover:bg-black'}`}>
        {isProcessing ? 'Thinking...' : notes.length > 0 ? 'Regenerate' : 'Generate'}
      </button>
    </div>
    <div className="flex-1 overflow-y-auto space-y-6 pr-2">
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl opacity-50">
          <BookOpen className="w-10 h-10 mb-4 text-slate-300" />
          <p className="text-xs font-bold text-slate-400">No notes yet. Start by generating an AI summary of your document.</p>
        </div>
      ) : notes.map((item, i) => (
        <div key={i} className={`p-4 rounded-2xl border ${isGamified ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
          <h4 className={`text-xs font-black uppercase mb-3 ${isGamified ? 'text-slate-200' : 'text-slate-800'}`}>{item.heading}</h4>
          <ul className="space-y-2">
            {item.points.map((p, j) => <li key={j} className={`text-[12px] leading-relaxed flex gap-2 ${isGamified ? 'text-slate-400' : 'text-slate-600'}`}><span className="text-indigo-500">•</span> {p}</li>)}
          </ul>
        </div>
      ))}
    </div>
  </div>
);

const FlashcardsPanel: React.FC<{ flashcards: Flashcard[]; hasDoc: boolean; isProcessing: boolean; isGamified: boolean; onGenerate: () => void }> = ({ flashcards, hasDoc, isProcessing, isGamified, onGenerate }) => {
  const [fIdx, setFIdx] = useState(0);
  const [showA, setShowA] = useState(false);
  if (flashcards.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <Sparkles className="w-12 h-12 mb-4 text-indigo-400 animate-pulse" />
      <h4 className="font-black text-base mb-2">Mastery Cards</h4>
      <p className="text-xs text-slate-500 mb-6">AI will extract key concepts and create flashcards for active recall.</p>
      <button onClick={onGenerate} disabled={isProcessing || !hasDoc} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl">
        {isProcessing ? 'Generating...' : 'Create Flashcards'}
      </button>
    </div>
  );
  const card = flashcards[fIdx];
  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <span className="text-[10px] font-black text-indigo-500">{fIdx + 1} / {flashcards.length}</span>
        <div className="flex gap-2">
          <button onClick={() => { setFIdx(i => Math.max(0, i - 1)); setShowA(false); }} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => { setFIdx(i => Math.min(flashcards.length - 1, i + 1)); setShowA(false); }} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div onClick={() => setShowA(!showA)} className={`flex-1 flex flex-col items-center justify-center p-8 rounded-3xl cursor-pointer transition-all duration-500 preserve-3d text-center border-4 ${showA ? 'bg-indigo-600 border-indigo-400 shadow-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200 shadow-sm'}`}>
        <h4 className={`text-lg font-black leading-tight ${showA ? 'text-white' : 'text-slate-800'}`}>{showA ? card.answer : card.question}</h4>
        <p className={`mt-4 text-[10px] font-black uppercase tracking-widest ${showA ? 'text-indigo-200' : 'text-slate-400'}`}>{showA ? 'Definition' : 'Tap to Reveal'}</p>
      </div>
    </div>
  );
};

const QuizPanel: React.FC<{ quiz: QuizQuestion[]; hasDoc: boolean; isProcessing: boolean; isGamified: boolean; onGenerate: () => void; onXP: (n: number) => void }> = ({ quiz, hasDoc, isProcessing, isGamified, onGenerate, onXP }) => {
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showScore, setShowScore] = useState(false);
  if (quiz.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <LayoutList className="w-12 h-12 mb-4 text-blue-500" />
      <h4 className="font-black text-base mb-2">Challenge Arena</h4>
      <p className="text-xs text-slate-500 mb-6">Test your knowledge with an AI-generated quiz based on this document.</p>
      <button onClick={onGenerate} disabled={isProcessing || !hasDoc} className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl">
        {isProcessing ? 'Building Quiz...' : 'Start Quiz'}
      </button>
    </div>
  );
  if (showScore) return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-emerald-50/50">
      <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-200"><CheckCircle2 className="w-10 h-10 text-white" /></div>
      <h3 className="text-2xl font-black text-slate-800">Quiz Complete!</h3>
      <p className="text-sm font-bold text-emerald-600 mt-2">You earned +100 XP</p>
      <div className="mt-8 flex gap-3">
        <button onClick={() => { setAnswers({}); setQIdx(0); setShowScore(false); }} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 hover:bg-slate-50"><RotateCcw className="w-3.5 h-3.5" /> Retake</button>
        <button onClick={onGenerate} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md hover:bg-black">New Quiz</button>
      </div>
    </div>
  );
  const q = quiz[qIdx];
  const isAnswered = answers[qIdx] !== undefined;
  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-slate-400">{qIdx + 1} / {quiz.length}</span>
        <button onClick={onGenerate} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-8"><div className="h-full bg-blue-500 transition-all" style={{ width: `${((qIdx + 1) / quiz.length) * 100}%` }} /></div>
      <h4 className="text-[15px] font-bold text-slate-800 leading-snug mb-6">{q.question}</h4>
      <div className="space-y-3">
        {q.options.map((opt, i) => {
          const status = !isAnswered ? 'idle' : answers[qIdx] === i ? (q.correct === i ? 'correct' : 'wrong') : (q.correct === i ? 'correct' : 'faded');
          const cls = status === 'correct' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : status === 'wrong' ? 'border-red-500 bg-red-50 text-red-700' : status === 'faded' ? 'opacity-40 border-slate-100' : 'border-slate-100 hover:border-blue-200 hover:bg-blue-50/30';
          return (
            <button key={i} onClick={() => { if (!isAnswered) { setAnswers(p => ({ ...p, [qIdx]: i })); if (i === q.correct) onXP(20); } }} disabled={isAnswered} className={`w-full p-4 rounded-2xl border-2 text-left text-sm font-medium transition-all flex items-center gap-3 ${cls}`}>
              <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${status === 'correct' ? 'bg-emerald-500 text-white' : status === 'wrong' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          )
        })}
      </div>
      {isAnswered && q.explanation && <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-lg text-xs leading-relaxed text-blue-800"><span className="font-black uppercase text-[9px] block mb-1">AI Explanation</span>{q.explanation}</div>}
      <div className="mt-auto pt-6 flex justify-between items-center border-t border-slate-100">
        <button disabled={qIdx === 0} onClick={() => setQIdx(i => i - 1)} className="text-xs font-bold text-slate-400 disabled:opacity-0 transition-all">Back</button>
        <button disabled={!isAnswered} onClick={() => { if (qIdx < quiz.length - 1) setQIdx(i => i + 1); else { setShowScore(true); onXP(100); } }} className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 transition-all active:scale-95">{qIdx < quiz.length - 1 ? 'Next Question' : 'Finish Quiz'}</button>
      </div>
    </div>
  );
};

// --- HELPERS ---
const parseQuiz = (raw: string): QuizQuestion[] => {
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    return Array.isArray(data) ? data : (data.quiz || []);
  } catch { return []; }
};

const parseFlashcards = (raw: string): Flashcard[] => {
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    return Array.isArray(data) ? data : (data.flashcards || []);
  } catch { return []; }
};

const parseNotes = (raw: string): NoteItem[] => {
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    return Array.isArray(data) ? data : (data.notes || []);
  } catch { return []; }
};

// --- MAIN COMPONENT ---
export const ChatPDF: React.FC = () => {
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [currentDoc, setCurrentDoc] = useState<PDFDocument | null>(null);
  const [docMessages, setDocMessages] = useState<Record<string, ChatMessage[]>>({});
  const [activeTab, setActiveTab] = useState<'chat' | 'notes' | 'flashcards' | 'quiz' | 'gamified'>('chat');
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGamified, setIsGamified] = useState(false);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [simulation, setSimulation] = useState<SimulationData | null>(null);
  const [stagedImage, setStagedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentMessages = currentDoc ? (docMessages[currentDoc.id] ?? []) : [];

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentMessages]);
  useEffect(() => { fetchDocuments(); }, []);

  const addXP = useCallback((n: number) => {
    setXp(v => {
      const next = v + n;
      if (Math.floor(next / 200) > Math.floor(v / 200)) setLevel(l => l + 1);
      return next;
    });
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API}/api/documents/`);
      if (res.ok) {
        const data = await res.json();
        const documentsArray = Array.isArray(data) ? data : (data.documents || []);
        const docs: PDFDocument[] = documentsArray.map((d: any) => ({
          id: d.id, name: d.filename,
          status: (d.status === 'completed' || d.status === 'ready') ? 'ready' : d.status === 'error' ? 'error' : 'processing',
          page_count: d.page_count, summary: d.summary, category: d.category, chunks_count: d.chunks_count, timestamp: d.created_at ?? ''
        }));
        setDocuments(docs);
        if (docs.length > 0 && !currentDoc) setCurrentDoc(docs[0]);
      }
    } catch {}
  };

  const pollStatus = async (id: string) => {
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const res = await fetch(`${API}/api/documents/${id}`);
      if (res.ok) {
        const d = await res.json();
        if (d.status === 'completed' || d.status === 'ready') {
          fetchDocuments(); return;
        } else if (d.status === 'error') {
          setDocuments(p => p.map(doc => doc.id === id ? { ...doc, status: 'error' } : doc)); return;
        }
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${API}/api/documents/upload`, { method: 'POST', body: fd });
      if (res.ok) {
        const d = await res.json();
        const doc: PDFDocument = { id: d.id, name: d.filename, status: 'processing', timestamp: new Date().toISOString() };
        setDocuments(p => [doc, ...p]);
        setCurrentDoc(doc);
        pollStatus(d.id);
        addXP(50);
      }
    } catch {} finally { setIsUploading(false); }
  };

  const handleSend = async () => {
    if ((!input.trim() && !stagedImage) || !currentDoc || isProcessing) return;
    const q = input.trim(); setInput('');
    const userMsg: ChatMessage = { id: Date.now(), type: 'user', content: q || "Sent an image", timestamp: new Date(), image: imagePreview ?? undefined };
    setDocMessages(p => ({ ...p, [currentDoc.id]: [...(p[currentDoc.id] ?? []), userMsg] }));
    
    let b64: string | undefined;
    if (stagedImage) {
      const r = new FileReader();
      b64 = await new Promise(res => { r.onload = () => res((r.result as string).split(',')[1]); r.readAsDataURL(stagedImage); });
      setStagedImage(null); setImagePreview(null);
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`${API}/api/chat/document`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, document_id: currentDoc.id, image_b64: b64, stream: false })
      });
      const data = await res.json();
      const aiMsg: ChatMessage = { id: Date.now() + 1, type: 'ai', content: data.response ?? "Error", timestamp: new Date(), sources: data.sources, processingTime: data.processing_time };
      setDocMessages(p => ({ ...p, [currentDoc.id]: [...(p[currentDoc.id] ?? []), aiMsg] }));
      addXP(10);
    } catch {
      setDocMessages(p => ({ ...p, [currentDoc.id]: [...(p[currentDoc.id] ?? []), { id: Date.now() + 1, type: 'ai', content: "Connection failed", timestamp: new Date() }] }));
    } finally { setIsProcessing(false); }
  };

  const handleImageSelect = (file: File) => {
    setStagedImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearStagedImage = () => {
    setStagedImage(null);
    setImagePreview(null);
  };

  const handleMaterializeSite = async () => {
    if (!currentDoc || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${API}/api/simulation/generate-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: currentDoc.id, document_text: currentDoc.summary || "" })
      });
      if (res.ok) {
        const data = await res.json();
        setSimulation(data.simulation);
        setActiveTab('gamified');
        addXP(100);
      }
    } catch {} finally { setIsProcessing(false); }
  };

  const handleAction = async (action: 'quiz' | 'flashcards' | 'summarize' | 'simulation') => {
    if (!currentDoc || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${API}/api/documents/${currentDoc.id}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (action === 'quiz') { setQuiz(parseQuiz(data.quiz)); setActiveTab('quiz'); }
      else if (action === 'flashcards') { setFlashcards(parseFlashcards(data.flashcards)); setActiveTab('flashcards'); }
      else if (action === 'summarize') { setNotes(parseNotes(data.notes ?? data.summary)); setActiveTab('notes'); }
      else if (action === 'simulation') { setSimulation(data.simulation); setActiveTab('gamified'); }
      addXP(30);
    } catch {} finally { setIsProcessing(false); }
  };

  const filteredDocs = documents.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <GamifiedMode isGamified={isGamified} level={level} xp={xp} streak={streak}>
      <div className={`flex h-full font-sans transition-all overflow-hidden ${isGamified ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        
        {/* LEFT SIDEBAR */}
        <div className={`${isSidebarCollapsed ? 'w-12' : 'w-72'} flex flex-col border-r transition-all shrink-0 ${isGamified ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200'}`}>
          {!isSidebarCollapsed ? (
            <div className="flex flex-col h-full flex-1 min-h-0">
              <div className="p-4 flex items-center justify-between">
                <h2 className="font-black text-xs uppercase tracking-widest text-slate-400">Library</h2>
                <button onClick={() => setIsSidebarCollapsed(true)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><ChevronLeft className="w-4 h-4" /></button>
              </div>
              <div className="px-4 mb-4">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isGamified ? 'bg-slate-800 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search library..." className="bg-transparent text-xs w-full focus:outline-none" />
                </div>
              </div>
              <div className="px-4 mb-4">
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all">
                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add Document
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
              </div>
              <div className="flex-1 overflow-y-auto px-2 space-y-1">
                {filteredDocs.map(doc => (
                  <div key={doc.id} onClick={() => setCurrentDoc(doc)} className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${currentDoc?.id === doc.id ? (isGamified ? 'bg-indigo-600 shadow-lg shadow-indigo-900/20' : 'bg-white border-2 border-indigo-100 shadow-sm') : 'hover:bg-slate-100'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${currentDoc?.id === doc.id ? 'bg-white/20' : 'bg-slate-100'}`}><FileText className={`w-4 h-4 ${currentDoc?.id === doc.id ? 'text-white' : 'text-slate-500'}`} /></div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-black truncate ${currentDoc?.id === doc.id ? 'text-white' : 'text-slate-700'}`}>{doc.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5"><StatusDot status={doc.status} /><span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">{doc.status}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-slate-100 mt-auto">
                <button onClick={() => setIsGamified(!isGamified)} className={`w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isGamified ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-400/20' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}>
                  {isGamified ? 'Arena Mode Active' : 'Enable Gamification'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 gap-4">
              <button onClick={() => setIsSidebarCollapsed(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><ChevronRight className="w-4 h-4" /></button>
              <button className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200"><Plus className="w-4 h-4" /></button>
            </div>
          )}
        </div>

        {/* MIDDLE PANE - VIEWER */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {!currentDoc ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 bg-indigo-50 rounded-[3rem] flex items-center justify-center mb-6 shadow-2xl shadow-indigo-100"><FileText className="w-12 h-12 text-indigo-400" /></div>
              <h2 className="text-2xl font-black text-slate-800 mb-3">Your Digital Brain is Empty</h2>
              <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-8">Upload a PDF or document to start interacting with it. AI will index its contents for instant Q&A.</p>
              <button onClick={() => fileInputRef.current?.click()} className="px-10 py-4 bg-indigo-600 text-white rounded-[2rem] font-black text-sm shadow-2xl shadow-indigo-200 hover:scale-105 transition-all">Upload First File</button>
            </div>
          ) : (
            <>
              <div className="h-12 border-b flex items-center px-6 justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black truncate max-w-[300px]">{currentDoc.name}</h3>
                  <StatusDot status={currentDoc.status} />
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={fetchDocuments} className="p-2 hover:bg-slate-50 text-slate-400 transition-all rounded-lg"><RotateCw className="w-3.5 h-3.5" /></button>
                  <a href={`${API}/api/documents/${currentDoc.id}/file`} target="_blank" rel="noreferrer" className="p-2 hover:bg-slate-50 text-slate-400 transition-all rounded-lg"><Download className="w-3.5 h-3.5" /></a>
                </div>
              </div>
              <div className="flex-1 bg-slate-100/50 relative overflow-hidden">
                {currentDoc.status === 'ready' ? (
                  <iframe src={`${API}/api/documents/${currentDoc.id}/file?inline=true#toolbar=0&navpanes=0`} className="w-full h-full border-none" title="PDF Viewer" />

                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
                    <p className="text-sm font-black text-slate-500 animate-pulse">AI is indexing your document...</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANE - CHAT & TOOLS */}
        <div className={`w-96 flex flex-col border-l shrink-0 transition-all ${isGamified ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200 shadow-2xl'}`}>
          <div className="flex border-b border-slate-100 shrink-0">
            {(['chat', 'notes', 'flashcards', 'quiz', 'gamified'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-all border-b-2 ${activeTab === tab ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                {tab === 'chat' && <MessageSquare className="w-4 h-4" />}
                {tab === 'notes' && <BookOpen className="w-4 h-4" />}
                {tab === 'flashcards' && <Sparkles className="w-4 h-4" />}
                {tab === 'quiz' && <LayoutList className="w-4 h-4" />}
                {tab === 'gamified' && <Gamepad2 className="w-4 h-4" />}
                <span className="text-[10px] font-black uppercase tracking-tighter">{tab}</span>
              </button>
            ))}
          </div>
          
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'chat' && (
              <div className="h-full flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-5 scroll-smooth">
                  {currentMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-30">
                      <Brain className="w-12 h-12 mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest">Awaiting Prompt</p>
                    </div>
                  )}
                  {currentMessages.map(msg => <ChatBubble key={msg.id} msg={msg} isGamified={isGamified} />)}
                  <div ref={scrollRef} />
                </div>
                
                {currentDoc?.status === 'ready' && (
                  <div className="px-5 py-3 border-t border-slate-100 flex gap-2 overflow-x-auto shrink-0 no-scrollbar">
                    {([{l:'Notes',a:'summarize'},{l:'Cards',a:'flashcards'},{l:'Quiz',a:'quiz'},{l:'Arena',a:'simulation'}] as const).map(bt => (
                      <button key={bt.l} onClick={() => handleAction(bt.a)} disabled={isProcessing} className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-tighter whitespace-nowrap hover:bg-white hover:border-indigo-200 transition-all shadow-sm">
                        {bt.l}
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="p-4 shrink-0">
                  <div className={`p-3 rounded-2xl border-2 flex flex-col gap-2 transition-all ${isProcessing ? 'opacity-50' : 'bg-slate-50 border-slate-100 focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-indigo-50'}`}>
                    {imagePreview && (
                      <div className="relative w-16 h-16 group">
                        <img src={imagePreview} className="w-full h-full object-cover rounded-lg border border-slate-200" alt="preview" />
                        <button onClick={clearStagedImage} className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 text-white rounded-full"><X className="w-2 h-2" /></button>
                      </div>
                    )}
                    <div className="flex items-end gap-3">
                      <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder={currentDoc?.status === 'ready' ? "Ask anything..." : "Select a document first"} rows={2} disabled={!currentDoc || currentDoc.status !== 'ready'} className="flex-1 bg-transparent text-[13px] focus:outline-none resize-none min-h-[40px] leading-relaxed" />
                      <div className="flex gap-1.5">
                        <button onClick={() => imgInputRef.current?.click()} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-400"><ImageIcon className="w-4 h-4" /></button>
                        <button onClick={handleSend} disabled={(!input.trim() && !stagedImage) || isProcessing} className="p-2 bg-slate-900 text-white rounded-xl hover:bg-black shadow-lg transition-all active:scale-95 disabled:opacity-30">
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </div>
                      <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageSelect(e.target.files[0])} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'notes' && <NotesPanel notes={notes} onGenerate={() => handleAction('summarize')} isProcessing={isProcessing} hasDoc={currentDoc?.status === 'ready'} isGamified={isGamified} />}
            {activeTab === 'flashcards' && <FlashcardsPanel flashcards={flashcards} onGenerate={() => handleAction('flashcards')} isProcessing={isProcessing} hasDoc={currentDoc?.status === 'ready'} isGamified={isGamified} />}
            {activeTab === 'quiz' && <QuizPanel quiz={quiz} onGenerate={() => handleAction('quiz')} isProcessing={isProcessing} hasDoc={currentDoc?.status === 'ready'} isGamified={isGamified} onXP={addXP} />}
            {activeTab === 'gamified' && (
              <div className="h-full flex flex-col p-5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-black text-sm uppercase text-indigo-600">Learning Arena</h3>
                  <button onClick={handleMaterializeSite} className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9px] font-black rounded-lg shadow-lg flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Materialize</button>
                </div>
                {simulation ? (
                  <div className="flex-1 overflow-hidden rounded-3xl border border-slate-100 bg-slate-50 relative">
                    <DynamicSimulation 
                      documentId={currentDoc?.id}
                      documentText={currentDoc?.summary || ""}
                      simulationData={simulation}
                      onXPGain={addXP}
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <Gamepad2 className="w-12 h-12 mb-4 text-indigo-300" />
                    <h4 className="font-black text-sm mb-2 text-slate-800">Arena Offline</h4>
                    <p className="text-[11px] text-slate-500 mb-6">Generate an interactive learning simulation from your document concepts.</p>
                    <button onClick={() => handleAction('simulation')} disabled={isProcessing} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">{isProcessing ? 'Designing Arena...' : 'Launch Arena'}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </GamifiedMode>
  );
};

export default ChatPDF;
