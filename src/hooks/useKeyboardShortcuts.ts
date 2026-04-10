import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  send?: () => void;
  search?: () => void;
  newChat?: () => void;
  export?: () => void;
  help?: () => void;
}

/**
 * Custom hook for keyboard shortcuts
 * Supports Ctrl/Cmd + Key combinations
 */
export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + Enter: Send message
      if (isCtrlOrCmd && e.key === 'Enter' && handlers.send) {
        e.preventDefault();
        handlers.send();
      }

      // Ctrl/Cmd + K: Search conversations (Command palette)
      if (isCtrlOrCmd && e.key === 'k' && handlers.search) {
        e.preventDefault();
        handlers.search();
      }

      // Ctrl/Cmd + N: New conversation
      if (isCtrlOrCmd && e.key === 'n' && handlers.newChat) {
        e.preventDefault();
        handlers.newChat();
      }

      // Ctrl/Cmd + Shift + S: Export/Save chat
      if (isCtrlOrCmd && e.shiftKey && e.key === 'S' && handlers.export) {
        e.preventDefault();
        handlers.export();
      }

      // ?: Show keyboard help
      if (e.key === '?' && handlers.help && !isCtrlOrCmd) {
        e.preventDefault();
        handlers.help();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
};

/**
 * Get keyboard shortcut display string (shows Cmd on Mac, Ctrl on Windows)
 */
export const getShortcutDisplay = (baseShortcut: string): string => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifier = isMac ? '⌘' : 'Ctrl';
  return baseShortcut.replace('Ctrl', modifier);
};
