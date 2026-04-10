import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, HelpCircle, ChevronRight, Brain, Zap, Trophy } from 'lucide-react';

interface SimulationProps {
  type: string;
}

export const GamifiedSimulation: React.FC<SimulationProps> = ({ type }) => {
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Let's build an AVL Tree. Insert 30 to start.");

  // Logic inspired by the user's AVL simulation code
  const handleAction = () => {
    if (step === 0) {
      setMessage("30 inserted. Now insert 20. It will go to the left.");
      setScore(prev => prev + 10);
      setStep(1);
    } else if (step === 1) {
      setMessage("20 inserted. Now insert 10. This will cause a right rotation!");
      setScore(prev => prev + 10);
      setStep(2);
    } else if (step === 2) {
      setMessage("Right rotation complete! The tree is now balanced with 20 at root.");
      setScore(prev => prev + 50);
      setStep(3);
    } else {
      setStep(0);
      setScore(0);
      setMessage("Let's build an AVL Tree. Insert 30 to start.");
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
      <div className="p-6 flex items-center justify-between border-b border-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Advanced Algorithmic Simulation</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{type.replace('-', ' ')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Current Score</p>
            <p className="text-sm font-bold text-blue-600">{score.toLocaleString()} XP</p>
          </div>
          <button className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-slate-900 m-6 rounded-[2rem] overflow-hidden shadow-2xl border-4 border-slate-800">
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10">
          <div className="px-4 py-2 bg-slate-800/80 backdrop-blur rounded-full border border-slate-700/50 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Simulation Active</span>
          </div>
          <div className="bg-slate-800/80 backdrop-blur px-3 py-1 rounded-lg border border-slate-700/50 text-[10px] font-bold text-slate-400">
            Step {step + 1} / 10
          </div>
        </div>

        {/* Binary Tree Visualizer */}
        <div className="absolute inset-0 flex items-center justify-center p-20">
          <svg className="w-full h-full" viewBox="0 0 500 400">
            {step >= 1 && (
              <g>
                <line x1="250" y1="100" x2="150" y2="200" stroke="#475569" strokeWidth="4" />
                <circle cx="250" cy="100" r="35" fill="#1E293B" stroke="#3B82F6" strokeWidth="3" />
                <text x="250" y="110" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">30</text>
              </g>
            )}
            {step >= 2 && (
              <g>
                <line x1="150" y1="200" x2="100" y2="300" stroke="#475569" strokeWidth="4" />
                <circle cx="150" cy="200" r="30" fill="#1E293B" stroke="#10B981" strokeWidth="3" />
                <text x="150" y="210" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">20</text>
              </g>
            )}
            {step >= 3 && (
              <g>
                <circle cx="100" cy="300" r="25" fill="#1E293B" stroke="#F59E0B" strokeWidth="3" />
                <text x="100" y="310" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">10</text>
              </g>
            )}
          </svg>
        </div>

        {/* AI Commentary Overlay */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="bg-blue-600/90 backdrop-blur-md rounded-2xl p-4 border border-blue-400/30 flex items-start gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-1">AI Logic Guide</p>
              <p className="text-white text-sm font-medium leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 pt-0 flex gap-4">
        <button 
          onClick={handleAction}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl py-4 flex items-center justify-center gap-3 text-white font-bold shadow-lg active:scale-95 transition-all"
        >
          {step === 3 ? <RotateCcw className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
          {step === 3 ? "Reset Simulation" : "Next logical step"}
        </button>
        <button className="w-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-95 transition-all">
          <HelpCircle className="w-6 h-6" />
        </button>
      </div>

      <div className="px-6 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mastery Progress</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[1, 1, 0, 0, 0].map((v, i) => (
            <div key={i} className={`h-1.5 rounded-full ${v ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-100'}`} />
          ))}
        </div>
      </div>
    </div>
  );
};
