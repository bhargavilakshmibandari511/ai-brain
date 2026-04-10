import React, { useEffect, useRef } from 'react';

interface Node {
  id: string;
  label: string;
  type: 'concept' | 'entity' | 'keyword';
  val: number;
}

interface Link {
  source: string;
  target: string;
  strength: number;
}

export const KnowledgeGraph: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Mock data for initial implementation
  const nodes: Node[] = [
    { id: '1', label: 'Algorithm', type: 'concept', val: 20 },
    { id: '2', label: 'Time Complexity', type: 'entity', val: 12 },
    { id: '3', label: 'Space Complexity', type: 'entity', val: 12 },
    { id: '4', label: 'Big O Notation', type: 'concept', val: 15 },
    { id: '5', label: 'Sorting', type: 'keyword', val: 10 },
    { id: '6', label: 'Searching', type: 'keyword', val: 10 },
    { id: '7', label: 'Data Structures', type: 'concept', val: 18 },
  ];

  const links: Link[] = [
    { source: '1', target: '2', strength: 0.5 },
    { source: '1', target: '3', strength: 0.5 },
    { source: '1', target: '4', strength: 0.8 },
    { source: '1', target: '5', strength: 0.4 },
    { source: '1', target: '6', strength: 0.4 },
    { source: '4', target: '2', strength: 0.6 },
    { source: '7', target: '5', strength: 0.5 },
    { source: '7', target: '6', strength: 0.5 },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-white">
      <div className="flex-1 relative overflow-hidden bg-slate-50/50 rounded-3xl m-4 border border-slate-100 shadow-inner">
        <svg 
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          viewBox="0 0 500 500"
        >
          {/* Static rendering for now, could be dynamic with D3 later */}
          <g>
            {/* Links */}
            <line x1="250" y1="250" x2="150" y2="150" stroke="#E2E8F0" strokeWidth="2" />
            <line x1="250" y1="250" x2="350" y2="150" stroke="#E2E8F0" strokeWidth="2" />
            <line x1="250" y1="250" x2="350" y2="350" stroke="#E2E8F0" strokeWidth="2" />
            <line x1="250" y1="250" x2="150" y2="350" stroke="#E2E8F0" strokeWidth="2" />
            
            {/* Central Node */}
            <circle cx="250" cy="250" r="30" fill="white" stroke="#3B82F6" strokeWidth="3" className="shadow-lg" />
            <text x="250" y="255" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1E293B">Algorithm</text>
            
            {/* Surrounding Nodes */}
            <circle cx="150" cy="150" r="20" fill="white" stroke="#10B981" strokeWidth="2" />
            <text x="150" y="185" textAnchor="middle" fontSize="8" fill="#64748B">Time Complexity</text>
            
            <circle cx="350" cy="150" r="22" fill="white" stroke="#F59E0B" strokeWidth="2" />
            <text x="350" y="187" textAnchor="middle" fontSize="8" fill="#64748B">Big O Notation</text>
            
            <circle cx="350" cy="350" r="18" fill="white" stroke="#8B5CF6" strokeWidth="2" />
            <text x="350" y="380" textAnchor="middle" fontSize="8" fill="#64748B">Data Structures</text>
            
            <circle cx="150" cy="350" r="15" fill="white" stroke="#EC4899" strokeWidth="2" />
            <text x="150" y="375" textAnchor="middle" fontSize="8" fill="#64748B">Sorting</text>
          </g>
        </svg>
        
        {/* Legend */}
        <div className="absolute bottom-6 left-6 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Concept</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Entity</span>
          </div>
        </div>
        
        {/* Controls */}
        <div className="absolute top-6 right-6 flex flex-col gap-2">
          <button className="w-8 h-8 bg-white border border-slate-100 rounded-lg shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-95 transition-all text-lg">+</button>
          <button className="w-8 h-8 bg-white border border-slate-100 rounded-lg shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-95 transition-all text-lg">-</button>
        </div>
      </div>
    </div>
  );
};
