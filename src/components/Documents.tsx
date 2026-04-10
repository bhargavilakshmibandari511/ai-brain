import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Search,
  Filter,
  MoreVertical,
  Download,
  Trash2,
  Eye,
  Calendar,
  File,
  Tag
} from 'lucide-react';

interface Document {
  id: number;
  name: string;
  type: string;
  size: string;
  date: string;
  status: 'processed' | 'processing' | 'error' | 'ready';
  summary: string;
  category: string | null;
  confidence: number | null;
}

interface DocumentsProps {
  onNavigate?: (view: 'chatpdf') => void;
}

export const Documents: React.FC<DocumentsProps> = ({ onNavigate }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8001/api/documents/');
      if (response.ok) {
        const data = await response.json();
        const documentsArray = Array.isArray(data) ? data : (data.documents || []);
        const mappedData = documentsArray.map((doc: any) => ({
          id: doc.id,
          name: doc.filename,
          type: doc.filename.split('.').pop() || 'unknown',
          size: 'Unknown',
          status: doc.status,
          date: new Date(doc.created_at || Date.now()).toISOString().split('T')[0],
          summary: doc.summary || 'No summary available.',
          category: doc.category || null,
          confidence: doc.confidence || null,
        }));
        setDocuments(mappedData);
      } else {
        console.error('Failed to fetch documents:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleFileUpload = async (file: File | null) => {
    setIsUploading(true);
    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('http://127.0.0.1:8001/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          // Refresh immediately, then poll until processing finishes
          fetchDocuments();
          let attempts = 0;
          const interval = setInterval(async () => {
            attempts++;
            await fetchDocuments();
            if (attempts > 30) clearInterval(interval);
          }, 2000);
        } else {
          const errData = await response.json().catch(() => null);
          console.error("Upload failed", errData?.detail || response.statusText);
          alert(`Upload failed: ${errData?.detail || response.statusText}`);
        }
      }
    } catch (error) {
      console.error("Upload error", error);
      alert('Upload error: Could not connect to backend. Is the server running?');
    } finally {
      setTimeout(() => setIsUploading(false), 500);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
    e.target.value = '';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-400 bg-green-400/20'; // Added 'ready'
      case 'processed': return 'text-green-400 bg-green-400/20';
      case 'processing': return 'text-amber-400 bg-amber-400/20';
      case 'error': return 'text-red-400 bg-red-400/20';
      default: return 'text-slate-400 bg-slate-400/20';
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.category && doc.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDelete = async (id: string | number) => {
    try {
      const response = await fetch(`http://127.0.0.1:8001/api/documents/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchDocuments();
      } else {
        console.error("Delete failed", response.statusText);
      }
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Documents</h1>
        <p className="text-slate-400">Upload and manage your documents for AI analysis</p>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive
          ? 'border-purple-500 bg-purple-500/10'
          : 'border-slate-600 hover:border-slate-500 bg-slate-800/20'
          }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">
          {isUploading ? 'Uploading...' : 'Drop files here or click to upload'}
        </h3>
        <p className="text-slate-400 mb-4">
          Supports PDF, DOCX, TXT, MD, and more
        </p>
        <input
          type="file"
          ref={inputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.txt,.md,.doc,.docx"
          multiple={false}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all duration-200"
          disabled={isUploading}
        >
          Choose Files
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/40 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800/40 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading documents...</div>
        ) : (
          filteredDocuments.map((doc) => (
            <div key={doc.id} className="bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:bg-slate-800/60 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
                    <File className="w-6 h-6 text-slate-300" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white truncate">{doc.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                    </div>

                    <p className="text-sm text-slate-400 mb-3 line-clamp-2">{doc.summary}</p>

                    {doc.category && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          <Tag className="w-3 h-3" />
                          {doc.category}
                        </span>
                        {doc.confidence !== null && (
                          <span className="text-xs text-slate-500">
                            {Math.round(doc.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {doc.type}
                      </span>
                      <span>{doc.size}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(doc.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onNavigate?.('chatpdf')}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(doc.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {filteredDocuments.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {searchTerm ? 'No documents match your search' : 'No documents uploaded yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
