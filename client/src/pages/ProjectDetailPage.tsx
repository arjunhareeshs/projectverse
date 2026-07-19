import React from 'react';
import { useParams } from 'react-router-dom';
import { ProjectReviewerPanel } from '../components/projects/ProjectReviewerPanel';
import { useAppSelector } from '../app/hooks';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const user = useAppSelector((state) => state.auth.user);

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="mb-6 border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Project Details</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage project scope, reviews, and analytics.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-2">Project Overview</h3>
            <p className="text-sm text-gray-600">Details for project ID: {id}</p>
            <p className="text-sm text-gray-600 mt-2">
              This page can display the problem statement, objectives, and progress tracked via the
              backend.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Review Panel only visible to reviewers or admins */}
          {((user as any)?.role === 'REVIEWER' || (user as any)?.role === 'ADMIN') && id ? (
            <ProjectReviewerPanel projectId={id} />
          ) : (
            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
              <h4 className="font-bold text-indigo-900 mb-2">Evaluation Status</h4>
              <p className="text-sm text-indigo-800">
                Your project proposal is awaiting reviewer feedback. You will see their comments and
                approval status here once reviewed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
