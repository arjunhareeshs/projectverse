import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Calendar,
  Users,
  MessageSquare,
  ShieldCheck,
  Bot,
  Sparkles,
  Layers,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useAppSelector } from '../app/hooks';
import { ProjectReviewerPanel } from '../components/projects/ProjectReviewerPanel';
import { ProjectExecutionTemplate } from '../components/projects/ProjectExecutionTemplate';
import { DailyLogTab } from './ProjectWorkspace/DailyLogTab';
import { IntakeWizard } from '../components/lifecycle/IntakeWizard';
import { lifecycleService } from '../services/lifecycle.service';
import { teamService } from '../services/team.service';
import { ProjectLogState } from '../types/projectLog';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const switcherRef = useRef<HTMLDivElement>(null);

  const initialTabParam = searchParams.get('tab') as 'log' | 'team-features' | 'execution-plan' | null;
  const [activeTab, setActiveTabState] = useState<'log' | 'team-features' | 'execution-plan'>(
    initialTabParam || 'log'
  );
  const [logState, setLogState] = useState<ProjectLogState | null>(null);
  const [unresolvedFlagsCount, setUnresolvedFlagsCount] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justGeneratedFallback, setJustGeneratedFallback] = useState(false);
  const [teamProjects, setTeamProjects] = useState<any[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const projectId = id || '1';

  const setActiveTab = (tab: 'log' | 'team-features' | 'execution-plan') => {
    setActiveTabState(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const fetchLogState = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const state = await lifecycleService.getLogState(id);
      setLogState(state);
      if (state && state.flags) {
        const count = state.flags.filter((f) => !f.resolved).length;
        setUnresolvedFlagsCount(count);
      }
    } catch (err) {
      console.error('Failed to load project log state', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogState();
  }, [id]);

  const teamId = logState?.team?.teamId || user?.teamId;

  useEffect(() => {
    if (!teamId) {
      setTeamProjects([]);
      return;
    }
    teamService
      .getTeamProjects(teamId)
      .then((projects) => setTeamProjects(Array.isArray(projects) ? projects : []))
      .catch((err) => console.error('Failed to load team projects', err));
  }, [teamId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tabs = [
    { id: 'log', label: 'Daily Log', icon: Calendar },
    { id: 'team-features', label: 'Team & Features Allocation', icon: Users },
    { id: 'execution-plan', label: 'Phase Execution Plan & Reviews', icon: FileText },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-[#EEF2FF] text-[#4338CA] tracking-wide uppercase">
              {logState?.category
                ? logState.category.endsWith('_PROJECT')
                  ? logState.category
                  : `${logState.category}_PROJECT`
                : 'FINAL_YEAR_PROJECT'}
            </span>
            <span className="text-[11px] font-semibold text-gray-500">
              {logState?.duration?.months ? `${logState.duration.months} Months Duration` : '6 Months Duration'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
            {logState?.title || 'Wind Powered Child Warming System'}
          </h1>
          <p className="text-xs text-[#64748B] font-normal mt-1">
            Track daily work logs, team allocation, and phase execution reviews for this project.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative" ref={switcherRef}>
            <button
              onClick={() => setSwitcherOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200/90 text-[#0F172A] text-xs font-bold rounded-2xl hover:bg-gray-50 transition shadow-2xs"
            >
              <Layers className="w-3.5 h-3.5 text-gray-600" /> Switch Project
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            </button>
            {switcherOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 max-h-80 overflow-y-auto">
                {teamProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSwitcherOpen(false);
                      navigate(`/projects/${p.id}`);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50"
                  >
                    <span className="truncate">
                      <span className="font-semibold text-gray-900 block truncate">{p.name}</span>
                      {p.domain && <span className="text-gray-400">{p.domain}</span>}
                    </span>
                    {p.id === projectId && <Check className="w-3.5 h-3.5 text-[#4F46E5] shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/projects')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200/90 text-[#0F172A] text-xs font-bold rounded-2xl hover:bg-gray-50 transition shadow-2xs"
          >
            All Projects
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200/80 gap-8 overflow-x-auto pt-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-0.5 py-3 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'border-[#4F46E5] text-[#4F46E5]'
                  : 'border-transparent text-[#64748B] hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Workspace Content Area */}
      <div className="pt-2">
        {activeTab === 'log' && <DailyLogTab projectId={projectId} />}
        {activeTab === 'team-features' && (
          <ProjectExecutionTemplate
            projectId={projectId}
            logState={logState}
            initialTab="team-features"
            onBack={() => navigate('/projects')}
          />
        )}
        {activeTab === 'execution-plan' && (
          <ProjectExecutionTemplate
            projectId={projectId}
            logState={logState}
            initialTab="execution-plan"
            onBack={() => navigate('/projects')}
          />
        )}
      </div>

      {/* Review Panel section for reviewers/admins */}
      {((user as any)?.role === 'REVIEWER' || (user as any)?.role === 'ADMIN') && (
        <div className="pt-8 border-t border-gray-200">
          <ProjectReviewerPanel projectId={projectId} />
        </div>
      )}

      {/* Intake Wizard Modal */}
      {showWizard && (
        <IntakeWizard
          projectId={projectId}
          category={logState?.category || 'MINI'}
          onComplete={(fallback) => {
            setShowWizard(false);
            setJustGeneratedFallback(!!fallback);
            fetchLogState();
            navigate(`/projects/${projectId}/execution-doc`);
          }}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
};
