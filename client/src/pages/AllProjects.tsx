import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Radio,
  Ban,
  Wind,
  Trash2,
  Sprout,
  Activity,
  Droplets,
  Layers,
  LogOut,
  AlertTriangle,
  Loader2,
  Sparkles,
  Clock,
  Github,
  X,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/project.service';
import type { MyProjectItem, MyProjectsResponse } from '../services/project.service';
import { capstoneService } from '../services/capstone.service';
import { WithdrawProjectModal } from '../components/projects/WithdrawProjectModal';
import { cn } from '../utils/cn';

const ICON_TYPES = ['wind', 'trash', 'sprout', 'activity', 'droplets'] as const;

/** Stable per-project decoration so a row keeps its icon across refetches and pages. */
const iconIndex = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % ICON_TYPES.length;
};

const renderProjectIcon = (type: string) => {
  switch (type) {
    case 'wind':
      return <Wind className="w-5 h-5" />;
    case 'trash':
      return <Trash2 className="w-5 h-5" />;
    case 'sprout':
      return <Sprout className="w-5 h-5" />;
    case 'activity':
      return <Activity className="w-5 h-5" />;
    case 'droplets':
      return <Droplets className="w-5 h-5" />;
    default:
      return <Layers className="w-5 h-5" />;
  }
};

const statusBadgeClass = (label: MyProjectItem['statusLabel']) => {
  switch (label) {
    case 'In Progress':
      return 'bg-primary/10 text-primary border border-primary/20';
    case 'Completed':
      return 'bg-success/10 text-success border border-success/20';
    case 'In Review':
    case 'Pending Approval':
      return 'bg-warning/10 text-warning border border-warning/20';
    case 'On Hold':
      return 'bg-danger/10 text-danger border border-danger/20';
    default:
      return 'bg-surface-subtle text-muted-foreground border border-border';
  }
};

const formatLastActivity = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const initialsOf = (name: string) =>
  (name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2) || 'T').toUpperCase();

export const AllProjects: React.FC = () => {
  const [data, setData] = useState<MyProjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [withdrawTarget, setWithdrawTarget] = useState<{ id: string; name: string } | null>(null);

  // GitHub Submission Modal State for Capstone
  const [githubSubmitTarget, setGithubSubmitTarget] = useState<{
    selectionId: string;
    projectName: string;
  } | null>(null);
  const [repoUrlInput, setRepoUrlInput] = useState('');
  const [isSubmittingRepo, setIsSubmittingRepo] = useState(false);
  const [repoSubmitError, setRepoSubmitError] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchMyProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await projectService.getMyProjects();
      setData(res);
    } catch (err) {
      console.error('Error fetching my projects:', err);
      setData(null);
      setError('We could not load your projects. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMyProjects();
  }, [fetchMyProjects]);

  const projects = data?.projects ?? [];
  const summary = data?.summary ?? { total: 0, inProgress: 0, completed: 0, onHold: 0 };

  const totalPages = Math.max(1, Math.ceil(projects.length / pageSize));
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return projects.slice(start, start + pageSize);
  }, [projects, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleOpenGithubSubmitModal = (selectionId: string, projectName: string) => {
    setGithubSubmitTarget({ selectionId, projectName });
    setRepoUrlInput('');
    setRepoSubmitError(null);
  };

  const handleSubmitGithubRepo = async () => {
    if (!githubSubmitTarget || !repoUrlInput.trim()) return;

    try {
      setIsSubmittingRepo(true);
      setRepoSubmitError(null);
      await capstoneService.submitGithub(githubSubmitTarget.selectionId, repoUrlInput.trim());
      setGithubSubmitTarget(null);
      setRepoUrlInput('');
      await fetchMyProjects();
    } catch (err: any) {
      console.error('Failed to submit GitHub repo:', err);
      setRepoSubmitError(
        err.response?.data?.message || 'Failed to analyze repository. Please verify the URL and try again.'
      );
    } finally {
      setIsSubmittingRepo(false);
    }
  };

  const stats = [
    {
      label: 'Total Projects',
      value: summary.total,
      hint: 'Projects you are part of',
      icon: <Radio className="w-5 h-5" />,
      tone: 'bg-primary/10 text-primary',
    },
    {
      label: 'Active Projects',
      value: summary.inProgress,
      hint: 'In progress',
      icon: <CheckCircle2 className="w-5 h-5" />,
      tone: 'bg-primary/10 text-primary',
    },
    {
      label: 'Completed Projects',
      value: summary.completed,
      hint: 'Successfully completed',
      icon: <CheckCircle2 className="w-5 h-5" />,
      tone: 'bg-success/10 text-success',
    },
    {
      label: 'On Hold',
      value: summary.onHold,
      hint: 'Temporarily paused',
      icon: <Ban className="w-5 h-5" />,
      tone: 'bg-danger/10 text-danger',
    },
  ];

  return (
    <div className="min-h-screen bg-background font-sans space-y-6 max-w-7xl mx-auto pb-12">
      {/* ─── Top Header Bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">My Projects</h1>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            All the projects you are part of. Track progress, submit capstone repos, and attend MCQ evaluations.
          </p>
        </div>

        <button
          onClick={() => navigate('/projects/catalog')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-btn bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition interactive-tap cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Explore & Claim Projects
        </button>
      </div>

      {/* ─── Top Metric Stat Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-card p-5 shadow-card flex items-center gap-4 hover-lift"
          >
            <div className={`w-11 h-11 rounded-btn ${s.tone} flex items-center justify-center shrink-0`}>
              {s.icon}
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium block">{s.label}</span>
              <span className="text-2xl font-semibold text-foreground leading-tight block tabular-nums">
                {loading ? '—' : s.value}
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">{s.hint}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Workspace Listing ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="rounded-card border border-border bg-card p-12 text-center shadow-card">
          <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto" />
          <p className="text-sm font-semibold text-foreground mt-3">Loading your projects…</p>
        </div>
      ) : error ? (
        <div className="rounded-card border border-danger/20 bg-danger/10 p-12 text-center">
          <AlertTriangle className="w-5 h-5 text-danger mx-auto" />
          <p className="text-sm font-semibold text-danger mt-3">{error}</p>
          <button
            onClick={() => void fetchMyProjects()}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-btn bg-danger hover:bg-danger/90 text-primary-foreground text-xs font-semibold shadow-sm transition interactive-tap cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm font-semibold text-foreground">No projects yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Choose a normal problem statement or a 7-day Capstone Challenge from the catalog.
          </p>
          <button
            onClick={() => navigate('/projects/catalog')}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-btn bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition interactive-tap cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Browse Catalog
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-surface-subtle border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Project Details</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Progress / Score</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedProjects.map((p) => {
                  const idx = iconIndex(p.id);
                  const isCapstone = p.mode === 'CAPSTONE' || Boolean(p.capstone);
                  const cap = p.capstone;
                  const isPast7Days = cap ? new Date().getTime() >= new Date(cap.dueAt).getTime() : false;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="hover:bg-surface-subtle/70 transition-colors group cursor-pointer"
                    >
                      {/* 1. Project + domain */}
                      <td className="py-4 px-5">
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-btn flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform ${
                            isCapstone ? 'bg-indigo-50 text-indigo-600' : 'bg-primary/10 text-primary'
                          }`}>
                            {isCapstone ? <Sparkles className="w-5 h-5" /> : renderProjectIcon(ICON_TYPES[idx])}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                                {p.name}
                              </span>
                              {isCapstone && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wide">
                                  Capstone
                                </span>
                              )}
                              {p.category && !isCapstone && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide">
                                  {p.category.replace(/_/g, ' ')}
                                </span>
                              )}
                              {p.isCollaboration && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-surface-subtle text-foreground uppercase tracking-wide">
                                  Collab
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 space-x-1 font-medium">
                              {p.domain && <span>{p.domain}</span>}
                              {p.domain && p.sector && <span>•</span>}
                              {p.sector && <span>{p.sector}</span>}
                              {!p.domain && !p.sector && <span className="text-muted-foreground">No domain set</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Team */}
                      <td className="py-4 px-4 align-middle">
                        {p.team ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground font-semibold text-[10px] flex items-center justify-center shrink-0">
                              {initialsOf(p.team.name)}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{p.team.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {p.team.memberCount} {p.team.memberCount === 1 ? 'member' : 'members'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Individual / Assigned</span>
                        )}
                      </td>

                      {/* 3. Status Column */}
                      <td className="py-4 px-4 text-center align-middle">
                        {isCapstone && cap ? (
                          cap.status === 'CLAIMED' ? (
                            !isPast7Days ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  <Clock className="w-3 h-3 text-indigo-600" />
                                  Capstone Active
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  Due on: {new Date(cap.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  Due for Submission
                                </span>
                                <span className="text-[10px] text-amber-700 font-medium">
                                  7-day period complete
                                </span>
                              </div>
                            )
                          ) : cap.status === 'MCQ_READY' || cap.status === 'SUBMITTED' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <Sparkles className="w-3 h-3 text-blue-600" />
                                MCQ Ready
                              </span>
                              <span className="text-[10px] text-blue-600 font-medium">
                                Codebase Analyzed
                              </span>
                            </div>
                          ) : cap.status === 'COMPLETED' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Completed
                              </span>
                              <span className="text-[11px] font-bold text-emerald-800">
                                Score: {cap.mcqScore ?? 0}/15
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                              {cap.status}
                            </span>
                          )
                        ) : (
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
                              statusBadgeClass(p.statusLabel)
                            )}
                          >
                            {p.statusLabel}
                          </span>
                        )}
                      </td>

                      {/* 4. Progress / Score Column */}
                      <td className="py-4 px-4 align-middle">
                        {isCapstone && cap?.status === 'COMPLETED' ? (
                          <div className="flex flex-col items-center justify-center">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${Math.round(((cap.mcqScore || 0) / 15) * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-emerald-700">
                                {Math.round(((cap.mcqScore || 0) / 15) * 100)}%
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              MCQ Score: {cap.mcqScore}/15
                            </span>
                          </div>
                        ) : isCapstone ? (
                          <div className="text-center text-xs font-medium text-slate-500">
                            {cap?.status === 'MCQ_READY' ? (
                              <span className="text-blue-600 font-semibold">15 MCQs Ready</span>
                            ) : (
                              <span>7-Day Build Cycle</span>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-500"
                                  style={{ width: `${p.progress.percentage}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-foreground w-8 text-right tabular-nums">
                                {p.progress.percentage}%
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-medium text-center mt-1">
                              {p.progress.totalTasks === 0
                                ? 'No tasks yet'
                                : `${p.progress.completedTasks}/${p.progress.totalTasks} tasks`}
                            </div>
                          </>
                        )}
                      </td>

                      {/* 5. Last activity */}
                      <td className="py-4 px-4 text-xs text-muted-foreground align-middle">
                        {formatLastActivity(p.lastActivityAt)}
                      </td>

                      {/* 6. Actions */}
                      <td className="py-4 px-5 text-right align-middle">
                        <div className="flex items-center justify-end gap-2">
                          {/* Capstone specific actions */}
                          {isCapstone && cap ? (
                            cap.status === 'CLAIMED' ? (
                              isPast7Days ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenGithubSubmitModal(cap.id, p.name);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-btn transition shadow-sm interactive-tap cursor-pointer"
                                >
                                  <Github className="w-3.5 h-3.5" />
                                  Submit GitHub Repository
                                </button>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/projects/${p.id}`);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-btn transition interactive-tap cursor-pointer"
                                  >
                                    Open Workspace
                                  </button>
                                  {/* Quick dev-mode trigger so testing doesn't require waiting 7 days */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenGithubSubmitModal(cap.id, p.name);
                                    }}
                                    title="Dev Test: Submit repository without waiting 7 days"
                                    className="p-1 text-slate-400 hover:text-indigo-600 text-[10px] underline"
                                  >
                                    (Submit)
                                  </button>
                                </div>
                              )
                            ) : cap.status === 'MCQ_READY' || cap.status === 'SUBMITTED' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/capstone/${cap.id}/mcq`);
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-btn transition shadow-sm interactive-tap cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                Attend MCQ
                              </button>
                            ) : cap.status === 'COMPLETED' ? (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2.5 py-1 rounded-btn bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                                  Score: {cap.mcqScore ?? 0}/15
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/projects/${p.id}`);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-subtle hover:bg-muted text-foreground text-xs font-medium rounded-btn transition interactive-tap cursor-pointer"
                                >
                                  Workspace
                                </button>
                              </div>
                            ) : null
                          ) : (
                            // Normal Project Actions
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/projects/${p.id}`);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-btn transition shadow-sm interactive-tap cursor-pointer"
                            >
                              Open Workspace
                            </button>
                          )}

                          {!isCapstone && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setWithdrawTarget({ id: p.id, name: p.name });
                              }}
                              className="inline-flex items-center gap-1.5 p-1.5 text-danger hover:bg-danger/10 rounded-btn transition interactive-tap cursor-pointer"
                              title="Withdraw from project"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Footer Pagination ─────────────────────────────────────────────────── */}
      {!loading && !error && projects.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground font-medium">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, projects.length)} of {projects.length} projects
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-btn border border-border bg-card hover:bg-surface-subtle text-foreground disabled:opacity-40 transition shadow-sm interactive-tap cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {[...Array(totalPages)].map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      'h-8 w-8 rounded-btn text-xs font-semibold transition interactive-tap cursor-pointer',
                      currentPage === pageNum
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-card text-foreground hover:bg-surface-subtle border border-border'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-btn border border-border bg-card hover:bg-surface-subtle text-foreground disabled:opacity-40 transition shadow-sm interactive-tap cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-btn bg-card border border-border text-xs font-semibold text-foreground outline-none cursor-pointer"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ─── Submit GitHub Repository Modal ────────────────────────────────────── */}
      {githubSubmitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Github className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Submit GitHub Repository</h3>
                  <p className="text-[11px] text-slate-500">{githubSubmitTarget.projectName}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isSubmittingRepo) setGithubSubmitTarget(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-900 text-xs leading-relaxed space-y-1">
                <span className="font-semibold block">Code Analysis & Evaluation:</span>
                Our backend will inspect your public repository's architecture, routes, database schemas, and codebase depth to generate your personalized 15-question MCQ evaluation.
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Public GitHub Repository URL
                </label>
                <div className="relative">
                  <Github className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    disabled={isSubmittingRepo}
                    value={repoUrlInput}
                    onChange={(e) => setRepoUrlInput(e.target.value)}
                    placeholder="https://github.com/username/project-repo"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition"
                  />
                </div>
              </div>

              {repoSubmitError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{repoSubmitError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setGithubSubmitTarget(null)}
                disabled={isSubmittingRepo}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitGithubRepo}
                disabled={isSubmittingRepo || !repoUrlInput.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-200 transition-all cursor-pointer"
              >
                {isSubmittingRepo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Code & Generating MCQs...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Submit & Generate Assessment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Project Modal */}
      {withdrawTarget && (
        <WithdrawProjectModal
          isOpen={!!withdrawTarget}
          projectId={withdrawTarget.id}
          projectName={withdrawTarget.name}
          onClose={() => setWithdrawTarget(null)}
          onSuccess={() => {
            setWithdrawTarget(null);
            void fetchMyProjects();
          }}
        />
      )}
    </div>
  );
};
