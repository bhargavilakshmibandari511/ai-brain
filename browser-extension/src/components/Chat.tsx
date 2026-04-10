import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Trash2, Zap, Maximize2, Search, Highlighter, Presentation, Sparkles } from 'lucide-react';
import { apiStreamUrl, getPageContent } from '../utils/api';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: number;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ChatProps {
  pendingText?: string;
  onConsumeText?: () => void;
}

export default function Chat({ pendingText, onConsumeText }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Pre-fill from widget action
  useEffect(() => {
    if (pendingText) {
      setInput(pendingText);
      onConsumeText?.();
      textareaRef.current?.focus();
    }
  }, [pendingText]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isProcessing) return;

    const userMsg: Message = {
      id: Date.now(),
      type: 'user',
      content: text,
      timestamp: new Date(),
    };

    const aiMsg: Message = {
      id: Date.now() + 1,
      type: 'ai',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      const res = await fetch(apiStreamUrl('/api/chat/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'extension-user',
          message: text,
          agent_mode: agentMode,
          temperature: 0.7,
          max_tokens: 512,
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body!.getReader();
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
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsg.id ? { ...m, content: m.content + payload.token } : m
                )
              );
            }
            if (payload.done) {
              setMessages((prev) =>
                prev.map((m) => (m.id === aiMsg.id ? { ...m, isStreaming: false } : m))
              );
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsg.id
            ? { ...m, content: `Error: ${errorMessage}`, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const askAboutPage = async () => {
    const page = await getPageContent();
    if (page.error) return;
    const context = page.selectedText || page.text?.substring(0, 3000) || '';
    setInput(`Based on this page content:\n\n"${context}"\n\nSummarize the key points.`);
    textareaRef.current?.focus();
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAgentMode(!agentMode)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              agentMode
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
            }`}
          >
            <Zap size={12} />
            Multi-Agent
          </button>
        </div>
        <div className="flex gap-1">
          <button
            onClick={askAboutPage}
            className="px-2 py-1 text-xs bg-blue-600/20 text-blue-300 rounded hover:bg-blue-600/30 transition-colors"
            title="Ask about current page"
          >
            Ask Page
          </button>
          <button
            onClick={clearChat}
            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
            title="Clear chat"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">Hi,</h2>
              <p className="text-sm text-slate-400">How can I assist you today?</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
              <button
                onClick={() => {
                  if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
                    chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
                  }
                }}
                className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 border border-slate-700/50 rounded-xl text-xs text-slate-300 hover:border-purple-500/40 hover:bg-slate-800/80 transition-all"
              >
                <Maximize2 size={14} className="text-slate-400" />
                Full Screen Chat
              </button>
              <button
                onClick={() => setInput('[Deep Research] ')}
                className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 border border-slate-700/50 rounded-xl text-xs text-slate-300 hover:border-purple-500/40 hover:bg-slate-800/80 transition-all"
              >
                <Search size={14} className="text-slate-400" />
                Deep Research
              </button>
              <button
                onClick={() => setInput('Show my highlights from this page')}
                className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 border border-slate-700/50 rounded-xl text-xs text-slate-300 hover:border-purple-500/40 hover:bg-slate-800/80 transition-all"
              >
                <Highlighter size={14} className="text-slate-400" />
                My Highlights
              </button>
              <button
                onClick={() => setInput('Create AI presentation slides about: ')}
                className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 border border-slate-700/50 rounded-xl text-xs text-slate-300 hover:border-purple-500/40 hover:bg-slate-800/80 transition-all"
              >
                <Presentation size={14} className="text-slate-400" />
                AI Slides
              </button>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.type === 'ai' && (
              <div className="w-6 h-6 rounded-full bg-purple-600/30 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={14} className="text-purple-300" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-200 border border-slate-700/50'
              }`}
            >
              {msg.type === 'ai' ? (
                <div className="markdown-body">
                  <ReactMarkdown>{msg.content || (msg.isStreaming ? '...' : '')}</ReactMarkdown>
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-purple-400 animate-pulse ml-0.5" />
                  )}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            {msg.type === 'user' && (
              <div className="w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0 mt-1">
                <User size={14} className="text-blue-300" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-slate-700/50">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask anything, @ models, / prompts"
            rows={1}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-purple-500/50"
          />
          <button
            onClick={sendMessage}
            disabled={isProcessing || !input.trim()}
            className="p-2 bg-purple-600 rounded-lg text-white hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {isProcessing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => setInput((prev) => prev ? `[Think] ${prev}` : '[Think] ')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-purple-300 hover:border-purple-500/40 transition-all"
          >
            <Sparkles size={11} />
            Think
          </button>
          <button
            onClick={() => setInput((prev) => prev ? `[Deep Research] ${prev}` : '[Deep Research] ')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-blue-300 hover:border-blue-500/40 transition-all"
          >
            <Search size={11} />
            Deep Research
          </button>
        </div>
      </div>
    </div>
  );
}
