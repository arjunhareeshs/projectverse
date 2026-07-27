import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Calendar,
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
import { DocumentTab } from './ProjectWorkspace/DocumentTab';
import { DailyLogTab } from './ProjectWorkspace/DailyLogTab';
import { ChatTab } from './ProjectWorkspace/ChatTab';
import { EvaluationsTab } from './ProjectWorkspace/EvaluationsTab';
import { MentorPanel } from './ProjectWorkspace/MentorPanel';
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

  const initialTabParam = searchParams.get('tab') as 'document' | 'log' | 'chat' | 'evaluations' | 'mentor' | null;
  const [activeTab, setActiveTabState] = useState<'document' | 'log' | 'chat' | 'evaluations' | 'mentor'>(
    initialTabParam || 'document'
  );
  const [logState, setLogState] = useState<ProjectLogState | null>(null);
  const [unresolvedFlagsCount, setUnresolvedFlagsCount] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justGeneratedFallback, setJustGeneratedFallback] = useState(false);
  const [teamProjects, setTeamProjects] = useState<any[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const projectId = id || '1';

  const setActiveTab = (tab: 'document' | 'log' | 'chat' | 'evaluations' | 'mentor') => {
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
    { id: 'document', label: 'Execution Document', icon: FileText },
    { id: 'log', label: 'Daily Log', icon: Calendar },
    { id: 'chat', label: 'Team Chat', icon: MessageSquare },
    { id: 'evaluations', label: '15-Day Evaluations', icon: ShieldCheck },
    {
      id: 'mentor',
      label: 'AI Assistant',
      icon: Bot,
      badge: unresolvedFlagsCount > 0 ? unresolvedFlagsCount : undefined,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 uppercase tracking-wide">
              {logState?.category || 'MINI'} PROJECT
            </span>
            {logState?.duration?.months && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                {logState.duration.months} Months Duration
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {logState?.title || `Project Lifecycle Workspace (${projectId})`}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Track daily logs, execution baseline, 15-day AI reviews, and continuous mentorship.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {teamProjects.length > 1 && (
            <div className="relative" ref={switcherRef}>
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition"
              >
                <Layers className="w-3.5 h-3.5" /> Switch Project
                <ChevronDown className="w-3.5 h-3.5" />
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
                      {p.id === projectId && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => navigate('/projects')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition"
          >
            All Projects
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5" /> Setup Intake & Doc
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-none gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-xl'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Workspace Content Area */}
      <div className="pt-2">
        {activeTab === 'document' && (
          <DocumentTab
            projectId={projectId}
            logState={logState}
            onLaunchWizard={() => setShowWizard(true)}
            initialFallback={justGeneratedFallback}
          />
        )}
        {activeTab === 'log' && <DailyLogTab projectId={projectId} />}
        {activeTab === 'chat' && <ChatTab teamId={teamId || undefined} />}
        {activeTab === 'evaluations' && <EvaluationsTab projectId={projectId} />}
        {activeTab === 'mentor' && (
          <MentorPanel
            projectId={projectId}
            onFlagsUpdate={(count) => setUnresolvedFlagsCount(count)}
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
            setActiveTab('document');
          }}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
};
