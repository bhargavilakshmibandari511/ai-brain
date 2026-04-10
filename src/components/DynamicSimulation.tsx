import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GameConfig {
  type: "tree" | "graph" | "sorting" | "concept" | "linked_list" | "stack_queue" | "hash_table" | "heap" | "dp" | "pathfinding";
  title: string;
  description: string;
  topic: string;
  instructions: string[];
  initialState: any;
  rules: any;
  scoring: { correct: number; wrong: number; bonus: number };
}

interface SimulationData {
  nodes?: any[];
  edges?: any[];
  goal?: string;
  style?: string;
}

interface Props {
  documentId?: string;
  documentText?: string;
  simulationData?: SimulationData | null;
  onXPGain?: (xp: number) => void;
}

// ─── Backend Integration ───────────────────────────────────────────────────────

async function generateGameFromContent(docText: string, simData: SimulationData | null): Promise<GameConfig> {
  const API = 'http://127.0.0.1:8001';
  const response = await fetch(`${API}/api/simulation/generate-game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_text: docText, simulation_data: simData }),
  });

  if (!response.ok) throw new Error("Failed to generate game config");
  return await response.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function updateTreePositions(nodes: any[]): any[] {
  if (!nodes.length) return nodes;
  const root = nodes.find(n => !nodes.some(p => p.left === n.id || p.right === n.id));
  if (!root) return nodes;
  const assign = (id: number | null, x: number, y: number, spread: number) => {
    if (!id) return;
    const n = nodes.find(n => n.id === id);
    if (!n) return;
    n.x = x; n.y = y;
    assign(n.left, x - spread, y + 90, Math.max(spread / 1.8, 30));
    assign(n.right, x + spread, y + 90, Math.max(spread / 1.8, 30));
  };
  assign(root.id, 400, 70, 160);
  return [...nodes];
}

// ─── TREE GAME ────────────────────────────────────────────────────────────────

function TreeGame({ config, onScore }: { config: any; onScore: (n: number) => void }) {
  const [nodes, setNodes] = useState<any[]>(config.initialState.nodes || []);
  const [nextId, setNextId] = useState(config.initialState.nextId || 10);
  const [inputVal, setInputVal] = useState("");
  const [message, setMessage] = useState({ text: "", good: true });
  const [score, setScore] = useState(0);
  const [pulseId, setPulseId] = useState<number | null>(null);

  const msg = (text: string, good = true) => {
    setMessage({ text, good });
    setTimeout(() => setMessage({ text: "", good: true }), 3000);
  };

  const getHeight = (id: number | null, ns: any[]): number => {
    if (!id) return 0;
    const n = ns.find(x => x.id === id);
    if (!n) return 0;
    return 1 + Math.max(getHeight(n.left, ns), getHeight(n.right, ns));
  };

  const getBalance = (id: number | null, ns: any[]): number => {
    if (!id) return 0;
    const n = ns.find(x => x.id === id);
    if (!n) return 0;
    return getHeight(n.left, ns) - getHeight(n.right, ns);
  };

  const insertBST = (rootId: number | null, val: number, ns: any[], newNode: any): number => {
    if (!rootId) return newNode.id;
    const root = ns.find(x => x.id === rootId)!;
    if (val < root.value) root.left = insertBST(root.left, val, ns, newNode);
    else if (val > root.value) root.right = insertBST(root.right, val, ns, newNode);
    root.height = 1 + Math.max(getHeight(root.left, ns), getHeight(root.right, ns));
    return rootId;
  };

  const handleInsert = () => {
    const val = parseInt(inputVal);
    if (isNaN(val)) return;
    if (nodes.find(n => n.value === val)) { msg("Value already exists!", false); return; }
    const newNode = { id: nextId, value: val, x: 400, y: 400, left: null, right: null, height: 1 };
    const ns = [...nodes, newNode];
    const rootNode = ns.find(n => !ns.some(p => p.left === n.id || p.right === n.id));
    if (rootNode) insertBST(rootNode.id, val, ns, newNode);
    setNodes(updateTreePositions(ns));
    setNextId(nextId + 1); setInputVal(""); setPulseId(nextId);
    setTimeout(() => setPulseId(null), 600);
    setScore(s => s + config.scoring.correct); onScore(config.scoring.correct);
    msg(`✓ Inserted ${val}!`);
  };

  const handleDelete = (id: number) => {
    let ns = nodes.filter(n => n.id !== id);
    ns = ns.map(n => ({ ...n, left: n.left === id ? null : n.left, right: n.right === id ? null : n.right }));
    setNodes(updateTreePositions(ns));
    onScore(config.scoring.correct);
  };

  return (
    <div className="flex flex-col h-full gap-2 overflow-hidden">
      <div className="flex gap-2">
        <input type="number" value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder="Val..." className="bg-slate-800 px-2 py-1 rounded text-sm flex-1" />
        <button onClick={handleInsert} className="bg-violet-600 px-3 py-1 rounded text-sm">Insert</button>
      </div>
      <svg width="100%" height="320" viewBox="0 0 800 400" className="bg-slate-900/50 rounded-lg">
        {nodes.flatMap(n => {
           const edges = [];
           if (n.left) { const c = nodes.find(x => x.id === n.left); if (c) edges.push(<line key={`${n.id}-l`} x1={n.x} y1={n.y} x2={c.x} y2={c.y} stroke="#6d28d9" strokeWidth="2" />); }
           if (n.right) { const c = nodes.find(x => x.id === n.right); if (c) edges.push(<line key={`${n.id}-r`} x1={n.x} y1={n.y} x2={c.x} y2={c.y} stroke="#6d28d9" strokeWidth="2" />); }
           return edges;
        })}
        {nodes.map(n => (
          <g key={n.id} onClick={() => handleDelete(n.id)}>
            <circle cx={n.x} cy={n.y} r="20" fill={Math.abs(getBalance(n.id, nodes)) > 1 ? "#ef4444" : "#8b5cf6"} />
            <text x={n.x} y={n.y} textAnchor="middle" dy=".3em" fill="white" fontSize="10">{n.value}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── LINKED LIST GAME ────────────────────────────────────────────────────────

function LinkedListGame({ config, onScore }: { config: any; onScore: (n: number) => void }) {
  const [nodes, setNodes] = useState<any[]>(config.initialState.nodes || []);
  const [head, setHead] = useState<number | null>(config.initialState.head || null);
  const [nextId, setNextId] = useState(config.initialState.nextId || 10);
  const [inputVal, setInputVal] = useState("");

  const insertHead = () => {
    const val = inputVal.trim(); if (!val) return;
    const newNode = { id: nextId, value: val, next: head };
    setNodes([...nodes, newNode]); setHead(nextId); setNextId(nextId + 1); setInputVal("");
    onScore(config.scoring.correct);
  };

  const ordered: any[] = []; let cur = head;
  while (cur !== null) { const n = nodes.find(x => x.id === cur); if (!n) break; ordered.push(n); cur = n.next; }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex gap-2">
        <input value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder="Val..." className="bg-slate-800 px-2 py-1 rounded text-sm flex-1" />
        <button onClick={insertHead} className="bg-teal-600 px-3 py-1 rounded text-sm">Add Head</button>
      </div>
      <div className="flex flex-wrap gap-4 p-4 bg-slate-900/50 rounded-lg min-h-[100px] items-center">
        {ordered.map((n, i) => (
          <div key={n.id} className="flex items-center gap-2">
            <div className="bg-teal-600 px-3 py-2 rounded border border-teal-400/30 font-bold">{n.value}</div>
            {i < ordered.length - 1 && <span className="text-teal-500">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STACK & QUEUE GAME ───────────────────────────────────────────────────────

function StackQueueGame({ config, onScore }: { config: any; onScore: (n: number) => void }) {
  const [stack, setStack] = useState<any[]>(config.initialState.stack || []);
  const [queue, setQueue] = useState<any[]>(config.initialState.queue || []);
  const [inputVal, setInputVal] = useState("");

  const push = () => {
    const val = inputVal.trim(); if (!val) return;
    setStack([val, ...stack]); setInputVal(""); onScore(config.scoring.correct);
  };
  const enqueue = () => {
    const val = inputVal.trim(); if (!val) return;
    setQueue([...queue, val]); setInputVal(""); onScore(config.scoring.correct);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex gap-2">
        <input value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder="Val..." className="bg-slate-800 px-2 py-1 rounded text-sm flex-1" />
        <button onClick={push} className="bg-orange-600 px-3 py-1 rounded text-sm">Push</button>
        <button onClick={enqueue} className="bg-cyan-600 px-3 py-1 rounded text-sm">Enqueue</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/50 p-3 rounded-lg border border-orange-500/20">
          <p className="text-[10px] text-orange-400 font-bold mb-2">STACK (LIFO)</p>
          <div className="flex flex-col gap-1">
            {stack.map((v, i) => <div key={i} className="bg-orange-600/20 border border-orange-500/30 px-2 py-1 rounded text-center">{v}</div>)}
          </div>
        </div>
        <div className="bg-slate-900/50 p-3 rounded-lg border border-cyan-500/20">
          <p className="text-[10px] text-cyan-400 font-bold mb-2">QUEUE (FIFO)</p>
          <div className="flex gap-1 overflow-x-auto">
            {queue.map((v, i) => <div key={i} className="bg-cyan-600/20 border border-cyan-500/30 px-2 py-1 rounded min-w-[40px] text-center">{v}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SORTING GAME ────────────────────────────────────────────────────────────

function SortingGame({ config, onScore }: { config: any; onScore: (n: number) => void }) {
  const [array, setArray] = useState<number[]>(config.initialState.array || [64, 34, 25, 12, 22, 11, 90]);
  const [comparing, setComparing] = useState<number[]>([]);
  const [sorted, setSorted] = useState<number[]>([]);

  const swap = (i: number, j: number) => {
    const next = [...array]; [next[i], next[j]] = [next[j], next[i]];
    setArray(next); setComparing([i, j]); onScore(config.scoring.correct);
    setTimeout(() => setComparing([]), 400);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-end gap-1 h-32 bg-slate-900/50 p-4 rounded-lg">
        {array.map((v, i) => (
          <div
            key={i} onClick={() => i < array.length - 1 && swap(i, i + 1)}
            style={{ height: `${(v / Math.max(...array)) * 100}%` }}
            className={`flex-1 rounded-t transition-all cursor-pointer ${comparing.includes(i) ? "bg-yellow-400" : "bg-violet-500 hover:bg-violet-400"}`}
          />
        ))}
      </div>
      <p className="text-[10px] text-slate-500 text-center italic">Click a bar to swap with its neighbor</p>
    </div>
  );
}

// ─── HASH TABLE GAME ──────────────────────────────────────────────────────────

function HashTableGame({ config, onScore }: { config: any; onScore: (n: number) => void }) {
  const [table, setTable] = useState<Record<number, string[]>>(config.initialState.table || {});
  const [inputVal, setInputVal] = useState("");
  const size = config.rules.size || 7;

  const insert = () => {
    const val = inputVal.trim(); if (!val) return;
    const hash = val.split("").reduce((a, b) => a + b.charCodeAt(0), 0) % size;
    const next = { ...table }; next[hash] = [...(next[hash] || []), val];
    setTable(next); setInputVal(""); onScore(config.scoring.correct);
  };

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex gap-2">
        <input value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder="Key..." className="bg-slate-800 px-2 py-1 rounded text-sm flex-1" />
        <button onClick={insert} className="bg-pink-600 px-3 py-1 rounded text-sm">Hash & Insert</button>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {Array.from({ length: size }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-900/30 p-1 rounded border border-white/5">
            <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-pink-400">{i}</div>
            <div className="flex gap-1 flex-wrap">
              {(table[i] || []).map((v, j) => <div key={j} className="bg-pink-600/20 border border-pink-500/30 px-2 rounded text-[10px]">{v}</div>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── HEAP GAME ────────────────────────────────────────────────────────────────

function HeapGame({ config, onScore }: { config: any; onScore: (n: number) => void }) {
  const [heap, setHeap] = useState<number[]>(config.initialState.heap || []);
  const [inputVal, setInputVal] = useState("");

  const push = () => {
    const val = parseInt(inputVal); if (isNaN(val)) return;
    const next = [...heap, val];
    // Simple bubble up
    let i = next.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (next[i] > next[p]) { [next[i], next[p]] = [next[p], next[i]]; i = p; }
      else break;
    }
    setHeap(next); setInputVal(""); onScore(config.scoring.correct);
  };

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex gap-2">
        <input type="number" value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder="Val..." className="bg-slate-800 px-2 py-1 rounded text-sm flex-1" />
        <button onClick={push} className="bg-yellow-600 px-3 py-1 rounded text-sm">Push Heap</button>
      </div>
      <div className="flex flex-wrap gap-2 p-4 bg-slate-900/50 rounded-lg min-h-[100px] items-start content-start">
        {heap.map((v, i) => (
          <div key={i} className="relative">
            <div className="bg-yellow-600 w-10 h-10 rounded-full flex items-center justify-center border-2 border-yellow-400/50 font-bold">{v}</div>
            <div className="absolute -top-1 -right-1 bg-slate-800 text-[8px] px-1 rounded border border-white/10">{i}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GRAPH GAME ────────────────────────────────────────────────────────────────

function GraphGame({ config, onScore }: { config: any; onScore: (n: number) => void }) {
  const [nodes, setNodes] = useState<any[]>(config.initialState.nodes || [
    { id: 1, label: "A", x: 100, y: 100 }, { id: 2, label: "B", x: 300, y: 100 }, { id: 3, label: "C", x: 200, y: 250 }
  ]);
  const [edges, setEdges] = useState<any[]>(config.initialState.edges || [{ from: 1, to: 2 }, { from: 2, to: 3 }]);
  const [visited, setVisited] = useState<number[]>([]);

  const visit = (id: number) => {
    if (visited.includes(id)) return;
    setVisited([...visited, id]); onScore(config.scoring.correct);
  };

  return (
    <div className="flex flex-col h-full gap-2">
      <svg width="100%" height="300" viewBox="0 0 400 300" className="bg-slate-900/50 rounded-lg">
        {edges.map((e, i) => {
          const n1 = nodes.find(n => n.id === e.from);
          const n2 = nodes.find(n => n.id === e.to);
          if (!n1 || !n2) return null;
          return <line key={i} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="#4f46e5" strokeWidth="2" />;
        })}
        {nodes.map(n => (
          <g key={n.id} onClick={() => visit(n.id)} className="cursor-pointer">
            <circle cx={n.x} cy={n.y} r="15" fill={visited.includes(n.id) ? "#10b981" : "#4f46e5"} />
            <text x={n.x} y={n.y} textAnchor="middle" dy=".3em" fill="white" fontSize="10">{n.label}</text>
          </g>
        ))}
      </svg>
      <p className="text-[10px] text-slate-500 text-center">Click nodes to simulate traversal</p>
    </div>
  );
}

// ─── CONCEPT GAME ─────────────────────────────────────────────────────────────

function ConceptGame({ config, onScore }: { config: any; onScore: (n: number) => void }) {
  const [idx, setIdx] = useState(0);
  const [solved, setSolved] = useState<number[]>([]);
  const scenario = config.initialState.scenarios[idx];

  const handleAnswer = (ansIdx: number) => {
    if (ansIdx === scenario.correct) {
      if (!solved.includes(idx)) { onScore(config.scoring.correct); setSolved([...solved, idx]); }
      if (idx < config.initialState.scenarios.length - 1) setIdx(idx + 1);
    }
  };

  if (!scenario) return <p className="text-center py-10">All concepts mastered! 🎉</p>;

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
        <p className="text-sm font-medium mb-4">{scenario.question}</p>
        <div className="grid grid-cols-1 gap-2">
          {scenario.options.map((opt: string, i: number) => (
            <button key={i} onClick={() => handleAnswer(i)} className="text-left text-xs p-3 rounded-lg bg-slate-800 border border-white/5 hover:bg-violet-600/20 hover:border-violet-500/30 transition-all">
              {opt}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-between items-center text-[10px] text-slate-500">
        <span>Question {idx+1} of {config.initialState.scenarios.length}</span>
        <span>Progress: {Math.round((solved.length / config.initialState.scenarios.length) * 100)}%</span>
      </div>
    </div>
  );
}

// ─── Component Shell ──────────────────────────────────────────────────────────

const GAME_ICONS: Record<string, string> = {
  tree: "🌳", graph: "🕸️", sorting: "📊", concept: "🧠",
  linked_list: "🔗", stack_queue: "📦", hash_table: "🗄️", heap: "⛏️",
  dp: "♟️", pathfinding: "🗺️"
};

export default function DynamicSimulation({ documentId, documentText, simulationData, onXPGain }: Props) {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadStage, setLoadStage] = useState("Analyzing content...");
  const [error, setError] = useState<string | null>(null);
  const [totalXP, setTotalXP] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);

  const handleScore = useCallback((pts: number) => {
    setTotalXP(x => x + pts);
    onXPGain?.(pts);
  }, [onXPGain]);

  const generateGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGameConfig(null);
    setTotalXP(0);

    try {
      setLoadStage("Analyzing content...");
      const config = await generateGameFromContent(documentText || "", simulationData || null);
      setGameConfig(config);
      setShowInstructions(true);
    } catch (e) {
      console.error(e);
      setError("Failed to generate game. Using fallback.");
    } finally {
      setLoading(false);
    }
  }, [documentText, simulationData]);

  useEffect(() => {
    if (documentText || simulationData) generateGame();
  }, [documentId]);

  const renderGame = () => {
    if (!gameConfig) return null;
    const props = { config: gameConfig, onScore: handleScore };
    switch (gameConfig.type) {
      case "tree": return <TreeGame {...props} />;
      case "linked_list": return <LinkedListGame {...props} />;
      case "stack_queue": return <StackQueueGame {...props} />;
      case "sorting": return <SortingGame {...props} />;
      case "hash_table": return <HashTableGame {...props} />;
      case "heap": return <HeapGame {...props} />;
      case "graph": return <GraphGame {...props} />;
      case "concept": return <ConceptGame {...props} />;
      default: return <p className="text-center py-10 opacity-50 text-xs">Engine "{gameConfig.type}" not found.</p>;
    }
  };

  const icon = gameConfig ? (GAME_ICONS[gameConfig.type] || "🎮") : "🎮";

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white rounded-xl overflow-hidden border border-white/5 shadow-2xl relative" style={{ minHeight: 520 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-slate-900/80 backdrop-blur-sm relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-700/50 flex items-center justify-center text-base shadow-inner shadow-white/10">{icon}</div>
          <div>
            <h2 className="text-sm font-black text-white leading-none tracking-tight">{gameConfig?.title || "Simulation Arena"}</h2>
            <p className="text-[10px] text-slate-500 mt-1 font-medium">{gameConfig?.description || "Analyzing document content..."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalXP > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 animate-in zoom-in-50 duration-300">
              <span className="text-[10px] font-black text-violet-400">+{totalXP} XP</span>
            </div>
          )}
          <button 
            onClick={generateGame} 
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-white"
            title="Regenerate Game"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 p-4 overflow-hidden relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-xs font-medium text-slate-400 animate-pulse">{loadStage}</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
             <div className="text-3xl opacity-50">⚠️</div>
             <p className="text-xs text-slate-400">{error}</p>
             <button onClick={generateGame} className="text-[10px] text-violet-400 hover:underline">Try again</button>
          </div>
        ) : (
          <div className="h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            {renderGame()}
          </div>
        )}

        {/* Instructions Overlay */}
        {gameConfig && showInstructions && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-20 flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="max-w-xs w-full bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="text-2xl mb-4">{icon}</div>
              <h3 className="text-lg font-black mb-1">{gameConfig.title}</h3>
              <p className="text-xs text-slate-400 mb-6">{gameConfig.description}</p>
              <div className="space-y-3 mb-8">
                {gameConfig.instructions.map((inst, i) => (
                   <div key={i} className="flex gap-3 text-xs text-slate-300">
                      <span className="text-violet-500 font-bold">{i+1}.</span>
                      <p>{inst}</p>
                   </div>
                ))}
              </div>
              <button 
                onClick={() => setShowInstructions(false)}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-900/40 active:scale-[0.98]"
              >
                Let's Start
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-slate-900/40 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
           <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">Engine Online</span>
        </div>
        <button 
          onClick={() => setShowInstructions(true)}
          className="text-[9px] font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
        >
          View Instructions
        </button>
      </div>
    </div>
  );
}
