import React, { useEffect, useState } from 'react';
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  Layers,
  Search,
  AlertCircle,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { api } from '../../services/api';
import { lifecycleService } from '../../services/lifecycle.service';
import { ExecutionDocContent } from '../../types/projectLog';

interface ProjectSummary {
  id: string;
  name: string;
  domain: string;
  sector?: string;
  status: string;
  teamName?: string;
  type?: string;
  difficultyLevel?: string;
}

interface ExpandedDoc {
  doc: ExecutionDocContent;
  version: number;
  allVersions?: number[];
}

export const DocumentManagement: React.FC = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [docData, setDocData] = useState<Record<string, ExpandedDoc | null>>({});
  const [docLoading, setDocLoading] = useState<Record<string, boolean>>({});
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      // Use active projects endpoint — filters out templates
      const res = await api.get('/projects/active');
      const list: ProjectSummary[] = (res.data || []).map((p: any) => ({
        id: p.id,
        name: p.name || 'Untitled Project',
        domain: p.domain || p.client || 'Uncategorized',
        sector: p.sector,
        status: p.status || 'Active',
        teamName: p.teamName || p.team?.name,
        type: p.type,
        difficultyLevel: p.difficultyLevel,
      }));
      setProjects(list);
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (projectId: string) => {
    if (expandedId === projectId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(projectId);

    // Load doc if not already cached
    if (!docData[projectId] && !docLoading[projectId]) {
      setDocLoading((prev) => ({ ...prev, [projectId]: true }));
      try {
        const data = await lifecycleService.getDocument(projectId);
        setDocData((prev) => ({ ...prev, [projectId]: data ? { doc: data.doc, version: data.version, allVersions: data.allVersions } : null }));
      } catch (err) {
        console.error('Failed to load doc for', projectId, err);
        setDocData((prev) => ({ ...prev, [projectId]: null }));
      } finally {
        setDocLoading((prev) => ({ ...prev, [projectId]: false }));
      }
    }
  };

  const handleDownload = async (projectId: string, format: 'md' | 'pdf') => {
    setDownloading(`${projectId}-${format}`);
    try {
      await lifecycleService.downloadDocument(projectId, format);
    } catch (err) {
      console.error(`Download ${format} failed for`, projectId, err);
    } finally {
      setDownloading(null);
    }
  };

  // Group by domain
  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.teamName || '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const grouped = filtered.reduce<Record<string, ProjectSummary[]>>((acc, p) => {
    const domain = p.domain || 'Uncategorized';
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(p);
    return acc;
  }, {});

  const domainKeys = Object.keys(grouped).sort();

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-xs text-gray-500 font-medium">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Execution Documents
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View and download execution documents for each project. Grouped by domain.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search projects, domains, teams..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
          />
        </div>
      </div>

      {/* Stats Strip */}
      <div className="flex items-center gap-6 px-5 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-indigo-600">{projects.length}</span>
          <span className="text-xs text-gray-400">Total Projects</span>
        </div>
        <div className="w-px h-6 bg-gray-200" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-emerald-600">{domainKeys.length}</span>
          <span className="text-xs text-gray-400">Domains</span>
        </div>
        <div className="w-px h-6 bg-gray-200" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-amber-600">
            {projects.filter((p) => docData[p.id]?.doc).length}
          </span>
          <span className="text-xs text-gray-400">Documents Loaded</span>
        </div>
      </div>

      {/* No Projects */}
      {domainKeys.length === 0 && (
        <div className="py-16 text-center space-y-3 bg-white border border-gray-200 rounded-2xl">
          <FolderOpen className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-500 font-medium">
            {searchTerm ? 'No projects match your search.' : 'No active projects found.'}
          </p>
        </div>
      )}

      {/* Domain Groups */}
      <div className="space-y-6">
        {domainKeys.map((domain) => (
          <div key={domain} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Domain Header */}
            <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                {domain}
              </h2>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full">
                {grouped[domain].length} {grouped[domain].length === 1 ? 'Project' : 'Projects'}
              </span>
            </div>

            {/* Project List */}
            <div className="divide-y divide-gray-100">
              {grouped[domain].map((project) => {
                const isExpanded = expandedId === project.id;
                const isLoadingDoc = docLoading[project.id];
                const expandedDocData = docData[project.id];

                return (
                  <div key={project.id}>
                    {/* Project Row */}
                    <button
                      onClick={() => toggleExpand(project.id)}
                      className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-gray-50/50 transition group"
                    >
                      <div className="shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 truncate">{project.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {project.teamName && (
                            <span className="text-xs text-gray-500">Team: {project.teamName}</span>
                          )}
                          {project.sector && (
                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
                              {project.sector}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md ${
                            project.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : project.status === 'CATALOG'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {project.status}
                        </span>
                        <FileText className="w-4 h-4 text-gray-300" />
                      </div>
                    </button>

                    {/* Expanded Document View */}
                    {isExpanded && (
                      <div className="px-6 pb-6 pt-2 bg-gray-50/30 border-t border-gray-100">
                        {isLoadingDoc ? (
                          <div className="py-10 text-center space-y-2">
                            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                            <p className="text-xs text-gray-500">Loading execution document...</p>
                          </div>
                        ) : !expandedDocData?.doc ? (
                          <div className="py-10 text-center space-y-2 border-2 border-dashed border-gray-200 rounded-xl bg-white">
                            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto" />
                            <p className="text-sm font-medium text-gray-600">No Execution Document</p>
                            <p className="text-xs text-gray-400">
                              This project has not generated an execution document yet.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Document Action Bar */}
                            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-gray-900">
                                    Version {expandedDocData.version}
                                  </p>
                                  <p className="text-[10px] text-gray-500">
                                    {expandedDocData.allVersions?.length || 1} version(s) available
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleDownload(project.id, 'pdf')}
                                  disabled={downloading === `${project.id}-pdf`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  {downloading === `${project.id}-pdf` ? 'Downloading...' : 'PDF'}
                                </button>
                                <button
                                  onClick={() => handleDownload(project.id, 'md')}
                                  disabled={downloading === `${project.id}-md`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  {downloading === `${project.id}-md` ? 'Downloading...' : 'Markdown'}
                                </button>
                              </div>
                            </div>

                            {/* Document Content Preview */}
                            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 text-sm">
                              {/* Title */}
                              <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                  {expandedDocData.doc.title}
                                </h3>
                                {expandedDocData.doc.projectOverview && (
                                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                    {expandedDocData.doc.projectOverview}
                                  </p>
                                )}
                              </div>

                              {/* Problem Statement */}
                              {expandedDocData.doc.problemStatement && (
                                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                                  <p className="text-xs font-bold text-indigo-900 mb-1">Problem Statement</p>
                                  <p className="text-xs text-indigo-800 leading-relaxed">
                                    {expandedDocData.doc.problemStatement}
                                  </p>
                                </div>
                              )}

                              {/* Tech Stack */}
                              {expandedDocData.doc.techStack && expandedDocData.doc.techStack.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold text-gray-900 mb-2">Tech Stack</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {expandedDocData.doc.techStack.map((t, i) => (
                                      <span
                                        key={i}
                                        className="px-2.5 py-1 bg-gray-100 border border-gray-200 text-gray-800 text-xs font-medium rounded-md"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Skills Required */}
                              {expandedDocData.doc.skillsRequired && expandedDocData.doc.skillsRequired.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold text-gray-900 mb-2">Skills Required</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {expandedDocData.doc.skillsRequired.map((s, i) => (
                                      <span
                                        key={i}
                                        className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-medium rounded-md"
                                      >
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Milestones */}
                              {expandedDocData.doc.milestones && expandedDocData.doc.milestones.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold text-gray-900 mb-2">Milestones</p>
                                  <div className="overflow-hidden border border-gray-200 rounded-xl">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold uppercase">
                                          <th className="py-2.5 px-4">Milestone</th>
                                          <th className="py-2.5 px-4">Expected Output</th>
                                          <th className="py-2.5 px-4 text-right">Week</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {expandedDocData.doc.milestones.map((ms, i) => (
                                          <tr key={i} className="hover:bg-gray-50/50">
                                            <td className="py-2.5 px-4 font-bold text-gray-900">
                                              {ms.name}
                                            </td>
                                            <td className="py-2.5 px-4 text-gray-700">
                                              {ms.expectedOutput}
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-bold text-indigo-700">
                                              Week {ms.completionWeek}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Work Breakdown */}
                              {expandedDocData.doc.workBreakdown && expandedDocData.doc.workBreakdown.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold text-gray-900 mb-2">Work Breakdown</p>
                                  <div className="space-y-2">
                                    {expandedDocData.doc.workBreakdown.map((wp, i) => (
                                      <div
                                        key={i}
                                        className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold text-gray-900">{wp.packageName}</p>
                                          <p className="text-[10px] text-gray-500 truncate">
                                            {wp.tasks?.join(', ')}
                                          </p>
                                        </div>
                                        <div className="shrink-0 px-2.5 py-1 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-md">
                                          {wp.percentage}%
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
