import { useState, useEffect, useRef, useCallback } from 'react';

// ── Browser API shims ─────────────────────────────────────────────────────────
const SpeechRecognitionAPI =
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition ||
  null;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface UseVoiceOptions {
  /** BCP-47 language tag for recognition, e.g. 'en-US', 'hi-IN', 'te-IN' */
  lang?: string;
  /**
   * continuous=false (default) → stops after first pause (good for single commands)
   * continuous=true            → keeps listening until stopListening() is called
   */
  continuous?: boolean;
  /** Called every time a final transcript segment is committed */
  onTranscript?: (text: string) => void;
  /** Called when recognition errors occur */
  onError?: (error: string) => void;
}

export interface UseVoiceReturn {
  // ── Voice input ──────────────────────────────────────────────────────────
  isListening:       boolean;
  transcript:        string;          // accumulated final transcript
  interimTranscript: string;          // live partial transcript (not yet committed)
  isSupported:       boolean;         // false if browser has no SpeechRecognition
  startListening:    () => void;
  stopListening:     () => void;
  clearTranscript:   () => void;
  recognitionError:  string | null;
  // ── Text-to-speech ───────────────────────────────────────────────────────
  speak:             (text: string) => void;
  stopSpeaking:      () => void;
  pauseSpeaking:     () => void;
  resumeSpeaking:    () => void;
  isSpeaking:        boolean;
  isPaused:          boolean;
  ttsSupported:      boolean;
  voices:            SpeechSynthesisVoice[];
  selectedVoice:     SpeechSynthesisVoice | null;
  setSelectedVoice:  (v: SpeechSynthesisVoice | null) => void;
  rate:              number;          // 0.5 – 2.0 (default 1.0)
  setRate:           (r: number) => void;
  pitch:             number;          // 0.0 – 2.0 (default 1.0)
  setPitch:          (p: number) => void;
  volume:            number;          // 0.0 – 1.0 (default 1.0)
  setVolume:         (v: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export function useVoice({
  lang = 'en-US',
  continuous = false,
  onTranscript,
  onError,
}: UseVoiceOptions = {}): UseVoiceReturn {

  // ── Voice input state ─────────────────────────────────────────────────────
  const [isListening,       setIsListening]       = useState(false);
  const [transcript,        setTranscript]        = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [recognitionError,  setRecognitionError]  = useState<string | null>(null);

  // ── TTS state ─────────────────────────────────────────────────────────────
  const [isSpeaking,    setIsSpeaking]    = useState(false);
  const [isPaused,      setIsPaused]      = useState(false);
  const [voices,        setVoices]        = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [rate,          setRate]          = useState(1.0);
  const [pitch,         setPitch]         = useState(1.0);
  const [volume,        setVolume]        = useState(1.0);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const recognitionRef    = useRef<any>(null);
  const accumulatedRef    = useRef('');   // builds up final transcript segments
  const onTranscriptRef   = useRef(onTranscript);
  const onErrorRef        = useRef(onError);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onErrorRef.current = onError; },          [onError]);

  const isSupported  = SpeechRecognitionAPI !== null;
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // ── Load available TTS voices ─────────────────────────────────────────────
  useEffect(() => {
    if (!ttsSupported) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
        // Default: pick the first voice matching `lang`, else first available
        const match = available.find(v => v.lang.startsWith(lang.split('-')[0]));
        setSelectedVoice(match || available[0]);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [lang, ttsSupported]);

  // ── Poll isSpeaking / isPaused ────────────────────────────────────────────
  // speechSynthesis has no reliable events for pause/resume on all browsers
  useEffect(() => {
    if (!ttsSupported) return;
    const id = setInterval(() => {
      setIsSpeaking(window.speechSynthesis.speaking);
      setIsPaused(window.speechSynthesis.paused);
    }, 100);
    return () => clearInterval(id);
  }, [ttsSupported]);

  // ── Build recognition instance ────────────────────────────────────────────
  const buildRecognition = useCallback(() => {
    if (!isSupported) return null;

    const rec = new SpeechRecognitionAPI();
    rec.lang        = lang;
    rec.continuous  = continuous;
    rec.interimResults = true;   // receive partial results as user speaks

    rec.onresult = (e: any) => {
      let interim = '';
      let finalSegment = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          finalSegment += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalSegment) {
        accumulatedRef.current += (accumulatedRef.current ? ' ' : '') + finalSegment.trim();
        setTranscript(accumulatedRef.current);
        onTranscriptRef.current?.(accumulatedRef.current);
      }
      setInterimTranscript(interim);
    };

    rec.onerror = (e: any) => {
      const msg = e.error === 'not-allowed'
        ? 'Microphone permission denied. Allow mic access in browser settings.'
        : e.error === 'no-speech'
        ? 'No speech detected. Please try again.'
        : e.error === 'network'
        ? 'Network error during recognition.'
        : `Recognition error: ${e.error}`;
      setRecognitionError(msg);
      onErrorRef.current?.(msg);
      setIsListening(false);
      setInterimTranscript('');
    };

    rec.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    return rec;
  }, [lang, continuous, isSupported]);

  // ── Voice input controls ──────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!isSupported) return;
    setRecognitionError(null);

    // Rebuild each time so lang/continuous changes take effect
    recognitionRef.current = buildRecognition();
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e: any) {
      // "already started" race condition — safe to ignore
      if (!e.message?.includes('already started')) {
        setRecognitionError(e.message || 'Could not start recognition');
      }
    }
  }, [isSupported, buildRecognition]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const clearTranscript = useCallback(() => {
    accumulatedRef.current = '';
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // ── TTS controls ──────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!ttsSupported || !text.trim()) return;

    // Cancel any in-progress speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate   = rate;
    utterance.pitch  = pitch;
    utterance.volume = volume;
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onend   = () => { setIsSpeaking(false); setIsPaused(false); };
    utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [ttsSupported, selectedVoice, rate, pitch, volume]);

  const stopSpeaking   = useCallback(() => { window.speechSynthesis.cancel(); }, []);
  const pauseSpeaking  = useCallback(() => { window.speechSynthesis.pause();  }, []);
  const resumeSpeaking = useCallback(() => { window.speechSynthesis.resume(); }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  return {
    isListening, transcript, interimTranscript,
    isSupported, startListening, stopListening,
    clearTranscript, recognitionError,
    speak, stopSpeaking, pauseSpeaking, resumeSpeaking,
    isSpeaking, isPaused, ttsSupported,
    voices, selectedVoice, setSelectedVoice,
    rate, setRate, pitch, setPitch, volume, setVolume,
  };
}
