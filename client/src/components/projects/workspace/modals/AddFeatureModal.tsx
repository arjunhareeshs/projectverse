import React from 'react';
import { Sparkles, Edit3, X } from 'lucide-react';
import { ProjectWorkspaceHook } from '../useProjectWorkspace';

interface AddFeatureModalProps {
  ws: ProjectWorkspaceHook;
}

export const AddFeatureModal: React.FC<AddFeatureModalProps> = ({ ws }) => {
  if (!ws.showAddFeatureModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/25 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-card rounded-card border border-border p-6 shadow-floating space-y-4 gpu-layer transform transition-all duration-200 scale-100"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2 text-foreground font-semibold text-base">
            {ws.editingFeatureId ? (
              <>
                <Edit3 className="w-5 h-5 text-primary" /> Edit Feature
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-primary" /> Add Proposed Feature
              </>
            )}
          </div>
          <button
            onClick={() => {
              ws.setShowAddFeatureModal(false);
              ws.setEditingFeatureId(null);
            }}
            className="text-muted-foreground hover:text-foreground rounded-btn p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs">
          <div>
            <label className="font-semibold text-foreground block mb-1">Feature Name</label>
            <input
              type="text"
              placeholder="e.g., Automated Waste Sorting & Telemetry"
              value={ws.newFeature.name}
              onChange={(e) => ws.setNewFeature({ ...ws.newFeature, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-input text-foreground bg-background focus-visible:ring-2 focus-visible:ring-primary/40 outline-none text-xs transition-shadow"
            />
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Detailed Description</label>
            <textarea
              rows={3}
              placeholder="Describe the operational mechanism and intended technical impact..."
              value={ws.newFeature.description}
              onChange={(e) => ws.setNewFeature({ ...ws.newFeature, description: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-input text-foreground bg-background focus-visible:ring-2 focus-visible:ring-primary/40 outline-none text-xs transition-shadow resize-none"
            />
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Implementation Method</label>
            <textarea
              rows={2}
              placeholder="Algorithms, libraries, APIs, or frameworks to be used..."
              value={ws.newFeature.implementationMethod}
              onChange={(e) => ws.setNewFeature({ ...ws.newFeature, implementationMethod: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-input text-foreground bg-background focus-visible:ring-2 focus-visible:ring-primary/40 outline-none text-xs transition-shadow resize-none"
            />
          </div>

          <div className="p-3 bg-surface-subtle border border-border/80 rounded-btn text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">AI Point Scoring:</span> Points and difficulty are computed server-side by AI based on feature complexity and scope alignment.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
          <button
            onClick={() => {
              ws.setShowAddFeatureModal(false);
              ws.setEditingFeatureId(null);
            }}
            className="px-4 py-2 border border-border text-foreground hover:bg-surface-subtle text-xs font-semibold rounded-btn transition-colors interactive-tap"
          >
            Cancel
          </button>
          <button
            onClick={ws.handleAddFeature}
            disabled={ws.savingFeature || !ws.newFeature.name.trim()}
            className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-semibold rounded-btn shadow-sm transition-all interactive-tap"
          >
            {ws.savingFeature ? 'Evaluating & Saving...' : ws.editingFeatureId ? 'Update Feature' : 'Add Feature'}
          </button>
        </div>
      </div>
    </div>
  );
};
