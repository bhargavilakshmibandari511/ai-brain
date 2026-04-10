// Chat History Storage Utility
// Handles saving and loading chat messages from localStorage

interface Message {
  id: number;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  agentTrace?: Array<{
    step: string;
    agent: string;
    detail: string;
    status?: string;
  }>;
  confidence?: number;
  sourceUrl?: string;
  attachedFiles?: string[];
}

const CHAT_STORAGE_KEY = 'ai_brain_chat_history';
const MAX_MESSAGES = 500; // Prevent localStorage from growing too large

/**
 * Save chat messages to localStorage
 */
export const saveChatHistory = (messages: Message[]): void => {
  try {
    // Convert Date objects to ISO strings for JSON serialization
    const serialized = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date 
        ? msg.timestamp.toISOString() 
        : msg.timestamp,
    }));
    
    // Keep only recent messages to avoid localStorage quota issues
    const toStore = serialized.slice(-MAX_MESSAGES);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toStore));
  } catch (e) {
    // Silently fail if localStorage is full or unavailable
    console.warn('Failed to save chat history:', e);
  }
};

/**
 * Load chat messages from localStorage
 */
export const loadChatHistory = (): Message[] => {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    
    // Convert ISO strings back to Date objects
    return parsed.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (e) {
    console.warn('Failed to load chat history:', e);
    return [];
  }
};

/**
 * Clear all chat history
 */
export const clearChatHistory = (): void => {
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear chat history:', e);
  }
};

/**
 * Get chat history size (for debugging)
 */
export const getChatHistorySize = (): number => {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    return stored ? JSON.parse(stored).length : 0;
  } catch {
    return 0;
  }
};

/**
 * Export chat history as JSON (for user downloads)
 */
export const exportChatHistory = (messages: Message[]): string => {
  const serialized = messages.map(msg => ({
    ...msg,
    timestamp: msg.timestamp instanceof Date 
      ? msg.timestamp.toISOString() 
      : msg.timestamp,
  }));
  return JSON.stringify(serialized, null, 2);
};

/**
 * Import chat history from JSON
 */
export const importChatHistory = (jsonString: string): Message[] => {
  try {
    const parsed = JSON.parse(jsonString);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid format: expected array of messages');
    }
    
    return parsed.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (e) {
    console.error('Failed to import chat history:', e);
    throw e;
  }
};
