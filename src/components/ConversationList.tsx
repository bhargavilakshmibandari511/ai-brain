import React, { useState } from 'react';
import { MessageSquare, Plus, Search, X, Trash2, ChevronRight } from 'lucide-react';
import { Conversation, searchConversations } from '../utils/conversationManager';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  collapsed?: boolean;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  collapsed = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const filtered = searchQuery ? searchConversations(conversations, searchQuery) : conversations;
  const sorted = [...filtered].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Header with New Button */}
      <div className="flex items-center gap-2 px-2">
        {!collapsed && <MessageSquare className="w-4 h-4 text-slate-400" />}
        {!collapsed && <span className="text-xs font-semibold text-slate-400 uppercase">Conversations</span>}
        <button
          onClick={onNewConversation}
          title="New conversation"
          className={`ml-auto p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${
            collapsed ? 'px-2' : ''
          }`}
        >
          <Plus size={16} />
        </button>
        {!collapsed && (
          <button
            onClick={() => setShowSearch(!showSearch)}
            title="Search conversations"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Search size={16} />
          </button>
        )}
      </div>

      {/* Search Bar */}
      {showSearch && !collapsed && (
        <div className="px-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto space-y-1 px-2">
        {sorted.length === 0 ? (
          !collapsed && (
            <div className="px-3 py-4 text-center text-xs text-slate-500">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </div>
          )
        ) : (
          sorted.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer ${
                activeId === conv.id
                  ? 'bg-purple-600/20 border border-purple-500/30'
                  : 'hover:bg-slate-800 border border-transparent'
              }`}
              onClick={() => onSelectConversation(conv.id)}
              title={collapsed ? conv.title : undefined}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0 text-slate-400" />
              
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {conv.title}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {conv.messages.length} messages
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${conv.title}"?`)) {
                        onDeleteConversation(conv.id);
                      }
                    }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}

              {collapsed && activeId === conv.id && (
                <ChevronRight className="w-3 h-3 text-purple-400" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      {!collapsed && conversations.length > 0 && (
        <div className="px-3 py-2 text-xs text-slate-500 border-t border-slate-800">
          {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
        </div>
      )}
    </div>
  );
};
