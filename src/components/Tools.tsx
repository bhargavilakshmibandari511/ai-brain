import React from 'react';
import { 
  FileText, Youtube, Video, Bot, GraduationCap, Globe, Edit3, 
  Languages, Image as ImageIcon, FileSearch, Sparkles, Wand2, Paintbrush, 
  Eraser, LayoutGrid, Eye 
} from 'lucide-react';
import { ViewType } from '../App';

interface ToolCategory {
  title: string;
  items: {
    icon: React.ElementType;
    label: string;
    description: string;
    isHot?: boolean;
    isNew?: boolean;
    comingSoon?: boolean;
    action?: ViewType | string;
    color: string;
  }[];
}

interface ToolsProps {
  onNavigate: (view: ViewType) => void;
}

export const Tools: React.FC<ToolsProps> = ({ onNavigate }) => {
  const categories: ToolCategory[] = [
    {
      title: "Popular Tools",
      items: [
        { icon: FileText, label: "ChatPDF", description: "Chat with any PDF document", isHot: true, action: "chatpdf", color: "text-red-400" },
        { icon: Youtube, label: "YouTube Summarizer", description: "Get key points instantly", action: "youtube", color: "text-red-500" },
        { icon: Video, label: "AI Video Shortener", description: "Create shorts from long videos", isHot: true, comingSoon: true, color: "text-purple-400" }
      ]
    },
    {
      title: "Agents",
      items: [
        { icon: Bot, label: "Deep Research", description: "Comprehensive analysis agent", isHot: true, action: "research", color: "text-blue-400" },
        { icon: GraduationCap, label: "Scholar Research", description: "Academic paper analysis", isNew: true, action: "scholar", color: "text-indigo-400" },
        { icon: Globe, label: "Web Creator", description: "Build sites from prompts", isNew: true, action: "webcreator", color: "text-sky-400" },
        { icon: Edit3, label: "AI Essay Writer", description: "Draft essays side by side", action: "write", color: "text-indigo-500" },
        { icon: LayoutGrid, label: "AI Slides", description: "Generate presentations", isNew: true, comingSoon: true, color: "text-orange-400" }
      ]
    },
    {
      title: "Translate",
      items: [
        { icon: Languages, label: "AI Translator", description: "Native language translation", action: "translate", color: "text-blue-500" },
        { icon: ImageIcon, label: "Image Translator", description: "Translate text in images", comingSoon: true, color: "text-emerald-400" },
        { icon: FileSearch, label: "PDF Translator", description: "Translate entire PDFs", isHot: true, comingSoon: true, color: "text-rose-400" }
      ]
    },
    {
      title: "Image",
      items: [
        { icon: Sparkles, label: "Prompt Generator", description: "AI-crafted prompts for Stable Diffusion, Midjourney & more", isHot: true, action: "imagegen", color: "text-violet-400" },
        { icon: Eye, label: "Vision Chat", description: "Chat with any image — OCR, charts, UI review & more", isNew: true, action: "vlmchat", color: "text-cyan-400" },
        { icon: Eraser, label: "Background Remover", description: "Remove image backgrounds", isNew: true, action: "bgremover", color: "text-pink-400" },
        { icon: Paintbrush, label: "Background Changer", description: "Swap backgrounds instantly", comingSoon: true, color: "text-teal-400" },
        { icon: Wand2, label: "Photo Eraser", description: "Remove unwanted objects", comingSoon: true, color: "text-violet-400" }
      ]
    }
  ];

  const handleToolClick = (action?: ViewType | string, comingSoon?: boolean) => {
    if (comingSoon) {
      alert('This tool is coming soon! Stay tuned for updates.');
      return;
    }
    if (action === 'write') onNavigate('write');
    else if (action === 'translate') onNavigate('translate');
    else if (action === 'chatpdf') onNavigate('chatpdf');
    else if (action === 'youtube') onNavigate('youtube');
    else if (action === 'imagegen') onNavigate('imagegen');
    else if (action === 'vlmchat') onNavigate('vlmchat');
    else if (action === 'research') onNavigate('research');
    else if (action === 'scholar') onNavigate('scholar');
    else if (action === 'webcreator') onNavigate('webcreator');
    else if (action === 'bgremover') onNavigate('bgremover');
    else alert('This tool is a placeholder for demonstration purposes.');
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10 backdrop-blur">
        <h1 className="text-2xl font-bold text-white mb-1">Tools</h1>
        <p className="text-sm text-slate-400">Expand your capabilities with specialized AI utilities</p>
      </div>

      <div className="p-8 max-w-6xl mx-auto w-full space-y-10">
        {categories.map((category, idx) => (
          <div key={idx} className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider pl-1">
              {category.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {category.items.map((tool, i) => (
                <button
                  key={i}
                  onClick={() => handleToolClick(tool.action, tool.comingSoon)}
                  className={`flex flex-col p-5 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-slate-800/80 hover:border-slate-700 transition-all text-left group relative overflow-hidden ${tool.comingSoon ? 'opacity-75' : ''}`}
                >
                  <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-800 mb-3 group-hover:scale-110 transition-transform w-max ${tool.color}`}>
                    <tool.icon className="w-5 h-5" />
                  </div>
                  
                  <div className="w-full">
                    <h3 className="text-[13px] font-semibold text-slate-200 group-hover:text-white truncate mb-1">
                      {tool.label}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {tool.description}
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="absolute top-4 right-4 flex flex-col gap-1 items-end">
                    {tool.comingSoon && (
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Coming Soon
                      </span>
                    )}
                    {tool.isHot && !tool.comingSoon && (
                      <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                         🔥
                      </span>
                    )}
                    {tool.isNew && !tool.comingSoon && (
                      <span className="text-[9px] font-bold text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        New
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
