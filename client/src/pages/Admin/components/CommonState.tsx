import React from 'react';
import { Inbox, AlertCircle, RefreshCw } from 'lucide-react';

export const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs my-4">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
      <Inbox className="h-6 w-6" />
    </div>
    <h3 className="text-sm font-bold text-slate-800">{title}</h3>
    <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">{description}</p>
  </div>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center p-10 text-center bg-rose-50/50 rounded-2xl border border-rose-200 my-4">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
      <AlertCircle className="h-5 w-5" />
    </div>
    <h3 className="text-sm font-bold text-rose-900">Failed to Load Intelligence Data</h3>
    <p className="text-xs text-rose-700 max-w-md mt-1 font-medium">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-2xs"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Retry</span>
      </button>
    )}
  </div>
);

export const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-4 my-4">
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx} className="p-5 bg-white rounded-2xl border border-slate-200/80 animate-pulse space-y-3">
        <div className="flex justify-between items-center">
          <div className="h-4 w-1/3 bg-slate-200 rounded" />
          <div className="h-6 w-16 bg-slate-200 rounded-full" />
        </div>
        <div className="h-3 w-2/3 bg-slate-100 rounded" />
        <div className="h-10 w-full bg-slate-50 rounded-xl" />
      </div>
    ))}
  </div>
);
