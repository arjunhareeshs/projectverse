import React from 'react';
import { AlertTriangle, AlertCircle, Info, ShieldAlert } from 'lucide-react';

interface SeverityBadgeProps {
  severity: 'DISTINCT' | 'PARTIAL_OVERLAP' | 'SUBSTANTIAL_OVERLAP' | 'NEAR_DUPLICATE' | string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  switch (severity) {
    case 'NEAR_DUPLICATE':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
          <ShieldAlert className="h-3 w-3 text-rose-600" />
          Near Duplicate
        </span>
      );
    case 'SUBSTANTIAL_OVERLAP':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="h-3 w-3 text-amber-600" />
          Substantial Overlap
        </span>
      );
    case 'PARTIAL_OVERLAP':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
          <Info className="h-3 w-3 text-sky-600" />
          Partial Overlap
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
          {severity}
        </span>
      );
  }
};
