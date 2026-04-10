import { MessageSquare, Settings as SettingsIcon, ChevronLeft, ChevronRight, Brain, PenTool, Languages, LayoutGrid, FileText, LogOut, Globe, Scan, Sparkles } from 'lucide-react';
import { ViewType } from '../App';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentView: ViewType;
  onViewChange: (v: ViewType) => void;
  onLogout: () => void;
  username: string;
}

interface NavItem {
  view: ViewType;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { view: 'chat', label: 'AI Chat', icon: MessageSquare },
  { view: 'ocr', label: 'OCR Reader', icon: Scan },
  { view: 'documents', label: 'Documents', icon: FileText },
  { view: 'webcreator', label: 'Web Creator', icon: Globe },
  { view: 'write', label: 'Write', icon: PenTool },
  { view: 'imagegen', label: 'Prompt Generator', icon: Sparkles },
  { view: 'translate', label: 'Translate', icon: Languages },
  { view: 'tools', label: 'Tools', icon: LayoutGrid },
  { view: 'settings', label: 'Settings', icon: SettingsIcon },
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed, 
  onToggle, 
  currentView, 
  onViewChange,
  onLogout,
  username
}) => {
  return (
    <aside
      className={`flex flex-col h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-800 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Brain className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="text-sm font-bold text-white leading-tight">AI Brain</div>
            <div className="text-[10px] text-slate-500">Offline · Private</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ icon: Icon, label, view }) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            title={collapsed ? label : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
              currentView === view
                ? 'bg-gradient-to-r from-purple-600/30 to-blue-600/20 text-white border border-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{label}</span>}
          </button>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="mt-auto p-2 space-y-1">
        {!collapsed && (
          <div className="px-3 py-2 mb-1 flex items-center gap-3 bg-slate-800/50 rounded-xl overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {username[0].toUpperCase()}
            </div>
            <span className="text-xs font-medium text-slate-300 truncate">{username}</span>
          </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
        
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-3 py-2.5 border-t border-slate-800 text-slate-500 hover:text-white hover:bg-slate-800 transition-colors ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-sm font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
};
