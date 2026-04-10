import React from 'react';
import { Menu, X, Brain } from 'lucide-react';

interface MobileHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  username: string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  username,
}) => {
  return (
    <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Toggle sidebar"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">AI Brain</div>
            <div className="text-[10px] text-slate-500">Offline</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-400">{username}</span>
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
          {username[0].toUpperCase()}
        </div>
      </div>
    </div>
  );
};
