import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { useAppSelector } from '../app/hooks';
import {
  BookOpen,
  Users,
  CheckCircle,
  AlertTriangle,
  Layers,
  X,
  Target,
  Code,
  Lightbulb,
  ArrowRight,
  Server,
  Cpu,
  Link,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TeamMemberSelect } from '../components/projects/TeamMemberSelect';

interface CatalogProject {
  id: string;
  name: string;
  problemStatement: string;
  objective: string;
  expectedOutcome: string;
  domain: string;
  type: string;
  technologies: string[];
  _count: {
    childProjects: number;
  };
}

export const AllProjects: React.FC = () => {
  const [projects, setProjects] = useState<CatalogProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string>('Software');
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);

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

  const handleSelect = async (projectId: string) => {
    if (!user?.teamId) {
      alert('You must be part of a team to select a project.');
      return;
    }
    setSelecting(true);
    setSelectError(null);
    try {
      const res = await api.post(`/projects/catalog/${projectId}/select`, {
        teamMembers,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setSelectError(err.response?.data?.message || 'Failed to select project');
    } finally {
      setSelecting(false);
    }
  };

  const categorizedProjects = useMemo(() => {
    const map: Record<string, Record<string, CatalogProject[]>> = {
      Software: {},
      Hardware: {},
      Combination: {},
    };

    projects.forEach((p) => {
      const typeRaw = (p.type || 'Software').toLowerCase();
      let typeKey = 'Software';
      if (
        typeRaw.includes('combo') ||
        typeRaw.includes('combination') ||
        (typeRaw.includes('hard') && typeRaw.includes('soft'))
      ) {
        typeKey = 'Combination';
      } else if (typeRaw.includes('hard')) {
        typeKey = 'Hardware';
      }

      const domainKey = p.domain || 'Uncategorized';
      if (!map[typeKey][domainKey]) {
        map[typeKey][domainKey] = [];
      }
      map[typeKey][domainKey].push(p);
    });

    return map;
  }, [projects]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium animate-pulse">Loading Problem Statements...</p>
        </div>
      </div>
    );
  }

  const activeDomains = categorizedProjects[activeType] || {};

  return (
    <div className="p-6 max-w-7xl mx-auto w-full relative">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Layers className="w-8 h-8 text-primary" />
            All Problem Statements
          </h1>
          <p className="text-gray-500 mt-2">
            Browse problem statements organized by category and domain.
          </p>
        </div>
        <button
          onClick={() => navigate('/projects/propose')}
          className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold shadow-sm hover:shadow-md hover:bg-primary/90 transition-all flex items-center gap-2"
        >
          <Lightbulb className="w-5 h-5" />
          Propose New Project
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> {error}
        </div>
      )}

      {/* Type Tabs */}
      <div className="flex bg-gray-100/80 p-1.5 rounded-xl gap-2 mb-8 max-w-2xl border border-gray-200">
        {[
          { id: 'Software', label: 'Software', icon: Code },
          { id: 'Hardware', label: 'Hardware', icon: Cpu },
          { id: 'Combination', label: 'Hardware + Software', icon: Link },
        ].map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => setActiveType(type.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                activeType === type.id
                  ? 'bg-white text-primary shadow-sm ring-1 ring-gray-900/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
              }`}
            >
              <Icon className="w-4 h-4" /> {type.label}
            </button>
          );
        })}
      </div>

      {/* Domain Groups */}
      {Object.keys(activeDomains).length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-300 rounded-xl">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No problem statements found in this category.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(activeDomains).map(([domain, items]) => (
            <div key={domain}>
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3 pb-2 border-b border-gray-200/60">
                <span className="bg-primary/10 text-primary p-2 rounded-lg">
                  <Lightbulb className="w-5 h-5" />
                </span>
                {domain}
                <span className="bg-gray-100 text-gray-500 text-xs px-2.5 py-1 rounded-full font-semibold ml-2">
                  {items.length} items
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((p) => {
                  const isFull = p._count?.childProjects >= 4;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                          {p.type || 'Software'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1.5 ${isFull ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}
                        >
                          <Users className="w-3 h-3" /> {p._count?.childProjects || 0} / 4 Teams
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-3 leading-snug group-hover:text-primary transition-colors">
                        {p.name}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-3 mb-5 flex-grow">
                        {p.problemStatement}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mb-5 mt-auto">
                        {(p.technologies || []).slice(0, 3).map((tech) => (
                          <span
                            key={tech}
                            className="bg-indigo-50/50 text-indigo-600 text-[10px] font-medium px-2 py-1 rounded border border-indigo-100"
                          >
                            {tech}
                          </span>
                        ))}
                        {(p.technologies?.length || 0) > 3 && (
                          <span className="bg-gray-50 text-gray-500 text-[10px] font-medium px-2 py-1 rounded border border-gray-200">
                            +{(p.technologies?.length || 0) - 3} more
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-semibold text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                        View Details <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deep View Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wide">
                    {selectedProject.domain}
                  </span>
                  <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wide">
                    {selectedProject.type || 'Software'}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 ${selectedProject._count?.childProjects >= 4 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                  >
                    <Users className="w-3.5 h-3.5" /> {selectedProject._count?.childProjects || 0} /
                    4 Teams Selected
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                  {selectedProject.name}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedProject(null);
                  setSelectError(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <div className="p-8 overflow-y-auto">
              {selectError && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> {selectError}
                </div>
              )}

              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-500" /> Problem Statement
                  </h3>
                  <div className="bg-indigo-50/30 border border-indigo-100 rounded-xl p-5 text-gray-700 leading-relaxed">
                    {selectedProject.problemStatement}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Objective</h3>
                    <div className="text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 p-5 rounded-xl h-full">
                      {selectedProject.objective || 'No specific objective provided.'}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Expected Outcome</h3>
                    <div className="text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 p-5 rounded-xl h-full">
                      {selectedProject.expectedOutcome || 'No expected outcome provided.'}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Code className="w-5 h-5 text-blue-500" /> Recommended Technologies
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(selectedProject.technologies || []).map((tech: string) => (
                      <span
                        key={tech}
                        className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 font-medium text-sm"
                      >
                        {tech}
                      </span>
                    ))}
                    {!selectedProject.technologies?.length && (
                      <span className="text-gray-500 italic text-sm">
                        No specific technologies recommended.
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <TeamMemberSelect selectedIds={teamMembers} onChange={setTeamMembers} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => {
                  setSelectedProject(null);
                  setSelectError(null);
                  setTeamMembers([]);
                }}
                className="px-6 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSelect(selectedProject.id)}
                disabled={selecting || selectedProject._count?.childProjects >= 4}
                className={`px-8 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-sm ${
                  selectedProject._count?.childProjects >= 4
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary/90 hover:shadow-md'
                }`}
              >
                {selecting ? (
                  'Selecting...'
                ) : selectedProject._count?.childProjects >= 4 ? (
                  'Capacity Reached'
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" /> Select for My Team
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
