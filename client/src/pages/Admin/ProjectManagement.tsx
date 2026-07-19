import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Folder, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ProjectManagement: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/admin/all-projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading projects...</div>;
  }

  // Group by domain
  const grouped = projects.reduce((acc: any, project: any) => {
    const domain = project.domain || 'Uncategorized';
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(project);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">All Projects</h1>
        <p className="text-sm text-muted-foreground mt-1">Grouped by project domain.</p>
      </div>

      <div className="space-y-8">
        {Object.keys(grouped).map((domain) => (
          <div
            key={domain}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                {domain}
              </h2>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full">
                {grouped[domain].length} Projects
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {grouped[domain].map((project: any) => (
                <div
                  key={project.id}
                  className="bg-white border border-gray-100 p-4 rounded-lg shadow-sm hover:border-indigo-300 cursor-pointer transition"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Folder className="w-5 h-5 text-indigo-500" />
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        project.status === 'Completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {project.status || 'Active'}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{project.name}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {project.description || 'No description provided.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
