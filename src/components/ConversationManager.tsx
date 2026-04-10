import React, { useState, useEffect } from 'react';
import { X, Plus, MessageSquare } from 'lucide-react';
import {
  Conversation,
  createConversation,
  loadConversations,
  saveConversations,
  deleteConversation,
  setActiveConversationId,
  getActiveConversationId,
  searchConversations,
} from '../utils/conversationManager';
import { ConversationList } from './ConversationList';

interface ConversationManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (conversation: Conversation) => void;
}

export const ConversationManager: React.FC<ConversationManagerProps> = ({
  isOpen,
  onClose,
  onSelectConversation,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadConversations();
    setConversations(loaded);
    const active = getActiveConversationId();
    setActiveId(active);
  }, [isOpen]);

  const handleNewConversation = () => {
    const newConv = createConversation('chat');
    const updated = [newConv, ...conversations];
    setConversations(updated);
    saveConversations(updated);
    setActiveId(newConv.id);
    setActiveConversationId(newConv.id);
    onSelectConversation(newConv);
    onClose();
  };

  const handleSelectConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveId(id);
      setActiveConversationId(id);
      onSelectConversation(conv);
      onClose();
    }
  };

  const handleDeleteConversation = (id: string) => {
    const updated = deleteConversation(conversations, id);
    setConversations(updated);
    saveConversations(updated);
    
    if (activeId === id) {
      const newActive = updated[0];
      if (newActive) {
        setActiveId(newActive.id);
        setActiveConversationId(newActive.id);
        onSelectConversation(newActive);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-96 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare size={20} />
            My Conversations
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-hidden">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors text-white font-medium"
          >
            <Plus size={18} />
            New Conversation
          </button>
        </div>
      </div>
    </div>
  );
};
