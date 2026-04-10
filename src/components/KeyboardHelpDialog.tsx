import React from 'react';
import { X } from 'lucide-react';
import { getShortcutDisplay } from '../hooks/useKeyboardShortcuts';

interface KeyboardHelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: 'Ctrl + Enter', action: 'Send message', mac: '⌘ + Enter' },
  { keys: 'Ctrl + K', action: 'Search conversations', mac: '⌘ + K' },
  { keys: 'Ctrl + N', action: 'New conversation', mac: '⌘ + N' },
  { keys: 'Ctrl + Shift + S', action: 'Export chat history', mac: '⌘ + ⇧ + S' },
  { keys: '?', action: 'Show this help menu', mac: '?' },
  { keys: 'Ctrl + L', action: 'Focus input', mac: '⌘ + L' },
];

export const KeyboardHelpDialog: React.FC<KeyboardHelpDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">⌨️ Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {shortcuts.map((shortcut, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <div className="flex gap-2 items-center flex-shrink-0">
                {(isMac ? shortcut.mac : shortcut.keys).split(' ').map((part, i) => (
                  <span key={i}>
                    {part !== '+' && (
                      <kbd className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs font-mono text-slate-200">
                        {part}
                      </kbd>
                    )}
                    {part === '+' && <span className="text-slate-500 text-xs">+</span>}
                  </span>
                ))}
              </div>
              <span className="text-sm text-slate-400 text-right">{shortcut.action}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50">
          <p className="text-xs text-slate-500 text-center">
            Use <kbd className="px-1 py-0.5 bg-slate-700 rounded text-[10px] font-mono">?</kbd> anytime to show this menu
          </p>
        </div>
      </div>
    </div>
  );
};
