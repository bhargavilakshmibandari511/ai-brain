import React, { useState } from 'react';
import { User, Lock, ArrowRight, Brain, AlertCircle } from 'lucide-react';

interface AuthProps {
  onLogin: (user: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    try {
      const response = await fetch(`http://127.0.0.1:8001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (response.ok) {
        if (isLogin) {
          onLogin(data.user);
        } else {
          setIsLogin(true);
          setError('Registration successful! Please login.');
        }
      } else {
        setError(data.detail || 'An error occurred');
      }
    } catch (err) {
      setError('Connection failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>

        <div className="flex flex-col items-center mb-8 relative">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AI Digital Brain</h1>
          <p className="text-slate-400 text-sm mt-1">{isLogin ? 'Welcome back, explorer' : 'Start your private AI journey'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative">
          {error && (
            <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${error.includes('successful') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 ml-1">Username</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                placeholder="Enter your username"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-purple-900/20 active:scale-[0.98] flex items-center justify-center gap-2 group"
          >
            {loading ? 'Processing...' : (
              <>
                {isLogin ? 'Login' : 'Sign Up'}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center relative">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-slate-500 hover:text-purple-400 transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
};
