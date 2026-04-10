import { useState, useEffect, useRef } from 'react';
import { Languages, ArrowRightLeft, Loader2, Copy, Check, Volume2, Wifi, WifiOff, Globe, Monitor } from 'lucide-react';
import { apiPost } from '../utils/api';

const LANGUAGES = [
  'English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi',
  'Bengali', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Korean',
  'Arabic', 'Russian', 'Portuguese', 'Italian',
];

interface TranslateProps {
  pendingText?: string;
  onConsumeText?: () => void;
}

export default function Translate({ pendingText, onConsumeText }: TranslateProps) {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('Auto Detect');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [engine, setEngine] = useState('');
  const [error, setError] = useState('');
  const [forceMode, setForceMode] = useState<'auto' | 'online' | 'offline'>('auto');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Pre-fill from widget action or page selection
  useEffect(() => {
    if (pendingText) {
      setSourceText(pendingText);
      onConsumeText?.();
    } else if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SELECTED_TEXT' }, (response) => {
        if (response?.text) {
          setSourceText(response.text);
        }
      });
    }
  }, [pendingText]);

  // Auto-translate with debounce
  useEffect(() => {
    if (!sourceText.trim()) {
      setTranslatedText('');
      setEngine('');
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      translate();
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sourceText, targetLang, sourceLang, forceMode]);

  const translate = async () => {
    if (!sourceText.trim()) return;
    setIsTranslating(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        text: sourceText,
        target_language: targetLang,
        force_mode: forceMode === 'auto' ? null : forceMode,
      };
      if (sourceLang !== 'Auto Detect') {
        body.source_language = sourceLang;
      }

      const data = await apiPost('/api/summarize/translate', body);
      setTranslatedText(data.translation);
      setEngine(data.engine || '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  const swapLanguages = () => {
    if (sourceLang === 'Auto Detect') return;
    const tmpLang = sourceLang;
    const tmpText = translatedText;
    setSourceLang(targetLang);
    setTargetLang(tmpLang);
    setSourceText(tmpText);
    setTranslatedText('');
  };

  const copyTranslation = () => {
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const speakText = (text: string, lang: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = {
      English: 'en', Hindi: 'hi', Telugu: 'te', Tamil: 'ta', Spanish: 'es',
      French: 'fr', German: 'de', Chinese: 'zh', Japanese: 'ja', Korean: 'ko',
      Arabic: 'ar', Russian: 'ru', Portuguese: 'pt', Italian: 'it',
      Kannada: 'kn', Malayalam: 'ml', Marathi: 'mr', Bengali: 'bn',
    };
    utterance.lang = langMap[lang] || 'en';
    speechSynthesis.speak(utterance);
  };

  const engineLabel: Record<string, string> = {
    google: '🌐 Google',
    argos: '⚡ Argos',
    llm: '🤖 LLM',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mode toggle */}
      <div className="flex items-center justify-center gap-1 px-3 py-1.5 border-b border-slate-700/50 bg-slate-800/40">
        {(['auto', 'online', 'offline'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setForceMode(m)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
              forceMode === m
                ? m === 'online'
                  ? 'bg-emerald-600 text-white'
                  : m === 'offline'
                  ? 'bg-amber-600 text-white'
                  : 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800'
            }`}
          >
            {m === 'auto' ? '⚡ Auto' : m === 'online' ? '🌐 Online' : '💻 Offline'}
          </button>
        ))}
      </div>

      {/* Language selector bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-700/50">
        <select
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
        >
          <option value="Auto Detect">Auto Detect</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <button
          onClick={swapLanguages}
          disabled={sourceLang === 'Auto Detect'}
          className="p-1.5 text-slate-400 hover:text-purple-300 disabled:opacity-30 transition-colors"
          title="Swap languages"
        >
          <ArrowRightLeft size={14} />
        </button>

        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* Source text */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 relative">
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Type or paste text to translate..."
            className="w-full h-full bg-transparent px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none"
          />
          {sourceText && (
            <button
              onClick={() => speakText(sourceText, sourceLang === 'Auto Detect' ? 'English' : sourceLang)}
              className="absolute bottom-2 right-2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
              title="Listen"
            >
              <Volume2 size={14} />
            </button>
          )}
        </div>

        {/* Divider with engine badge */}
        <div className="flex items-center px-3 py-1 border-y border-slate-700/50 bg-slate-800/30">
          <div className="flex-1 flex items-center gap-2">
            {isTranslating && <Loader2 size={12} className="animate-spin text-purple-400" />}
            {engine && !isTranslating && (
              <span className="text-[10px] text-slate-400">
                {engineLabel[engine] || engine}
              </span>
            )}
          </div>
          {error && <span className="text-[10px] text-red-400 truncate">{error}</span>}
          <Languages size={14} className="text-purple-400/50" />
        </div>

        {/* Translation output */}
        <div className="flex-1 relative">
          <div className="w-full h-full overflow-y-auto px-3 py-2 text-sm text-slate-200">
            {translatedText || (
              <span className="text-slate-500">Translation will appear here...</span>
            )}
          </div>
          {translatedText && (
            <div className="absolute bottom-2 right-2 flex gap-1">
              <button
                onClick={() => speakText(translatedText, targetLang)}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                title="Listen"
              >
                <Volume2 size={14} />
              </button>
              <button
                onClick={copyTranslation}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                title="Copy"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
