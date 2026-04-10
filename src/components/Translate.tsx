import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRightLeft, Loader2, Copy, Check, ChevronDown, Search, Wifi, WifiOff } from 'lucide-react';

const API = 'http://127.0.0.1:8001';

type PreferenceOptions = {
  length: 'Standard' | 'Concise' | 'Expanded';
  tone: 'Neutral' | 'Casual' | 'Formal' | 'Authoritative' | 'Empathetic';
  style: 'Dynamic Equivalence' | 'Literal' | 'Creative Adaptation';
  complexity: 'Standard' | 'Layman' | 'Expert';
};

const languages = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
];

export const Translate: React.FC = () => {
  const [sourceText, setSourceText] = useState('');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [sourceLang, setSourceLang] = useState('Auto Detect');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [translationEngine, setTranslationEngine] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [forceMode, setForceMode] = useState<'auto' | 'online' | 'offline'>('auto');

  // Check connectivity on mount and on network changes
  const checkConnectivity = useCallback(async () => {
    setIsOnline(navigator.onLine);
    try {
      const res = await fetch(`${API}/api/summarize/connectivity`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        setServerOnline(data.online);
      }
    } catch {
      setServerOnline(false);
    }
  }, []);

  useEffect(() => {
    checkConnectivity();
    const onOnline = () => { setIsOnline(true); checkConnectivity(); };
    const onOffline = () => { setIsOnline(false); setServerOnline(false); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const interval = setInterval(checkConnectivity, 30000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, [checkConnectivity]);

  // UI State for Popovers
  const [showPreferences, setShowPreferences] = useState(false);
  const [showSourceLangSelect, setShowSourceLangSelect] = useState(false);
  const [showTargetLangSelect, setShowTargetLangSelect] = useState(false);
  const [langSearchQuery, setLangSearchQuery] = useState('');
  const [sourceLangSearchQuery, setSourceLangSearchQuery] = useState('');
  
  const prefsRef = useRef<HTMLDivElement>(null);
  const sourceLangRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const leftScrollRef = useRef<HTMLTextAreaElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  const handleScrollLeft = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (isSyncingRight.current) return;
    isSyncingLeft.current = true;
    if (rightScrollRef.current) rightScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    clearTimeout((window as any).syncScrollLeftTimeout);
    (window as any).syncScrollLeftTimeout = setTimeout(() => { isSyncingLeft.current = false; }, 50);
  };

  const handleScrollRight = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingLeft.current) return;
    isSyncingRight.current = true;
    if (leftScrollRef.current) leftScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    clearTimeout((window as any).syncScrollRightTimeout);
    (window as any).syncScrollRightTimeout = setTimeout(() => { isSyncingRight.current = false; }, 50);
  };

  const [preferences, setPreferences] = useState<PreferenceOptions>({
    length: 'Standard',
    tone: 'Neutral',
    style: 'Dynamic Equivalence',
    complexity: 'Standard'
  });

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (prefsRef.current && !prefsRef.current.contains(event.target as Node)) setShowPreferences(false);
      if (sourceLangRef.current && !sourceLangRef.current.contains(event.target as Node)) setShowSourceLangSelect(false);
      if (langRef.current && !langRef.current.contains(event.target as Node)) setShowTargetLangSelect(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    setIsTranslating(true);
    setError('');
    setTranslationEngine('');

    try {
      const response = await fetch(`${API}/api/summarize/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: sourceText,
          target_language: targetLang,
          force_mode: forceMode === 'auto' ? null : forceMode,
          ...preferences
        }),
      });

      if (!response.ok) throw new Error('Translation failed. Ensure LLM is running.');
      const data = await response.json();
      setTranslatedText(data.translation);
      const engineLabels: Record<string, string> = {
        google: '🌐 Google Translate',
        argos: '⚡ Argos NMT',
        llm: '🤖 Local LLM',
      };
      setTranslationEngine(engineLabels[data.engine] || data.engine);
      if (data.connectivity) setServerOnline(data.connectivity === 'online');
    } catch (err: any) {
      setError(err.message || 'An error occurred during translation.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSwap = () => {
    if (sourceLang !== 'Auto Detect') {
      const temp = sourceLang;
      setSourceLang(targetLang);
      setTargetLang(temp);
    }
    if (translatedText) {
      setSourceText(translatedText);
      setTranslatedText('');
    }
  };

  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLanguages = languages.filter(l => 
    l.name.toLowerCase().includes(langSearchQuery.toLowerCase()) || 
    l.native.toLowerCase().includes(langSearchQuery.toLowerCase())
  );

  const filteredSourceLanguages = languages.filter(l =>
    l.name.toLowerCase().includes(sourceLangSearchQuery.toLowerCase()) ||
    l.native.toLowerCase().includes(sourceLangSearchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <h1 className="text-2xl font-bold text-white tracking-tight pl-10">Translate</h1>
            {/* Connectivity Badge */}
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              serverOnline === null
                ? 'bg-slate-800 text-slate-400 border-slate-700'
                : (isOnline && serverOnline)
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {serverOnline === null ? '…' : (isOnline && serverOnline) ? <><Wifi className="w-3 h-3" /> Online</> : <><WifiOff className="w-3 h-3" /> Offline</>}
            </span>
            {/* Mode toggle: Auto / Online / Offline */}
            <div className="flex items-center bg-slate-800 rounded-full border border-slate-700 p-0.5">
              {(['auto', 'online', 'offline'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setForceMode(m)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                    forceMode === m
                      ? m === 'online'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : m === 'offline'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m === 'auto' ? '⚡ Auto' : m === 'online' ? '🌐 Online' : '💻 Offline'}
                </button>
              ))}
            </div>
            {/* PROMINENT TRANSLATE BUTTON */}
            <button
              onClick={handleTranslate}
              disabled={isTranslating || !sourceText.trim()}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${
                !isTranslating && sourceText.trim()
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500 shadow-blue-900/40 active:scale-95'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isTranslating ? <><Loader2 className="w-4 h-4 animate-spin" /> Translating...</> : 'Translate →'}
            </button>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
             
             {/* Preferences Dropdown Container */}
             <div className="relative flex-shrink-0" ref={prefsRef}>
                <button 
                  onClick={() => setShowPreferences(!showPreferences)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition"
                >
                  Translation Settings <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Expanded Preferences Menu */}
                {showPreferences && (
                  <div className="absolute top-10 right-0 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-5 origin-top-right animate-in fade-in slide-in-from-top-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4">Translation preferences</h3>
                    
                    {/* Length */}
                    <div className="mb-4">
                      <label className="text-xs font-medium text-slate-500 mb-2 block">Length</label>
                      <div className="flex flex-wrap gap-2">
                        {['Standard', 'Concise', 'Expanded'].map(opt => (
                          <button 
                            key={opt}
                            onClick={() => setPreferences(p => ({...p, length: opt as any}))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              preferences.length === opt 
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tone */}
                    <div className="mb-4">
                      <label className="text-xs font-medium text-slate-500 mb-2 block">Tone</label>
                      <div className="flex flex-wrap gap-2">
                        {['Neutral', 'Casual', 'Formal', 'Authoritative', 'Empathetic'].map(opt => (
                          <button 
                            key={opt}
                            onClick={() => setPreferences(p => ({...p, tone: opt as any}))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              preferences.tone === opt 
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Style */}
                    <div className="mb-4">
                      <label className="text-xs font-medium text-slate-500 mb-2 block">Style</label>
                      <div className="flex flex-wrap gap-2">
                        {['Dynamic Equivalence', 'Literal', 'Creative Adaptation'].map(opt => (
                          <button 
                            key={opt}
                            onClick={() => setPreferences(p => ({...p, style: opt as any}))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              preferences.style === opt 
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Complexity */}
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-2 block">Complexity</label>
                      <div className="flex flex-wrap gap-2">
                        {['Standard', 'Layman', 'Expert'].map(opt => (
                          <button 
                            key={opt}
                            onClick={() => setPreferences(p => ({...p, complexity: opt as any}))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              preferences.complexity === opt 
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center max-w-5xl w-full mx-auto overflow-y-auto">
        
        {/* Main Translator Box */}
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm flex flex-col lg:flex-row min-h-[500px] lg:h-[70vh] overflow-hidden relative">
          
          {/* Absolute Swap Button (Desktop) */}
          <div className="absolute left-1/2 top-8 -translate-x-1/2 -translate-y-1/2 z-20 hidden lg:flex">
             <button 
               onClick={handleSwap}
               title="Swap languages"
               className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition-all hover:scale-105 hover:shadow"
             >
               <ArrowRightLeft className="w-4 h-4" />
             </button>
          </div>

          {/* Left Pane (Input) */}
          <div className="flex-1 flex flex-col relative min-h-[300px] lg:min-h-0 bg-white dark:bg-slate-900 z-0">
            {/* Header */}
            <div className="h-16 flex justify-between items-center px-6 border-b border-slate-100 dark:border-slate-800">
              <div className="relative" ref={sourceLangRef}>
                <button 
                  onClick={() => setShowSourceLangSelect(!showSourceLangSelect)}
                  className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition shadow-sm text-[15px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                  title="Select source language"
                >
                  {sourceLang} <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {/* Source Language Picker Popover */}
                {showSourceLangSelect && (
                  <div className="absolute top-12 left-0 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-2 text-left animate-in fade-in zoom-in-95">
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search"
                        value={sourceLangSearchQuery}
                        onChange={e => setSourceLangSearchQuery(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
                      {/* Auto Detect option */}
                      <button
                        onClick={() => { setSourceLang('Auto Detect'); setShowSourceLangSelect(false); setSourceLangSearchQuery(''); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between transition ${
                          sourceLang === 'Auto Detect'
                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>🔍 Auto Detect</span>
                        {sourceLang === 'Auto Detect' && <Check className="w-4 h-4" />}
                      </button>
                      {filteredSourceLanguages.map(l => (
                        <button
                          key={l.code}
                          onClick={() => { setSourceLang(l.name); setShowSourceLangSelect(false); setSourceLangSearchQuery(''); }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between transition ${
                            sourceLang === l.name
                              ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span>{l.name} <span className="text-slate-400 text-xs ml-1">{l.native}</span></span>
                          {sourceLang === l.name && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                      {filteredSourceLanguages.length === 0 && (
                        <div className="text-center py-4 text-xs text-slate-500">No languages found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {sourceText.length > 0 && (
                <button onClick={() => setSourceText('')} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition" title="Clear text">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              )}
            </div>

            {/* Editing Area */}
            <div className="flex-1 px-6 pt-2 pb-16 overflow-y-auto custom-scrollbar relative">
              <textarea
                ref={leftScrollRef}
                onScroll={handleScrollLeft}
                value={sourceText}
                onChange={e => setSourceText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && sourceText.trim()) { e.preventDefault(); handleTranslate(); } }}
                placeholder="Type or paste text here... (Enter to translate)"
                className="w-full h-full min-h-[200px] bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 resize-none outline-none text-[1.15rem] leading-relaxed"
              />
              {/* Translate button overlays content at bottom center if there's text but no translation */}
              {sourceText.trim() && !translatedText && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                    <button
                      onClick={handleTranslate}
                      disabled={isTranslating}
                      className={`px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 transition-all shadow-md ${
                        !isTranslating
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                      }`}
                    >
                      {isTranslating ? <><Loader2 className="w-4 h-4 animate-spin" /> Translating...</> : 'Translate'}
                    </button>
                  </div>
               )}
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 w-full h-14 px-6 flex justify-between items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur z-10">
               <div className="flex items-center">
                 <button className="p-2 -ml-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-colors bg-blue-50/50 dark:bg-blue-900/20" title="Scan Image">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.5-1.5"/></svg>
                 </button>
               </div>
               
               <div className="flex items-center gap-1">
                 <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="Listen">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                 </button>
                 <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="Copy source text">
                    <Copy className="w-5 h-5" />
                 </button>
               </div>
            </div>
          </div>

          {/* Desktop Divider */}
          <div className="hidden lg:flex w-[2px] bg-gradient-to-b from-transparent via-indigo-500/40 dark:via-indigo-400/30 to-transparent mx-1 self-stretch"></div>

          {/* Mobile Divider / Swap */}
          <div className="lg:hidden h-px bg-slate-200 dark:bg-slate-800 flex items-center justify-center relative my-4">
             <button onClick={handleSwap} className="absolute w-10 h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-500 shadow-md hover:scale-110 transition-transform" title="Swap languages">
               <ArrowRightLeft className="w-4 h-4" />
             </button>
          </div>

          {/* Right Pane (Output) */}
          <div className="flex-1 flex flex-col relative min-h-[300px] lg:min-h-0 bg-[#f9f8f6] dark:bg-slate-800/50 z-0">
            {/* Header */}
            <div className="h-16 flex justify-between items-center px-6 lg:pl-10 border-b border-transparent">
              {/* Target Lang Selection (With Popover) */}
              <div className="relative" ref={langRef}>
                <button 
                  onClick={() => setShowTargetLangSelect(!showTargetLangSelect)}
                  className="flex items-center gap-3 px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-300/60 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition shadow-sm text-[15px] font-medium text-slate-700 dark:text-slate-200"
                >
                  {targetLang} <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {/* Advanced Language Picker Popover */}
                {showTargetLangSelect && (
                  <div className="absolute top-12 left-0 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-2 text-left animate-in fade-in zoom-in-95">
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search"
                        value={langSearchQuery}
                        onChange={e => setLangSearchQuery(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
                      {filteredLanguages.map(l => (
                        <button
                          key={l.code}
                          onClick={() => { setTargetLang(l.name); setShowTargetLangSelect(false); setLangSearchQuery(''); }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between transition ${
                            targetLang === l.name 
                              ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium' 
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span>{l.name}</span>
                          {targetLang === l.name && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                      {filteredLanguages.length === 0 && (
                        <div className="text-center py-4 text-xs text-slate-500">No languages found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <button onClick={handleTranslate} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition" title="Refresh translation">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            </div>

            {/* Output Area */}
            <div className="flex-1 px-6 lg:pl-10 pt-2 pb-16 overflow-y-auto custom-scrollbar relative">
              {error ? (
                <div className="text-red-500 text-sm">{error}</div>
              ) : translatedText ? (
                <div className="flex flex-col h-full gap-2">
                  <div 
                    ref={rightScrollRef}
                    onScroll={handleScrollRight}
                    className="w-full flex-1 text-[#4a44b8] dark:text-indigo-300 text-[1.15rem] leading-relaxed whitespace-pre-wrap outline-none"
                  >
                    {translatedText}
                  </div>
                  {translationEngine && (
                    <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {translationEngine}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-slate-400 dark:text-slate-500 text-[1.15rem]">
                  Translation
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 w-full h-14 px-6 lg:pl-10 flex justify-between items-center bg-[#f9f8f6]/90 dark:bg-slate-800/90 backdrop-blur z-10 border-t border-transparent">
               
               {/* Minimal Tone Selector on the left */}
               <div className="relative">
                  <button 
                    onClick={() => setShowPreferences(true)}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition text-[15px] font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Tone <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
               </div>
               
               <div className="flex items-center gap-1">
                 <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="Listen">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                 </button>
                 <button onClick={handleCopy} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="Copy translation">
                    {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                 </button>
               </div>
            </div>
          </div>
        </div>

        <div className="w-full mt-6 text-center">
          <p className="text-xs text-slate-500 italic">
            Advanced features like PDF and Image translation are coming soon to your local brain.
          </p>
        </div>

      </div>
      
      {/* Global styles for custom scrollbar embedded inside component for simplicity */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 10px;
        }
      `}} />
    </div>
  );
};
