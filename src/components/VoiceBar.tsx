import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, Settings2,
  Square, Play, Pause, ChevronDown, X, Loader2,
} from 'lucide-react';
import { useVoice } from '../hooks/useVoice';

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE OPTIONS (recognition + matching TTS voices)
// ─────────────────────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en-US', label: 'English (US)'    },
  { code: 'en-GB', label: 'English (UK)'    },
  { code: 'hi-IN', label: 'Hindi'           },
  { code: 'te-IN', label: 'Telugu'          },
  { code: 'ta-IN', label: 'Tamil'           },
  { code: 'kn-IN', label: 'Kannada'         },
  { code: 'fr-FR', label: 'French'          },
  { code: 'de-DE', label: 'German'          },
  { code: 'es-ES', label: 'Spanish'         },
  { code: 'ja-JP', label: 'Japanese'        },
  { code: 'zh-CN', label: 'Chinese (CN)'    },
  { code: 'ar-SA', label: 'Arabic'          },
];

// ─────────────────────────────────────────────────────────────────────────────
// WAVEFORM ANIMATION — pure CSS bars
// ─────────────────────────────────────────────────────────────────────────────
const Waveform: React.FC<{ active: boolean }> = ({ active }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 18 }}>
    <style>{`
      @keyframes wave1 { 0%,100%{height:4px} 50%{height:14px} }
      @keyframes wave2 { 0%,100%{height:8px} 50%{height:18px} }
      @keyframes wave3 { 0%,100%{height:14px}50%{height:6px}  }
      @keyframes wave4 { 0%,100%{height:6px} 50%{height:16px} }
      @keyframes wave5 { 0%,100%{height:10px}50%{height:4px}  }
    `}</style>
    {[
      { anim: 'wave1', delay: '0ms'   },
      { anim: 'wave2', delay: '80ms'  },
      { anim: 'wave3', delay: '160ms' },
      { anim: 'wave4', delay: '240ms' },
      { anim: 'wave5', delay: '320ms' },
    ].map((bar, i) => (
      <div key={i} style={{
        width: 3,
        height: active ? undefined : 4,
        borderRadius: 2,
        background: '#f43f5e',
        animation: active ? `${bar.anim} 0.8s ease-in-out ${bar.delay} infinite` : 'none',
        transition: 'height 0.2s',
      }} />
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface VoiceBarProps {
  /** Called with final transcript text — wire to your chat input setter */
  onTranscript: (text: string) => void;
  /** Pass the latest AI reply here to enable the TTS "read aloud" button */
  lastMessage?: string;
  /** Optional: whether to auto-speak new AI messages */
  autoSpeak?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE BAR
// ─────────────────────────────────────────────────────────────────────────────
export const VoiceBar: React.FC<VoiceBarProps> = ({
  onTranscript,
  lastMessage,
  autoSpeak = false,
}) => {
  const [lang, setLang]             = useState('en-US');
  const [showSettings, setShowSettings] = useState(false);
  const prevMessageRef = useRef<string | undefined>(undefined);

  const voice = useVoice({
    lang,
    continuous: false,
    onTranscript: (text) => {
      onTranscript(text);
    },
  });

  // Auto-speak new AI messages if enabled
  useEffect(() => {
    if (autoSpeak && lastMessage && lastMessage !== prevMessageRef.current) {
      prevMessageRef.current = lastMessage;
      voice.speak(lastMessage);
    }
  }, [lastMessage, autoSpeak]);

  // Filter voices to those matching current language
  const matchingVoices = voice.voices.filter(v =>
    v.lang.startsWith(lang.split('-')[0])
  );

  if (!voice.isSupported && !voice.ttsSupported) {
    return (
      <div style={{ fontSize: 12, color: '#ef4444', padding: '6px 10px',
        background: 'rgba(239,68,68,0.08)', borderRadius: 8,
        border: '1px solid rgba(239,68,68,0.2)' }}>
        Voice features not supported in this browser. Use Chrome or Edge.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        .vb-btn { transition: all 0.15s; cursor: pointer; border: none; }
        .vb-btn:hover  { filter: brightness(1.1); transform: translateY(-1px); }
        .vb-btn:active { transform: scale(0.95); }
        .vb-settings-panel { animation: vb-fade 0.15s ease; }
        @keyframes vb-fade { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* ── MAIN BAR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 14,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${voice.isListening ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
        transition: 'border-color 0.3s',
      }}>

        {/* MIC BUTTON */}
        {voice.isSupported && (
          <div style={{ position: 'relative' }}>
            {voice.isListening && (
              <div style={{
                position: 'absolute', inset: -4, borderRadius: '50%',
                background: 'rgba(244,63,94,0.3)',
                animation: 'pulse-ring 1s ease-out infinite',
              }} />
            )}
            <button
              onClick={voice.isListening ? voice.stopListening : voice.startListening}
              className="vb-btn"
              style={{
                position: 'relative', width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: voice.isListening ? '#f43f5e' : 'rgba(244,63,94,0.12)',
                border: `1px solid ${voice.isListening ? '#f43f5e' : 'rgba(244,63,94,0.3)'}`,
                color: voice.isListening ? '#fff' : '#fb7185',
              }}
              title={voice.isListening ? 'Stop listening' : 'Start voice input'}
            >
              {voice.isListening
                ? <MicOff style={{ width: 15, height: 15 }} />
                : <Mic    style={{ width: 15, height: 15 }} />
              }
            </button>
          </div>
        )}

        {/* WAVEFORM / TRANSCRIPT PREVIEW */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {voice.isListening ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Waveform active={true} />
              <span style={{ fontSize: 12, color: '#f87171', fontStyle: 'italic',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {voice.interimTranscript || 'Listening…'}
              </span>
            </div>
          ) : voice.transcript ? (
            <span style={{ fontSize: 12, color: '#94a3b8',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {voice.transcript}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: '#334155' }}>
              {voice.isSupported ? 'Press mic to speak…' : 'TTS only (recognition not supported)'}
            </span>
          )}
        </div>

        {/* CLEAR TRANSCRIPT */}
        {voice.transcript && !voice.isListening && (
          <button onClick={voice.clearTranscript} className="vb-btn" style={{
            background: 'none', color: '#475569', padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center',
          }} title="Clear transcript">
            <X style={{ width: 12, height: 12 }} />
          </button>
        )}

        {/* TTS SPEAK LAST MESSAGE */}
        {voice.ttsSupported && lastMessage && (
          <button
            onClick={() => voice.isSpeaking ? voice.stopSpeaking() : voice.speak(lastMessage)}
            className="vb-btn"
            style={{
              width: 32, height: 32, borderRadius: 8, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: voice.isSpeaking ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${voice.isSpeaking ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: voice.isSpeaking ? '#818cf8' : '#64748b',
            }}
            title={voice.isSpeaking ? 'Stop speaking' : 'Read last message aloud'}
          >
            {voice.isSpeaking
              ? <Square   style={{ width: 13, height: 13 }} />
              : <Volume2  style={{ width: 13, height: 13 }} />
            }
          </button>
        )}

        {/* PAUSE / RESUME while speaking */}
        {voice.isSpeaking && (
          <button
            onClick={voice.isPaused ? voice.resumeSpeaking : voice.pauseSpeaking}
            className="vb-btn"
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#64748b',
            }}
            title={voice.isPaused ? 'Resume' : 'Pause'}
          >
            {voice.isPaused
              ? <Play  style={{ width: 13, height: 13 }} />
              : <Pause style={{ width: 13, height: 13 }} />
            }
          </button>
        )}

        {/* SETTINGS TOGGLE */}
        <button
          onClick={() => setShowSettings(v => !v)}
          className="vb-btn"
          style={{
            width: 30, height: 30, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: showSettings ? 'rgba(255,255,255,0.08)' : 'none',
            border: '1px solid rgba(255,255,255,0.07)',
            color: showSettings ? '#e2e8f0' : '#475569',
          }}
          title="Voice settings"
        >
          <Settings2 style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* ── ERROR ── */}
      {voice.recognitionError && (
        <div style={{
          marginTop: 6, padding: '7px 12px', borderRadius: 8, fontSize: 12,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#fca5a5',
        }}>
          {voice.recognitionError}
        </div>
      )}

      {/* ── SETTINGS PANEL ── */}
      {showSettings && (
        <div className="vb-settings-panel" style={{
          marginTop: 8, padding: '14px 16px', borderRadius: 14,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
        }}>

          {/* Language */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.7px', display: 'block', marginBottom: 5 }}>
              Language
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={lang}
                onChange={e => setLang(e.target.value)}
                style={{
                  width: '100%', appearance: 'none', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)', color: '#e2e8f0', fontSize: 13,
                  borderRadius: 8, padding: '7px 28px 7px 10px', cursor: 'pointer',
                  outline: 'none', fontFamily: 'inherit',
                }}
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code} style={{ background: '#1e293b' }}>
                    {l.label}
                  </option>
                ))}
              </select>
              <ChevronDown style={{ position: 'absolute', right: 8, top: '50%',
                transform: 'translateY(-50%)', width: 12, height: 12,
                color: '#64748b', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* TTS Voice */}
          {matchingVoices.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '0.7px', display: 'block', marginBottom: 5 }}>
                Voice
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={voice.selectedVoice?.name || ''}
                  onChange={e => {
                    const v = voice.voices.find(v => v.name === e.target.value) || null;
                    voice.setSelectedVoice(v);
                  }}
                  style={{
                    width: '100%', appearance: 'none', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)', color: '#e2e8f0', fontSize: 13,
                    borderRadius: 8, padding: '7px 28px 7px 10px', cursor: 'pointer',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                >
                  {matchingVoices.map(v => (
                    <option key={v.name} value={v.name} style={{ background: '#1e293b' }}>
                      {v.name} {v.localService ? '(offline)' : '(online)'}
                    </option>
                  ))}
                </select>
                <ChevronDown style={{ position: 'absolute', right: 8, top: '50%',
                  transform: 'translateY(-50%)', width: 12, height: 12,
                  color: '#64748b', pointerEvents: 'none' }} />
              </div>
            </div>
          )}

          {/* Speed */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.7px',
              display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              Speed <span style={{ color: '#94a3b8' }}>{voice.rate.toFixed(1)}×</span>
            </label>
            <input type="range" min="0.5" max="2" step="0.1"
              value={voice.rate}
              onChange={e => voice.setRate(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#f43f5e' }}
            />
          </div>

          {/* Pitch */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.7px',
              display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              Pitch <span style={{ color: '#94a3b8' }}>{voice.pitch.toFixed(1)}</span>
            </label>
            <input type="range" min="0" max="2" step="0.1"
              value={voice.pitch}
              onChange={e => voice.setPitch(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#f43f5e' }}
            />
          </div>

          {/* Volume */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.7px',
              display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              Volume <span style={{ color: '#94a3b8' }}>{Math.round(voice.volume * 100)}%</span>
            </label>
            <input type="range" min="0" max="1" step="0.05"
              value={voice.volume}
              onChange={e => voice.setVolume(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#f43f5e' }}
            />
          </div>

          {/* Test TTS */}
          <div style={{ gridColumn: '1 / -1' }}>
            <button
              onClick={() => voice.speak('Hello! Voice is working correctly in AI Brain.')}
              style={{
                width: '100%', padding: '8px', borderRadius: 8, fontSize: 12,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)',
                color: '#fb7185', transition: 'all 0.15s',
              }}
            >
              Test voice
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceBar;
