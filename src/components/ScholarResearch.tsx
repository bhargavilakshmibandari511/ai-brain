import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  GraduationCap, Search, Loader2, ExternalLink, Copy, Check,
  BookOpen, Users, Quote, ChevronDown, ChevronUp, Filter,
  Download, MessageSquare, X, Send, Bookmark, ArrowRight,
  RefreshCw, Hash, AlertCircle, Zap, Clock, BarChart2,
  TrendingUp, Layers, Brain, Star, FileText
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const BACKEND  = 'http://127.0.0.1:8001';
const S2_BASE  = 'https://api.semanticscholar.org/graph/v1';
const S2_RECCO = 'https://api.semanticscholar.org/recommendations/v1';
const S2_FIELDS = [
  'title','abstract','year','citationCount','influentialCitationCount',
  'referenceCount','authors','venue','publicationTypes','publicationDate',
  'url','openAccessPdf','fieldsOfStudy','tldr','externalIds'
].join(',');

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Author { authorId: string; name: string; }

interface Paper {
  paperId: string;
  title: string;
  abstract: string;
  year: number;
  citationCount: number;
  influentialCitationCount: number;
  referenceCount: number;
  authors: Author[];
  venue: string;
  publicationTypes: string[];
  publicationDate: string;
  url: string;
  openAccessPdf?: { url: string };
  fieldsOfStudy?: string[];
  tldr?: { text: string };
  externalIds?: { DOI?: string; ArXiv?: string };
}

interface DeepAnalysis {
  overview: string;
  keyThemes: string[];
  methodology: string;
  strengths: string;
  gaps: string;
  futureDirections: string;
  consensus: string;
  practicalApplications: string;
}

interface ChatMessage { role: 'user' | 'ai'; content: string; }

type SearchMode = 'keyword' | 'doi' | 'author';
type SortMode   = 'relevance' | 'citations' | 'year' | 'influential';
type RightView  = 'none' | 'deepdive' | 'chat';

// ─────────────────────────────────────────────────────────────
// SEMANTIC SCHOLAR API  (free, no API key needed)
// ─────────────────────────────────────────────────────────────
async function s2Search(q: string, limit = 12): Promise<Paper[]> {
  const url = `${BACKEND}/api/scholar/search?query=${encodeURIComponent(q)}&fields=${S2_FIELDS}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Scholar proxy error ${res.status}`);
  return ((await res.json()).data ?? []) as Paper[];
}

async function s2GetByDOI(doi: string): Promise<Paper | null> {
  const clean = doi.replace(/^doi:\s*/i, '').trim();
  const res = await fetch(`${BACKEND}/api/scholar/paper/${encodeURIComponent(clean)}?fields=${S2_FIELDS}`);
  if (!res.ok) return null;
  return res.json() as Promise<Paper>;
}

async function s2Recommendations(paperId: string): Promise<Paper[]> {
  const res = await fetch(`${BACKEND}/api/scholar/recommendations/${paperId}?fields=${S2_FIELDS}&limit=6`);
  if (!res.ok) return [];
  return ((await res.json()).recommendedPapers ?? []) as Paper[];
}

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
const isDOI  = (s: string) => /^(doi:)?\s*10\.\d{4,}/i.test(s.trim());
const fmtNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n ?? 0);
const trunc  = (s: string, n: number) => s?.length > n ? s.slice(0, n) + '…' : (s ?? '');

// ─────────────────────────────────────────────────────────────
// CITATION BADGE — colour-coded by impact level
// ─────────────────────────────────────────────────────────────
const CiteBadge: React.FC<{ count: number }> = ({ count }) => {
  const cls = count > 500
    ? 'text-orange-600 bg-orange-50 border-orange-200'
    : count > 100
    ? 'text-amber-600 bg-amber-50 border-amber-200'
    : count > 10
    ? 'text-blue-600 bg-blue-50 border-blue-200'
    : 'text-slate-500 bg-slate-50 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${cls}`}>
      <Quote className="w-2.5 h-2.5" />{fmtNum(count)}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// PAPER CARD
// ─────────────────────────────────────────────────────────────
const PaperCard: React.FC<{
  paper: Paper;
  isSelected: boolean;
  isSaved: boolean;
  onDeepDive: (p: Paper) => void;
  onChat:     (p: Paper) => void;
  onSave:     (p: Paper) => void;
}> = ({ paper, isSelected, isSaved, onDeepDive, onChat, onSave }) => {
  const [showAbstract, setShowAbstract] = useState(false);

  return (
    <div className={`rounded-2xl border transition-all duration-150 overflow-hidden
      ${isSelected
        ? 'border-indigo-300 bg-indigo-50/40 shadow-sm'
        : 'border-slate-700 bg-slate-900 hover:border-slate-600 hover:bg-slate-800/60'}`}>

      <div className="p-4">
        {/* Title + bookmark + external link */}
        <div className="flex items-start gap-2 mb-2">
          <h3 className="flex-1 text-[13.5px] font-bold text-slate-100 leading-snug">{paper.title}</h3>
          <div className="flex gap-1 shrink-0 mt-0.5">
            <button onClick={() => onSave(paper)}
              className={`p-1.5 rounded-lg transition-colors
                ${isSaved ? 'text-indigo-400 bg-indigo-900/40' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'}`}>
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-indigo-400' : ''}`} />
            </button>
            {paper.url && (
              <a href={paper.url} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Meta: year, citations, venue, type, PDF, arXiv */}
        <div className="flex items-center gap-2.5 flex-wrap mb-2.5 text-[11px] text-slate-400">
          {paper.year > 0 && (
            <span className="flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3" />{paper.year}
            </span>
          )}
          {paper.citationCount > 0 && <CiteBadge count={paper.citationCount} />}
          {paper.venue && (
            <span className="flex items-center gap-1 truncate max-w-[140px]">
              <BookOpen className="w-3 h-3 shrink-0" />{trunc(paper.venue, 26)}
            </span>
          )}
          {paper.publicationTypes?.[0] && (
            <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded-md text-[10px] font-medium">
              {paper.publicationTypes[0]}
            </span>
          )}
          {paper.openAccessPdf?.url && (
            <a href={paper.openAccessPdf.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold">
              <Download className="w-3 h-3" />PDF
            </a>
          )}
          {paper.externalIds?.ArXiv && (
            <a href={`https://arxiv.org/abs/${paper.externalIds.ArXiv}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-red-400 hover:text-red-300 font-medium">
              <FileText className="w-3 h-3" />arXiv
            </a>
          )}
        </div>

        {/* Authors */}
        {paper.authors?.length > 0 && (
          <p className="text-[11px] text-slate-500 mb-2.5 flex items-center gap-1">
            <Users className="w-3 h-3 shrink-0" />
            {paper.authors.slice(0, 5).map(a => a.name).join(', ')}
            {paper.authors.length > 5 && ` +${paper.authors.length - 5} more`}
          </p>
        )}

        {/* TL;DR — Semantic Scholar AI one-liner */}
        {paper.tldr?.text && (
          <div className="bg-indigo-900/30 border border-indigo-800/50 rounded-xl px-3 py-2 mb-2.5">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mr-2">TL;DR</span>
            <span className="text-[12px] text-indigo-200 leading-relaxed">{paper.tldr.text}</span>
          </div>
        )}

        {/* Abstract — collapsible */}
        {paper.abstract && (
          <div>
            <p className={`text-[12px] text-slate-400 leading-relaxed ${!showAbstract ? 'line-clamp-2' : ''}`}>
              {paper.abstract}
            </p>
            <button onClick={() => setShowAbstract(s => !s)}
              className="flex items-center gap-1 mt-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
              {showAbstract
                ? <><ChevronUp className="w-3 h-3" />Hide</>
                : <><ChevronDown className="w-3 h-3" />Abstract</>}
            </button>
          </div>
        )}

        {/* Field tags */}
        {paper.fieldsOfStudy && paper.fieldsOfStudy.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {paper.fieldsOfStudy.slice(0, 5).map(f => (
              <span key={f} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-medium rounded-full border border-slate-700">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="px-4 py-2.5 border-t border-slate-700/60 bg-slate-900/60 flex items-center gap-2">
        <button onClick={() => onDeepDive(paper)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-lg text-white text-[11px] font-bold transition-all shadow-sm">
          <Zap className="w-3 h-3 fill-white" /> Deep Dive
        </button>
        <button onClick={() => onChat(paper)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 text-[11px] font-medium transition-all">
          <MessageSquare className="w-3 h-3" /> Chat
        </button>
        <div className="flex items-center gap-3 ml-auto text-[10px] text-slate-500">
          {paper.referenceCount > 0 && (
            <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{paper.referenceCount} refs</span>
          )}
          {paper.influentialCitationCount > 0 && (
            <span className="flex items-center gap-1 text-indigo-400 font-medium">
              <TrendingUp className="w-3 h-3" />{paper.influentialCitationCount} influential
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// DEEP ANALYSIS PANEL  (right pane)
// ─────────────────────────────────────────────────────────────
const DeepAnalysisPanel: React.FC<{
  paper: Paper;
  analysis: DeepAnalysis | null;
  loading: boolean;
  recommendations: Paper[];
  recoLoading: boolean;
  onClose: () => void;
  onOpenChat: () => void;
  onSelectRelated: (p: Paper) => void;
}> = ({ paper, analysis, loading, recommendations, recoLoading, onClose, onOpenChat, onSelectRelated }) => {
  const [tab, setTab]       = useState<'analysis' | 'related'>('analysis');
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    if (!analysis) return;
    const txt = [
      paper.title, '',
      'OVERVIEW', analysis.overview, '',
      'KEY THEMES', analysis.keyThemes.join('\n'), '',
      'METHODOLOGY', analysis.methodology, '',
      'STRENGTHS', analysis.strengths, '',
      'RESEARCH GAPS', analysis.gaps, '',
      'FUTURE DIRECTIONS', analysis.futureDirections, '',
      'SCIENTIFIC CONSENSUS', analysis.consensus, '',
      'PRACTICAL APPLICATIONS', analysis.practicalApplications,
    ].join('\n');
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="px-4 pt-4 pb-0 border-b border-slate-800 shrink-0">
        <div className="flex items-start gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-4 h-4 bg-indigo-600 rounded flex items-center justify-center">
                <Zap className="w-2.5 h-2.5 text-white fill-white" />
              </div>
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Deep Dive</span>
            </div>
            <p className="text-[12.5px] font-bold text-slate-200 leading-snug line-clamp-2">{paper.title}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {paper.year > 0 && <span className="text-[10px] text-slate-500">{paper.year}</span>}
              {paper.citationCount > 0 && <CiteBadge count={paper.citationCount} />}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={copyAll} title="Copy analysis"
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-5">
          {(['analysis', 'related'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-3 text-[12px] font-semibold border-b-2 transition-colors
                ${tab === t
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
              {t === 'analysis' ? 'AI Analysis' : `Related (${recommendations.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {/* ── AI ANALYSIS TAB ── */}
        {tab === 'analysis' && (
          <div className="p-4 space-y-4">

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-4 animate-pulse">
                <div className="bg-indigo-900/20 rounded-2xl p-4 space-y-2">
                  <div className="h-3 bg-indigo-800/40 rounded w-20" />
                  {[100, 88, 92].map((w, i) => (
                    <div key={i} className="h-3 bg-indigo-900/30 rounded-full" style={{ width: `${w}%` }} />
                  ))}
                </div>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="h-2.5 bg-slate-800 rounded w-24" />
                    <div className="h-3 bg-slate-800/60 rounded-full w-full" />
                    <div className="h-3 bg-slate-800/60 rounded-full w-[80%]" />
                  </div>
                ))}
                <p className="text-center text-[11px] text-indigo-400 flex items-center justify-center gap-1.5 pt-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI is analysing this paper…
                </p>
              </div>
            )}

            {!loading && analysis && (
              <>
                {/* 1. Overview */}
                <div className="bg-indigo-900/20 border border-indigo-800/40 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Brain className="w-3 h-3" /> Overview
                  </p>
                  <p className="text-[13px] text-slate-300 leading-relaxed">{analysis.overview}</p>
                </div>

                {/* 2. Key Themes */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Hash className="w-3 h-3" /> Key Themes
                  </p>
                  <div className="space-y-2">
                    {analysis.keyThemes.map((t, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-5 h-5 bg-indigo-600 text-white rounded-md flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-[12.5px] text-slate-300 leading-relaxed">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Methodology */}
                <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-3.5">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <BarChart2 className="w-3 h-3" /> Methodology
                  </p>
                  <p className="text-[12.5px] text-slate-400 leading-relaxed">{analysis.methodology}</p>
                </div>

                {/* 4. Strengths */}
                <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-xl p-3.5">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <Star className="w-3 h-3 fill-emerald-400" /> Strengths
                  </p>
                  <p className="text-[12.5px] text-emerald-200 leading-relaxed">{analysis.strengths}</p>
                </div>

                {/* 5. Scientific Consensus */}
                <div className="bg-amber-900/20 border border-amber-800/30 rounded-xl p-3.5">
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" /> Scientific Consensus
                  </p>
                  <p className="text-[12.5px] text-amber-200 leading-relaxed">{analysis.consensus}</p>
                </div>

                {/* 6. Research Gaps */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" /> Research Gaps
                  </p>
                  <p className="text-[12.5px] text-slate-400 leading-relaxed">{analysis.gaps}</p>
                </div>

                {/* 7. Future Directions */}
                <div className="bg-violet-900/20 border border-violet-800/30 rounded-xl p-3.5">
                  <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <ArrowRight className="w-3 h-3" /> Future Directions
                  </p>
                  <p className="text-[12.5px] text-violet-200 leading-relaxed">{analysis.futureDirections}</p>
                </div>

                {/* 8. Practical Applications */}
                <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-3.5">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-3 h-3" /> Practical Applications
                  </p>
                  <p className="text-[12.5px] text-blue-200 leading-relaxed">{analysis.practicalApplications}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── RELATED PAPERS TAB ── */}
        {tab === 'related' && (
          <div className="p-4 space-y-3">
            {recoLoading && (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="h-3.5 bg-slate-800 rounded w-[85%]" />
                    <div className="flex gap-2">
                      <div className="h-3 bg-slate-800/60 rounded w-12" />
                      <div className="h-3 bg-slate-800/60 rounded w-16" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!recoLoading && recommendations.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs">No related papers found</div>
            )}
            {recommendations.map(rec => (
              <div key={rec.paperId}
                className="border border-slate-800 rounded-xl p-3 hover:border-indigo-700/50 hover:bg-indigo-900/10 transition-all cursor-pointer group"
                onClick={() => onSelectRelated(rec)}>
                <p className="text-[12.5px] font-semibold text-slate-300 group-hover:text-indigo-300 line-clamp-2 leading-snug mb-1.5 transition-colors">
                  {rec.title}
                </p>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  {rec.year > 0 && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{rec.year}</span>}
                  {rec.citationCount > 0 && <CiteBadge count={rec.citationCount} />}
                  {rec.authors?.[0] && <span className="truncate max-w-[110px]">{rec.authors[0].name}</span>}
                  {rec.openAccessPdf?.url && (
                    <a href={rec.openAccessPdf.url} target="_blank" rel="noopener noreferrer"
                      className="text-emerald-400 font-semibold flex items-center gap-0.5 ml-auto shrink-0"
                      onClick={e => e.stopPropagation()}>
                      <Download className="w-2.5 h-2.5" />PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer CTAs */}
      <div className="p-3.5 border-t border-slate-800 shrink-0 space-y-2">
        <button onClick={onOpenChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] rounded-xl text-white text-[12px] font-bold transition-all">
          <MessageSquare className="w-3.5 h-3.5" /> Chat with this Paper
        </button>
        {paper.url && (
          <a href={paper.url} target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2 border border-slate-700 hover:border-slate-600 rounded-xl text-slate-400 hover:text-slate-200 text-[11px] font-medium transition-all">
            <ExternalLink className="w-3 h-3" /> View on Semantic Scholar
          </a>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// PAPER CHAT PANEL  (right pane)
// ─────────────────────────────────────────────────────────────
const PaperChat: React.FC<{ paper: Paper; onClose: () => void }> = ({ paper, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'ai',
    content: `I've loaded "${paper.title}" (${paper.year || 'n/d'}, ${fmtNum(paper.citationCount)} citations). Ask me anything — methodology, findings, limitations, or how it fits the broader literature.`,
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const SUGGESTED = [
    'What is the main contribution?',
    'What are the key limitations?',
    'How does the methodology work?',
    'How does this compare to prior work?',
    'What datasets or experiments were used?',
  ];

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(p => [...p, { role: 'user', content: q }]);
    setLoading(true);

    const ctx = [
      `Title: ${paper.title}`,
      `Year: ${paper.year || 'Unknown'}  |  Citations: ${paper.citationCount || 0}`,
      `Authors: ${paper.authors?.map(a => a.name).join(', ') || 'Unknown'}`,
      `Venue: ${paper.venue || 'Unknown'}`,
      `Fields: ${paper.fieldsOfStudy?.join(', ') || 'Unknown'}`,
      paper.tldr?.text ? `TL;DR: ${paper.tldr.text}` : '',
      `Abstract: ${paper.abstract || 'Not available'}`,
    ].filter(Boolean).join('\n');

    try {
      const res = await fetch(`${BACKEND}/api/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          context: `You are a research assistant helping a scholar understand this paper.\n\n${ctx}\n\nAnswer based on the abstract and metadata. Be specific. If something is unavailable, say so clearly.`,
        }),
      });
      const data = await res.json();
      setMessages(p => [...p, { role: 'ai', content: data.response ?? 'No response.' }]);
    } catch {
      setMessages(p => [...p, { role: 'ai', content: '⚠️ Backend unreachable — make sure 127.0.0.1:8001 is running.' }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="w-7 h-7 bg-indigo-900/50 border border-indigo-700/50 rounded-lg flex items-center justify-center shrink-0">
          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">Paper Chat</p>
          <p className="text-[11px] text-slate-500 truncate">{trunc(paper.title, 55)}</p>
        </div>
        <button onClick={onClose}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed
              ${m.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : 'bg-slate-800 text-slate-300 rounded-tl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggested questions (only at session start) */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3 shrink-0">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Quick Questions</p>
          <div className="space-y-1.5">
            {SUGGESTED.map((q, i) => (
              <button key={i} onClick={() => send(q)}
                className="w-full text-left px-3 py-2 bg-indigo-900/20 hover:bg-indigo-900/40 border border-indigo-800/40 rounded-xl text-[11.5px] text-indigo-300 font-medium transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-full pl-4 pr-1.5 py-1.5 focus-within:border-indigo-600 transition-all">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Ask about this paper…"
            className="flex-1 bg-transparent text-[12.5px] text-slate-300 placeholder-slate-600 focus:outline-none"
          />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="w-7 h-7 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-full flex items-center justify-center transition-colors">
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────
const SearchSkeleton: React.FC = () => (
  <div className="space-y-3 p-4 animate-pulse">
    {[1, 2, 3].map(i => (
      <div key={i} className="border border-slate-800 rounded-2xl p-4 space-y-3 bg-slate-900">
        <div className="h-4 bg-slate-800 rounded-full w-[78%]" />
        <div className="flex gap-2.5">
          <div className="h-3 bg-slate-800/60 rounded w-12" />
          <div className="h-3 bg-amber-900/40 rounded w-20" />
          <div className="h-3 bg-slate-800/60 rounded w-28" />
        </div>
        <div className="h-3 bg-slate-800/60 rounded-full w-full" />
        <div className="h-3 bg-slate-800/60 rounded-full w-[82%]" />
        <div className="h-8 bg-indigo-900/20 rounded-xl w-full" />
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export const ScholarResearch: React.FC = () => {
  // Search
  const [query,       setQuery]       = useState('');
  const [searchMode,  setSearchMode]  = useState<SearchMode>('keyword');
  const [sortMode,    setSortMode]    = useState<SortMode>('relevance');
  const [yearFrom,    setYearFrom]    = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [papers,      setPapers]      = useState<Paper[]>([]);
  const [error,       setError]       = useState('');

  // Right panel
  const [rightView,     setRightView]     = useState<RightView>('none');
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  // Deep analysis
  const [analysis,        setAnalysis]        = useState<DeepAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Paper[]>([]);
  const [recoLoading,     setRecoLoading]     = useState(false);

  // Saved
  const [savedPapers, setSavedPapers] = useState<Set<string>>(new Set());

  // ── SEARCH ──────────────────────────────────────────────
  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setError('');
    setPapers([]);
    setRightView('none');

    try {
      let results: Paper[] = [];

      if (isDOI(query) || searchMode === 'doi') {
        const p = await s2GetByDOI(query);
        results = p ? [p] : [];
      } else {
        results = await s2Search(query, 15);
      }

      if (yearFrom) {
        const yr = parseInt(yearFrom);
        results = results.filter(p => (p.year || 0) >= yr);
      }
      if (fieldFilter) {
        const f = fieldFilter.toLowerCase();
        results = results.filter(p =>
          p.fieldsOfStudy?.some(s => s.toLowerCase().includes(f))
        );
      }
      if (sortMode === 'citations')   results.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
      else if (sortMode === 'year')   results.sort((a, b) => (b.year || 0) - (a.year || 0));
      else if (sortMode === 'influential') results.sort((a, b) => (b.influentialCitationCount || 0) - (a.influentialCitationCount || 0));

      setPapers(results);
      if (results.length === 0) setError('No papers found. Try different keywords or check the DOI format.');
    } catch (e) {
      setError(`Search failed: ${e instanceof Error ? e.message : 'Unknown error'}. Check your internet connection.`);
    } finally {
      setIsSearching(false);
    }
  }, [query, searchMode, sortMode, yearFrom, fieldFilter]);

  // ── DEEP DIVE ────────────────────────────────────────────
  const openDeepDive = useCallback(async (paper: Paper) => {
    setSelectedPaper(paper);
    setRightView('deepdive');
    setAnalysis(null);
    setAnalysisLoading(true);
    setRecommendations([]);
    setRecoLoading(true);

    // Parallel: fetch recommendations from Semantic Scholar
    s2Recommendations(paper.paperId)
      .then(setRecommendations)
      .finally(() => setRecoLoading(false));

    // Ask local LLM for structured deep analysis
    const prompt = `You are an expert academic researcher. Analyse this paper deeply.

Title: ${paper.title}
Year: ${paper.year || 'Unknown'}
Authors: ${paper.authors?.map(a => a.name).join(', ') || 'Unknown'}
Venue: ${paper.venue || 'Unknown'}
Citations: ${paper.citationCount || 0}  |  Influential Citations: ${paper.influentialCitationCount || 0}
Fields: ${paper.fieldsOfStudy?.join(', ') || 'Unknown'}
TL;DR: ${paper.tldr?.text || 'Not available'}
Abstract: ${paper.abstract || 'Not available'}

Return ONLY this JSON — no markdown fences, no extra text:
{
  "overview": "3-4 sentence comprehensive overview of what this paper does and why it matters",
  "keyThemes": ["theme 1 with specific detail", "theme 2", "theme 3", "theme 4"],
  "methodology": "Detailed description of the research approach, experimental design, datasets used, and evaluation metrics",
  "strengths": "Key contributions and what this paper does better than prior work",
  "gaps": "What limitations exist? What questions does it leave unanswered?",
  "futureDirections": "What follow-on research does this paper suggest or enable?",
  "consensus": "How does this relate to broader scientific consensus? Mainstream or controversial?",
  "practicalApplications": "Real-world uses, industry relevance, and downstream applications"
}`;

    try {
      const res = await fetch(`${BACKEND}/api/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      });
      const data = await res.json();
      const raw: string = data.response ?? '{}';
      const clean = raw.replace(/```(?:json)?|```/g, '').trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setAnalysis({
          overview:              parsed.overview ?? '',
          keyThemes:             Array.isArray(parsed.keyThemes) ? parsed.keyThemes : [],
          methodology:           parsed.methodology ?? '',
          strengths:             parsed.strengths ?? '',
          gaps:                  parsed.gaps ?? '',
          futureDirections:      parsed.futureDirections ?? '',
          consensus:             parsed.consensus ?? '',
          practicalApplications: parsed.practicalApplications ?? '',
        });
      } else throw new Error('JSON parse failed');
    } catch {
      // Graceful fallback using metadata we already have
      setAnalysis({
        overview:              paper.abstract || 'Abstract not available.',
        keyThemes:             paper.fieldsOfStudy?.length ? paper.fieldsOfStudy : ['See full paper'],
        methodology:           'See full paper for methodology details.',
        strengths:             `This paper has received ${paper.citationCount || 0} citations (${paper.influentialCitationCount || 0} influential).`,
        gaps:                  'See the discussion section of the full paper for limitations.',
        futureDirections:      'See the conclusion section for future work directions.',
        consensus:             `${paper.influentialCitationCount || 0} influential citations indicate its field impact.`,
        practicalApplications: 'See the full paper for real-world application details.',
      });
    }
    setAnalysisLoading(false);
  }, []);

  const openChat = useCallback((paper: Paper) => {
    setSelectedPaper(paper);
    setRightView('chat');
  }, []);

  const toggleSave = useCallback((paper: Paper) => {
    setSavedPapers(prev => {
      const next = new Set(prev);
      next.has(paper.paperId) ? next.delete(paper.paperId) : next.add(paper.paperId);
      return next;
    });
  }, []);

  const rightOpen = rightView !== 'none';

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div className="flex h-full bg-slate-950 overflow-hidden font-sans">

      {/* ════════ LEFT PANE — Search & Results ════════ */}
      <div className={`flex flex-col border-r border-slate-800 transition-all duration-300 ${rightOpen ? 'w-[54%]' : 'flex-1'} min-w-0`}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 shrink-0 space-y-3 bg-slate-900/60 backdrop-blur">

          {/* Title row */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30">
              <GraduationCap className="w-[18px] h-[18px] text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-[15px] font-black text-white tracking-tight">Scholar Research</h1>
              <p className="text-[10px] text-slate-500 font-medium">200M+ papers · Semantic Scholar · Free · No API key</p>
            </div>
            {papers.length > 0 && (
              <button
                onClick={() => { setPapers([]); setQuery(''); setRightView('none'); setError(''); }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                title="Clear results">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder={
                  searchMode === 'doi' ? 'Enter DOI (e.g. 10.1038/s41586-021-…)' :
                  searchMode === 'author' ? 'Author name (e.g. Yann LeCun deep learning)' :
                  'Topic, paper title, or keywords…'
                }
                className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[13px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <button
              onClick={doSearch}
              disabled={!query.trim() || isSearching}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white text-[12px] font-bold transition-all active:scale-95 shadow-sm shadow-indigo-900/50">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode pills */}
            <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
              {(['keyword', 'doi', 'author'] as SearchMode[]).map(m => (
                <button key={m} onClick={() => setSearchMode(m)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold capitalize transition-all
                    ${searchMode === m ? 'bg-slate-700 text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                  {m}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-500" />
              <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}
                className="bg-transparent text-[11px] font-medium text-slate-400 focus:outline-none cursor-pointer">
                <option value="relevance">Relevance</option>
                <option value="citations">Most Cited</option>
                <option value="year">Newest</option>
                <option value="influential">Most Influential</option>
              </select>
            </div>

            {/* Year filter */}
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)}
                placeholder="Year ≥" min="1900" max="2025"
                className="w-20 text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-600 text-slate-400" />
            </div>

            {/* Field filter */}
            <input value={fieldFilter} onChange={e => setFieldFilter(e.target.value)}
              placeholder="Field…"
              className="w-24 text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-600 text-slate-400" />

            {/* Saved count */}
            {savedPapers.size > 0 && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-900/30 border border-indigo-800/50 px-2 py-1 rounded-full">
                <Bookmark className="w-3 h-3 fill-indigo-400" />{savedPapers.size} saved
              </span>
            )}
          </div>
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto">

          {/* Empty / tips state */}
          {!isSearching && papers.length === 0 && !error && (
            <div className="flex flex-col items-center text-center py-10 px-5 gap-5">
              <div className="w-16 h-16 bg-indigo-900/30 border border-indigo-800/40 rounded-2xl flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <p className="text-slate-300 text-sm font-bold mb-1">Search 200M+ academic papers</p>
                <p className="text-slate-500 text-xs">Semantic Scholar · Free · No API key needed</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm text-left">
                {[
                  { icon: '🔬', label: 'Keywords',    ex: 'attention mechanism transformers' },
                  { icon: '📋', label: 'DOI',          ex: '10.1038/s41586-021-03819-2' },
                  { icon: '👤', label: 'Author',       ex: 'Geoffrey Hinton neural networks' },
                  { icon: '🧬', label: 'Topic + Year', ex: 'CRISPR gene editing 2023' },
                  { icon: '📐', label: 'Method',       ex: 'randomized controlled trial' },
                  { icon: '🌐', label: 'Field',        ex: 'quantum computing error correction' },
                ].map((tip, i) => (
                  <button key={i} onClick={() => setQuery(tip.ex)}
                    className="flex items-start gap-2 p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-700/50 rounded-xl transition-all text-left group">
                    <span className="text-lg leading-none mt-0.5">{tip.icon}</span>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 group-hover:text-indigo-400">{tip.label}</p>
                      <p className="text-[9.5px] text-slate-600 font-mono mt-0.5 leading-tight">{tip.ex}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {isSearching && <SearchSkeleton />}

          {/* Error */}
          {error && !isSearching && (
            <div className="m-4">
              <div className="flex items-start gap-3 bg-red-900/20 border border-red-800/40 rounded-xl p-4">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-red-300 text-sm font-bold">Search failed</p>
                  <p className="text-red-400/70 text-xs mt-0.5">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Results list */}
          {papers.length > 0 && !isSearching && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-bold text-slate-500">
                  {papers.length} paper{papers.length !== 1 ? 's' : ''} found
                </p>
                <p className="text-[10px] text-slate-600">via Semantic Scholar</p>
              </div>
              {papers.map(paper => (
                <PaperCard
                  key={paper.paperId}
                  paper={paper}
                  isSelected={selectedPaper?.paperId === paper.paperId}
                  isSaved={savedPapers.has(paper.paperId)}
                  onDeepDive={openDeepDive}
                  onChat={openChat}
                  onSave={toggleSave}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ════════ RIGHT PANE — Deep Dive / Chat ════════ */}
      {rightOpen && selectedPaper && (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-l border-slate-800">
          {rightView === 'deepdive' && (
            <DeepAnalysisPanel
              paper={selectedPaper}
              analysis={analysis}
              loading={analysisLoading}
              recommendations={recommendations}
              recoLoading={recoLoading}
              onClose={() => setRightView('none')}
              onOpenChat={() => setRightView('chat')}
              onSelectRelated={p => { setSelectedPaper(p); openDeepDive(p); }}
            />
          )}
          {rightView === 'chat' && (
            <PaperChat paper={selectedPaper} onClose={() => setRightView('none')} />
          )}
        </div>
      )}
    </div>
  );
};

export default ScholarResearch;

