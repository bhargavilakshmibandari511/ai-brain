import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, RotateCcw, Zap } from 'lucide-react';

class AVLNode {
  value: number;
  left: AVLNode | null = null;
  right: AVLNode | null = null;
  height: number = 1;
  balanceFactor: number = 0;
  constructor(value: number) { this.value = value; }
}

class AVLTree {
  root: AVLNode | null = null;
  rotationCount = 0;

  private getHeight(node: AVLNode | null): number { return node ? node.height : 0; }
  private updateNode(node: AVLNode) {
    node.height = 1 + Math.max(this.getHeight(node.left), this.getHeight(node.right));
    node.balanceFactor = this.getHeight(node.left) - this.getHeight(node.right);
  }

  private rightRotate(z: AVLNode): AVLNode {
    const y = z.left!;
    const T3 = y.right;
    y.right = z; z.left = T3;
    this.updateNode(z); this.updateNode(y);
    this.rotationCount++;
    return y;
  }

  private leftRotate(z: AVLNode): AVLNode {
    const y = z.right!;
    const T2 = y.left;
    y.left = z; z.right = T2;
    this.updateNode(z); this.updateNode(y);
    this.rotationCount++;
    return y;
  }

  private balance(node: AVLNode): AVLNode {
    if (node.balanceFactor > 1) {
      if (node.left!.balanceFactor < 0) node.left = this.leftRotate(node.left!);
      return this.rightRotate(node);
    }
    if (node.balanceFactor < -1) {
      if (node.right!.balanceFactor > 0) node.right = this.rightRotate(node.right!);
      return this.leftRotate(node);
    }
    return node;
  }

  insert(value: number) { this.root = this._insert(this.root, value); }
  private _insert(node: AVLNode | null, value: number): AVLNode {
    if (!node) return new AVLNode(value);
    if (value < node.value) node.left = this._insert(node.left, value);
    else if (value > node.value) node.right = this._insert(node.right, value);
    else return node;
    this.updateNode(node);
    return this.balance(node);
  }

  delete(value: number) { this.root = this._delete(this.root, value); }
  private _delete(node: AVLNode | null, value: number): AVLNode | null {
    if (!node) return null;
    if (value < node.value) node.left = this._delete(node.left, value);
    else if (value > node.value) node.right = this._delete(node.right, value);
    else {
      if (!node.left || !node.right) return node.left || node.right;
      const min = this.findMin(node.right);
      node.value = min.value;
      node.right = this._delete(node.right, min.value);
    }
    this.updateNode(node);
    return this.balance(node);
  }
  private findMin(node: AVLNode): AVLNode { while (node.left) node = node.left; return node; }
}

export const AVLSimulation: React.FC = () => {
  const [tree, setTree] = useState(new AVLTree());
  const [val, setVal] = useState('');
  const [stats, setStats] = useState({ nodes: 0, height: 0, rotations: 0 });

  const nodePositions = useRef<{node: AVLNode, x: number, y: number}[]>([]);
  
  const calculatePositions = (node: AVLNode | null, x: number, y: number, offset: number) => {
    if (!node) return;
    nodePositions.current.push({ node, x, y });
    const nextOffset = Math.max(offset / 2, 20);
    if (node.left) calculatePositions(node.left, x - offset, y + 60, nextOffset);
    if (node.right) calculatePositions(node.right, x + offset, y + 60, nextOffset);
  };

  const update = () => {
    const count = (n: any): number => n ? 1 + count(n.left) + count(n.right) : 0;
    
    nodePositions.current = [];
    if (tree.root) calculatePositions(tree.root, 250, 40, 100);

    setStats({
      nodes: count(tree.root),
      height: tree.root ? tree.root.height : 0,
      rotations: tree.rotationCount
    });
    setTree(Object.assign(Object.create(Object.getPrototypeOf(tree)), tree));
  };

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-6 border border-white/5 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
          <div className="flex gap-2">
            <input type="number" value={val} onChange={e => setVal(e.target.value)}
              className="w-24 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-purple-500" placeholder="Value" />
            <button onClick={() => { if(val){tree.insert(parseInt(val)); setVal(''); update();} }}
              className="bg-purple-600 hover:bg-purple-500 p-2 rounded-xl transition-all shadow-lg shadow-purple-500/20"><Plus className="w-4 h-4" /></button>
            <button onClick={() => { if(val){tree.delete(parseInt(val)); setVal(''); update();} }}
              className="bg-red-600 hover:bg-red-500 p-2 rounded-xl transition-all shadow-lg shadow-red-500/20"><Trash2 className="w-4 h-4" /></button>
          </div>
          <button onClick={() => { const nt = new AVLTree(); setTree(nt); update(); }}
            className="p-2 text-slate-400 hover:text-white transition-colors"><RotateCcw className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Nodes', val: stats.nodes },
            { label: 'Height', val: stats.height },
            { label: 'Rotations', val: stats.rotations }
          ].map(s => (
            <div key={s.label} className="bg-slate-800/50 p-3 rounded-2xl border border-white/5 text-center">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{s.label}</div>
              <div className="text-sm font-black text-purple-400">{s.val}</div>
            </div>
          ))}
      </div>

      <div className="aspect-square md:aspect-video bg-slate-950/50 rounded-3xl border border-white/5 relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-500 via-transparent to-transparent" />
          
          {stats.nodes === 0 ? (
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">
              Insert values to begin simulation
            </div>
          ) : (
            <svg width="500" height="400" className="drop-shadow-2xl">
              <g>
                {nodePositions.current.map(({node, x, y}) => (
                  <React.Fragment key={`${node.value}-${x}-${y}`}>
                    {node.left && (
                      <line 
                        x1={x} y1={y} 
                        x2={nodePositions.current.find(p => p.node === node.left)?.x} 
                        y2={nodePositions.current.find(p => p.node === node.left)?.y} 
                        stroke="rgba(168, 85, 247, 0.2)" strokeWidth="2" 
                      />
                    )}
                    {node.right && (
                      <line 
                        x1={x} y1={y} 
                        x2={nodePositions.current.find(p => p.node === node.right)?.x} 
                        y2={nodePositions.current.find(p => p.node === node.right)?.y} 
                        stroke="rgba(168, 85, 247, 0.2)" strokeWidth="2" 
                      />
                    )}
                  </React.Fragment>
                ))}
                
                {nodePositions.current.map(({node, x, y}) => (
                  <g key={node.value} className="transition-all duration-500">
                    <circle 
                      cx={x} cy={y} r="18" 
                      className="fill-slate-900 stroke-purple-500 stroke-2 cursor-pointer hover:stroke-purple-400" 
                    />
                    <text 
                      x={x} y={y} dy=".3em" 
                      textAnchor="middle" 
                      className="fill-white text-[10px] font-black pointer-events-none"
                    >
                      {node.value}
                    </text>
                    <text 
                      x={x+20} y={y-10} 
                      className="fill-slate-500 text-[8px] font-bold"
                    >
                      {node.balanceFactor}
                    </text>
                  </g>
                ))}
              </g>
            </svg>
          )}
      </div>
    </div>
  );
};
