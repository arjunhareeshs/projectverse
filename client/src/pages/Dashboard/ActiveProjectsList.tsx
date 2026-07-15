import React, { useEffect, useState } from 'react';
import { ArrowRight, Users, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { projectService } from '../../services/project.service';

interface Project {
  id: string;
  name: string;
  client: string;
  teamSize: number;
  dueDate: string;
  progress: number;
  daysLeft: number;
  status: 'On Track' | 'At Risk' | 'In Progress' | 'Completed';
  color: string;
  initials: string;
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  'On Track': { bg: 'bg-success/10', text: 'text-success' },
  'At Risk': { bg: 'bg-warning/10', text: 'text-warning' },
  'In Progress': { bg: 'bg-primary/10', text: 'text-primary' },
  'Completed': { bg: 'bg-success/15', text: 'text-success' },
};

const progressBarColor: Record<string, string> = {
  'On Track': 'bg-success',
  'At Risk': 'bg-warning',
  'In Progress': 'bg-primary',
  'Completed': 'bg-success',
};

export const ActiveProjectsList: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await projectService.getActiveProjects();
        setProjects(data);
      } catch (error) {
        console.error('Failed to load active projects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Active Projects</h3>
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1 text-sm text-primary font-medium hover:underline"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="p-5 text-center text-sm text-muted-foreground">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="p-5 text-center text-sm text-muted-foreground">No active projects found.</div>
        ) : (
          projects.map((project) => {
            const statusStyle = statusConfig[project.status] || { bg: 'bg-muted', text: 'text-muted-foreground' };
            const barColor = progressBarColor[project.status] || 'bg-muted-foreground';

            return (
              <div
                key={project.id}
                className="group px-5 py-4 hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold', project.color)}>
                    {project.initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {project.name}
                      </p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          statusStyle.bg,
                          statusStyle.text
                        )}
                      >
                        {project.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2.5">
                      <span>{project.client}</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> Team of {project.teamSize}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due {project.dueDate}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', barColor)}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {project.progress}% · {project.daysLeft} days left
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
