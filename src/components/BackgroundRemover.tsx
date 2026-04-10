import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, Download, Loader2, Image as ImageIcon, RotateCcw,
  Clock, ChevronDown, Zap, Sparkles, Eye, Code2, SlidersHorizontal,
  CheckCircle2, AlertCircle, Layers, Sun, Moon, Maximize2
} from 'lucide-react';

const API = 'http://127.0.0.1:8001';

interface ProcessedImage {
  image_id: string;
  originalUrl: string;
  resultUrl: string;
  resultUrlDark?: string;
  width: number;
  height: number;
  processing_time_ms: number;
  filename: string;
  model: string;
  quality: string;
}

interface AdvancedSettings {
  model: string;
  quality: 'fast' | 'balanced' | 'high';
  enhance_edges: boolean;
  remove_spill: boolean;
  enhance_details: boolean;
  blur_edges: number;
  transparency_level: number;
}

const MODEL_OPTIONS = [
  { value: 'isnet-general-use', label: 'ISNet General', badge: 'Best for logos', color: '#10b981' },
  { value: 'u2net', label: 'U2-Net Classic', badge: 'All-round', color: '#3b82f6' },
  { value: 'u2netp', label: 'U2-Net Lite', badge: 'Fastest', color: '#f59e0b' },
  { value: 'silueta', label: 'Silueta', badge: 'Silhouettes', color: '#8b5cf6' },
  { value: 'u2net_human_seg', label: 'Human Seg', badge: 'People', color: '#ec4899' },
  { value: 'isnet-anime', label: 'Anime / Cartoon', badge: 'Stylized', color: '#06b6d4' },
];

const QUALITY_OPTIONS = [
  { value: 'fast', label: 'Fast', time: '1–2s', icon: '⚡' },
  { value: 'balanced', label: 'Balanced', time: '2–3s', icon: '⚖️' },
  { value: 'high', label: 'High', time: '3–4s', icon: '💎' },
];

const DEFAULT_SETTINGS: AdvancedSettings = {
  model: 'isnet-general-use',
  quality: 'balanced',
  enhance_edges: true,
  remove_spill: true,
  enhance_details: false,
  blur_edges: 1,
  transparency_level: 255,
};

type PreviewBg = 'transparent' | 'dark' | 'white' | 'gradient';

const BG_OPTIONS: { id: PreviewBg; label: string; style: React.CSSProperties }[] = [
  {
    id: 'transparent',
    label: 'Transparent',
    style: {
      backgroundImage:
        'linear-gradient(45deg,#1e293b 25%,transparent 25%),linear-gradient(-45deg,#1e293b 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1e293b 75%),linear-gradient(-45deg,transparent 75%,#1e293b 75%)',
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0,0 10px,10px -10px,-10px 0px',
      backgroundColor: '#0f172a',
    },
  },
  { id: 'dark', label: 'Dark', style: { backgroundColor: '#000000' } },
  { id: 'white', label: 'White', style: { backgroundColor: '#ffffff' } },
  {
    id: 'gradient',
    label: 'Gradient',
    style: { background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e3a5f 100%)' },
  },
];

export const BackgroundRemover: React.FC = () => {
  const [settings, setSettings] = useState<AdvancedSettings>(DEFAULT_SETTINGS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<ProcessedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBg, setPreviewBg] = useState<PreviewBg>('transparent');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate a fake progress bar for UX
  const startProgress = useCallback((quality: string) => {
    const totalMs = quality === 'fast' ? 2000 : quality === 'balanced' ? 3000 : 4500;
    const steps = [
      { pct: 15, label: 'Loading AI model...' },
      { pct: 35, label: 'Analysing image...' },
      { pct: 55, label: 'Generating mask...' },
      { pct: 75, label: 'Refining edges...' },
      { pct: 90, label: 'Enhancing details...' },
      { pct: 97, label: 'Finalising output...' },
    ];
    let step = 0;
    setProgress(5);
    setProgressLabel('Preparing...');
    progressRef.current = setInterval(() => {
      if (step < steps.length) {
        setProgress(steps[step].pct);
        setProgressLabel(steps[step].label);
        step++;
      }
    }, totalMs / steps.length);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(100);
    setProgressLabel('Done!');
    setTimeout(() => { setProgress(0); setProgressLabel(''); }, 600);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/tiff'];
    if (!allowed.includes(file.type)) {
      setError('Unsupported file type. Use PNG, JPG, WebP, BMP, or TIFF.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File too large. Maximum size is 20 MB.');
      return;
    }

    setError(null);
    setResult(null);
    setPreviewUrl(URL.createObjectURL(file));
    setIsProcessing(true);
    startProgress(settings.quality);

    // Build form data for the advanced endpoint
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', settings.model);
    formData.append('quality', settings.quality);
    formData.append('enhance_edges', String(settings.enhance_edges));
    formData.append('remove_spill', String(settings.remove_spill));
    formData.append('enhance_details', String(settings.enhance_details));
    formData.append('blur_edges', String(settings.blur_edges));
    formData.append('transparency_level', String(settings.transparency_level));

    try {
      const res = await fetch(`${API}/api/background/advanced`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        // Fallback to basic endpoint
        const formData2 = new FormData();
        formData2.append('file', file);
        formData2.append('model', settings.model);
        formData2.append('sharpen', 'true');
        formData2.append('threshold', '20');
        const res2 = await fetch(`${API}/api/background/remove`, { method: 'POST', body: formData2 });
        if (!res2.ok) {
          const d = await res2.json().catch(() => null);
          throw new Error(d?.detail || `Server error ${res2.status}`);
        }
        const data2 = await res2.json();
        stopProgress();
        setResult({
          image_id: data2.image_id,
          originalUrl: URL.createObjectURL(file),
          resultUrl: `${API}${data2.download_url}`,
          width: data2.width,
          height: data2.height,
          processing_time_ms: data2.processing_time_ms,
          filename: file.name,
          model: data2.model || settings.model,
          quality: settings.quality,
        });
        return;
      }

      const data = await res.json();
      stopProgress();
      setResult({
        image_id: data.image_id,
        originalUrl: URL.createObjectURL(file),
        resultUrl: `${API}${data.download_url}`,
        width: data.width,
        height: data.height,
        processing_time_ms: data.processing_time_ms,
        filename: file.name,
        model: data.model || settings.model,
        quality: settings.quality,
      });
    } catch (err) {
      stopProgress();
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  }, [settings, startProgress, stopProgress]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleReset = () => {
    setResult(null); setPreviewUrl(null); setError(null);
    setProgress(0); setProgressLabel('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDownload = async (bg?: PreviewBg) => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.resultUrl;
    const suffix = bg === 'dark' ? '_dark_bg' : '_no_bg';
    a.download = result.filename.replace(/\.[^.]+$/, '') + suffix + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const patchSetting = (key: keyof AdvancedSettings, val: any) =>
    setSettings(prev => ({ ...prev, [key]: val }));

  const selectedModel = MODEL_OPTIONS.find(m => m.value === settings.model);

  return (
    <div className="flex flex-col h-full font-sans" style={{ background: '#080c14', color: '#e2e8f0' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(15,20,35,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        className="px-6 py-3 flex items-center justify-between shrink-0 backdrop-blur">
        <div className="flex items-center gap-3">
          <div style={{ background: 'linear-gradient(135deg,#f43f5e,#ec4899)', borderRadius: 10 }}
            className="w-9 h-9 flex items-center justify-center shadow-lg">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px', color: '#f1f5f9' }}>
                Background Remover
              </span>
              <span style={{ background: 'rgba(244,63,94,0.15)', color: '#fb7185', fontSize: 10,
                fontWeight: 700, padding: '1px 7px', borderRadius: 99, border: '1px solid rgba(244,63,94,0.3)',
                letterSpacing: '0.5px' }}>
                ADVANCED
              </span>
            </div>
            <p style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
              AI-powered · Multi-model · Edge-preserving
            </p>
          </div>
        </div>
        {result && (
          <button onClick={handleReset}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}
            className="flex items-center gap-1.5 hover:text-white transition-colors">
            <RotateCcw className="w-3 h-3" /> New Image
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: '20px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* ── UPLOAD / IDLE STATE ─────────────────────────────────────── */}
          {!result && !isProcessing && (
            <>
              {/* Model + Quality row */}
              <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
                {/* Model picker */}
                <div style={{ flex: '1 1 240px' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: 6 }}>
                    AI Model
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select value={settings.model} onChange={e => patchSetting('model', e.target.value)}
                      style={{ width: '100%', appearance: 'none', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.09)', color: '#e2e8f0', fontSize: 13,
                        borderRadius: 10, padding: '9px 36px 9px 12px', cursor: 'pointer',
                        outline: 'none' }}>
                      {MODEL_OPTIONS.map(m => (
                        <option key={m.value} value={m.value} style={{ background: '#1e293b' }}>
                          {m.label} — {m.badge}
                        </option>
                      ))}
                    </select>
                    <ChevronDown style={{ position: 'absolute', right: 10, top: '50%',
                      transform: 'translateY(-50%)', width: 14, height: 14, color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                  {selectedModel && (
                    <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: selectedModel.color }} />
                      <span style={{ fontSize: 11, color: '#64748b' }}>{selectedModel.badge}</span>
                    </div>
                  )}
                </div>

                {/* Quality picker */}
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: 6 }}>
                    Quality
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {QUALITY_OPTIONS.map(q => (
                      <button key={q.value} onClick={() => patchSetting('quality', q.value)}
                        style={{
                          flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.15s', border: '1px solid',
                          borderColor: settings.quality === q.value ? '#f43f5e' : 'rgba(255,255,255,0.08)',
                          background: settings.quality === q.value ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.03)',
                          color: settings.quality === q.value ? '#fb7185' : '#64748b',
                        }}>
                        <div>{q.icon}</div>
                        <div style={{ fontSize: 11, marginTop: 1 }}>{q.label}</div>
                        <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>{q.time}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Advanced settings toggle */}
              <button onClick={() => setShowAdvanced(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b',
                  background: 'none', border: 'none', cursor: 'pointer', marginBottom: 10, padding: 0 }}
                className="hover:text-slate-300 transition-colors">
                <SlidersHorizontal style={{ width: 13, height: 13 }} />
                {showAdvanced ? 'Hide' : 'Show'} advanced settings
                <ChevronDown style={{ width: 12, height: 12,
                  transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {showAdvanced && (
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '16px 20px', marginBottom: 16, display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>

                  {/* Toggles */}
                  {([
                    { key: 'enhance_edges', label: 'Enhance Edges', desc: 'Morphological refinement' },
                    { key: 'remove_spill', label: 'Remove Spill', desc: 'No colour halos' },
                    { key: 'enhance_details', label: 'Enhance Details', desc: 'Unsharp masking (+300ms)' },
                  ] as const).map(({ key, label, desc }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                      <div onClick={() => patchSetting(key, !settings[key])}
                        style={{ marginTop: 2, width: 36, height: 20, borderRadius: 99, flexShrink: 0,
                          background: settings[key] ? '#f43f5e' : 'rgba(255,255,255,0.1)',
                          position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
                        <div style={{ position: 'absolute', top: 2, left: settings[key] ? 18 : 2,
                          width: 16, height: 16, borderRadius: '50%', background: '#fff',
                          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{label}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{desc}</div>
                      </div>
                    </label>
                  ))}

                  {/* Blur edges slider */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                      Edge Blur: {settings.blur_edges}
                    </div>
                    <input type="range" min={0} max={5} value={settings.blur_edges}
                      onChange={e => patchSetting('blur_edges', Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#f43f5e' }} />
                    <div style={{ fontSize: 11, color: '#64748b' }}>0 = sharp, 5 = feathered</div>
                  </div>

                  {/* Transparency slider */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                      Transparency: {settings.transparency_level}
                    </div>
                    <input type="range" min={0} max={255} value={settings.transparency_level}
                      onChange={e => patchSetting('transparency_level', Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#f43f5e' }} />
                    <div style={{ fontSize: 11, color: '#64748b' }}>255 = fully transparent bg</div>
                  </div>
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragEnter={handleDrag} onDragLeave={handleDrag}
                onDragOver={handleDrag} onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragActive ? '#f43f5e' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 20, padding: '52px 24px', textAlign: 'center', cursor: 'pointer',
                  background: dragActive ? 'rgba(244,63,94,0.06)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s',
                }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
                  background: 'rgba(244,63,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(244,63,94,0.2)' }}>
                  <Upload style={{ width: 22, height: 22, color: '#fb7185' }} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
                  Drop your image here or click to upload
                </h3>
                <p style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>
                  PNG · JPG · WebP · BMP · TIFF — max 20 MB
                </p>
                <p style={{ fontSize: 12, color: '#334155' }}>
                  Works best on logos, emblems, product photos and portraits
                </p>
                <input ref={inputRef} type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff"
                  style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
              </div>

              {/* Tips */}
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
                {[
                  { icon: '🎨', title: 'Logos & Emblems', tip: 'Use ISNet + High quality for best results' },
                  { icon: '👤', title: 'Portraits', tip: 'Human Seg model for people & faces' },
                  { icon: '📦', title: 'Products', tip: 'Balanced quality is ideal for e-commerce' },
                  { icon: '🌸', title: 'Anime / Art', tip: 'Anime model preserves stylised edges' },
                ].map(item => (
                  <div key={item.title} style={{ background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{item.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{item.tip}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── PROCESSING STATE ─────────────────────────────────────────── */}
          {isProcessing && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20, padding: 32, textAlign: 'center' }}>
              {previewUrl && (
                <img src={previewUrl} alt="preview"
                  style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 12, opacity: 0.4,
                    margin: '0 auto 24px', display: 'block', objectFit: 'contain' }} />
              )}
              <div style={{ width: 48, height: 48, margin: '0 auto 16px', borderRadius: '50%',
                background: 'rgba(244,63,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 style={{ width: 22, height: 22, color: '#f43f5e', animation: 'spin 1s linear infinite' }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
                {progressLabel || 'Processing…'}
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>
                Using <span style={{ color: '#fb7185' }}>{MODEL_OPTIONS.find(m => m.value === settings.model)?.label}</span> ·{' '}
                <span style={{ color: '#fb7185', textTransform: 'capitalize' }}>{settings.quality}</span> quality
              </div>
              {/* Progress bar */}
              <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden', maxWidth: 320, margin: '0 auto' }}>
                <div style={{ height: '100%', borderRadius: 4,
                  background: 'linear-gradient(90deg,#f43f5e,#ec4899)',
                  width: `${progress}%`, transition: 'width 0.6s ease' }} />
              </div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* ── ERROR ────────────────────────────────────────────────────── */}
          {error && !isProcessing && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertCircle style={{ width: 16, height: 16, color: '#f87171', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#fca5a5' }}>{error}</span>
            </div>
          )}

          {/* ── RESULT ───────────────────────────────────────────────────── */}
          {result && !isProcessing && (
            <div>
              {/* Stats bar */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, padding: '10px 16px', marginBottom: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b' }}>
                    <CheckCircle2 style={{ width: 13, height: 13, color: '#10b981' }} />
                    <span style={{ color: '#10b981', fontWeight: 600 }}>Done</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock style={{ width: 12, height: 12 }} />
                    {result.processing_time_ms} ms
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{result.width} × {result.height} px</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', background: 'rgba(255,255,255,0.05)',
                    padding: '2px 8px', borderRadius: 6 }}>
                    {MODEL_OPTIONS.find(m => m.value === result.model)?.label || result.model}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', background: 'rgba(255,255,255,0.05)',
                    padding: '2px 8px', borderRadius: 6, textTransform: 'capitalize' }}>
                    {result.quality} quality
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleDownload()}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                      borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
                      color: '#fb7185', transition: 'all 0.15s' }}>
                    <Download style={{ width: 13, height: 13 }} /> Download PNG
                  </button>
                </div>
              </div>

              {/* Background picker for preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.6px' }}>Preview on:</span>
                {BG_OPTIONS.map(bg => (
                  <button key={bg.id} onClick={() => setPreviewBg(bg.id)}
                    style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                      border: '1px solid',
                      borderColor: previewBg === bg.id ? '#f43f5e' : 'rgba(255,255,255,0.08)',
                      background: previewBg === bg.id ? 'rgba(244,63,94,0.1)' : 'rgba(255,255,255,0.03)',
                      color: previewBg === bg.id ? '#fb7185' : '#64748b', transition: 'all 0.15s',
                      fontWeight: previewBg === bg.id ? 600 : 400 }}>
                    {bg.label}
                  </button>
                ))}
              </div>

              {/* Before / After */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Original */}
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 18, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b',
                      textTransform: 'uppercase', letterSpacing: '0.6px' }}>Original</span>
                    <span style={{ fontSize: 11, color: '#334155' }}>{result.filename}</span>
                  </div>
                  <div style={{ padding: 16, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', minHeight: 280, background: '#111827' }}>
                    <img src={result.originalUrl} alt="Original"
                      style={{ maxHeight: 300, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
                  </div>
                </div>

                {/* Result with chosen background */}
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(244,63,94,0.2)',
                  borderRadius: 18, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#fb7185',
                      textTransform: 'uppercase', letterSpacing: '0.6px' }}>Background Removed</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleDownload(previewBg)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px',
                          borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)',
                          color: '#fb7185' }}>
                        <Download style={{ width: 11, height: 11 }} /> Save
                      </button>
                    </div>
                  </div>
                  <div style={{ ...BG_OPTIONS.find(b => b.id === previewBg)?.style,
                    padding: 16, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', minHeight: 280 }}>
                    <img src={result.resultUrl} alt="Background removed"
                      style={{ maxHeight: 300, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
                  </div>
                </div>
              </div>

              {/* Try again hint */}
              <div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 12,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sparkles style={{ width: 14, height: 14, color: '#f59e0b', flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#64748b' }}>
                  Not satisfied with the result? Try switching to a different model or increase quality.{' '}
                  <button onClick={handleReset}
                    style={{ color: '#fb7185', background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, padding: 0 }}>
                    Process another image →
                  </button>
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default BackgroundRemover;
