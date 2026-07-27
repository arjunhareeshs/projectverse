import React from 'react';
import {
  AlertTriangle,
  Clock,
  UserX,
  Unlink,
  Activity,
  Code,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../../utils/cn';

export interface FlagItem {
  id: string;
  at: string;
  type: 'DELAY' | 'INACTIVE_MEMBER' | 'MISSING_DEPENDENCY' | 'OVERLOAD' | 'TIMELINE_RISK' | 'TECH_DRIFT';
  message: string;
  resolved: boolean;
}

interface FlagBadgeProps {
  flag: FlagItem;
  className?: string;
  onResolve?: (id: string) => void;
}

export const FlagBadge: React.FC<FlagBadgeProps> = ({ flag, className, onResolve }) => {
  const getFlagDetails = () => {
    switch (flag.type) {
      case 'DELAY':
        return {
          icon: Clock,
          color: 'bg-amber-50 text-amber-800 border-amber-200',
          label: 'Delay',
        };
      case 'INACTIVE_MEMBER':
        return {
          icon: UserX,
          color: 'bg-rose-50 text-rose-800 border-rose-200',
          label: 'Inactive Member',
        };
      case 'MISSING_DEPENDENCY':
        return {
          icon: Unlink,
          color: 'bg-purple-50 text-purple-800 border-purple-200',
          label: 'Missing Dependency',
        };
      case 'OVERLOAD':
        return {
          icon: Activity,
          color: 'bg-orange-50 text-orange-800 border-orange-200',
          label: 'Overload',
        };
      case 'TIMELINE_RISK':
        return {
          icon: AlertTriangle,
          color: 'bg-red-50 text-red-800 border-red-200',
          label: 'Timeline Risk',
        };
      case 'TECH_DRIFT':
        return {
          icon: Code,
          color: 'bg-blue-50 text-blue-800 border-blue-200',
          label: 'Tech Drift',
        };
      default:
        return {
          icon: AlertTriangle,
          color: 'bg-gray-50 text-gray-800 border-gray-200',
          label: 'Notice',
        };
    }
  };

  const { icon: Icon, color, label } = getFlagDetails();

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 p-3.5 rounded-xl border text-xs leading-relaxed transition-all shadow-xs',
        flag.resolved ? 'bg-gray-50 text-gray-500 border-gray-200 opacity-60' : color,
        className
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="p-1 rounded-lg shrink-0 bg-white/60 shadow-2xs mt-0.5">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold tracking-tight uppercase text-[10px]">{label}</span>
            <span className="text-[10px] text-gray-400">
              {new Date(flag.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <p className="font-medium text-xs break-words">{flag.message}</p>
        </div>
      </div>
      {onResolve && !flag.resolved && (
        <button
          onClick={() => onResolve(flag.id)}
          className="shrink-0 p-1 text-gray-400 hover:text-green-600 transition-colors"
          title="Mark resolved"
        >
          <CheckCircle2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
