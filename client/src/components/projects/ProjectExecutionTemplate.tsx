import React, { useState } from 'react';
import { ExecutionDocContent, ProjectLogState } from '../../types/projectLog';
import {
  useProjectWorkspace,
  WorkspaceHeader,
  WorkspaceTabs,
  TeamFeaturesTab,
  ExecutionPlanTab,
  WorkspaceTabId,
} from './workspace';
import { WithdrawProjectModal } from './WithdrawProjectModal';
import { useNavigate } from 'react-router-dom';

interface ProjectExecutionTemplateProps {
  projectId: string;
  logState?: ProjectLogState | null;
  initialDoc?: ExecutionDocContent | null;
  initialTab?: 'team-features' | 'execution-plan';
  hideHeader?: boolean;
  hideTabs?: boolean;
  onBack?: () => void;
  onSaved?: () => void;
}

export const ProjectExecutionTemplate: React.FC<ProjectExecutionTemplateProps> = ({
  projectId,
  logState,
  initialDoc,
  initialTab = 'team-features',
  hideHeader = false,
  hideTabs = false,
  onSaved,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>(initialTab);
  const ws = useProjectWorkspace({ projectId, logState, initialDoc, onSaved });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {!hideHeader && (
        <WorkspaceHeader ws={ws} logState={logState} />
      )}

      {!hideTabs && (
        <WorkspaceTabs
          activeTab={activeTab}
          onChangeTab={(tab) => {
            if (tab !== 'log') {
              setActiveTab(tab);
            }
          }}
        />
      )}

      {/* Tab Body */}
      <div>
        {activeTab === 'team-features' && <TeamFeaturesTab ws={ws} />}
        {activeTab === 'execution-plan' && <ExecutionPlanTab ws={ws} />}
      </div>

      {/* Withdraw Modal */}
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
