import React, { useState } from 'react';
import {
  X, Download, FileJson, FileText, BarChart3,
  Share2, Copy, Check,
} from 'lucide-react';
import {
  exportAsJSON, exportAsMarkdown, exportAsText,
  exportAsCSV, exportAsHTML, getConversationStats,
} from '../utils/chatExport';

interface Message {
  id: number;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  agentTrace?: Array<{ step: string; agent: string; detail: string; status?: string }>;
  confidence?: number;
  sourceUrl?: string;
  attachedFiles?: string[];
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  conversationTitle?: string;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  messages,
  conversationTitle = 'Chat History',
}) => {
  const [copied, setCopied] = useState(false);
  const stats = getConversationStats(messages);

  if (!isOpen) return null;

  const handleExport = (format: 'json' | 'markdown' | 'text' | 'csv' | 'html') => {
    switch (format) {
      case 'json':
        exportAsJSON(messages, conversationTitle);
        break;
      case 'markdown':
        exportAsMarkdown(messages, conversationTitle);
        break;
      case 'text':
        exportAsText(messages, conversationTitle);
        break;
      case 'csv':
        exportAsCSV(messages, conversationTitle);
        break;
      case 'html':
        exportAsHTML(messages, conversationTitle);
        break;
    }
    setTimeout(onClose, 500);
  };

  const copyToClipboard = () => {
    const text = messages.map(m => `${m.type === 'user' ? 'You: ' : 'AI: '}${m.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportFormats = [
    {
      id: 'json',
      name: 'JSON',
      icon: FileJson,
      description: 'Full metadata, timestamps, traces',
      use: 'Backups, data analysis',
    },
    {
      id: 'markdown',
      name: 'Markdown',
      icon: FileText,
      description: 'Readable format, good for sharing',
      use: 'Documentation, sharing',
    },
    {
      id: 'html',
      name: 'HTML',
      icon: FileText,
      description: 'Formatted web page, printable',
      use: 'Printing, archiving',
    },
    {
      id: 'csv',
      name: 'CSV',
      icon: BarChart3,
      description: 'Spreadsheet compatible format',
      use: 'Excel, data analysis',
    },
    {
      id: 'text',
      name: 'Plain Text',
      icon: FileText,
      description: 'Simple text format',
      use: 'Notes, basic storage',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full shadow-2xl max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Download size={20} />
            Export Conversation
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats */}
        <div className="p-4 border-b border-slate-700 bg-slate-900/50">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div>
              <div className="text-slate-500">Messages</div>
              <div className="font-bold text-white">{stats.totalMessages}</div>
            </div>
            <div>
              <div className="text-slate-500">Tokens ~</div>
              <div className="font-bold text-white">{stats.totalTokens.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-slate-500">Duration</div>
              <div className="font-bold text-white">{stats.durationMinutes}m</div>
            </div>
            <div>
              <div className="text-slate-500">User Msgs</div>
              <div className="font-bold text-white">{stats.userMessages}</div>
            </div>
            <div>
              <div className="text-slate-500">AI Msgs</div>
              <div className="font-bold text-white">{stats.aiMessages}</div>
            </div>
          </div>
        </div>

        {/* Export Formats */}
        <div className="p-4 space-y-2">
          {exportFormats.map(({ id, name, icon: Icon, description, use }) => (
            <button
              key={id}
              onClick={() => handleExport(id as any)}
              className="w-full flex items-start gap-3 p-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 transition-colors text-left group"
            >
              <Icon className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white">{name}</div>
                <div className="text-xs text-slate-400">{description}</div>
                <div className="text-xs text-slate-500 mt-1">💡 {use}</div>
              </div>
              <div className="text-slate-600 group-hover:text-slate-400 transition-colors">→</div>
            </button>
          ))}
        </div>

        {/* Copy to Clipboard Option */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50">
          <button
            onClick={copyToClipboard}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-white font-medium"
          >
            {copied ? (
              <>
                <Check size={18} />
                Copied to clipboard!
              </>
            ) : (
              <>
                <Copy size={18} />
                Copy All as Text
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500 space-y-1">
          <p>💾 Your data is stored locally in your browser. Export to create backups.</p>
          <p>🔒 No data leaves your device - all exports are generated locally.</p>
        </div>
      </div>
    </div>
  );
};
