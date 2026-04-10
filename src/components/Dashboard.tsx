import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileText,
  Brain,
  Clock,
  Cpu,
  HardDrive,
  Activity,
  Database,
  Zap,
  Search,
  Globe,
  ShieldCheck,
} from 'lucide-react';

interface SystemStats {
  total_documents: number;
  total_conversations: number;
  total_knowledge_items: number;
  ai_model_status: string;
  memory_usage: {
    total: number;
    available: number;
    percent: number;
    used: number;
  };
  processing_speed: number;
}

interface ActivityItem {
  type: string;
  description: string;
  timestamp: string;
  status: string;
}

interface AgentInfo {
  name: string;
  status: string;
  description: string;
  capabilities: string[];
  last_execution_time: number;
  total_tasks_completed: number;
}

const agentIconMap: Record<string, React.ElementType> = {
  'Orchestrator Agent': Brain,
  'Research Agent': Search,
  'Web Agent': Globe,
  'Analyst Agent': BarChart3,
  'Reviewer Agent': ShieldCheck,
};

const agentColorMap: Record<string, string> = {
  'Orchestrator Agent': 'from-violet-500 to-purple-600',
  'Research Agent': 'from-blue-500 to-cyan-500',
  'Web Agent': 'from-green-500 to-emerald-500',
  'Analyst Agent': 'from-orange-500 to-amber-500',
  'Reviewer Agent': 'from-pink-500 to-rose-500',
};

const statusColor = (status: string) => {
  switch (status) {
    case 'idle': return 'bg-slate-400';
    case 'working': return 'bg-yellow-400 animate-pulse';
    case 'done': return 'bg-green-400';
    case 'error': return 'bg-red-400';
    default: return 'bg-slate-500';
  }
};

export const Dashboard: React.FC = () => {
  const [statsData, setStatsData] = useState<SystemStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, activityRes, agentsRes] = await Promise.all([
          fetch('http://127.0.0.1:8001/api/dashboard/stats'),
          fetch('http://127.0.0.1:8001/api/dashboard/activity'),
          fetch('http://127.0.0.1:8001/api/agents/'),
        ]);

        if (statsRes.ok) {
          const stats = await statsRes.json();
          setStatsData(stats);
        }

        if (activityRes.ok) {
          const activityData = await activityRes.json();
          setRecentActivity(activityData.activities || []);
        }

        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          setAgents(agentsData.agents || []);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    {
      label: 'Memory Usage',
      value: statsData ? `${statsData.memory_usage.percent.toFixed(1)}%` : '0%',
      icon: Zap,
      trend: statsData && statsData.memory_usage.percent > 80 ? 'High' : 'Normal',
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      label: 'Documents',
      value: statsData ? statsData.total_documents.toString() : '0',
      icon: FileText,
      trend: 'Secure',
      color: 'from-indigo-500 to-indigo-600',
    },
    {
      label: 'Knowledge Items',
      value: statsData ? statsData.total_knowledge_items.toString() : '0',
      icon: Database,
      trend: 'Dynamic',
      color: 'from-purple-500 to-purple-600',
    },
    {
      label: 'Processing Speed',
      value: statsData ? `${statsData.processing_speed} t/s` : '0 t/s',
      icon: Brain,
      trend: statsData?.ai_model_status === 'healthy' ? 'Stable' : (statsData?.ai_model_status || 'Offline'),
      color: 'from-blue-500 to-blue-600',
    },
  ];

  const systemStats = [
    { label: 'CPU Usage', value: 'N/A', icon: Cpu },
    { label: 'Memory Usage', value: statsData ? `${statsData.memory_usage.percent.toFixed(1)}%` : '0%', icon: Activity },
    { label: 'Storage Used', value: 'N/A', icon: HardDrive },
    { label: 'Uptime', value: 'N/A', icon: Clock }
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6 h-full overflow-y-auto flex items-center justify-center text-white">
        Loading dashboard data...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Monitor your AI assistant's performance, agents, and usage</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg bg-gradient-to-r ${stat.color}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-green-400 text-sm font-medium">{stat.trend}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-slate-400 text-sm">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Multi-Agent System Panel ═══ */}
      <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-violet-600">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Multi-Agent System</h3>
            <p className="text-sm text-slate-400">{agents.length} agents registered and operational</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent, i) => {
            const IconComponent = agentIconMap[agent.name] || Brain;
            const gradient = agentColorMap[agent.name] || 'from-slate-500 to-slate-600';

            return (
              <div
                key={i}
                className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md bg-gradient-to-r ${gradient}`}>
                      <IconComponent className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">{agent.name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${statusColor(agent.status)}`} />
                        <span className="text-[10px] text-slate-400 capitalize">{agent.status}</span>
                      </div>
                    </div>
                  </div>
                  {agent.total_tasks_completed > 0 && (
                    <span className="text-[10px] bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded-full">
                      {agent.total_tasks_completed} tasks
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{agent.description}</p>

                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.slice(0, 3).map((cap, j) => (
                    <span
                      key={j}
                      className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50"
                    >
                      {cap}
                    </span>
                  ))}
                  {agent.capabilities.length > 3 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500">
                      +{agent.capabilities.length - 3}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts and System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">AI Usage Over Time</h3>
            <div className="flex items-center gap-2">
              <button className="text-sm text-slate-400 hover:text-white">7D</button>
              <button className="text-sm bg-purple-600 text-white px-3 py-1 rounded-lg">30D</button>
              <button className="text-sm text-slate-400 hover:text-white">90D</button>
            </div>
          </div>

          <div className="h-48 bg-slate-900/50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">Usage analytics visualization</p>
              <p className="text-sm text-slate-600">Chart implementation would go here</p>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">System Status</h3>
          <div className="space-y-4">
            {systemStats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <stat.icon className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300">{stat.label}</span>
                </div>
                <span className="text-sm font-medium text-white">{stat.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${statsData?.ai_model_status === 'healthy' ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className={`text-sm ${statsData?.ai_model_status === 'healthy' ? 'text-green-400' : 'text-red-400'}`}>
                AI Model: {statsData?.ai_model_status ? statsData.ai_model_status.charAt(0).toUpperCase() + statsData.ai_model_status.slice(1) : 'Unknown'}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span className="text-sm text-purple-400">Multi-Agent: Active ({agents.length} agents)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-sm text-blue-400">Local Mode: Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Recent Activity</h3>
        <div className="space-y-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 rounded-lg border border-slate-700/50 bg-slate-900/30">
                <div className="p-2 rounded-full bg-blue-500/10 text-blue-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-200">{activity.description}</p>
                  <p className="text-xs text-gray-500">{new Date(activity.timestamp).toLocaleString()}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${activity.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                  {activity.status}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">No recent activity.</p>
          )}
        </div>
      </div>
    </div>
  );
};
