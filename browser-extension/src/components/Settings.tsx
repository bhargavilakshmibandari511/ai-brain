import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Server, CheckCircle2, XCircle, Save } from 'lucide-react';
import { getSettings, saveSettings, type Settings as SettingsType } from '../utils/storage';
import { checkHealth } from '../utils/api';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType>({
    apiUrl: 'http://localhost:8000',
    temperature: 0.7,
    maxTokens: 512,
    defaultModel: 'tinyllama',
  });
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    setServerStatus('checking');
    const ok = await checkHealth();
    setServerStatus(ok ? 'online' : 'offline');
  };

  const handleSave = async () => {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-3 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <SettingsIcon size={18} className="text-purple-400" />
          <span className="text-sm font-medium text-slate-200">Settings</span>
        </div>
      </div>

      <div className="px-3 py-3 space-y-4">
        {/* Server Status */}
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Server size={13} />
              Backend Server
            </span>
            <button
              onClick={checkServerHealth}
              className="text-[10px] text-purple-400 hover:text-purple-300"
            >
              Refresh
            </button>
          </div>
          <div className="flex items-center gap-2">
            {serverStatus === 'checking' && (
              <span className="text-xs text-yellow-300">⏳ Checking...</span>
            )}
            {serverStatus === 'online' && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle2 size={12} /> Connected
              </span>
            )}
            {serverStatus === 'offline' && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <XCircle size={12} /> Offline
              </span>
            )}
          </div>
          {serverStatus === 'offline' && (
            <p className="mt-2 text-[10px] text-slate-400 leading-relaxed">
              Make sure the backend is running:<br />
              <code className="bg-slate-900 px-1 rounded text-purple-300">
                cd backend && python run.py
              </code>
            </p>
          )}
        </div>

        {/* API URL */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">API Server URL</label>
          <input
            type="url"
            value={settings.apiUrl}
            onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
          />
        </div>

        {/* Model */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Default Model</label>
          <select
            value={settings.defaultModel}
            onChange={(e) => setSettings({ ...settings, defaultModel: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
          >
            <option value="tinyllama">TinyLlama (Fast)</option>
            <option value="mistral">Mistral (Quality)</option>
            <option value="llama2">Llama 2</option>
            <option value="codellama">Code Llama</option>
          </select>
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Temperature: {settings.temperature}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.temperature}
            onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Max Tokens: {settings.maxTokens}
          </label>
          <input
            type="range"
            min="128"
            max="4096"
            step="128"
            value={settings.maxTokens}
            onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })}
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Short</span>
            <span>Long</span>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors"
        >
          {saved ? (
            <>
              <CheckCircle2 size={16} />
              Saved!
            </>
          ) : (
            <>
              <Save size={16} />
              Save Settings
            </>
          )}
        </button>

        {/* Info */}
        <div className="bg-slate-800/30 border border-slate-700/20 rounded-lg p-3">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            <strong className="text-slate-400">AI Brain Extension v1.0</strong><br />
            Connects to your local AI Digital Brain backend. Make sure Ollama and the
            FastAPI server are running for full functionality.
          </p>
        </div>
      </div>
    </div>
  );
}
