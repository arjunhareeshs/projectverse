import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useAppSelector } from '../app/hooks';
import { ProjectReviewerPanel } from '../components/projects/ProjectReviewerPanel';
import { DailyLogTab } from './ProjectWorkspace/DailyLogTab';
import { IntakeWizard } from '../components/lifecycle/IntakeWizard';
import { WithdrawProjectModal } from '../components/projects/WithdrawProjectModal';
import { lifecycleService } from '../services/lifecycle.service';
import { teamService } from '../services/team.service';
import { ProjectLogState } from '../types/projectLog';
import {
  useProjectWorkspace,
  WorkspaceHeader,
  WorkspaceTabs,
  TeamFeaturesTab,
  ExecutionPlanTab,
  WorkspaceTabId,
} from '../components/projects/workspace';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  const initialTabParam = searchParams.get('tab') as WorkspaceTabId | null;
  const [activeTab, setActiveTabState] = useState<WorkspaceTabId>(
    initialTabParam && ['log', 'team-features', 'execution-plan'].includes(initialTabParam)
      ? initialTabParam
      : 'log'
  );
  const [logState, setLogState] = useState<ProjectLogState | null>(null);
  const [, setUnresolvedFlagsCount] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setJustGeneratedFallback] = useState(false);
  const [teamProjects, setTeamProjects] = useState<any[]>([]);

  const projectId = id || '';

  // Synchronize state with URL search params
  useEffect(() => {
    const tabParam = searchParams.get('tab') as WorkspaceTabId | null;
    if (tabParam && ['log', 'team-features', 'execution-plan'].includes(tabParam)) {
      setActiveTabState(tabParam);
    }
  }, [searchParams]);

  const setActiveTab = (tab: WorkspaceTabId) => {
    setActiveTabState(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const fetchLogState = async () => {
    if (!projectId) {
      setError('Invalid project ID specified in URL.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const state = await lifecycleService.getLogState(projectId);
      setLogState(state);
      if (state && state.flags) {
        const count = state.flags.filter((f) => !f.resolved).length;
        setUnresolvedFlagsCount(count);
      }
    } catch (err: any) {
      console.error('Failed to load project log state', err);
      setError(err?.response?.data?.message || 'Could not load this project workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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

  // Hoisted workspace state
  const ws = useProjectWorkspace({
    projectId,
    logState,
    onSaved: fetchLogState,
  });

  // Guard for missing project ID or load error
  if (!projectId || error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          {error || 'Project Not Found'}
        </h2>
        <p className="text-xs text-muted-foreground max-w-sm">
          We couldn't retrieve the project details. Please check the URL or try reloading.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => navigate('/projects')}
            className="px-4 py-2 border border-border text-foreground hover:bg-surface-subtle text-xs font-semibold rounded-btn transition interactive-tap"
          >
            All Projects
          </button>
          <button
            onClick={fetchLogState}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-btn shadow-sm transition interactive-tap"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  // Shimmer skeleton loading state
  if (loading && !logState) {
    return (
      <div className="space-y-6 pb-16 animate-pulse">
        <div className="h-24 rounded-card skeleton-shimmer" />
        <div className="h-16 rounded-card skeleton-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 rounded-card skeleton-shimmer" />
          <div className="h-64 rounded-card skeleton-shimmer" />
          <div className="h-64 rounded-card skeleton-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* ─── 1. Sticky Action Header & Meta Strip ──────────────────────────────── */}
      <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
        <WorkspaceHeader
          ws={ws}
          logState={logState}
          teamProjects={teamProjects}
        />
      </div>

      {/* ─── 2. Prominent Workspace Tabs Navigation ────────────────────────────── */}
      <WorkspaceTabs
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      />

      {/* ─── 3. Active Tab Body Content ────────────────────────────────────────── */}
      <div className="pt-1">
        {activeTab === 'log' && <DailyLogTab projectId={projectId} />}
        {activeTab === 'team-features' && <TeamFeaturesTab ws={ws} />}
        {activeTab === 'execution-plan' && <ExecutionPlanTab ws={ws} />}
      </div>

      {/* ─── Review Panel (REVIEWER or ADMIN only) ───────────────────────────────── */}
      {((user as any)?.role === 'REVIEWER' || (user as any)?.role === 'ADMIN') && (
        <div className="pt-8 border-t border-border">
          <ProjectReviewerPanel projectId={projectId} />
        </div>
      )}

      {/* ─── Intake Wizard Modal ───────────────────────────────────────────────── */}
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

      {/* ─── Withdraw Project Modal ────────────────────────────────────────────── */}
      <WithdrawProjectModal
        isOpen={ws.showWithdrawModal}
        projectId={projectId}
        projectName={ws.projectName || logState?.title || 'Current Project'}
        onClose={() => ws.setShowWithdrawModal(false)}
        onSuccess={() => navigate('/projects')}
      />
    </div>
  );
};
