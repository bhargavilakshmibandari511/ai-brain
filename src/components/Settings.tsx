import React, { useState, useEffect } from 'react';
import { Brain, Zap, Palette, Globe, Mic, Check } from 'lucide-react';

const API = 'http://127.0.0.1:8001';

export const Settings: React.FC = () => {
  const [model, setModel] = useState('llama3.1:8b');
  const [availableModels, setAvailableModels] = useState<string[]>(['llama3.1:8b']);
  const [maxTokens, setMaxTokens] = useState(512);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [language, setLanguage] = useState('English');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<'offline' | 'online'>('offline');
  const [apiKey, setApiKey] = useState('');
  const [currentMode, setCurrentMode] = useState('offline');
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('ai_settings');
    if (stored) {
      const s = JSON.parse(stored);
      setModel(s.model || 'mistral');
      setMaxTokens(s.maxTokens || 512);
      setTheme(s.theme || 'dark');
      setLanguage(s.language || 'English');
      setVoiceEnabled(s.voiceEnabled !== false);
      setMode(s.mode === 'online' ? 'online' : 'offline');
      setApiKey(typeof s.api_key === 'string' ? s.api_key : '');
    }

    fetch(`${API}/api/dashboard/mode`)
      .then(r => r.json())
      .then(d => {
        if (d?.mode === 'online' || d?.mode === 'offline') {
          setMode(d.mode);
          setCurrentMode(d.mode);
        }
      })
      .catch(() => {});

    fetch(`${API}/api/dashboard/models`)
      .then(r => r.json())
      .then(d => {
        const names = (d.available_models || []).map((m: any) => m.name);
        if (names.length) setAvailableModels(names);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    const settings = { 
      model, 
      maxTokens, 
      theme, 
      language, 
      voiceEnabled,
      mode,
      api_key: apiKey 
    };
    localStorage.setItem('ai_settings', JSON.stringify(settings));

    // Backend mode switch
    try {
      await fetch(`${API}/api/dashboard/mode`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({mode, api_key: apiKey})
      });
      setCurrentMode(mode);
    } catch (e) { console.error('Mode switch failed', e); }

    // Model switch
    try {
      await fetch(`${API}/api/dashboard/models/${encodeURIComponent(model)}/switch`, { method: 'POST' });
    } catch { /* ignore */ }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleModeToggle = async (newMode: 'offline' | 'online') => {
    setIsSwitchingMode(true);
    setMode(newMode);
    
    const settings = { 
      model, 
      maxTokens, 
      theme, 
      language, 
      voiceEnabled,
      mode: newMode,
      api_key: apiKey 
    };
    localStorage.setItem('ai_settings', JSON.stringify(settings));

    try {
      const resp = await fetch(`${API}/api/dashboard/mode`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({mode: newMode, api_key: apiKey})
      });
      
      if (resp.ok) {
        const data = await resp.json();
        setCurrentMode(data.mode || newMode);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } catch (e) { 
      console.error('Mode switch failed', e);
      setMode(currentMode); // Revert on error
    } finally {
      setIsSwitchingMode(false);
    }
  };

  const Section = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 transition-all hover:border-slate-700 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-purple-400" />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-y-auto">
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">Configure your local AI assistant</p>
      </div>

      <div className="flex-1 p-6 max-w-xl mx-auto w-full space-y-4">

        {/* AI Model */}
        <Section title="AI Model" icon={Brain}>
          <label className="text-xs text-slate-400 mb-2 block">Active model</label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            title="Active AI model"
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
          >
            {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-slate-700"></span>
            Install more models with <code className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] font-mono border border-slate-700">ollama pull llama3</code>
          </p>
        </Section>

        {/* Response Speed */}
        <Section title="Response Speed" icon={Zap}>
          <label className="text-xs text-slate-400 mb-2 block">Max tokens per response: <span className="text-white">{maxTokens}</span></label>
          <input
            type="range"
            min={128}
            max={2048}
            step={128}
            value={maxTokens}
            onChange={e => setMaxTokens(+e.target.value)}
            title="Max tokens per response"
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>128 (fastest)</span>
            <span>2048 (most complete)</span>
          </div>
        </Section>

        {/* Voice */}
        <Section title="Voice Input" icon={Mic}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-200">Enable voice input</p>
              <p className="text-xs text-slate-500 mt-0.5">Uses browser Web Speech API (Chrome recommended)</p>
            </div>
            <button
              onClick={() => setVoiceEnabled(p => !p)}
              title="Toggle voice input"
              className={`w-11 h-6 rounded-full transition-colors relative ${voiceEnabled ? 'bg-purple-600' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${voiceEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </Section>

        {/* Language */}
        <Section title="Interface Language" icon={Globe}>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            title="Interface language"
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
          >
            {['English', 'Spanish', 'French', 'German', 'Hindi', 'Tamil', 'Chinese', 'Japanese', 'Arabic'].map(l =>
              <option key={l}>{l}</option>
            )}
          </select>
        </Section>

        {/* Theme */}
        <Section title="Theme" icon={Palette}>
          <div className="flex gap-3">
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
                  theme === t
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
              </button>
            ))}
          </div>
        </Section>

        {/* Deployment Mode */}
        <Section title="Deployment Mode" icon={Zap}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="text-xs text-slate-400 block">Online Mode</label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {mode === 'online' ? 'Using online provider settings' : 'Using offline local settings'}
              </p>
            </div>
            <button
              onClick={() => handleModeToggle(mode === 'online' ? 'offline' : 'online')}
              disabled={isSwitchingMode}
              className={`w-12 h-7 rounded-full transition-colors relative ${mode === 'online' ? 'bg-emerald-600' : 'bg-slate-700'} ${isSwitchingMode ? 'opacity-60' : ''}`}
              aria-label="Toggle online mode"
            >
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${mode === 'online' ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          <div className="mb-2 text-xs text-slate-400">
            Active selection: <span className="text-slate-200 font-medium">{mode === 'online' ? 'Online (Groq)' : 'Offline (Local Ollama)'}</span>
          </div>

          {mode === 'online' && (
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Groq API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Get free key</a>
              </p>
            </div>
          )}
          <p className="text-[11px] text-slate-500 mt-2">
            Current backend: <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${currentMode === 'offline' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-blue-900/50 text-blue-300'}`}>{currentMode.toUpperCase()}</span>
          </p>
        </Section>

        {/* Save */}
        <button
          onClick={save}
          className={`w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500'
          }`}
        >
          {saved ? <><Check className="w-4 h-4" /> Saved!</> : <>Save Settings</>}
        </button>
      </div>
    </div>
  );
};
