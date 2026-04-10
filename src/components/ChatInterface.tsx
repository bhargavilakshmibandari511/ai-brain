import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Paperclip, Bot,
  Copy, Star, Check, Globe, Zap,
  ChevronDown, ChevronRight, Brain,
  FileText, X, Upload, Trash2
} from 'lucide-react';
import { getCurrentMode, getApiKey } from '../utils/modeHelper';
import { saveChatHistory, loadChatHistory, clearChatHistory } from '../utils/chatStorage';
import { VoiceBar } from './VoiceBar';
import { VoiceMessage } from './VoiceMessage';

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode = 'chat' | 'summarize';

interface AgentTrace {
  step: string;
  agent: string;
  detail: string;
  status?: string;
}

interface Message {
  id: number;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  agentTrace?: AgentTrace[];
  confidence?: number;
  sourceUrl?: string;
  attachedFiles?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MODES: { id: Mode; label: string; icon: React.ElementType; placeholder: string }[] = [
  { id: 'chat',      label: 'Chat',       icon: Brain,  placeholder: 'Ask me anything... or upload a PDF to chat with it' },
  { id: 'summarize', label: 'Summarize',  icon: Globe,  placeholder: 'Paste a URL (webpage or YouTube)...' },
];

const API = 'http://localhost:8000';

// ─── Component ────────────────────────────────────────────────────────────────
export const ChatInterface: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{"id":"anonymous","username":"Guest"}');

  const [mode, setMode] = useState<Mode>('chat');
  
  // Initialize messages from localStorage or use default greeting
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = loadChatHistory();
    if (stored.length > 0) {
      return stored;
    }
    // Default greeting if no history exists
    return [
      {
        id: 1,
        type: 'ai',
        content: "Hello! I'm your offline AI assistant. You can:\n• 💬 Chat with me about anything\n• 📄 Upload PDFs/docs and ask questions about them\n• 🔗 Summarize any URL or YouTube video\n• 🎙️ Use voice input (click the mic)\n\nAll processing is local and private. How can I help?",
        timestamp: new Date(),
      },
    ];
  });
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [expandedTraces, setExpandedTraces] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-save chat history whenever messages change
  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const addAIMessage = useCallback((content: string, extra?: Partial<Message>) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'ai',
      content,
      timestamp: new Date(),
      ...extra,
    }]);
  }, []);

  // ── File Staging (NOT immediate processing) ───────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const allowed = ['.pdf', '.txt', '.md', '.doc', '.docx', '.csv', '.png', '.jpg', '.jpeg', '.webp'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      addAIMessage(`⚠️ File type "${ext}" may not be supported. Supported: ${allowed.join(', ')}`);
    }
    setStagedFiles(prev => {
      if (prev.find(f => f.name === file.name)) return prev; // dedup
      return [...prev, file];
    });
  }, [addAIMessage]);

  const removeStagedFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ── Send Handler ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if ((!trimmedInput && stagedFiles.length === 0) || isProcessing) return;

    const currentInput = trimmedInput;
    const currentFiles = [...stagedFiles];

    // Separate images from documents
    const imageFiles = currentFiles.filter(f => f.type.startsWith('image/'));
    const docFiles = currentFiles.filter(f => !f.type.startsWith('image/'));

    // Build display message
    const userMsg: Message = {
      id: Date.now(),
      type: 'user',
      content: currentInput || `📎 ${currentFiles.map(f => f.name).join(', ')}`,
      timestamp: new Date(),
      attachedFiles: currentFiles.map(f => f.name),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStagedFiles([]);
    setIsProcessing(true);

    try {
      // ── Summarize Mode ──────────────────────────────────────────────────────
      if (mode === 'summarize' && currentFiles.length === 0) {
        const isURL = currentInput.startsWith('http');
        const res = await fetch(
          isURL ? `${API}/api/summarize/url` : `${API}/api/summarize/text`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(isURL ? { url: currentInput } : { text: currentInput, mode: 'general' }),
          }
        );
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        addAIMessage(data.summary || data.error || 'Could not summarize. Please try again.');
        return;
      }

      // ── File Upload + RAG ───────────────────────────────────────────────────
      let docIds: string[] = [];
      if (docFiles.length > 0) {
        const streamingUploadId = Date.now() + 1;
        setMessages(prev => [...prev, {
          id: streamingUploadId,
          type: 'ai',
          content: `⏳ Uploading and indexing ${docFiles.length} file(s) for RAG...`,
          timestamp: new Date(),
        }]);

        for (const file of docFiles) {
          setUploadStatus(`Uploading ${file.name}...`);
          const formData = new FormData();
          formData.append('file', file);
          try {
            const uploadRes = await fetch(`${API}/api/documents/upload`, {
              method: 'POST',
              body: formData,
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              const docId = uploadData.id || uploadData.document_id;
              if (docId) docIds.push(docId);
            }
          } catch {
            // continue even if one file fails
          }
        }
        setUploadStatus('');

        // Remove the upload indicator message
        setMessages(prev => prev.filter(m => m.id !== streamingUploadId));

        if (docIds.length === 0 && docFiles.length > 0) {
          addAIMessage('⚠️ Files could not be uploaded. Make sure the backend is running. I\'ll answer using general knowledge instead.');
        }
      }

      // ── RAG Chat (with docs) or Regular Chat ───────────────────────────────
      const streamingId = Date.now() + 2;
      setMessages(prev => [...prev, {
        id: streamingId,
        type: 'ai',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }]);

      const messageToSend = currentInput || `Summarize the uploaded file(s): ${currentFiles.map(f => f.name).join(', ')}`;

      let imageB64: string | undefined;
      if (imageFiles.length > 0) {
        try {
          const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.includes(',') ? result.split(',')[1] : result);
            };
            reader.onerror = error => reject(error);
          });
          imageB64 = await fileToBase64(imageFiles[0]);
        } catch (err) {
          console.error("Failed to read image", err);
        }
      }

      if (docIds.length > 0) {
        // RAG endpoint — returns JSON (not streaming)
        const mode = getCurrentMode();
        const apiKey = getApiKey();
        const body = {
          user_id: user.id || 'anonymous',
          document_ids: docIds,
          message: messageToSend,
          temperature: 0.3,
          max_tokens: 2048,
          max_context_chunks: 12,
          force_mode: mode === 'online' ? 'online' : 'offline',
          api_key: mode === 'online' ? apiKey : undefined,
        };

        // Poll document processing status until completed (max 30s)
        setMessages(prev => prev.map(m =>
          m.id === streamingId
            ? { ...m, content: '📄 Processing document(s)...' }
            : m
        ));
        for (let attempt = 0; attempt < 20; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          try {
            const statusRes = await fetch(`${API}/api/documents/${docIds[0]}`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.status === 'completed') break;
              if (statusData.status === 'error') {
                addAIMessage('⚠️ Document processing failed. Please try uploading again.');
                setMessages(prev => prev.filter(m => m.id !== streamingId));
                return;
              }
              setMessages(prev => prev.map(m =>
                m.id === streamingId
                  ? { ...m, content: `📄 Indexing document (${attempt + 1}s)...` }
                  : m
              ));
            }
          } catch { /* keep polling */ }
        }

        setMessages(prev => prev.map(m =>
          m.id === streamingId
            ? { ...m, content: '🔍 Searching document for answers...' }
            : m
        ));

        const res = await fetch(`${API}/api/chat/document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error(`RAG request failed: ${res.status}`);
        const data = await res.json();
        const sources = data.sources?.length ? `\n\n📚 *Sources: ${data.sources.join(', ')}*` : '';
        setMessages(prev => prev.map(m =>
          m.id === streamingId
            ? { ...m, content: (data.response || 'No response received.') + sources, isStreaming: false }
            : m
        ));
      } else {
        // Regular streaming chat
        const mode = getCurrentMode();
        const apiKey = getApiKey();
        
        const res = await fetch(`${API}/api/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id || 'anonymous',
            message: messageToSend,
            agent_mode: agentMode,
            image_b64: imageB64,
            temperature: 0.7,
            max_tokens: 512,
            force_mode: mode === 'online' ? 'online' : 'offline',
            api_key: mode === 'online' ? apiKey : undefined,
          }),
        });

        if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.token) {
                setMessages(prev => prev.map(m =>
                  m.id === streamingId ? { ...m, content: m.content + payload.token } : m
                ));
              }
              if (payload.done || payload.error) {
                setMessages(prev => prev.map(m =>
                  m.id === streamingId ? { ...m, isStreaming: false } : m
                ));
              }
            } catch { /* skip malformed */ }
          }
        }
        // Make sure streaming state is cleared
        setMessages(prev => prev.map(m =>
          m.id === streamingId ? { ...m, isStreaming: false } : m
        ));
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      addAIMessage(`❌ Error: ${errMsg}\n\n💡 Make sure the backend is running:\n\`\`\`\ncd backend\n.\\venv\\Scripts\\python.exe run.py\n\`\`\``);
    } finally {
      setIsProcessing(false);
      setUploadStatus('');
    }
  }, [input, mode, isProcessing, agentMode, stagedFiles, user.id, addAIMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const copyToClipboard = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const saveToWisebase = (content: string) => {
    const entries = JSON.parse(localStorage.getItem('wisebase') || '[]');
    entries.unshift({ id: Date.now(), content, savedAt: new Date().toISOString(), tags: [] });
    localStorage.setItem('wisebase', JSON.stringify(entries.slice(0, 200)));
  };

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear the chat history? This cannot be undone.')) {
      clearChatHistory();
      setMessages([
        {
          id: Date.now(),
          type: 'ai',
          content: "Chat history cleared. Starting fresh! 🎉\n\nYou can:\n• 💬 Chat with me about anything\n• 📄 Upload PDFs/docs and ask questions about them\n• 🔗 Summarize any URL or YouTube video\n• 🎙️ Use voice input (click the mic)",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const currentMode = MODES.find(m => m.id === mode)!;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-950">

      {/* ── Mode Tab Bar ── */}
      <div className="flex items-center gap-1 px-4 py-3 bg-slate-900/80 border-b border-slate-800 backdrop-blur pl-14">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              mode === id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setAgentMode(p => !p)}
            title={agentMode ? 'Multi-Agent ON — click to disable' : 'Enable Multi-Agent System'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              agentMode
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-slate-500 hover:text-slate-300 border border-slate-700'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            {agentMode ? 'Multi-Agent ON' : 'Multi-Agent'}
          </button>

          <button
            onClick={handleClearChat}
            title="Clear chat history"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-slate-500 hover:text-red-400 border border-slate-700 hover:border-red-500/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Summarize Info Bar ── */}
      {mode === 'summarize' && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-900/20 border-b border-blue-800/30">
          <Globe className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-xs text-blue-300">Paste a URL (webpage or YouTube) or text to summarize key insights</span>
        </div>
      )}

      {/* ── Upload Status ── */}
      {uploadStatus && (
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-900/20 border-b border-purple-800/30">
          <Upload className="w-4 h-4 text-purple-400 animate-pulse" />
          <span className="text-xs text-purple-300">{uploadStatus}</span>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>

            {msg.type === 'ai' && (
              <div className="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mt-1 shadow-md">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}

            <div className={`max-w-[78%] ${msg.type === 'user' ? 'order-first' : ''}`}>
              <div className={`px-4 py-3 rounded-2xl ${
                msg.type === 'user'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-tr-sm'
                  : 'bg-slate-800/80 backdrop-blur border border-slate-700/50 rounded-tl-sm'
              }`}>
                {/* Attached files badges */}
                {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {msg.attachedFiles.map((fname, i) => (
                      <span key={i} className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded text-[11px]">
                        <FileText className="w-3 h-3" /> {fname}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  {msg.type === 'ai' && !msg.isStreaming && (
                    <div className="self-end -mb-1 -mr-1">
                      <VoiceMessage text={msg.content} />
                    </div>
                  )}
                </div>
                {msg.isStreaming && (
                  <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-0.5 rounded-sm" />
                )}
              </div>

              {msg.type === 'ai' && !msg.isStreaming && (
                <div className="flex items-center gap-1 mt-1.5 px-1">
                  <span className="text-[10px] text-slate-600">{msg.timestamp.toLocaleTimeString()}</span>

                  <button
                    onClick={() => copyToClipboard(msg.id, msg.content)}
                    className="ml-auto p-1 rounded text-slate-600 hover:text-slate-300 transition-colors"
                    title="Copy"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  </button>

                  <button
                    onClick={() => saveToWisebase(msg.content)}
                    className="p-1 rounded text-slate-600 hover:text-yellow-400 transition-colors"
                    title="Save to Wisebase"
                  >
                    <Star className="w-3 h-3" />
                  </button>

                  {msg.agentTrace && msg.agentTrace.length > 0 && (
                    <button
                      onClick={() => {
                        setExpandedTraces(prev => {
                          const next = new Set(prev);
                          next.has(msg.id) ? next.delete(msg.id) : next.add(msg.id);
                          return next;
                        });
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-purple-400 hover:bg-slate-800 transition-colors"
                    >
                      {expandedTraces.has(msg.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {msg.agentTrace.length} agent steps
                      {msg.confidence && <span className="ml-1 opacity-70">{Math.round(msg.confidence * 100)}%</span>}
                    </button>
                  )}
                </div>
              )}

              {msg.agentTrace && expandedTraces.has(msg.id) && (
                <div className="mt-2 ml-1 border-l-2 border-purple-500/30 pl-3 space-y-1">
                  {msg.agentTrace.map((t, i) => (
                    <div key={i} className="text-[11px] text-slate-500">
                      <span className="text-purple-400 font-medium">{t.agent}</span>
                      {' — '}{t.detail}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {msg.type === 'user' && (
              <div className="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center mt-1 text-xs font-bold text-white shadow-md">
                {(user.username || 'G')[0].toUpperCase()}
              </div>
            )}
          </div>
        ))}

        {/* Professional AI Thinking Indicator */}
        {isProcessing && messages[messages.length - 1]?.type !== 'ai' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-900/30">
              <Bot className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="bg-slate-800/90 border border-slate-700/50 px-5 py-3 rounded-2xl rounded-tl-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="relative w-5 h-5">
                  <div className="absolute inset-0 border-2 border-purple-500/30 rounded-full" />
                  <div className="absolute inset-0 border-2 border-t-purple-400 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                </div>
                <span className="text-sm text-slate-300 font-medium">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ── */}
      <div className="border-t border-slate-800 bg-slate-900/60 backdrop-blur p-4">
        <div className="max-w-4xl mx-auto">
          <div
            className="relative flex flex-col gap-2 bg-slate-800/60 border border-slate-700 rounded-2xl px-4 py-3 transition-all focus-within:border-purple-500/50 focus-within:shadow-lg focus-within:shadow-purple-900/10"
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-purple-500', 'bg-purple-900/10'); }}
            onDragLeave={e => e.currentTarget.classList.remove('border-purple-500', 'bg-purple-900/10')}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-purple-500', 'bg-purple-900/10');
              Array.from(e.dataTransfer.files).forEach(handleFile);
            }}
          >
            {/* ── Voice Bar ── */}
            <div className="mb-2">
              <VoiceBar 
                onTranscript={(text) => setInput(prev => prev + (prev ? ' ' : '') + text)} 
                lastMessage={messages.filter(m => m.type === 'ai').pop()?.content}
              />
            </div>

            {/* ── Staged Files Preview ── */}
            {stagedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-700/50">
                {stagedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-lg group"
                  >
                    <FileText className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    <span className="text-xs text-purple-200 truncate max-w-[150px]">{file.name}</span>
                    <span className="text-[10px] text-slate-500 hidden group-hover:inline">
                      ({(file.size / 1024).toFixed(0)}KB)
                    </span>
                    <button
                      onClick={() => removeStagedFile(idx)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <span className="text-[11px] text-slate-500 self-center">
                  ↑ {stagedFiles.length} file{stagedFiles.length > 1 ? 's' : ''} ready — type a question or just press Send
                </span>
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* File Attach */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-slate-500 hover:text-purple-400 transition-colors flex-shrink-0 mb-1"
                title="Attach Document or Image"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.txt,.md,.doc,.docx,.csv,.png,.jpg,.jpeg,.webp"
                onChange={e => {
                  Array.from(e.target.files || []).forEach(handleFile);
                  e.target.value = '';
                }}
              />

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  stagedFiles.length > 0
                    ? 'Ask a question about the uploaded file(s)...'
                    : currentMode.placeholder
                }
                rows={1}
                className="flex-1 bg-transparent text-white placeholder-slate-500 resize-none focus:outline-none text-sm leading-relaxed"
              />

              {/* Voice button removed — VoiceBar is now used above */}

              {/* Send */}
              <button
                onClick={handleSend}
                disabled={(!input.trim() && stagedFiles.length === 0) || isProcessing}
                className={`flex-shrink-0 p-2 rounded-xl transition-all ${
                  (input.trim() || stagedFiles.length > 0) && !isProcessing
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-900/40 active:scale-95'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
                title="Send (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-[10px] text-slate-600">
              {mode === 'summarize'
                ? 'Paste URL or text • Press Enter to send'
                : 'Shift+Enter for new line · Drag & drop files · Enter to send'}
            </p>
            <span className="text-[10px] text-slate-600">
              {agentMode ? '⚡ Multi-Agent' : '🤖 Direct LLM'} · 🔒 Local & Private
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
