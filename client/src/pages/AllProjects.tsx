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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/project.service';
import type { MyProjectItem, MyProjectsResponse } from '../services/project.service';
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
            All the projects you are part of. Track progress and manage execution.
          </p>
        </div>

        <button
          onClick={() => navigate('/projects/propose')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-btn bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition interactive-tap"
        >
          <Plus className="h-4 w-4" />
          New Project
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
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-btn bg-danger hover:bg-danger/90 text-primary-foreground text-xs font-semibold shadow-sm transition interactive-tap"
          >
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm font-semibold text-foreground">No projects yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Propose a project to start tracking progress and team activity.
          </p>
          <button
            onClick={() => navigate('/projects/propose')}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-btn bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition interactive-tap"
          >
            <Plus className="h-4 w-4" /> Propose Project
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
                  <th className="py-3 px-4 text-center">Progress</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedProjects.map((p) => {
                  const idx = iconIndex(p.id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="hover:bg-surface-subtle/70 transition-colors group cursor-pointer"
                    >
                      {/* 1. Project + domain */}
                      <td className="py-4 px-5">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-btn bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                            {renderProjectIcon(ICON_TYPES[idx])}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                                {p.name}
                              </span>
                              {p.category && (
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
                          <span className="text-muted-foreground">No team</span>
                        )}
                      </td>

                      {/* 3. Status */}
                      <td className="py-4 px-4 text-center align-middle">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
                            statusBadgeClass(p.statusLabel)
                          )}
                        >
                          {p.statusLabel}
                        </span>
                      </td>

                      {/* 4. Progress */}
                      <td className="py-4 px-4 align-middle">
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
                      </td>

                      {/* 5. Last activity */}
                      <td className="py-4 px-4 text-xs text-muted-foreground align-middle">
                        {formatLastActivity(p.lastActivityAt)}
                      </td>

                      {/* 6. Actions */}
                      <td className="py-4 px-5 text-right align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/projects/${p.id}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-btn transition shadow-sm interactive-tap"
                          >
                            Open Workspace
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setWithdrawTarget({ id: p.id, name: p.name });
                            }}
                            className="inline-flex items-center gap-1.5 p-1.5 text-danger hover:bg-danger/10 rounded-btn transition interactive-tap"
                            title="Withdraw from project"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
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
                className="p-2 rounded-btn border border-border bg-card hover:bg-surface-subtle text-foreground disabled:opacity-40 transition shadow-sm interactive-tap"
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
                      'h-8 w-8 rounded-btn text-xs font-semibold transition interactive-tap',
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
                className="p-2 rounded-btn border border-border bg-card hover:bg-surface-subtle text-foreground disabled:opacity-40 transition shadow-sm interactive-tap"
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
