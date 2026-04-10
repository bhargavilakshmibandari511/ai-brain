import React, { useState, useEffect } from 'react';
import { Download, Zap } from 'lucide-react';

interface ModelLoadingProgressProps {
  isVisible: boolean;
  progress: number; // 0-100
  status: string;
  model: string;
  estimatedTime?: number; // seconds
}

export const ModelLoadingProgress: React.FC<ModelLoadingProgressProps> = ({
  isVisible,
  progress,
  status,
  model,
  estimatedTime,
}) => {
  const [displayTime, setDisplayTime] = useState<string>('');

  useEffect(() => {
    if (estimatedTime) {
      if (estimatedTime < 60) {
        setDisplayTime(`${Math.round(estimatedTime)}s`);
      } else {
        setDisplayTime(`${Math.round(estimatedTime / 60)}m`);
      }
    }
  }, [estimatedTime]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-850 rounded-xl border border-slate-700 p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/30 flex items-center justify-center">
            <Download className="w-8 h-8 text-purple-400 animate-bounce" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white text-center mb-2">
          Initializing AI Model
        </h2>

        {/* Model Name */}
        <p className="text-sm text-slate-400 text-center mb-6">
          {model}
        </p>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden border border-slate-600">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Progress Text */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-white">
            {progress}%
          </span>
          {displayTime && (
            <span className="text-xs text-slate-400">
              ~{displayTime} remaining
            </span>
          )}
        </div>

        {/* Status Message */}
        <div className="text-sm text-slate-300 text-center mb-4">
          {status}
        </div>

        {/* Tips */}
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
          <div className="flex gap-2 text-xs text-slate-400">
            <Zap className="w-4 h-4 flex-shrink-0 text-yellow-500 mt-0.5" />
            <p>
              <strong>First run setup.</strong> This happens once. Subsequent messages will be instant.
            </p>
          </div>
        </div>

        {/* Note */}
        <p className="text-xs text-slate-500 text-center mt-4">
          Keep this window open. Don't close your browser.
        </p>
      </div>
    </div>
  );
};
