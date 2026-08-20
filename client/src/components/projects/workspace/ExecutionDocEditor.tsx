import React from 'react';
import { Info, Edit3, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ProjectWorkspaceHook } from './useProjectWorkspace';
import { cn } from '../../../utils/cn';

interface ExecutionDocEditorProps {
  ws: ProjectWorkspaceHook;
}

export const ExecutionDocEditor: React.FC<ExecutionDocEditorProps> = ({ ws }) => {
  const tabs = [
    { id: 'overview' as const, label: 'Project Overview' },
    { id: 'objectives' as const, label: 'Objectives' },
    { id: 'tech' as const, label: 'Tech Stack' },
    { id: 'milestones' as const, label: 'Milestones' },
    { id: 'risks' as const, label: 'Risks' },
    { id: 'resources' as const, label: 'Resources' },
  ];

  return (
    <div className="bg-card border border-border rounded-card p-6 shadow-card space-y-6">
      <div className="flex items-center justify-between border-b border-border/70 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Execution Document (Editable) <Info className="w-4 h-4 text-muted-foreground" />
          </h3>
          <p className="text-xs text-muted-foreground">Canonical project plan baseline</p>
        </div>
      </div>

      {/* Document Navigation Tabs */}
      <div className="flex border-b border-border gap-1 overflow-x-auto text-xs font-semibold scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => ws.setActiveExecTab(t.id)}
            className={cn(
              'px-3 py-2 border-b-2 rounded-t-md transition whitespace-nowrap outline-none',
              ws.activeExecTab === t.id
                ? 'border-primary text-primary bg-primary/10'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content Panes */}
      <div className="space-y-4 text-xs">
        {ws.activeExecTab === 'overview' && (
          <div className="space-y-4">
            <div className="p-4 rounded-card bg-surface-subtle/50 border border-border/80 space-y-2 relative group">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Problem Statement</span>
                <Edit3 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <textarea
                rows={2}
                value={ws.overview.problemStatement}
                onChange={(e) => {
                  ws.setOverview({ ...ws.overview, problemStatement: e.target.value });
                  ws.setIsDirty(true);
                }}
                className="w-full text-xs text-foreground bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-primary/40 rounded p-1 resize-none outline-none"
              />
            </div>

            <div className="p-4 rounded-card bg-surface-subtle/50 border border-border/80 space-y-2 relative group">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Expected Outcome</span>
                <Edit3 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <textarea
                rows={2}
                value={ws.overview.expectedOutcome}
                onChange={(e) => {
                  ws.setOverview({ ...ws.overview, expectedOutcome: e.target.value });
                  ws.setIsDirty(true);
                }}
                className="w-full text-xs text-foreground bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-primary/40 rounded p-1 resize-none outline-none"
              />
            </div>

            <div className="p-4 rounded-card bg-surface-subtle/50 border border-border/80 space-y-2">
              <span className="font-semibold text-foreground block">Target Users</span>
              <input
                type="text"
                value={ws.overview.targetUsers}
                onChange={(e) => {
                  ws.setOverview({ ...ws.overview, targetUsers: e.target.value });
                  ws.setIsDirty(true);
                }}
                className="w-full text-xs text-foreground bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-primary/40 rounded p-1 outline-none"
              />
            </div>
          </div>
        )}

        {ws.activeExecTab === 'objectives' && (
          <div className="space-y-3">
            <span className="font-semibold text-foreground block">Project Core Objectives</span>
            {ws.overview.objectives.map((obj, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <input
                  type="text"
                  value={obj}
                  onChange={(e) => {
                    const updated = [...ws.overview.objectives];
                    updated[i] = e.target.value;
                    ws.setOverview({ ...ws.overview, objectives: updated });
                    ws.setIsDirty(true);
                  }}
                  className="w-full text-xs text-foreground bg-background border border-border rounded-input px-3 py-1.5 focus-visible:ring-1 focus-visible:ring-primary/40 outline-none"
                />
              </div>
            ))}
          </div>
        )}

        {ws.activeExecTab === 'tech' && (
          <div className="space-y-3">
            <span className="font-semibold text-foreground block">Technology Stack & Deliverables</span>
            <div className="flex flex-wrap gap-2">
              {ws.overview.deliverables.map((deliv, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-xs font-medium rounded-btn"
                >
                  {deliv}
                </span>
              ))}
            </div>
          </div>
        )}

        {ws.activeExecTab === 'milestones' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Milestone Deadlines & Outputs</span>
              <button
                type="button"
                onClick={() => {
                  const nextNum = ws.milestones.length + 1;
                  ws.setMilestones((prev) => [
                    ...prev,
                    {
                      id: `m-${Date.now()}`,
                      name: `Milestone ${nextNum}: New Phase Milestone`,
                      expectedOutput: 'Expected deliverable output',
                      completionWeek: nextNum * 3,
                      rewardPoints: 500,
                    },
                  ]);
                  ws.setIsDirty(true);
                }}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                + Add Milestone
              </button>
            </div>

            <div className="space-y-2">
              {ws.milestones.map((ms) => (
                <div key={ms.id} className="p-3.5 rounded-card bg-surface-subtle/50 border border-border/80 space-y-1.5 hover-lift">
                  <div className="flex items-center justify-between font-semibold">
                    <input
                      type="text"
                      value={ms.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        ws.setMilestones((prev) =>
                          prev.map((item) => (item.id === ms.id ? { ...item, name: val } : item))
                        );
                        ws.setIsDirty(true);
                      }}
                      className="bg-transparent border-0 font-semibold text-foreground focus-visible:ring-1 focus-visible:ring-primary/40 rounded p-0 text-xs outline-none"
                    />
                    <span className="text-primary font-semibold tabular-nums">{ms.rewardPoints} pts</span>
                  </div>
                  <input
                    type="text"
                    value={ms.expectedOutput}
                    onChange={(e) => {
                      const val = e.target.value;
                      ws.setMilestones((prev) =>
                        prev.map((item) => (item.id === ms.id ? { ...item, expectedOutput: val } : item))
                      );
                      ws.setIsDirty(true);
                    }}
                    className="w-full bg-transparent border-0 text-xs text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/40 rounded outline-none"
                    placeholder="Expected output..."
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>Deadline: Week {ms.completionWeek}</span>
                    <button
                      onClick={() => {
                        ws.setMilestones((prev) => prev.filter((item) => item.id !== ms.id));
                        ws.setIsDirty(true);
                      }}
                      className="text-danger hover:underline font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {ws.activeExecTab === 'risks' && (
          <div className="space-y-2">
            <span className="font-semibold text-foreground block">Project Risks & Contingencies</span>
            {[
              'API integration delay during multi-vendor hardware deployment.',
              'Telemetry packet loss in remote municipal test zones.',
            ].map((risk, i) => (
              <div
                key={i}
                className="p-3 rounded-card bg-warning/10 border border-warning/20 text-xs text-warning flex items-center gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                <span>{risk}</span>
              </div>
            ))}
          </div>
        )}

        {ws.activeExecTab === 'resources' && (
          <div className="space-y-2">
            <span className="font-semibold text-foreground block">Hardware & Cloud Resources</span>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
              <li>PostgreSQL Cloud Instance & Redis Cache</li>
              <li>AWS EC2 t3.medium for Telemetry Ingestion</li>
              <li>IoT Ultrasonic Sensor Kit (HC-SR04) & ESP32 NodeMCU</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
