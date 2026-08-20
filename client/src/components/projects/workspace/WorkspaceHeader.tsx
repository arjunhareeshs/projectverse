import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  Check,
  Layers,
  MoreHorizontal,
  FileDown,
  Folder,
  FileText,
  LogOut,
  Save,
  CheckCircle2,
  Edit2,
} from 'lucide-react';
import { ProjectWorkspaceHook } from './useProjectWorkspace';
import { ProjectLogState } from '../../../types/projectLog';

interface WorkspaceHeaderProps {
  ws: ProjectWorkspaceHook;
  logState?: ProjectLogState | null;
  teamProjects?: any[];
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  ws,
  logState,
  teamProjects = [],
}) => {
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rawStatus = (logState as any)?.status || (logState?.category ? logState.category.replace(/_/g, ' ') : 'In Progress');
  const rewardPercent = Math.min(100, Math.round((ws.totalProjectRewardPoints / 2000) * 100));

  return (
    <div className="sticky top-16 z-20 glass-panel border-b border-border transition-all">
      {/* ─── Row 1: Primary Action Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border/70">
        {/* Left: Back button + Inline Editable Project Title + Status Chip */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => navigate('/projects')}
            title="Back to all projects"
            className="p-2 rounded-btn text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors shrink-0 interactive-tap"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 min-w-0 flex-1 group">
            <input
              type="text"
              value={ws.projectName}
              placeholder="Untitled project"
              onChange={(e) => {
                ws.setProjectName(e.target.value);
                ws.setIsDirty(true);
              }}
              className="text-lg sm:text-xl font-semibold text-foreground tracking-tight bg-transparent border border-transparent hover:border-border/80 focus:border-primary/50 focus:bg-background rounded-md px-2 py-0.5 outline-none truncate transition-all w-full max-w-lg"
            />
            <Edit2 className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>

          {rawStatus && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0 capitalize">
              {rawStatus}
            </span>
          )}
        </div>

        {/* Right: Switcher + Save State + Overflow Menu */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Switch Project Dropdown */}
          {teamProjects.length > 0 && (
            <div className="relative" ref={switcherRef}>
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-foreground text-xs font-semibold rounded-btn hover:bg-surface-subtle transition shadow-sm interactive-tap"
              >
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="hidden md:inline">Switch</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>

              {switcherOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-card shadow-floating z-30 py-1.5 max-h-80 overflow-y-auto gpu-layer animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Team Projects
                  </div>
                  {teamProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSwitcherOpen(false);
                        navigate(`/projects/${p.id}`);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-surface-subtle transition-colors"
                    >
                      <span className="truncate">
                        <span className="font-semibold block truncate">{p.name || 'Untitled'}</span>
                        {p.domain && <span className="text-[10px] text-muted-foreground">{p.domain}</span>}
                      </span>
                      {p.id === ws.projectId && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Smart Dirty-State Save Button */}
          {ws.isDirty ? (
            <button
              onClick={ws.handleSaveDoc}
              disabled={ws.saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-btn shadow-sm transition-all interactive-tap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{ws.saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              <span>All changes saved</span>
            </div>
          )}

          {/* Overflow Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-2 bg-card border border-border text-foreground hover:bg-surface-subtle rounded-btn transition shadow-sm interactive-tap"
              title="More actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-card shadow-floating z-30 py-1 gpu-layer animate-in fade-in zoom-in-95 duration-150 text-xs">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/projects');
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-foreground hover:bg-surface-subtle text-left transition-colors"
                >
                  <Folder className="w-4 h-4 text-muted-foreground" /> All Projects
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    ws.handleExportPdf();
                  }}
                  disabled={ws.exporting}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-foreground hover:bg-surface-subtle text-left transition-colors"
                >
                  <FileDown className="w-4 h-4 text-muted-foreground" />
                  {ws.exporting ? 'Exporting PDF...' : 'Export PDF'}
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(`/projects/${ws.projectId}/execution-doc`);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-foreground hover:bg-surface-subtle text-left transition-colors"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" /> Open Execution Doc
                </button>

                <div className="my-1 border-t border-border" />

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    ws.setShowWithdrawModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-danger hover:bg-danger/10 text-left font-semibold transition-colors"
                >
                  <LogOut className="w-4 h-4 text-danger" /> Withdraw Project
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Row 2: Compact Meta Strip ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-6 py-2 bg-background/50 text-xs text-muted-foreground font-medium">
        <div className="flex items-center gap-2 truncate">
          <span>{ws.domain}</span>
          <span>·</span>
          <span>{ws.subdomain}</span>
          <span>·</span>
          <span>Proposed: {ws.proposedDate}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Reward Points:</span>
            <span className="font-semibold text-foreground tabular-nums">
              {ws.totalProjectRewardPoints.toLocaleString()} / 2,000 pts
            </span>
          </div>

          <div className="w-24 sm:w-32 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-500 ease-spring-snappy"
              style={{ width: `${rewardPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
