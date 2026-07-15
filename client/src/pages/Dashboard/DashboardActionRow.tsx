import React from 'react';
import { Plus, BarChart3, UserPlus, CheckSquare, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ActionBtn {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export const DashboardActionRow: React.FC = () => {
  const navigate = useNavigate();

  const actions: ActionBtn[] = [
    { icon: Plus, label: '+ New Project', onClick: () => navigate('/projects'), primary: true },
    { icon: FileText, label: 'Generate Weekly Report', onClick: () => navigate('/ai-assistant') },
    { icon: UserPlus, label: 'Invite Team Member', onClick: () => navigate('/team') },
    { icon: CheckSquare, label: 'Add Task', onClick: () => {} },
    { icon: BarChart3, label: 'View Analytics', onClick: () => navigate('/analytics') },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 border ${
            action.primary
              ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-sm'
              : 'bg-card text-foreground border-border hover:bg-muted hover:border-border/80'
          }`}
        >
          <action.icon className="h-3.5 w-3.5" />
          {action.label}
        </button>
      ))}
    </div>
  );
};
