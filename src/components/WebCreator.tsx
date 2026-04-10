import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, ChevronRight, ChevronLeft, Monitor, Smartphone, 
  History, Share2, Zap, Brain, Sparkles, Box, Eye,
  Settings, User, ExternalLink, X, Wand2, Layout, Palette, Code, Download, Trash2, Layers,
  Image as ImageIcon, Rocket, MessageSquare, Send, Undo2, ChevronDown
} from 'lucide-react';

const API = 'http://127.0.0.1:8001';

interface Project {
  id: string;
  name: string;
  domain: string | null;
  created_at: string;
}

interface Page {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  html: string;
  css: string;
  js: string;
  thought_process: string;
  style_tokens: Record<string, string>;
  status: string;
  updated_at: string;
}

interface Asset {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
  size: number;
}

interface ChatMsg {
  id: number;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  scope?: string;
}

interface PageSnapshot {
  id: number;
  html: string;
  css: string;
  js: string;
  timestamp: Date;
  label: string;
}

const GEN_STEPS = [
  'Initializing Engine',
  'Neural Mapping',
  'Visual Synthesis',
  'Logic Assembly',
  'Pixel Polishing',
  'Structure Audit',
  'Materializing',
];

export const WebCreator: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [prompt, setPrompt] = useState('');
  const [refineInstruction, setRefineInstruction] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentPage, setCurrentPage] = useState<Page | null>(null);

  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  type EditorTab = 'preview' | 'html' | 'css' | 'js' | 'assets';
  const [editorTab, setEditorTab] = useState<EditorTab>('preview');
  const [showAIThoughts, setShowAIThoughts] = useState(true);
  const [refineScope, setRefineScope] = useState<'all' | 'html' | 'css' | 'js'>('all');
  const [isSimulationMode, setIsSimulationMode] = useState(true);
  const [projectAssets, setProjectAssets] = useState<Asset[]>([]);

  // Chat history for AI design chat
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Version history
  const [versionHistory, setVersionHistory] = useState<PageSnapshot[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Generation step tracking
  const [genStep, setGenStep] = useState(0);
  const genInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API}/api/web-creator/projects`);
      if (res.ok) {
        const data = await res.json();
        setMyProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const openProject = async (project: Project) => {
    setCurrentProject(project);
    setView('editor');
    setIsGenerating(true);
    try {
      const res = await fetch(`${API}/api/web-creator/projects/${project.id}/pages`);
      if (res.ok) {
        const pages = await res.json();
        if (pages.length > 0) {
          const pageRes = await fetch(`${API}/api/web-creator/pages/${pages[0].id}`);
          if (pageRes.ok) {
            setCurrentPage(await pageRes.json());
          }
        } else {
          setCurrentPage(null);
        }
        await fetchAssets(project.id);
      }
    } catch (error) {
      console.error('Failed to load project pages:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setView('editor');
    setCurrentProject(null);
    setCurrentPage(null);
    setGenStep(0);

    // Start step animation
    genInterval.current = setInterval(() => {
      setGenStep(prev => (prev < GEN_STEPS.length - 1 ? prev + 1 : prev));
    }, 1800);

    try {
      const projectName = prompt.split(' ').slice(0, 4).join(' ') + (prompt.split(' ').length > 4 ? '...' : '');
      const projRes = await fetch(`${API}/api/web-creator/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName })
      });
      const project = await projRes.json();
      setCurrentProject(project);

      const res = await fetch(`${API}/api/web-creator/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          style: isSimulationMode ? 'immersive-simulation' : 'modern', 
          project_id: project.id 
        }),
      });

      if (res.ok) {
        const page = await res.json();
        setCurrentPage(page);
        setChatHistory([{ id: Date.now(), role: 'ai', content: `✨ Site generated from prompt: "${prompt}". You can now refine it using the chat below.`, timestamp: new Date() }]);
        setVersionHistory([{ id: Date.now(), html: page.html, css: page.css, js: page.js, timestamp: new Date(), label: 'Initial Generation' }]);
        fetchProjects();
      }
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      if (genInterval.current) clearInterval(genInterval.current);
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!refineInstruction.trim() || !currentPage || isGenerating) return;

    // Save snapshot before refining
    setVersionHistory(prev => [...prev, {
      id: Date.now(), html: currentPage.html, css: currentPage.css, js: currentPage.js,
      timestamp: new Date(), label: `Before: ${refineInstruction.slice(0, 40)}`
    }]);

    // Add user message to chat
    const userMsg: ChatMsg = { id: Date.now(), role: 'user', content: refineInstruction, timestamp: new Date(), scope: refineScope };
    setChatHistory(prev => [...prev, userMsg]);
    const instruction = refineInstruction;
    setRefineInstruction('');

    setIsGenerating(true);
    try {
      const res = await fetch(`${API}/api/web-creator/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          page_id: currentPage.id, 
          instruction,
          scope: refineScope
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentPage(prev => prev ? { ...prev, ...data } : data);
        setChatHistory(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: `✅ Applied ${refineScope === 'all' ? 'full system' : refineScope} refinement: "${instruction.slice(0, 60)}"`, timestamp: new Date() }]);
      }
    } catch (error) {
      console.error('Refinement failed:', error);
      setChatHistory(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: '⚠️ Refinement failed. Please try again.', timestamp: new Date() }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const restoreVersion = (snapshot: PageSnapshot) => {
    if (!currentPage) return;
    setCurrentPage(prev => prev ? { ...prev, html: snapshot.html, css: snapshot.css, js: snapshot.js } : prev);
    setChatHistory(prev => [...prev, { id: Date.now(), role: 'ai', content: `⏪ Restored version: "${snapshot.label}"`, timestamp: new Date() }]);
  };

  const handlePublish = async () => {
    if (!currentProject) return;
    setIsPublishing(true);
    try {
      const res = await fetch(`${API}/api/web-creator/projects/${currentProject.id}/publish`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentPage(prev => prev ? { ...prev, status: 'published' } : null);
        alert(`Mission Accomplished. Simulation live at: ${data.url}`);
      }
    } catch (error) {
      console.error('Publishing failed:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to terminate this simulation? All data will be lost.')) return;
    try {
      const res = await fetch(`${API}/api/web-creator/projects/${projectId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setMyProjects(prev => prev.filter(p => p.id !== projectId));
        if (currentProject?.id === projectId) {
          setView('dashboard');
          setCurrentProject(null);
          setCurrentPage(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm('Discard this page iteration?')) return;
    try {
      const res = await fetch(`${API}/api/web-creator/pages/${pageId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (currentPage?.id === pageId) {
          setCurrentPage(null);
        }
        if (currentProject) {
           openProject(currentProject);
        }
      }
    } catch (error) {
      console.error('Failed to delete page:', error);
    }
  };

  const handleExportPage = async (pageId: string) => {
    try {
      const res = await fetch(`${API}/api/web-creator/pages/${pageId}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simulation_${pageId}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !currentProject) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', currentProject.id);

    try {
      const res = await fetch(`${API}/api/web-creator/assets/upload`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const newAsset = await res.json();
        setProjectAssets(prev => [newAsset, ...prev]);
      }
    } catch (error) {
      console.error('Asset upload failed:', error);
    }
  };

  const fetchAssets = async (projectId: string) => {
    try {
      const res = await fetch(`${API}/api/web-creator/projects/${projectId}/assets`);
      if (res.ok) {
        setProjectAssets(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    }
  };

  const dashboardView = () => (
    <div className="flex-1 overflow-y-auto relative bg-[#020617] h-full">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="relative py-24 px-6 flex flex-col items-center min-h-screen">
        <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full mb-8">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Next-Gen Simulation Engine</span>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black text-white mb-8 leading-[1] tracking-tighter">
                Dream in pixels.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 animate-gradient">Build reality.</span>
            </h1>
            
            <p className="text-slate-400 text-xl mb-14 max-w-xl mx-auto font-medium leading-relaxed">
              The only AI-native creator that transforms concepts into immersive, gamified, and simulation-ready web environments.
            </p>

            <div className="relative max-w-3xl mx-auto group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2.5rem] blur opacity-25 group-focus-within:opacity-50 transition duration-1000 group-focus-within:duration-200"></div>
                <div className="relative bg-slate-900/40 backdrop-blur-3xl rounded-[2.2rem] p-2 flex items-center border border-white/10 ring-1 ring-white/5 transition-all">
                    <div className="p-4">
                        <Wand2 className="w-6 h-6 text-blue-400" />
                    </div>
                    <input 
                        type="text" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                        placeholder="I want a futuristic portfolio with floating glass windows..." 
                        className="flex-1 bg-transparent py-5 text-white placeholder-slate-500 focus:outline-none font-bold text-lg"
                    />
                    <button 
                        onClick={handleGenerate}
                        disabled={!prompt.trim()}
                        className="bg-blue-600 hover:bg-blue-500 text-white pl-8 pr-10 py-5 rounded-[1.8rem] font-black flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-500/20 group/btn"
                    >
                        CREATE
                        <ChevronRight className="w-6 h-6 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                </div>
                
                {/* Simulation Mode Toggle */}
                <div className="mt-6 flex items-center justify-center gap-4">
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${!isSimulationMode ? 'text-blue-400' : 'text-slate-600'}`}>Standard</span>
                  <button 
                    onClick={() => setIsSimulationMode(!isSimulationMode)}
                    className="relative w-12 h-6 bg-slate-800 rounded-full border border-white/10 transition-all overflow-hidden"
                  >
                    <div className={`absolute top-1 bottom-1 w-4 rounded-full transition-all duration-300 ${isSimulationMode ? 'right-1 bg-blue-500 shadow-[0_0_10px_#3b82f6]' : 'right-7 bg-slate-600'}`} />
                  </button>
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isSimulationMode ? 'text-blue-400' : 'text-slate-600'}`}>Simulation Mode</span>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 mt-14">
                {[
                  { label: 'Quantum Portfolio', icon: '⚛️', prompt: 'A futuristic quantum-themed personal portfolio with floating glass panels, particle effects, and holographic project cards' },
                  { label: 'Neon Dashboard', icon: '🌃', prompt: 'A cyberpunk neon-lit analytics dashboard with glowing charts, dark theme, and animated data streams' },
                  { label: 'Ethereal Landing', icon: '✨', prompt: 'An ethereal, dreamy landing page with soft gradients, floating elements, and smooth scroll animations' },
                  { label: 'Cyber Store', icon: '🛡️', prompt: 'A futuristic e-commerce storefront with holographic product cards, neon accents, and immersive product views' },
                  { label: 'Glass Blog', icon: '📝', prompt: 'A glassmorphism blog with frosted glass article cards, subtle animations, and a clean reading experience' },
                  { label: 'Minimal Bio', icon: '👤', prompt: 'A minimal personal bio page with elegant typography, subtle micro-animations, and a monochrome palette' },
                  { label: 'Dark Agency', icon: '🏢', prompt: 'A dark-themed creative agency site with bold typography, scroll-triggered animations, and case study showcases' },
                  { label: 'SaaS Hero', icon: '🚀', prompt: 'A modern SaaS landing page with gradient hero, feature grid, pricing cards, and animated testimonials' },
                ].map(cat => (
                    <button 
                      key={cat.label} 
                      onClick={() => setPrompt(cat.prompt)} 
                      className="px-6 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-[11px] font-black text-slate-300 hover:bg-white/10 hover:border-white/20 hover:text-white transition-all flex items-center gap-3 uppercase tracking-[0.2em] group"
                    >
                        <span className="scale-150 group-hover:rotate-12 transition-transform">{cat.icon}</span>
                        {cat.label}
                    </button>
                ))}
            </div>
        </div>

        <div className="mt-32 w-full max-w-7xl">
          <div className="flex items-center justify-between mb-12">
              <h2 className="text-2xl font-black text-white flex items-center gap-4 tracking-tighter uppercase">
                  <span className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30"><Box className="w-5 h-5 text-blue-400" /></span>
                  DEPLOYED CONCEPTS
              </h2>
              <div className="h-[1px] flex-1 mx-12 bg-gradient-to-r from-white/10 to-transparent" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              {myProjects.length > 0 ? (
                myProjects.map((p) => (
                  <div key={p.id} onClick={() => openProject(p)} className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-600/30 to-purple-600/30 rounded-[2.5rem] blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <div className="relative bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.2rem] overflow-hidden hover:border-white/20 transition-all cursor-pointer">
                        <div className="aspect-[4/3] bg-gradient-to-br from-slate-800 to-slate-900 border-b border-white/5 flex items-center justify-center relative overflow-hidden">
                            <BoxPattern />
                            <Rocket className="w-14 h-14 text-slate-700 group-hover:text-blue-500/40 transition-all transform group-hover:scale-110 duration-700 ease-out" />
                            <div className="absolute bottom-5 left-5 bg-blue-600/20 px-4 py-1.5 rounded-full border border-blue-500/20 backdrop-blur-md">
                              <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest leading-none">ALPHA.01</span>
                            </div>
                        </div>
                        <div className="p-7">
                            <h3 className="font-extrabold text-white mb-3 tracking-tight group-hover:text-blue-400 transition-colors uppercase text-sm leading-tight">{p.name}</h3>
                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{new Date(p.created_at).toLocaleDateString()}</span>
                                <div className="flex gap-1">
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-red-400 transition-colors" title="Delete Project"><Trash2 className="w-4 h-4" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); }} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors" title="Link"><ExternalLink className="w-4 h-4" /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-32 bg-white/5 border border-dashed border-white/10 rounded-[3rem] flex flex-col items-center text-center backdrop-blur-sm">
                    <Globe className="w-16 h-16 text-slate-800 mb-8 animate-pulse" />
                    <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px]">Awaiting Core materialization</p>
                    <p className="text-slate-600 text-sm mt-4 max-w-xs mx-auto font-medium">Your immersive environments will materialize here once the simulation engine starts.</p>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );

  const editorView = () => {
    const combinedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 10px; }
            ${currentPage?.css || ''}
          </style>
        </head>
        <body style="margin:0; padding:0;">
          ${currentPage?.html || ''}
          <script>${currentPage?.js || ''}<\/script>
        </body>
      </html>
    `;

    return (
      <div className="flex-1 flex flex-col bg-[#020617] relative h-full overflow-hidden">
        <div className="h-14 backdrop-blur-3xl bg-slate-950/80 border-b border-white/5 flex items-center px-6 justify-between shrink-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('dashboard')} className="p-2.5 hover:bg-white/5 rounded-2xl text-slate-400 transition-colors border border-white/5 bg-white/5">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="h-6 w-[1px] bg-white/10" />
            <div>
              <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{currentProject?.name || 'INITIALIZING ENGINE...'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]" />
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.25em] leading-none">
                  SECURE CHANNEL • {currentPage?.status === 'published' ? 'SYNCED' : 'LIVE DRAFT'}
                </span>
              </div>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 backdrop-blur-3xl shadow-2xl">
            {(['preview', 'html', 'css', 'js', 'assets'] as const).map((tab) => {
              const icons = {
                preview: <Eye className="w-4 h-4" />,
                html: <Code className="w-4 h-4" />,
                css: <Palette className="w-4 h-4" />,
                js: <Zap className="w-4 h-4" />,
                assets: <ImageIcon className="w-4 h-4" />
              };
              return (
                <button 
                  key={tab}
                  onClick={() => setEditorTab(tab)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 uppercase tracking-tighter ${editorTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                  {icons[tab as keyof typeof icons]}
                  <span className="hidden lg:inline">{tab}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
              <button onClick={() => setPreviewMode('desktop')} className={`p-2 rounded-lg transition-all ${previewMode === 'desktop' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Monitor className="w-4 h-4" /></button>
              <button onClick={() => setPreviewMode('mobile')} className={`p-2 rounded-lg transition-all ${previewMode === 'mobile' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Smartphone className="w-4 h-4" /></button>
            </div>
            
            <div className="h-6 w-[1px] bg-white/10" />
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => currentPage && handleExportPage(currentPage.id)}
                className="p-2.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all border border-white/5"
                title="Export HTML"
              >
                <Download className="w-5 h-5" />
              </button>
              <button 
                onClick={() => currentPage && handleDeletePage(currentPage.id)}
                className="p-2.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-red-400 transition-all border border-white/5"
                title="Discard Iteration"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <button 
              onClick={handlePublish}
              disabled={isPublishing || !currentProject || !currentPage}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-[1.2rem] text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isPublishing ? 'SYNCING...' : 'PUBLISH'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-hidden p-10 flex flex-col items-center relative">
            <div className="absolute top-[10%] left-[20%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
            
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
                <div className="relative mb-10">
                  <div className="absolute inset-2 bg-blue-500 rounded-[2.5rem] blur-3xl opacity-20 animate-pulse" />
                  <div className="w-28 h-28 bg-blue-600/10 rounded-[3rem] border border-blue-500/20 flex items-center justify-center relative backdrop-blur-2xl shadow-inner shadow-white/5">
                    <Zap className="w-12 h-12 text-blue-400" />
                  </div>
                </div>
                <h2 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase">Assembling Simulation</h2>
                <div className="w-80 space-y-2 mt-6">
                  {GEN_STEPS.map((step, i) => (
                    <div key={step} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-500 ${i < genStep ? 'opacity-40' : i === genStep ? 'bg-blue-600/10 border border-blue-500/20' : 'opacity-15'}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-[8px] font-black transition-all ${i < genStep ? 'bg-blue-600 border-blue-600 text-white' : i === genStep ? 'border-blue-500 text-blue-400 animate-pulse' : 'border-white/10 text-slate-700'}`}>
                        {i < genStep ? '✓' : i + 1}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${i === genStep ? 'text-blue-400' : 'text-slate-500'}`}>{step}</span>
                      {i === genStep && <div className="ml-auto w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                    </div>
                  ))}
                </div>
                <div className="w-80 h-1 bg-white/5 rounded-full mt-8 overflow-hidden border border-white/5">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-700" style={{ width: `${((genStep + 1) / GEN_STEPS.length) * 100}%` }} />
                </div>
              </div>
            ) : !currentPage ? (
              <div className="flex-1 flex items-center justify-center text-slate-800 font-black uppercase tracking-[0.5em] text-[10px]">
                Awaiting Materialization
              </div>
            ) : (
              <div className={`flex-1 flex flex-col bg-white rounded-[2.8rem] shadow-[0_40px_100px_rgba(0,0,0,0.6)] overflow-hidden border border-white/5 transition-all duration-1000 ease-[cubic-bezier(0.23, 1, 0.32, 1)] ${previewMode === 'mobile' ? 'w-[375px]' : 'w-full'}`}>
                <div className="h-10 bg-gray-100 border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">
                  <div className="flex gap-1.5 opacity-30">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                  </div>
                  <div className="flex-1 bg-white/50 h-5.5 rounded-md border border-gray-200 flex items-center px-3 text-[8px] text-gray-400 font-black uppercase tracking-[0.2em] overflow-hidden">
                    simulation.nexus/{currentProject?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'active'}
                  </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                  {editorTab === 'preview' ? (
                    <iframe 
                      srcDoc={combinedHtml}
                      title="Preview"
                      className="w-full h-full border-none bg-white"
                      sandbox="allow-scripts allow-popups"
                    />
                  ) : editorTab === 'assets' ? (
                    <div className="p-12 h-full overflow-auto bg-slate-50">
                      <div className="flex items-center justify-between mb-12">
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">PROJECT ASSETS</h3>
                        <label className="bg-slate-900 hover:bg-black text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer transition-all active:scale-95 shadow-xl shadow-black/10">
                          UPLOAD NEW
                          <input type="file" className="hidden" onChange={handleUploadAsset} />
                        </label>
                      </div>

                      {projectAssets.length > 0 ? (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                          {projectAssets.map(asset => (
                            <div key={asset.id} className="group bg-white border border-slate-200 rounded-[2rem] overflow-hidden hover:border-blue-300 hover:shadow-2xl transition-all p-3">
                              <div className="aspect-square bg-slate-100 rounded-[1.5rem] flex items-center justify-center overflow-hidden mb-4 border border-slate-100 shadow-inner">
                                {asset.file_type.startsWith('image/') ? (
                                  <img src={`${API}${asset.file_url}`} alt={asset.filename} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="text-slate-400 uppercase font-black text-[12px] tracking-widest">{asset.filename.split('.').pop()}</div>
                                )}
                              </div>
                              <div className="px-3 pb-3">
                                <p className="text-[10px] font-black text-slate-900 truncate uppercase tracking-tight" title={asset.filename}>{asset.filename}</p>
                                <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-50">
                                  <span className="text-[9px] font-black text-slate-400 uppercase">{(asset.size / 1024).toFixed(1)} KB</span>
                                  <button onClick={() => { navigator.clipboard.writeText(asset.file_url); alert('COPIED!'); }} className="p-2 hover:bg-slate-50 rounded-xl text-blue-600"><Share2 className="w-4 h-4" /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-center opacity-20">
                          <Layout className="w-16 h-16 text-slate-900 mb-6" />
                          <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.5rem]">Empty Vault</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-10 bg-[#0a0a0f] h-full overflow-auto text-[11px] font-mono leading-relaxed selection:bg-blue-900/40">
                      {editorTab === 'html' && (
                        <>
                          <div className="mb-8 opacity-40 font-black tracking-[0.4em] text-[9px] text-blue-400 uppercase">// STRUCTURE MODULE</div>
                          <div className="text-blue-100/80 whitespace-pre">{currentPage?.html}</div>
                        </>
                      )}
                      {editorTab === 'css' && (
                        <>
                          <div className="mb-8 opacity-40 font-black tracking-[0.4em] text-[9px] text-purple-400 uppercase">// STYLING KERNEL</div>
                          <div className="text-purple-100/80 whitespace-pre">{currentPage?.css}</div>
                        </>
                      )}
                      {editorTab === 'js' && (
                        <>
                          <div className="mb-8 opacity-40 font-black tracking-[0.4em] text-[9px] text-amber-400 uppercase">// INTERACTION BUS</div>
                          <div className="text-amber-100/80 whitespace-pre">{currentPage?.js}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={`${showAIThoughts ? 'w-[380px]' : 'w-0'} bg-slate-950/80 backdrop-blur-3xl border-l border-white/5 flex flex-col transition-all duration-500 overflow-hidden shrink-0`}>
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Design Chat</h3>
                  <div className="text-[7px] font-extrabold text-blue-500 tracking-[0.3em] mt-0.5 uppercase">LIVE · {chatHistory.length} messages</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setShowHistory(h => !h)} className={`p-2 rounded-xl transition-all ${showHistory ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/5 text-slate-500'}`} title="Version History">
                  <History className="w-4 h-4" />
                </button>
                <button onClick={() => setShowAIThoughts(false)} className="p-2 hover:bg-white/10 rounded-xl text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Version History Panel (collapsible) */}
            {showHistory && versionHistory.length > 0 && (
              <div className="border-b border-white/5 bg-slate-900/50 max-h-52 overflow-y-auto">
                <div className="px-4 py-2">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em]">Snapshots ({versionHistory.length})</span>
                </div>
                {versionHistory.map((snap, i) => (
                  <button key={snap.id} onClick={() => restoreVersion(snap)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-all text-left group">
                    <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-[9px] font-black text-slate-500 group-hover:text-blue-400 group-hover:border-blue-500/30">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-300 truncate group-hover:text-white">{snap.label}</p>
                      <p className="text-[8px] text-slate-600 font-bold">{snap.timestamp.toLocaleTimeString()}</p>
                    </div>
                    <Undo2 className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-blue-400 transition-all" />
                  </button>
                ))}
              </div>
            )}

            {/* Multi-Agent Creator Pipeline */}
            <div className="px-5 py-4 border-b border-white/5 bg-slate-950/40">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Creator Pipeline</span>
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">v2.0.0 Active</span>
              </div>
              <div className="flex justify-between items-center relative">
                <div className="absolute left-0 right-0 h-0.5 bg-white/5 top-1/2 -translate-y-1/2 z-0" />
                {[
                  { id: 'arch', label: 'Architect', icon: <Box className="w-3 h-3" /> },
                  { id: 'dsgn', label: 'Designer', icon: <Palette className="w-3 h-3" /> },
                  { id: 'eng', label: 'Engineer', icon: <Code className="w-3 h-3" /> },
                  { id: 'qa', label: 'QA', icon: <Shield className="w-3 h-3" /> },
                ].map((a, i) => (
                  <div key={a.id} className="relative z-10 flex flex-col items-center gap-2 group">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-700 ${
                      isGenerating && i === Math.floor(genStep / 2)
                        ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110'
                        : isGenerating && i < Math.floor(genStep / 2) || (!isGenerating && currentPage)
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-900 border-white/10 text-slate-600'
                    }`}>
                      {a.icon}
                    </div>
                    <span className={`text-[7px] font-black uppercase tracking-widest ${
                      isGenerating && i === Math.floor(genStep / 2) ? 'text-blue-400' : 'text-slate-600'
                    }`}>{a.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Thought Process (collapsed) */}
            {currentPage?.thought_process && (
              <details className="border-b border-white/5 group">
                <summary className="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors">
                  <Brain className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex-1">AI Reasoning</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-600 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-4">
                  <div className="bg-white/5 rounded-xl p-4 border-l-2 border-blue-500">
                    <p className="text-[11px] text-slate-400 leading-6 whitespace-pre-wrap">{currentPage.thought_process}</p>
                  </div>
                </div>
              </details>
            )}

            {/* Style Tokens (collapsed) */}
            {currentPage?.style_tokens && Object.keys(currentPage.style_tokens).length > 0 && (
              <details className="border-b border-white/5 group">
                <summary className="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors">
                  <Palette className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex-1">Design Tokens</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-600 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-4 grid grid-cols-2 gap-2">
                  {Object.entries(currentPage.style_tokens).slice(0, 8).map(([key, value]) => (
                    <div key={key} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
                      {typeof value === 'string' && value.startsWith('#') ? (
                        <div className="w-8 h-8 rounded-lg shrink-0 border border-white/10" style={{ backgroundColor: value }} />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><Palette className="w-4 h-4 text-slate-500" /></div>
                      )}
                      <div className="min-w-0">
                        <div className="text-[7px] font-black text-slate-600 uppercase truncate">{key.replace('_', ' ')}</div>
                        <div className="text-[9px] font-black text-white tabular-nums">{String(value).substring(0, 7)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {chatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-40">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                    <MessageSquare className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">No Design Directives</p>
                  <p className="text-[9px] text-slate-700 max-w-[200px]">Command the AI to refine your immersive environment.</p>
                </div>
              ) : (
                chatHistory.map(msg => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                      msg.role === 'user' 
                        ? 'bg-slate-800 border-white/10 text-slate-400' 
                        : 'bg-blue-600/10 border-blue-500/20 text-blue-400 animate-in zoom-in duration-300'
                    }`}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    </div>
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[11px] leading-relaxed shadow-sm transition-all ${
                      msg.role === 'user'
                        ? 'bg-slate-800/80 text-white rounded-tr-none border border-white/5'
                        : 'bg-blue-600/10 text-slate-300 border border-blue-500/20 rounded-tl-none'
                    }`}>
                      {msg.scope && msg.role === 'user' && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[7px] font-black uppercase tracking-widest border border-blue-500/30">Target: {msg.scope}</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                      <div className="flex items-center justify-between mt-2 opacity-30">
                        <span className="text-[7px] font-black uppercase tracking-widest">{msg.role === 'ai' ? 'Orchestrator' : 'User'}</span>
                        <span className="text-[7px] tabular-nums font-bold">{msg.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isGenerating && view === 'editor' && (
                <div className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Brain className="w-4 h-4 text-blue-400 animate-spin-slow" />
                  </div>
                  <div className="bg-blue-600/5 border border-blue-500/10 rounded-2xl rounded-tl-none px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Scope Selector + Input */}
            <div className="p-4 border-t border-white/5 bg-slate-950/60 shrink-0">
              <div className="flex gap-1.5 mb-3 overflow-x-auto">
                {[
                  { id: 'all', label: 'All', icon: <Layers className="w-3 h-3" /> },
                  { id: 'html', label: 'HTML', icon: <Layout className="w-3 h-3" /> },
                  { id: 'css', label: 'CSS', icon: <Palette className="w-3 h-3" /> },
                  { id: 'js', label: 'JS', icon: <Zap className="w-3 h-3" /> },
                ].map(s => (
                  <button key={s.id} onClick={() => setRefineScope(s.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${refineScope === s.id ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'}`}>
                    {s.icon}{s.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={refineInstruction}
                  onChange={e => setRefineInstruction(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRefine()}
                  placeholder="Describe changes…"
                  disabled={isGenerating || !currentPage}
                  className="w-full pl-4 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-[11px] text-white focus:outline-none focus:border-blue-500/50 font-bold placeholder:text-slate-700 transition-all disabled:opacity-40"
                />
                <button onClick={handleRefine} disabled={!refineInstruction.trim() || isGenerating || !currentPage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 active:scale-90 transition-all disabled:opacity-40">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {!showAIThoughts && (
            <div className="w-14 bg-slate-950/50 backdrop-blur-3xl border-l border-white/5 flex flex-col items-center py-6 gap-6 relative z-50">
              <button onClick={() => setShowAIThoughts(true)} className="p-3 bg-blue-600 text-white rounded-xl shadow-2xl shadow-blue-500/40 transition-all active:scale-90 border border-white/20"><MessageSquare className="w-5 h-5" /></button>
              <div className="h-px w-6 bg-white/10" />
              <button onClick={() => { setShowHistory(h => !h); setShowAIThoughts(true); }} className="p-3 text-slate-600 hover:text-white transition-all"><History className="w-5 h-5" /></button>
              <button className="p-3 text-slate-600 hover:text-white transition-all mt-auto"><Settings className="w-5 h-5" /></button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#020617] font-sans selection:bg-blue-500/40 overflow-hidden text-slate-300 antialiased">
      <style>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 6s linear infinite;
        }
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>

      <div className="h-16 bg-[#020617]/40 backdrop-blur-[40px] border-b border-white/5 flex items-center px-10 justify-between shrink-0 relative z-[60]">
          <div className="flex items-center gap-5 group cursor-pointer" onClick={() => setView('dashboard')}>
              <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-2xl flex items-center justify-center p-[2px] shadow-2xl shadow-blue-500/20 group-hover:scale-105 transition-all duration-500">
                  <div className="w-full h-full bg-slate-900/40 backdrop-blur-3xl flex items-center justify-center rounded-[0.9rem]">
                    <Globe className="w-5.5 h-5.5 text-blue-400 group-hover:rotate-[360deg] transition-transform duration-1000" />
                  </div>
              </div>
              <span className="font-black text-white tracking-[-0.05em] text-2xl flex items-center gap-2">
                SIMULATION <span className="text-blue-500 text-[10px] font-black border border-blue-500/20 px-3 py-1 rounded-full uppercase tracking-[0.3em] bg-blue-500/5">Nexus</span>
              </span>
          </div>

          <div className="flex items-center gap-12">
              <nav className="hidden lg:flex items-center gap-12">
                  <button onClick={() => setView('dashboard')} className={`text-[10px] font-black transition-all uppercase tracking-[0.3em] ${view === 'dashboard' ? 'text-blue-400' : 'text-slate-600 hover:text-white'}`}>Matrix</button>
                  <button onClick={() => setView('dashboard')} className={`text-[10px] font-black transition-all uppercase tracking-[0.3em] ${view === 'dashboard' ? 'text-slate-600 hover:text-white' : 'text-slate-600 hover:text-white'}`}>Vault</button>
                  <button onClick={() => setView('dashboard')} className={`text-[10px] font-black transition-all uppercase tracking-[0.3em] ${view === 'dashboard' ? 'text-slate-600 hover:text-white' : 'text-slate-600 hover:text-white'}`}>Network</button>
              </nav>
              <div className="h-6 w-[1px] bg-white/5" />
              <div className="flex items-center gap-6">
                  <button className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-500 transition-all border border-white/5"><Settings className="w-5.5 h-5.5" /></button>
                  <div className="flex items-center gap-4 pl-2 pr-6 py-2 bg-white/5 rounded-full border border-white/5 backdrop-blur-xl">
                      <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 rounded-full flex items-center justify-center border border-white/10 shadow-2xl relative">
                          <div className="absolute inset-0 bg-blue-500 blur-lg opacity-20" />
                          <User className="w-5 h-5 text-white relative z-10" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-white leading-none uppercase tracking-wide">COMMANDER</span>
                        <span className="text-[8px] font-black text-blue-500 tracking-[0.3rem] mt-1.5 uppercase leading-none">CORE.OPERATIVE</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      {view === 'dashboard' ? dashboardView() : editorView()}
    </div>
  );
};

const BoxPattern: React.FC = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="white" strokeWidth="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);
