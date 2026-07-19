import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAppSelector } from '../app/hooks';
import { BookOpen, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CatalogProject {
  id: string;
  name: string;
  problemStatement: string;
  domain: string;
  technologies: string[];
  _count: {
    childProjects: number;
  };
}

export const ProjectCatalog: React.FC = () => {
  const [projects, setProjects] = useState<CatalogProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = useAppSelector((s) => s.auth.token);
  const user = useAppSelector((s) => s.auth.user);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await api.get('/projects/catalog');
        setProjects(Array.isArray(res.data) ? res.data : []);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load catalog');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchCatalog();
  }, [token]);

  const handleSelect = async (id: string) => {
    if (!user?.teamId) {
      alert('You must be part of a team to select a project.');
      return;
    }
    setSelectingId(id);
    setError(null);
    try {
      await api.post(`/projects/catalog/${id}/select`);
      // Navigate to team dashboard or projects view
      navigate('/projects');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to select project');
      setSelectingId(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading catalog...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-primary" />
          Project Ideas Catalog
        </h1>
        <p className="text-gray-500 mt-2">
          Browse and select predefined problem statements. A maximum of 4 teams can select the same
          idea.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.isArray(projects) &&
          projects.map((p) => {
            const isFull = p._count.childProjects >= 4;
            return (
              <div
                key={p.id}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-full uppercase">
                    {p.domain || 'General'}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                  >
                    <Users className="w-3 h-3" /> {p._count.childProjects} / 4 Teams
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">{p.name}</h3>
                <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-grow">
                  {p.problemStatement}
                </p>

                <div className="flex flex-wrap gap-1 mb-6">
                  {p.technologies.slice(0, 4).map((tech) => (
                    <span
                      key={tech}
                      className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded border border-gray-200"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleSelect(p.id)}
                  disabled={isFull || selectingId === p.id}
                  className={`w-full py-2.5 rounded-lg font-semibold flex justify-center items-center gap-2 transition-colors ${
                    isFull
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                >
                  {selectingId === p.id ? (
                    'Selecting...'
                  ) : isFull ? (
                    'Capacity Reached'
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" /> Select Project
                    </>
                  )}
                </button>
              </div>
            );
          })}
        {projects.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white border border-dashed rounded-xl">
            No projects available in the catalog right now.
          </div>
        )}
      </div>
    </div>
  );
};
