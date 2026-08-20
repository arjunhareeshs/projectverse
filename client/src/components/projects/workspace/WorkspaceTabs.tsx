import React from 'react';
import { Calendar, Users, FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../utils/cn';

export type WorkspaceTabId = 'log' | 'team-features' | 'execution-plan';

interface WorkspaceTabsProps {
  activeTab: WorkspaceTabId;
  onChangeTab: (tab: WorkspaceTabId) => void;
}

export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  activeTab,
  onChangeTab,
}) => {
  const tabs = [
    {
      id: 'log' as const,
      label: 'Daily Log',
      shortLabel: 'Daily Log',
      icon: Calendar,
      description: 'Log daily progress & activity',
    },
    {
      id: 'team-features' as const,
      label: 'Team & Features Allocation',
      shortLabel: 'Team & Features',
      icon: Users,
      description: 'Features, members & reward shares',
    },
    {
      id: 'execution-plan' as const,
      label: 'Phase Execution Plan & Reviews',
      shortLabel: 'Execution Plan',
      icon: FileText,
      description: '4 milestone review checkpoints',
    },
  ];

  return (
    <div className="bg-card border border-border rounded-card p-2 shadow-card">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-btn text-left transition-all duration-200 interactive-tap group relative overflow-hidden',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30'
                  : 'bg-surface-subtle/50 hover:bg-surface-subtle text-foreground border border-border/70 hover:border-primary/40'
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-btn flex items-center justify-center shrink-0 transition-colors',
                  isActive
                    ? 'bg-primary-foreground/15 text-primary-foreground'
                    : 'bg-card text-primary shadow-xs border border-border group-hover:scale-105 transition-transform'
                )}
              >
                <Icon className="w-4.5 h-4.5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs leading-tight truncate">
                    {tab.label}
                  </span>
                  {isActive && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground shrink-0" />
                  )}
                </div>
                <p
                  className={cn(
                    'text-[10px] leading-tight mt-0.5 truncate',
                    isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  )}
                >
                  {tab.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
