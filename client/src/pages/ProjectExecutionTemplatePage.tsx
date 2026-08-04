import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectExecutionTemplate } from '../components/projects/ProjectExecutionTemplate';
import { lifecycleService } from '../services/lifecycle.service';
import { ExecutionDocContent, ProjectLogState } from '../types/projectLog';

export const ProjectExecutionTemplatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [logState, setLogState] = useState<ProjectLogState | null>(null);
  const [initialDoc, setInitialDoc] = useState<ExecutionDocContent | null>(null);
  const [loading, setLoading] = useState(true);

  const projectId = id || '1';

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [stateRes, docRes] = await Promise.allSettled([
          lifecycleService.getLogState(projectId),
          lifecycleService.getDocument(projectId),
        ]);

        if (isMounted) {
          if (stateRes.status === 'fulfilled' && stateRes.value) {
            setLogState(stateRes.value);
          }
          if (docRes.status === 'fulfilled' && docRes.value?.doc) {
            setInitialDoc(docRes.value.doc);
          }
        }
      } catch (err) {
        console.error('Failed to load project execution template data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-8 space-y-3">
        <div className="w-10 h-10 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading Project Execution & Reward Template...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <ProjectExecutionTemplate
        projectId={projectId}
        logState={logState}
        initialDoc={initialDoc}
        onBack={() => navigate('/projects')}
        onSaved={() => {
          lifecycleService.getDocument(projectId).then((data) => {
            if (data?.doc) setInitialDoc(data.doc);
          });
        }}
      />
    </div>
  );
};
