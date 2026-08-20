import React from 'react';
import {
  FileText,
  Award,
  Users,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  Zap,
  BookOpen,
  UserPlus,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { ProjectWorkspaceHook } from './useProjectWorkspace';
import { ExecutionDocEditor } from './ExecutionDocEditor';
import { AddFeatureModal } from './modals/AddFeatureModal';
import { AddMemberModal } from './modals/AddMemberModal';

interface TeamFeaturesTabProps {
  ws: ProjectWorkspaceHook;
}

export const TeamFeaturesTab: React.FC<TeamFeaturesTabProps> = ({ ws }) => {
  return (
    <div className="space-y-6">
      {/* ─── Top Grid: Features Allocation (Left) + Team & Share Allocation (Right) ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ─── Left: Proposed Features Table ─────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-card p-6 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Proposed Features
              </h3>
              <p className="text-xs text-muted-foreground">Scored by AI according to complexity and scope</p>
            </div>
            <button
              onClick={() => {
                ws.setEditingFeatureId(null);
                ws.setNewFeature({ name: '', description: '', implementationMethod: '' });
                ws.setShowAddFeatureModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-btn shadow-sm transition-all interactive-tap self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" /> Propose Feature
            </button>
          </div>

          {/* Feature warning banner if points were reduced */}
          {ws.featureWarning && (
            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-btn text-warning text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{ws.featureWarning}</span>
            </div>
          )}

          {/* Features Table */}
          <div className="border border-border rounded-btn overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle border-b border-border text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">Feature Name</th>
                  <th className="px-3.5 py-2.5 text-center">Importance</th>
                  <th className="px-3.5 py-2.5 text-right">Points</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ws.featuresLoading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-primary mb-2" />
                      <p>Loading AI-scored features...</p>
                    </td>
                  </tr>
                ) : ws.features.length > 0 ? (
                  ws.features.map((feat) => (
                    <tr key={feat.id} className="hover:bg-surface-subtle/60 transition-colors">
                      <td className="px-3.5 py-3">
                        <p className="font-semibold text-foreground">{feat.name}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{feat.description}</p>
                      </td>
                      <td className="px-3.5 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary capitalize">
                          {feat.importance?.toLowerCase() || 'medium'}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right font-semibold text-foreground tabular-nums">
                        {feat.points || 0} pts
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => ws.handleEditFeature(feat)}
                            title="Edit feature"
                            className="p-1 rounded text-muted-foreground hover:text-primary transition-colors interactive-tap"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => ws.handleDeleteFeature(feat.id)}
                            title="Remove feature"
                            className="p-1 rounded text-muted-foreground hover:text-danger transition-colors interactive-tap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      No features allocated yet. Click "Propose Feature" above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-subtle/50 rounded-btn text-xs font-semibold">
            <span className="text-muted-foreground">Total Feature Points:</span>
            <span className="text-primary tabular-nums">{ws.totalFeaturePoints} / 1,000 pts</span>
          </div>
        </div>

        {/* ─── Right: Team & Share Allocation ────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-card p-6 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Team & Share Allocation
              </h3>
              <p className="text-xs text-muted-foreground">Reward capacity adjusts dynamically with team size</p>
            </div>
            <button
              onClick={() => ws.setShowMemberSearchModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border hover:bg-surface-subtle text-foreground text-xs font-semibold rounded-btn shadow-sm transition-all interactive-tap self-start sm:self-auto"
            >
              <UserPlus className="w-3.5 h-3.5 text-primary" /> Add Member
            </button>
          </div>

          {/* Quick-Add for Team Members in Group */}
          {ws.availableGroupMembers.length > 0 && (
            <div className="p-3 bg-surface-subtle/70 border border-border/80 rounded-btn space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Unassigned Team Group Members:
              </span>
              <div className="flex flex-wrap gap-2">
                {ws.availableGroupMembers.map((m) => (
                  <button
                    key={m.userId}
                    onClick={() => ws.handleAddAvailableMember(m)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-card border border-border hover:border-primary/40 text-foreground text-xs font-medium rounded-btn transition shadow-2xs interactive-tap"
                  >
                    <Plus className="w-3 h-3 text-primary" />
                    <span>{m.name || 'Member'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Members Table */}
          <div className="border border-border rounded-btn overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle border-b border-border text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">Member / Role</th>
                  <th className="px-3.5 py-2.5 text-center">Share %</th>
                  <th className="px-3.5 py-2.5 text-right">Reward Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ws.teamShare.map((m) => (
                  <tr key={m.userId} className="hover:bg-surface-subtle/60 transition-colors">
                    <td className="px-3.5 py-3">
                      <p className="font-semibold text-foreground flex items-center gap-1.5">
                        {m.name}
                        {m.isLead && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary/10 text-primary">
                            Lead
                          </span>
                        )}
                      </p>
                      <input
                        type="text"
                        value={m.role}
                        onChange={(e) => ws.handleUpdateMemberRole(m.userId, e.target.value)}
                        className="text-[11px] text-muted-foreground bg-transparent border-0 p-0 focus:ring-1 focus:ring-primary/40 rounded outline-none w-full"
                      />
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={m.sharePercent}
                          onChange={(e) =>
                            ws.handleUpdateMemberShare(m.userId, parseInt(e.target.value, 10) || 0)
                          }
                          className="w-12 px-1.5 py-0.5 text-center font-semibold text-foreground border border-border rounded bg-background text-xs outline-none"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-right font-semibold text-foreground tabular-nums">
                      {m.rewardPoints} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-subtle/50 rounded-btn text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Total Allocation Share:</span>
              <span
                className={
                  ws.totalSharePercent === 100
                    ? 'text-success'
                    : 'text-danger font-bold'
                }
              >
                {ws.totalSharePercent}%
              </span>
            </div>
            <div className="text-primary tabular-nums">
              {ws.totalTeamRewardPoints} / {ws.teamRewardCapacity} capacity pts
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Grid: Summary of Allocations (Left) + ExecutionDocEditor (Right) ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Summary of Allocations */}
        <div className="lg:col-span-1 bg-card border border-border rounded-card p-6 shadow-card space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border/70 pb-3">
            <Award className="w-4 h-4 text-primary" /> Summary of Allocations
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-surface-subtle/50 rounded-btn">
              <span className="text-muted-foreground">Feature Rewards (AI):</span>
              <span className="font-semibold text-foreground tabular-nums">{ws.totalFeaturePoints} pts</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-surface-subtle/50 rounded-btn">
              <span className="text-muted-foreground">Team Capacity Rewards:</span>
              <span className="font-semibold text-foreground tabular-nums">{ws.totalTeamRewardPoints} pts</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-primary/10 border border-primary/20 rounded-btn font-semibold text-primary">
              <span>Total Project Reward:</span>
              <span className="text-sm tabular-nums">{ws.totalProjectRewardPoints.toLocaleString()} pts</span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
              Points are locked upon saving and credited dynamically into individual member profiles once review phases are approved by faculty.
            </p>
          </div>
        </div>

        {/* Right 2 Columns: Editable Execution Document Tab View */}
        <div className="lg:col-span-2">
          <ExecutionDocEditor ws={ws} />
        </div>
      </div>

      {/* ─── Collapsible Details: How Reward Points Work ─────────────────────────── */}
      <details className="group bg-card border border-border rounded-card p-6 shadow-card">
        <summary className="cursor-pointer list-none flex items-center justify-between text-sm font-semibold text-foreground select-none">
          <span className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> How Reward Points Work
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </summary>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs mt-4 pt-4 border-t border-border/70">
          <div className="p-4 rounded-btn bg-surface-subtle/60 border border-border/80 space-y-1">
            <div className="w-7 h-7 rounded-btn bg-primary/10 text-primary flex items-center justify-center font-bold mb-2">
              <Zap className="w-4 h-4" />
            </div>
            <span className="font-semibold text-foreground block">Features (Max 1,000 pts)</span>
            <p className="text-muted-foreground text-[11px]">
              AI scores each feature based on technical complexity and functional deliverables.
            </p>
          </div>

          <div className="p-4 rounded-btn bg-surface-subtle/60 border border-border/80 space-y-1">
            <div className="w-7 h-7 rounded-btn bg-primary/10 text-primary flex items-center justify-center font-bold mb-2">
              <Users className="w-4 h-4" />
            </div>
            <span className="font-semibold text-foreground block">Team Capacity (Up to 850 pts)</span>
            <p className="text-muted-foreground text-[11px]">
              Larger multi-disciplinary teams unlock higher team capacity budgets.
            </p>
          </div>

          <div className="p-4 rounded-btn bg-surface-subtle/60 border border-border/80 space-y-1">
            <div className="w-7 h-7 rounded-btn bg-primary/10 text-primary flex items-center justify-center font-bold mb-2">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-semibold text-foreground block">Share Percentages</span>
            <p className="text-muted-foreground text-[11px]">
              Team members receive points proportional to their assigned share contribution.
            </p>
          </div>

          <div className="p-4 rounded-btn bg-surface-subtle/60 border border-border/80 space-y-1">
            <div className="w-7 h-7 rounded-btn bg-primary/10 text-primary flex items-center justify-center font-bold mb-2">
              <Award className="w-4 h-4" />
            </div>
            <span className="font-semibold text-foreground block">Checkpoint Release</span>
            <p className="text-muted-foreground text-[11px]">
              Points unlock sequentially as faculty review checkpoints are officially approved.
            </p>
          </div>
        </div>
      </details>

      {/* Modals */}
      <AddFeatureModal ws={ws} />
      <AddMemberModal ws={ws} />
    </div>
  );
};
