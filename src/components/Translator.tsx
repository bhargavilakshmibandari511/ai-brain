import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeftRight, Copy, Send, CheckCircle2, AlertCircle,
  Loader2, Languages, ChevronDown, Info,
} from "lucide-react";

const API = "http://127.0.0.1:8001";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TranslateResult {
  text:        string;
  src:         string;
  tgt:         string;
  model:       string;
  pivot:       boolean;
  duration_ms: number;
}

interface Language {
  code: string;
  name: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const Translator: React.FC = () => {
  const [srcLang, setSrcLang]     = useState("en");
  const [tgtLang, setTgtLang]     = useState("hi");
  const [inputText, setInputText] = useState("");
  const [result, setResult]       = useState<TranslateResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [copied, setCopied]       = useState(false);
  const [numBeams, setNumBeams]   = useState(4);
  const [showSettings, setShowSettings] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_CHARS   = 2000;

  // Load language list on mount
  useEffect(() => {
    fetch(`${API}/api/translate/languages`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.languages) setLanguages(d.languages); })
      .catch(() => {});
  }, []);

  const doTranslate = useCallback(async (text: string, src: string, tgt: string) => {
    if (!text.trim() || src === tgt) {
      if (src === tgt) setResult({ text, src, tgt, model: "passthrough",
        pivot: false, duration_ms: 0 });
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/translate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, src, tgt, num_beams: numBeams }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.detail || `Error ${res.status}`);
      }
      setResult(await res.json());
    } catch (e: any) {
      setError(e?.message || "Translation failed");
    } finally {
      setLoading(false);
    }
  }, [numBeams]);

  // Auto-translate on input change (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!inputText.trim()) { setResult(null); setError(null); return; }
    debounceRef.current = setTimeout(() => {
      doTranslate(inputText, srcLang, tgtLang);
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputText, srcLang, tgtLang, doTranslate]);

  const swapLanguages = () => {
    setSrcLang(tgtLang);
    setTgtLang(srcLang);
    setInputText(result?.text || "");
    setResult(null);
  };

  const copyResult = async () => {
    if (!result?.text) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sendToChat = () => {
    if (!result?.text) return;
    window.dispatchEvent(new CustomEvent("ai-brain:send-to-chat", {
      detail: { text: `Translation (${srcLang}→${tgtLang}):\n${result.text}` }
    }));
  };

  const langName = (code: string) =>
    languages.find(l => l.code === code)?.name || code.toUpperCase();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#07080f", fontFamily: "'DM Sans', system-ui, sans-serif",
      color: "#e2e8f0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        .tr-btn { transition: all 0.15s; cursor: pointer; border: none; }
        .tr-btn:hover  { filter: brightness(1.1); transform: translateY(-1px); }
        .tr-btn:active { transform: scale(0.97); }
        select:focus, textarea:focus { outline: none; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        padding: "11px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Languages style={{ width: 16, height: 16, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.2px" }}>
              Translator
            </div>
            <div style={{ fontSize: 11, color: "#475569" }}>
              Helsinki-NLP Opus-MT · offline · 40+ languages
            </div>
          </div>
        </div>
        <button onClick={() => setShowSettings(v => !v)} className="tr-btn" style={{
          display: "flex", alignItems: "center", gap: 5, padding: "5px 11px",
          borderRadius: 8, fontSize: 12, fontFamily: "inherit",
          background: showSettings ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${showSettings ? "rgba(14,165,233,0.3)" : "rgba(255,255,255,0.08)"}`,
          color: showSettings ? "#38bdf8" : "#64748b",
        }}>
          <Info style={{ width: 11, height: 11 }} /> Settings
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

        {/* ── SETTINGS ── */}
        {showSettings && (
          <div style={{
            marginBottom: 14, padding: "14px 16px", borderRadius: 12,
            background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)",
            animation: "fadeIn 0.15s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b",
                  textTransform: "uppercase", letterSpacing: "0.7px",
                  display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 24 }}>
                  Quality (beam search)
                  <span style={{ color: "#38bdf8" }}>{numBeams} beams</span>
                </label>
                <input type="range" min={1} max={8} step={1} value={numBeams}
                  onChange={e => setNumBeams(Number(e.target.value))}
                  style={{ width: 160, accentColor: "#0ea5e9" }} />
                <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>
                  1 = fast · 4 = balanced · 8 = best quality
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6,
                padding: "8px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontWeight: 600, color: "#94a3b8" }}>First use:</span> each language
                pair downloads ~300 MB once, then works offline forever.<br />
                Cache location: <code style={{ fontSize: 11 }}>~/.cache/huggingface/hub/</code>
              </div>
            </div>
          </div>
        )}

        {/* ── LANGUAGE SELECTOR BAR ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
        }}>
          {/* Source language */}
          <div style={{ flex: 1, position: "relative" }}>
            <select value={srcLang} onChange={e => setSrcLang(e.target.value)} style={{
              width: "100%", appearance: "none", padding: "9px 32px 9px 12px",
              borderRadius: 10, fontSize: 13, fontFamily: "inherit", cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
              color: "#e2e8f0",
            }}>
              {languages.length > 0
                ? languages.map(l => (
                    <option key={l.code} value={l.code} style={{ background: "#1e293b" }}>
                      {l.name}
                    </option>
                  ))
                : <option value="en">English</option>
              }
            </select>
            <ChevronDown style={{ position: "absolute", right: 10, top: "50%",
              transform: "translateY(-50%)", width: 13, height: 13,
              color: "#64748b", pointerEvents: "none" }} />
          </div>

          {/* Swap button */}
          <button onClick={swapLanguages} className="tr-btn" style={{
            width: 38, height: 38, borderRadius: 99, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.25)",
            color: "#38bdf8",
          }}>
            <ArrowLeftRight style={{ width: 15, height: 15 }} />
          </button>

          {/* Target language */}
          <div style={{ flex: 1, position: "relative" }}>
            <select value={tgtLang} onChange={e => setTgtLang(e.target.value)} style={{
              width: "100%", appearance: "none", padding: "9px 32px 9px 12px",
              borderRadius: 10, fontSize: 13, fontFamily: "inherit", cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
              color: "#e2e8f0",
            }}>
              {languages.length > 0
                ? languages.map(l => (
                    <option key={l.code} value={l.code} style={{ background: "#1e293b" }}>
                      {l.name}
                    </option>
                  ))
                : <option value="hi">Hindi</option>
              }
            </select>
            <ChevronDown style={{ position: "absolute", right: 10, top: "50%",
              transform: "translateY(-50%)", width: 13, height: 13,
              color: "#64748b", pointerEvents: "none" }} />
          </div>
        </div>

        {/* ── INPUT / OUTPUT SPLIT ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

          {/* Input */}
          <div style={{ borderRadius: 14, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{
              padding: "8px 12px", background: "rgba(255,255,255,0.02)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b",
                textTransform: "uppercase", letterSpacing: "0.6px" }}>
                {langName(srcLang)}
              </span>
              <span style={{ fontSize: 11, color: inputText.length > MAX_CHARS * 0.9
                ? "#f87171" : "#334155" }}>
                {inputText.length}/{MAX_CHARS}
              </span>
            </div>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value.slice(0, MAX_CHARS))}
              placeholder={`Type in ${langName(srcLang)}…`}
              style={{
                width: "100%", minHeight: 220, padding: "12px 14px",
                background: "#0a0f1a", border: "none", color: "#e2e8f0",
                fontSize: 14, lineHeight: 1.7, fontFamily: "inherit",
                resize: "vertical", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Output */}
          <div style={{ borderRadius: 14, overflow: "hidden",
            border: `1px solid ${result ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.08)"}` }}>
            <div style={{
              padding: "8px 12px", background: "rgba(255,255,255,0.02)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#38bdf8",
                textTransform: "uppercase", letterSpacing: "0.6px" }}>
                {langName(tgtLang)}
              </span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {loading && (
                  <Loader2 style={{ width: 12, height: 12, color: "#38bdf8",
                    animation: "spin 0.9s linear infinite" }} />
                )}
                {result && !loading && (
                  <span style={{ fontSize: 10, color: "#475569" }}>
                    {result.duration_ms}ms
                  </span>
                )}
              </div>
            </div>
            <div style={{
              minHeight: 220, padding: "12px 14px", background: "#0a0f1a",
              position: "relative",
            }}>
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8,
                  height: "100%", paddingTop: 40, justifyContent: "center" }}>
                  <Loader2 style={{ width: 18, height: 18, color: "#38bdf8",
                    animation: "spin 0.9s linear infinite" }} />
                  <span style={{ fontSize: 13, color: "#475569" }}>
                    Translating…
                  </span>
                </div>
              ) : result?.text ? (
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7,
                  color: "#e2e8f0", whiteSpace: "pre-wrap" }}>
                  {result.text}
                </p>
              ) : error ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 7,
                  padding: "10px", borderRadius: 8,
                  background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertCircle style={{ width: 13, height: 13, color: "#f87171",
                    flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 12, color: "#fca5a5" }}>{error}</span>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "#334155", fontStyle: "italic" }}>
                  Translation will appear here…
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── RESULT METADATA + ACTIONS ── */}
        {result && !loading && (
          <div style={{
            marginTop: 10, padding: "10px 14px", borderRadius: 12,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 8, animation: "fadeIn 0.2s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, color: "#4ade80" }}>
                <CheckCircle2 style={{ width: 11, height: 11 }} /> Offline
              </span>
              {result.pivot ? (
                <span style={{ fontSize: 11, color: "#f59e0b", padding: "1px 7px",
                  borderRadius: 6, background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)" }}>
                  ⇄ Pivot via English
                </span>
              ) : null}
              <span style={{ fontSize: 11, color: "#334155",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: 280 }}>
                {result.model}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={copyResult} className="tr-btn" style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 11px",
                borderRadius: 8, fontSize: 12, fontFamily: "inherit",
                background: copied ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)"}`,
                color: copied ? "#4ade80" : "#64748b",
              }}>
                <Copy style={{ width: 11, height: 11 }} />
                {copied ? "Copied" : "Copy"}
              </button>
              <button onClick={sendToChat} className="tr-btn" style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 11px",
                borderRadius: 8, fontSize: 12, fontFamily: "inherit",
                background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
                color: "#818cf8",
              }}>
                <Send style={{ width: 11, height: 11 }} /> Chat
              </button>
            </div>
          </div>
        )}

        {/* ── QUICK LANGUAGE PILLS ── */}
        {!inputText && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#334155",
              textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>
              Popular pairs
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                ["en","hi"], ["en","te"], ["en","ta"], ["en","fr"],
                ["en","de"], ["en","es"], ["en","ar"], ["en","zh"],
                ["hi","en"], ["te","en"],
              ].map(([s, t]) => (
                <button key={`${s}-${t}`}
                  onClick={() => { setSrcLang(s); setTgtLang(t); }}
                  className="tr-btn" style={{
                    padding: "4px 11px", borderRadius: 99, fontSize: 12,
                    fontFamily: "inherit", cursor: "pointer",
                    background: srcLang === s && tgtLang === t
                      ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${srcLang === s && tgtLang === t
                      ? "rgba(14,165,233,0.35)" : "rgba(255,255,255,0.07)"}`,
                    color: srcLang === s && tgtLang === t ? "#38bdf8" : "#475569",
                  }}>
                  {s.toUpperCase()} → {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Translator;
