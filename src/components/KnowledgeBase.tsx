import React, { useState, useEffect } from 'react';
import {
  Search,
  Brain,
  Tag,
  Calendar,
  MoreVertical,
  Plus,
  Filter,
  BookOpen,
  Link,
  Star
} from 'lucide-react';

interface KnowledgeItem {
  id: number;
  title: string;
  content: string;
  tags: string[];
  createdDate: string;
  source: string;
  type: 'extracted' | 'manual' | 'generated';
  relevanceScore: number;
}

export const KnowledgeBase: React.FC = () => {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKnowledgeItems();
  }, []);

  const fetchKnowledgeItems = async (query = '') => {
    setLoading(true);
    try {
      let url = 'http://127.0.0.1:8001/api/knowledge/';
      let method = 'GET';
      let body = undefined;

      if (query.trim()) {
        url = 'http://127.0.0.1:8001/api/knowledge/search';
        method = 'POST';
        body = JSON.stringify({ query: query, limit: 50, similarity_threshold: 0.1 }); // lower threshold to show results
      }

      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body
      });

      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map((item: { id: string; title: string; content: string; source: string; created_date: string; relevance_score?: number }) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          source: item.source,
          createdDate: new Date(item.created_date).toISOString().split('T')[0], // Changed 'date' to 'createdDate' to match interface
          tags: ['Extracted'], // We don't have tags from backend right now
          type: 'extracted', // Defaulting to 'extracted' for now
          relevanceScore: item.relevance_score || 0.5 // Default relevance score
        }));
        setKnowledgeItems(mappedData);
      } else {
        console.error('Failed to fetch knowledge items:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch knowledge items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle Search using backend
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchKnowledgeItems(searchTerm);
    }, 500); // debounce 500ms
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const allTags = Array.from(new Set(knowledgeItems.flatMap(item => item.tags)));

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'extracted': return 'text-blue-400 bg-blue-400/20';
      case 'manual': return 'text-green-400 bg-green-400/20';
      case 'generated': return 'text-purple-400 bg-purple-400/20';
      default: return 'text-slate-400 bg-slate-400/20';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'extracted': return BookOpen;
      case 'manual': return Plus;
      case 'generated': return Brain;
      default: return BookOpen;
    }
  };

  const filteredItems = knowledgeItems.filter(item => {
    if (selectedTag && !item.tags.includes(selectedTag)) return false;
    return true; // Name/Content search is now handled by backend
  });

  const getRelevanceStars = (score: number) => {
    const stars = Math.round(score * 5);
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${i < stars ? 'text-yellow-400 fill-current' : 'text-slate-600'}`}
      />
    ));
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-6">
      {/* Loading state indicator */}
      {loading && (
        <div className="text-center py-4 text-slate-400">
          Syncing knowledge base...
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Knowledge Base</h1>
          <p className="text-slate-400">Explore your AI-curated knowledge collection</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all duration-200">
          <Plus className="w-4 h-4" />
          Add Knowledge
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search knowledge base..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/40 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <select
          value={selectedTag || ''}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="px-4 py-2 bg-slate-800/40 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
        >
          <option value="">All Tags</option>
          {allTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>

        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800/40 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{knowledgeItems.length}</p>
          <p className="text-sm text-slate-400">Total Items</p>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{knowledgeItems.filter(i => i.type === 'extracted').length}</p>
          <p className="text-sm text-slate-400">Extracted</p>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{knowledgeItems.filter(i => i.type === 'manual').length}</p>
          <p className="text-sm text-slate-400">Manual</p>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{knowledgeItems.filter(i => i.type === 'generated').length}</p>
          <p className="text-sm text-slate-400">Generated</p>
        </div>
      </div>

      {/* Knowledge Items */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {filteredItems.map((item) => {
          const TypeIcon = getTypeIcon(item.type);
          return (
            <div key={item.id} className="bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:bg-slate-800/60 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getTypeColor(item.type)}`}>
                    <TypeIcon className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {getRelevanceStars(item.relevanceScore)}
                  </div>
                  <button className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-slate-300 mb-4 line-clamp-3">{item.content}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Link className="w-3 h-3" />
                    {item.source}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(item.createdDate).toLocaleDateString()}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(item.type)}`}>
                    {item.type}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {item.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-slate-700/50 text-slate-300 rounded-full text-xs">
                      <Tag className="w-2 h-2" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Brain className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {searchTerm || selectedTag ? 'No knowledge items match your criteria' : 'No knowledge items found'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
