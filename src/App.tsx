import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileHeader } from './components/MobileHeader';
import { ChatInterface } from './components/ChatInterface';
import { Wisebase } from './components/Wisebase';
import { Settings } from './components/Settings';
import { Write } from './components/Write';
import { Documents } from './components/Documents';
import { OCRReader } from './components/OCRReader';
import { Tools } from './components/Tools';
import { ChatPDF } from './components/ChatPDF';
import { YouTubeSummarizer } from './components/YouTubeSummarizer';
import { ImageGenerator } from './components/ImageGenerator';
import { WebResearcher } from './components/WebResearcher';
import { ScholarResearch } from './components/ScholarResearch';
import { WebCreator } from './components/WebCreator';
import { BackgroundRemover } from './components/BackgroundRemover';
import { Translator } from './components/Translator';
import { Auth } from './components/Auth';
import { VLMChat } from './components/VLMChat';

export type ViewType = 'chat' | 'wisebase' | 'settings' | 'write' | 'translate' | 'tools' | 'documents' | 'chatpdf' | 'youtube' | 'imagegen' | 'research' | 'scholar' | 'webcreator' | 'bgremover' | 'ocr' | 'vlmchat';

interface User {
  id: string;
  username: string;
}

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentView, setCurrentView] = useState<ViewType>('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  // Close mobile sidebar when view changes
  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    setIsMobileSidebarOpen(false);
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  const renderMain = () => {
    switch (currentView) {
      case 'wisebase': return <Wisebase />;
      case 'settings': return <Settings />;
      case 'write': return <Write />;
      case 'translate': return <Translator />;
      case 'tools': return <Tools onNavigate={setCurrentView} />;
      case 'documents': return <Documents onNavigate={setCurrentView} />;
      case 'ocr': return <OCRReader />;
      case 'chatpdf': return <ChatPDF />;
      case 'youtube': return <YouTubeSummarizer />;
      case 'imagegen': return <ImageGenerator />;
      case 'research': return <WebResearcher />;
      case 'scholar': return <ScholarResearch />;
      case 'webcreator': return <WebCreator />;
      case 'bgremover': return <BackgroundRemover />;
      case 'vlmchat': return <VLMChat />;
      default: return <ChatInterface />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden flex-col md:flex-row">
      {/* Mobile Header (visible only on mobile) */}
      <MobileHeader
        isSidebarOpen={isMobileSidebarOpen}
        onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        username={user.username}
      />

      {/* Sidebar - Hidden on mobile, always visible on desktop */}
      <div
        className={`fixed md:static inset-0 z-40 transform transition-transform duration-300 md:transform-none md:relative ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar
          collapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          currentView={currentView}
          onViewChange={handleViewChange}
          onLogout={handleLogout}
          username={user.username}
        />
      </div>

      {/* Overlay for mobile sidebar */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main key={currentView} className="flex-1 flex flex-col overflow-hidden w-full">
        {renderMain()}
      </main>
    </div>
  );
}

export default App;
