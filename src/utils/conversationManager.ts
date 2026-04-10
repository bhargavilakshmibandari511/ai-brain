/**
 * Conversation Manager Utility
 * Handles multiple conversations with metadata, auto-titling, and search
 */

export interface Message {
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

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  preview: string; // First user message or AI response
  mode: 'chat' | 'summarize';
}

const CONVERSATIONS_STORAGE_KEY = 'ai_brain_conversations';
const ACTIVE_CONVERSATION_KEY = 'ai_brain_active_conversation';
const MAX_CONVERSATIONS = 100;

/**
 * Generate a title from the first user message (auto-titling)
 */
export const generateTitle = (messages: Message[]): string => {
  const userMsg = messages.find(m => m.type === 'user');
  if (!userMsg) return 'Untitled Conversation';
  
  // Use first 50 chars of first user message
  return userMsg.content.substring(0, 50).trim() + (userMsg.content.length > 50 ? '...' : '');
};

/**
 * Create a new conversation
 */
export const createConversation = (mode: 'chat' | 'summarize' = 'chat'): Conversation => {
  const now = new Date();
  return {
    id: `conv_${Date.now()}`,
    title: 'New Conversation',
    messages: [],
    createdAt: now,
    updatedAt: now,
    preview: '',
    mode,
  };
};

/**
 * Save all conversations to localStorage
 */
export const saveConversations = (conversations: Conversation[]): void => {
  try {
    const serialized = conversations.slice(-MAX_CONVERSATIONS).map(conv => ({
      ...conv,
      createdAt: conv.createdAt instanceof Date ? conv.createdAt.toISOString() : conv.createdAt,
      updatedAt: conv.updatedAt instanceof Date ? conv.updatedAt.toISOString() : conv.updatedAt,
      messages: conv.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
      })),
    }));
    localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(serialized));
  } catch (e) {
    console.warn('Failed to save conversations:', e);
  }
};

/**
 * Load all conversations from localStorage
 */
export const loadConversations = (): Conversation[] => {
  try {
    const stored = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return parsed.map((conv: any) => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: conv.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    }));
  } catch (e) {
    console.warn('Failed to load conversations:', e);
    return [];
  }
};

/**
 * Get active conversation ID
 */
export const getActiveConversationId = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_CONVERSATION_KEY);
  } catch (e) {
    return null;
  }
};

/**
 * Set active conversation ID
 */
export const setActiveConversationId = (id: string | null): void => {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    }
  } catch (e) {
    console.warn('Failed to set active conversation:', e);
  }
};

/**
 * Search conversations by query
 */
export const searchConversations = (
  conversations: Conversation[],
  query: string
): Conversation[] => {
  if (!query.trim()) return conversations;
  
  const lowerQuery = query.toLowerCase();
  return conversations.filter(conv => 
    conv.title.toLowerCase().includes(lowerQuery) ||
    conv.preview.toLowerCase().includes(lowerQuery) ||
    conv.messages.some(msg => msg.content.toLowerCase().includes(lowerQuery))
  );
};

/**
 * Get conversation by ID
 */
export const getConversationById = (
  conversations: Conversation[],
  id: string
): Conversation | undefined => {
  return conversations.find(c => c.id === id);
};

/**
 * Delete conversation
 */
export const deleteConversation = (
  conversations: Conversation[],
  id: string
): Conversation[] => {
  return conversations.filter(c => c.id !== id);
};

/**
 * Update conversation
 */
export const updateConversation = (
  conversations: Conversation[],
  id: string,
  updates: Partial<Conversation>
): Conversation[] => {
  return conversations.map(c =>
    c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
  );
};

/**
 * Auto-update conversation preview
 */
export const updateConversationPreview = (
  messages: Message[]
): string => {
  const firstMsg = messages.find(m => m.type === 'user')?.content || '';
  const lastMsg = messages[messages.length - 1]?.content || '';
  
  const preview = firstMsg || lastMsg;
  return preview.substring(0, 100).trim() + (preview.length > 100 ? '...' : '');
};

/**
 * Get conversation summary (for display)
 */
export const getConversationSummary = (conv: Conversation) => {
  return {
    ...conv,
    messageCount: conv.messages.length,
    lastMessageTime: conv.updatedAt,
    firstUserMessage: conv.messages.find(m => m.type === 'user')?.content || '',
  };
};
