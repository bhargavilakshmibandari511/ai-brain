import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2, Search, Globe, ExternalLink, Copy, Check,
  ChevronDown, Brain, Clock, Layers,
  AlertCircle, Users, BarChart3,
  Lightbulb, ArrowRight, Shield, PenTool
} from 'lucide-react';

const API = 'http://127.0.0.1:8001';

// ─── Types ────────────────────────────────────────────────
interface TraceStep {
  step: string;
  agent: string;
  detail: string;
  reasoning?: string;
  status?: string;
  duration_ms?: number;
}

interface AgentResult {
  agent_name: string;
  content: string;
  sources: string[];
  confidence: number;
  metadata: {
    trace?: TraceStep[];
    agents_used?: string[];
    execution_time?: number;
    tokens_used?: number;
    follow_up_questions?: string[];
  };
  success: boolean;
}

// 4 agents for visualisation
const AGENTS = [
  { id: 'planner', label: 'Planner', icon: <Brain className="w-4 h-4" />, color: 'blue' },
  { id: 'researcher', label: 'Researcher', icon: <Search className="w-4 h-4" />, color: 'cyan' },
  { id: 'analyzer', label: 'Analyzer', icon: <BarChart3 className="w-4 h-4" />, color: 'violet' },
  { id: 'writer', label: 'Writer', icon: <PenTool className="w-4 h-4" />, color: 'emerald' },
] as const;

type AgentStatus = 'idle' | 'active' | 'done' | 'error';

// ─── Confidence Ring ──────────────────────────────────────
const ConfidenceRing: React.FC<{ value: number; size?: number }> = ({ value, size = 80 }) => {
  const pct = Math.round(value * 100);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * pct) / 100;
  const clr = pct > 70 ? '#22c55e' : pct > 40 ? '#eab308' : '#f97316';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={clr} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-white">{pct}%</span>
        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Conf</span>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────
export const WebResearcher: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [history, setHistory] = useState<AgentResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [queryResult, setQueryResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>(
    Object.fromEntries(AGENTS.map(a => [a.id, 'idle']))
  );
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed timer during research
  useEffect(() => {
    if (isResearching) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 0.1), 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isResearching]);

  const simulateAgentProgress = () => {
    const order = ['planner', 'researcher', 'analyzer', 'writer'];
    let step = 0;
    setAgentStatuses(Object.fromEntries(AGENTS.map(a => [a.id, 'idle'])));
    setAgentStatuses(prev => ({ ...prev, [order[0]]: 'active' }));

    agentTimerRef.current = setInterval(() => {
      step++;
      if (step < order.length) {
        setAgentStatuses(prev => ({
          ...prev,
          [order[step - 1]]: 'done',
          [order[step]]: 'active',
        }));
      } else if (step === order.length) {
        setAgentStatuses(prev => ({ ...prev, [order[step - 1]]: 'done' }));
        if (agentTimerRef.current) clearInterval(agentTimerRef.current);
      }
    }, 2200);
  };

  const handleResearch = async () => {
    if (!query.trim()) return;
    setIsResearching(true);
    setResult(null);
    simulateAgentProgress();

    try {
      const params = new URLSearchParams({
        agent_name: 'Orchestrator Agent',
        query: query,
        task_type: 'research'
      });
      const res = await fetch(`${API}/api/agents/execute?${params.toString()}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const agentResult = data as AgentResult;
      setResult(agentResult);
      setQueryResult(query);
      setHistory(prev => [agentResult, ...prev]);
      // Mark all agents done
      setAgentStatuses(Object.fromEntries(AGENTS.map(a => [a.id, 'done'])));
    } catch (error) {
      setResult({
        agent_name: 'Error',
        content: `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sources: [], confidence: 0, metadata: {}, success: false,
      });
      setAgentStatuses(Object.fromEntries(AGENTS.map(a => [a.id, 'error'])));
    } finally {
      if (agentTimerRef.current) clearInterval(agentTimerRef.current);
      setIsResearching(false);
    }
  };

  const handleCopy = () => {
    if (!result?.content) return;
    navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const followUps = result?.metadata?.follow_up_questions ?? [
    `What are the latest developments in ${queryResult.split(' ').slice(0, 3).join(' ')}?`,
    `Compare different approaches to ${queryResult.split(' ').slice(0, 3).join(' ')}`,
    `What are the key challenges in this area?`,
  ];

  const statusColors: Record<AgentStatus, string> = {
    idle: 'bg-slate-800 border-slate-700 text-slate-600',
    active: 'bg-blue-950/60 border-blue-500/40 text-blue-400 shadow-[0_0_20px_-4px_rgba(59,130,246,0.3)]',
    done: 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400',
    error: 'bg-red-950/30 border-red-500/30 text-red-400',
  };

  return (
    <div className="flex h-full bg-[#030712] text-white font-sans overflow-hidden">
      {/* Sider Sidebar (History) */}
      <div className={`transition-all duration-500 border-r border-white/5 bg-slate-950/50 flex flex-col shrink-0 ${showHistory ? 'w-64' : 'w-14'}`}>
        <div className="p-3 border-b border-white/5 flex items-center justify-between overflow-hidden">
          <button onClick={() => setShowHistory(!showHistory)} 
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <Layers className={`w-4 h-4 text-slate-400 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
          </button>
          {showHistory && <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mr-2">History</span>}
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2">
          {history.map((item, i) => (
            <button key={i} onClick={() => setResult(item)}
              className={`w-full group text-left p-2.5 rounded-xl transition-all border border-transparent ${
                result === item ? 'bg-blue-600/10 border-blue-500/20' : 'hover:bg-white/5'
              }`}>
              <div className="flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${result === item ? 'bg-blue-500' : 'bg-slate-700'}`} />
                {showHistory && (
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-300 truncate leading-tight">
                      {item.content.slice(0, 30)}...
                    </p>
                    <p className="text-[8px] text-slate-600 font-medium">Research Result</p>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-white/5 bg-slate-950/80 backdrop-blur flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Globe className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-[0.15em]">Deep Research</h1>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Multi-Agent AI Research Engine</p>
            </div>
          </div>
          {isResearching && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 rounded-xl border border-blue-500/20">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]" />
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{elapsed.toFixed(1)}s</span>
            </div>
          )}
        </div>

        <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">

            {/* Query Input */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5">
              <div className="relative">
                <textarea
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleResearch())}
                  placeholder="What would you like to research?"
                  rows={2}
                  className="w-full pl-4 pr-28 py-3.5 bg-slate-800/50 border border-white/5 rounded-xl text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none leading-relaxed"
                />
                <button
                  onClick={handleResearch}
                  disabled={!query.trim() || isResearching}
                  className="absolute right-2 bottom-2.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 shadow-lg shadow-blue-600/20"
                >
                  {isResearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  {isResearching ? 'Running…' : 'Research'}
                </button>
              </div>
              <p className="text-[9px] text-slate-600 mt-2 px-1">Enter · Shift+Enter for newline</p>
            </div>

            {/* Agent Status Grid */}
            {(isResearching || result) && (
              <div className="grid grid-cols-4 gap-3">
                {AGENTS.map(agent => {
                  const st = agentStatuses[agent.id];
                  return (
                    <div key={agent.id} className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-500 ${statusColors[st]}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${st === 'active' ? 'animate-pulse' : ''}`}>
                        {agent.icon}
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest">{agent.label}</span>
                      <div className="flex items-center gap-1.5">
                        {st === 'idle' && <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                        {st === 'active' && <Loader2 className="w-3 h-3 animate-spin" />}
                        {st === 'done' && <Check className="w-3 h-3" />}
                        {st === 'error' && <AlertCircle className="w-3 h-3" />}
                        <span className="text-[8px] font-bold uppercase tracking-widest capitalize">{st}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Result Card */}
            {result && (
              <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
                {/* Result Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[11px] font-black text-white uppercase tracking-[0.15em]">Findings</h3>
                    {result.success && (
                      <span className={`px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest ${
                        result.confidence > 0.7 ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-600/30'
                        : result.confidence > 0.4 ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-600/30'
                        : 'bg-orange-900/40 text-orange-400 border border-orange-600/30'
                      }`}>
                        {Math.round(result.confidence * 100)}% conf
                      </span>
                    )}
                    {!result.success && (
                      <span className="px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest bg-red-900/40 text-red-400 border border-red-600/30">Failed</span>
                    )}
                  </div>
                  <button onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-all">
                    {copied ? <><Check className="w-3 h-3 text-green-400" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                  </button>
                </div>

                {/* Deep Metrics Bar */}
                <div className="flex items-center gap-6 px-5 py-3 border-b border-white/5 bg-slate-950/30">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
                    <Clock className="w-3 h-3" />
                    {(result.metadata?.execution_time ?? elapsed).toFixed(1)}s
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
                    <Layers className="w-3 h-3" />
                    {result.sources?.length ?? 0} sources
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
                    <Users className="w-3 h-3" />
                    {result.metadata?.agents_used?.length ?? AGENTS.length} agents
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
                    <Shield className="w-3 h-3" />
                    {result.agent_name}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <p className="text-[12.5px] text-slate-300 leading-7 whitespace-pre-wrap">{result.content}</p>
                </div>

                {/* Sources */}
                {result.sources?.length > 0 && (
                  <div className="px-5 pb-5">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-3">Sources</p>
                    <div className="space-y-1.5">
                      {result.sources.map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-800/50 border border-white/5 rounded-xl text-[11px] text-slate-400 hover:text-white hover:border-blue-500/30 transition-all group">
                          <ExternalLink className="w-3.5 h-3.5 text-blue-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                          <span className="truncate">{src}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Trace */}
                {(result.metadata?.trace?.length ?? 0) > 0 && (
                  <details className="border-t border-white/5 group">
                    <summary className="px-5 py-3 cursor-pointer flex items-center gap-2.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-slate-300 transition-colors">
                      <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                      Reasoning Trace ({result.metadata.trace?.length ?? 0} steps)
                    </summary>
                    <div className="px-5 pb-5 space-y-2.5">
                      {result.metadata.trace?.map((step, i) => (
                        <div key={i} className={`rounded-xl border p-3.5 transition-all ${
                          step.status === 'error' ? 'bg-red-950/20 border-red-600/20' : 'bg-white/[0.02] border-white/5'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-black border ${
                              step.status === 'error' ? 'bg-red-900/30 border-red-600/30 text-red-400' : 'bg-blue-900/30 border-blue-600/30 text-blue-400'
                            }`}>{i + 1}</div>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{step.agent}</span>
                            {step.status === 'error' && <span className="ml-auto text-[8px] font-black px-2 py-0.5 bg-red-900/50 text-red-400 rounded">Error</span>}
                            {step.duration_ms && <span className="ml-auto text-[8px] text-slate-600 font-bold">{step.duration_ms}ms</span>}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{step.detail}</p>
                          {step.reasoning && (
                            <details className="mt-2">
                              <summary className="text-[9px] font-bold text-blue-500/60 cursor-pointer hover:text-blue-400 transition-colors">Show reasoning</summary>
                              <p className="mt-1.5 text-[10px] text-slate-500 leading-relaxed pl-3 border-l border-blue-500/20">{step.reasoning}</p>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Smart Follow-ups */}
            {result && result.success && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Explore Further</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {followUps.slice(0, 4).map((q, i) => (
                    <button key={i} onClick={() => { setQuery(q); }}
                      className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800/50 border border-white/5 rounded-xl text-[10.5px] text-slate-400 hover:text-white hover:border-blue-500/30 hover:bg-blue-950/20 transition-all group">
                      <ArrowRight className="w-3 h-3 text-blue-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      {q.length > 60 ? q.slice(0, 60) + '…' : q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!result && !isResearching && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 bg-slate-900 border border-white/5 rounded-[2rem] flex items-center justify-center mb-6">
                  <Globe className="w-9 h-9 text-slate-700" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 mb-2">No Research Yet</h3>
                <p className="text-[11px] text-slate-600 mb-8 max-w-xs">Enter a query to deploy the multi-agent research pipeline</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    'Latest breakthroughs in quantum computing',
                    'Impact of AI on healthcare diagnostics',
                    'Sustainable energy storage innovations',
                  ].map((q, i) => (
                    <button key={i} onClick={() => setQuery(q)}
                      className="px-4 py-2.5 bg-slate-800/50 border border-white/5 rounded-xl text-[10.5px] text-slate-500 hover:text-white hover:border-blue-500/30 transition-all">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar — Confidence + Metrics */}
        {result && result.success && (
          <div className="w-56 border-l border-white/5 bg-slate-950/60 flex flex-col items-center py-8 px-4 gap-6 shrink-0 overflow-y-auto transition-all">
            <ConfidenceRing value={result.confidence} />
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.03] rounded-xl border border-white/5">
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Sources</span>
                <span className="text-[11px] font-black text-white">{result.sources?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.03] rounded-xl border border-white/5">
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Tokens</span>
                <span className="text-[11px] font-black text-white">{result.metadata?.tokens_used ?? '0'}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.03] rounded-xl border border-white/5">
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Time</span>
                <span className="text-[11px] font-black text-white">{(result.metadata?.execution_time ?? elapsed).toFixed(1)}s</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.03] rounded-xl border border-white/5">
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Status</span>
                <span className="text-[10px] font-black text-emerald-400 uppercase">Verified</span>
              </div>
            </div>
            {result.metadata?.agents_used && (
              <div className="w-full">
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2 px-1">Orchestration</p>
                <div className="space-y-1.5">
                  {result.metadata.agents_used.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span className="text-[9px] font-bold text-slate-400 truncate">{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);
};
