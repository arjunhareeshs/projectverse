import React from 'react';
import { UserPlus, Search, X, Check } from 'lucide-react';
import { ProjectWorkspaceHook } from '../useProjectWorkspace';

interface AddMemberModalProps {
  ws: ProjectWorkspaceHook;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({ ws }) => {
  if (!ws.showMemberSearchModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/25 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-card rounded-card border border-border p-6 shadow-floating space-y-4 gpu-layer"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2 text-foreground font-semibold text-base">
            <UserPlus className="w-5 h-5 text-primary" /> Add Team Member
          </div>
          <button
            onClick={() => ws.setShowMemberSearchModal(false)}
            className="text-muted-foreground hover:text-foreground rounded-btn p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search student by Name, Email, or Reg No..."
              value={ws.candidateQuery}
              onChange={(e) => ws.handleSearchCandidates(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-input text-foreground bg-background text-xs focus-visible:ring-2 focus-visible:ring-primary/40 outline-none"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 border border-border/70 rounded-btn p-2">
            {ws.searchingCandidates ? (
              <div className="py-6 text-center text-xs text-muted-foreground animate-pulse">
                Searching candidate registry...
              </div>
            ) : ws.candidates.length > 0 ? (
              ws.candidates.map((cand) => {
                const inShare = ws.teamShare.some((m) => m.userId === cand.id);
                return (
                  <div
                    key={cand.id}
                    className="flex items-center justify-between p-2 rounded-btn bg-background border border-border/60 hover:border-primary/40 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-foreground">{cand.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {cand.email} {cand.regNo ? `· ${cand.regNo}` : ''}
                      </p>
                    </div>
                    {inShare ? (
                      <span className="text-[10px] font-semibold text-success flex items-center gap-1">
                        <Check className="w-3 h-3" /> Added
                      </span>
                    ) : (
                      <button
                        onClick={() => ws.handleAddCandidate(cand)}
                        className="px-2.5 py-1 bg-primary text-primary-foreground text-[11px] font-semibold rounded-btn hover:bg-primary/90 transition shadow-xs interactive-tap"
                      >
                        Add
                      </button>
                    )}
                  </div>
                );
              })
            ) : ws.candidateQuery.trim().length >= 2 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No matching students found for "{ws.candidateQuery}".
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Type at least 2 characters to search across students.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border/80">
          <button
            onClick={() => ws.setShowMemberSearchModal(false)}
            className="px-4 py-2 border border-border text-foreground hover:bg-surface-subtle text-xs font-semibold rounded-btn transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
