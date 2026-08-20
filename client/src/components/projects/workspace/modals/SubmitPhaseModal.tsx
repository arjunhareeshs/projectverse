import React from 'react';
import { Send, X, AlertCircle } from 'lucide-react';
import { ProjectWorkspaceHook } from '../useProjectWorkspace';

interface SubmitPhaseModalProps {
  ws: ProjectWorkspaceHook;
}

export const SubmitPhaseModal: React.FC<SubmitPhaseModalProps> = ({ ws }) => {
  if (!ws.submitModalPhaseId) return null;

  const activePhase = ws.phases.find((p) => p.id === ws.submitModalPhaseId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/25 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-card rounded-card border border-border p-6 shadow-floating space-y-4 gpu-layer"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2 text-foreground font-semibold text-base">
            <Send className="w-5 h-5 text-primary" />
            Submit Phase {activePhase?.phaseNumber}: {activePhase?.title}
          </div>
          <button
            onClick={() => ws.setSubmitModalPhaseId(null)}
            className="text-muted-foreground hover:text-foreground rounded-btn p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs">
          <div className="p-3 bg-surface-subtle border border-border/80 rounded-btn space-y-1">
            <p className="font-semibold text-foreground">Expected Deliverables:</p>
            <p className="text-muted-foreground">{activePhase?.expectedDeliverables}</p>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">
              Submission Summary / Note <span className="text-danger">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Describe what was accomplished, repository branch, release tag, or test results..."
              value={ws.submissionNote}
              onChange={(e) => ws.setSubmissionNote(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-input text-foreground bg-background focus-visible:ring-2 focus-visible:ring-primary/40 outline-none text-xs resize-none"
            />
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">
              Evidence URLs (GitHub PRs, Figma, Live Demos, Docs)
            </label>
            <textarea
              rows={2}
              placeholder="Paste URLs separated by commas or new lines..."
              value={ws.evidenceUrlsText}
              onChange={(e) => ws.setEvidenceUrlsText(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-input text-foreground bg-background focus-visible:ring-2 focus-visible:ring-primary/40 outline-none text-xs resize-none"
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-btn text-warning text-[11px]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Once submitted, this phase enters <strong>FACULTY REVIEW</strong>. Points will be automatically awarded on approval.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
          <button
            onClick={() => ws.setSubmitModalPhaseId(null)}
            className="px-4 py-2 border border-border text-foreground hover:bg-surface-subtle text-xs font-semibold rounded-btn transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={ws.handleSubmitPhase}
            disabled={ws.submittingPhase === ws.submitModalPhaseId || !ws.submissionNote.trim()}
            className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-semibold rounded-btn shadow-sm transition-all interactive-tap"
          >
            {ws.submittingPhase === ws.submitModalPhaseId ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  );
};
