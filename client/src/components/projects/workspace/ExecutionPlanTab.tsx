import React from 'react';
import {
  Layers,
  Award,
  Clock,
  Send,
  Edit3,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import { ProjectWorkspaceHook } from './useProjectWorkspace';
import { SubmitPhaseModal } from './modals/SubmitPhaseModal';
import { useAppSelector } from '../../../app/hooks';
import { cn } from '../../../utils/cn';

interface ExecutionPlanTabProps {
  ws: ProjectWorkspaceHook;
}

export const ExecutionPlanTab: React.FC<ExecutionPlanTabProps> = ({ ws }) => {
  const user = useAppSelector((s) => s.auth.user);
  const isReviewer = (user?.role as string) === 'ADMIN' || (user?.role as string) === 'FACULTY';

  const approvedPhasesCount = ws.phases.filter((p) => p.status === 'APPROVED').length;

  return (
    <div className="space-y-6">
      {/* ─── Phase Summary Card ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-card p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Phase Execution Plan & Reviews</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            4 review checkpoints. Points credit on approval.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Progress</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {approvedPhasesCount} of {ws.phases.length || 4} Approved
            </p>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((num) => {
              const phase = ws.phases.find((p) => p.phaseNumber === num);
              const isApproved = phase?.status === 'APPROVED';
              const isSubmitted = phase?.status === 'SUBMITTED';
              return (
                <div
                  key={num}
                  title={`Phase ${num}: ${phase?.status || 'PLANNED'}`}
                  className={cn(
                    'w-3 h-8 rounded-btn transition-colors',
                    isApproved
                      ? 'bg-success'
                      : isSubmitted
                      ? 'bg-warning'
                      : 'bg-muted'
                  )}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Phase Checkpoint Cards List ────────────────────────────────────────── */}
      {ws.phasesLoading ? (
        <div className="py-12 text-center text-muted-foreground bg-card border border-border rounded-card">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-3" />
          <p className="text-xs">Loading phase milestones and checkpoints...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ws.phases.map((phase) => {
            const isEditing = ws.editingPhaseId === phase.id;
            const isPlanned = phase.status === 'PLANNED';
            const isSubmitted = phase.status === 'SUBMITTED';
            const isApproved = phase.status === 'APPROVED';
            const isChangesRequested = phase.status === 'CHANGES_REQUESTED';

            const latestSubmission = phase.submissions && phase.submissions.length > 0
              ? phase.submissions[phase.submissions.length - 1]
              : null;

            return (
              <div
                key={phase.id}
                className={cn(
                  'bg-card border rounded-card p-6 shadow-card transition-all space-y-4 hover-lift',
                  isApproved
                    ? 'border-success/40'
                    : isSubmitted
                    ? 'border-warning/40'
                    : isChangesRequested
                    ? 'border-danger/40'
                    : 'border-border'
                )}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                      {phase.phaseNumber}
                    </span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={ws.phaseEditDraft.title}
                        onChange={(e) =>
                          ws.setPhaseEditDraft({ ...ws.phaseEditDraft, title: e.target.value })
                        }
                        className="text-sm font-semibold text-foreground bg-background border border-border rounded px-2 py-1 outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                      />
                    ) : (
                      <h4 className="text-sm font-semibold text-foreground">{phase.title}</h4>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-subtle text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {isEditing ? (
                        <input
                          type="number"
                          value={ws.phaseEditDraft.weekTarget}
                          onChange={(e) =>
                            ws.setPhaseEditDraft({ ...ws.phaseEditDraft, weekTarget: e.target.value })
                          }
                          className="w-10 bg-background border border-border rounded px-1 text-center"
                        />
                      ) : (
                        `Week ${phase.weekTarget}`
                      )}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary tabular-nums">
                      <Award className="w-3 h-3" />
                      {isEditing ? (
                        <input
                          type="number"
                          value={ws.phaseEditDraft.points}
                          onChange={(e) =>
                            ws.setPhaseEditDraft({ ...ws.phaseEditDraft, points: e.target.value })
                          }
                          className="w-12 bg-background border border-border rounded px-1 text-center"
                        />
                      ) : (
                        `${phase.points} pts`
                      )}
                    </span>

                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize',
                        isApproved
                          ? 'bg-success/10 text-success'
                          : isSubmitted
                          ? 'bg-warning/10 text-warning'
                          : isChangesRequested
                          ? 'bg-danger/10 text-danger'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {phase.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </div>
                </div>

                {/* Deliverables Body */}
                <div className="text-xs space-y-2">
                  <span className="font-semibold text-muted-foreground block uppercase text-[10px] tracking-wider">
                    Expected Deliverables & Checkpoint Scope:
                  </span>
                  {isEditing ? (
                    <textarea
                      rows={2}
                      value={ws.phaseEditDraft.expectedDeliverables}
                      onChange={(e) =>
                        ws.setPhaseEditDraft({
                          ...ws.phaseEditDraft,
                          expectedDeliverables: e.target.value,
                        })
                      }
                      className="w-full text-xs text-foreground bg-background border border-border rounded-input p-2 outline-none focus-visible:ring-1 focus-visible:ring-primary/40 resize-none"
                    />
                  ) : (
                    <p className="text-foreground/90 leading-relaxed bg-surface-subtle/50 p-3 rounded-btn border border-border/80">
                      {phase.expectedDeliverables}
                    </p>
                  )}
                </div>

                {/* Submission note or Review note display */}
                {latestSubmission?.submissionNote && (
                  <div className="p-3 bg-surface-subtle/70 rounded-btn border border-border/80 text-xs space-y-1">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-primary" /> Team Submission Note:
                    </span>
                    <p className="text-muted-foreground">{latestSubmission.submissionNote}</p>
                    {latestSubmission.evidenceUrls && latestSubmission.evidenceUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {latestSubmission.evidenceUrls.map((url: string, i: number) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-primary hover:underline"
                          >
                            Evidence Link #{i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {latestSubmission?.reviewNote && (
                  <div className="p-3 bg-warning/10 rounded-btn border border-warning/20 text-xs space-y-1">
                    <span className="font-semibold text-warning flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" /> Faculty Review Feedback:
                    </span>
                    <p className="text-muted-foreground">{latestSubmission.reviewNote}</p>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/70 text-xs">
                  <div>
                    {isPlanned && !isEditing && (
                      <button
                        onClick={() => ws.handleStartEditPhase(phase)}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-semibold"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit Scope
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {isEditing ? (
                      <>
                        <button
                          onClick={ws.handleCancelEditPhase}
                          className="px-3 py-1.5 border border-border rounded-btn text-muted-foreground hover:text-foreground font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => ws.handleSavePhaseEdit(phase.id)}
                          disabled={ws.savingPhaseEdit}
                          className="px-4 py-1.5 bg-primary text-primary-foreground rounded-btn font-semibold hover:bg-primary/90 shadow-sm interactive-tap"
                        >
                          {ws.savingPhaseEdit ? 'Saving...' : 'Save Draft'}
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Student Action: Submit Phase */}
                        {(isPlanned || isChangesRequested) && (
                          <button
                            onClick={() => ws.setSubmitModalPhaseId(phase.id)}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-btn shadow-sm interactive-tap"
                          >
                            <Send className="w-3.5 h-3.5" /> Submit Evidence
                          </button>
                        )}

                        {/* Reviewer Actions: Approve / Changes Requested */}
                        {isReviewer && isSubmitted && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => ws.handleReviewPhase(phase.id, 'CHANGES_REQUESTED')}
                              disabled={ws.reviewingPhase === phase.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 border border-danger/40 text-danger hover:bg-danger/10 font-semibold rounded-btn transition interactive-tap"
                            >
                              <X className="w-3.5 h-3.5" /> Request Changes
                            </button>
                            <button
                              onClick={() => ws.handleReviewPhase(phase.id, 'APPROVED')}
                              disabled={ws.reviewingPhase === phase.id}
                              className="inline-flex items-center gap-1 px-4 py-1.5 bg-success hover:bg-success/90 text-primary-foreground font-semibold rounded-btn shadow-sm transition interactive-tap"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve & Credit Points
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Phase Modal */}
      <SubmitPhaseModal ws={ws} />
    </div>
  );
};
