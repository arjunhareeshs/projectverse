import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Calendar,
  Users,
  Layers,
  ChevronDown,
  Check,
  Folder,
  LogOut,
} from 'lucide-react';
import { useAppSelector } from '../app/hooks';
import { ProjectReviewerPanel } from '../components/projects/ProjectReviewerPanel';
import { ProjectExecutionTemplate } from '../components/projects/ProjectExecutionTemplate';
import { DailyLogTab } from './ProjectWorkspace/DailyLogTab';
import { IntakeWizard } from '../components/lifecycle/IntakeWizard';
import { WithdrawProjectModal } from '../components/projects/WithdrawProjectModal';
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
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
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
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 bg-[#FAFAFC] min-h-screen">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
            {logState?.title || 'Untitled Project'}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative" ref={switcherRef}>
            <button
              onClick={() => setSwitcherOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200/90 text-[#0F172A] text-xs font-bold rounded-xl hover:bg-gray-50 transition shadow-2xs"
            >
              <Layers className="w-4 h-4 text-gray-600" /> Switch Project
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl transition shadow-xs"
          >
            <Folder className="w-4 h-4" /> All Projects
          </button>

          <button
            onClick={() => setShowWithdrawModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition shadow-2xs"
            title="Withdraw from this project"
          >
            <LogOut className="w-4 h-4 text-rose-600" /> Withdraw Project
          </button>
        </div>
      </div>


      {/* Tabs Navigation Container */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-2 shadow-2xs flex items-center gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#EEF2FF] text-[#4F46E5] shadow-2xs'
                  : 'text-[#64748B] hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#4F46E5]' : 'text-gray-500'}`} />
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
            hideHeader={true}
            hideTabs={true}
            onBack={() => navigate('/projects')}
          />
        )}
        {activeTab === 'execution-plan' && (
          <ProjectExecutionTemplate
            projectId={projectId}
            logState={logState}
            initialTab="execution-plan"
            hideHeader={true}
            hideTabs={true}
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

      {/* Withdraw Project Modal */}
      <WithdrawProjectModal
        isOpen={showWithdrawModal}
        projectId={projectId}
        projectName={logState?.title || 'Current Project'}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={() => navigate('/projects')}
      />
    </div>
  );
};


