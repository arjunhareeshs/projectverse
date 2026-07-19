import React from 'react';
import { ProjectProposalForm } from '../components/projects/ProjectProposalForm';

export const ProjectProposal: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Project Proposal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Submit your idea, get AI recommendations, and check for similarity.
        </p>
      </div>
      <ProjectProposalForm />
    </div>
  );
};
