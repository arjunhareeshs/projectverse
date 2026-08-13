import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { useAppSelector } from '../app/hooks';
import {
  Search,
  SlidersHorizontal,
  Plus,
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProjectCard, ProjectCardData } from '../components/projects/ProjectCard';
import { ProjectDetailModal, ProjectDetailPayload } from '../components/projects/ProjectDetailModal';

export const ProjectCatalogPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Modal state
  const [selectedProject, setSelectedProject] = useState<ProjectDetailPayload | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const token = useAppSelector((s) => s.auth.token);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkedProjectId = searchParams.get('project');

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await api.get('/projects/catalog');
      setProjects(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Error fetching catalog:', err);
      setError(err.response?.data?.message || 'Failed to load catalog projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchCatalog();
  }, [token]);

  // Extract unique domains & sectors for filters
  const domains = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.domain) set.add(p.domain);
    });
    return Array.from(set).sort();
  }, [projects]);

  // Subdomains are scoped to the selected domain — picking a domain must not
  // leave subdomains from other domains selectable (they'd filter to zero results).
  const sectors = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (!p.sector) return;
      if (selectedDomain !== 'all' && p.domain !== selectedDomain) return;
      set.add(p.sector);
    });
    return Array.from(set).sort();
  }, [projects, selectedDomain]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const haystack = [
          p.name,
          p.shortName,
          p.soul,
          p.problemStatement,
          p.description,
          p.domain,
          p.sector,
          p.type,
          p.difficultyLevel,
          ...(p.technologies || []),
        ];
        const matches = haystack.some((field) => (field || '').toLowerCase().includes(query));
        if (!matches) return false;
      }
      if (selectedDomain !== 'all' && p.domain !== selectedDomain) return false;
      if (selectedSector !== 'all' && p.sector !== selectedSector) return false;
      if (selectedType !== 'all' && (p.type || '').toLowerCase() !== selectedType.toLowerCase()) return false;
      if (selectedDifficulty !== 'all' && String(p.difficultyLevel) !== selectedDifficulty) return false;

      return true;
    });
  }, [projects, searchQuery, selectedDomain, selectedSector, selectedType, selectedDifficulty]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredProjects.length / pageSize) || 1;
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  const handleOpenDetailModal = async (projectCard: ProjectCardData) => {
    try {
      const res = await api.get(`/projects/catalog/${projectCard.id}`);
      setSelectedProject(res.data);
    } catch (err) {
      setSelectedProject(projectCard as any);
    }
    setIsModalOpen(true);
  };

  // ?project=<id> deep link — used by the "Claim Project" action on an accepted
  // proposal, which needs to land directly on that statement's claim flow.
  useEffect(() => {
    if (!token || !deepLinkedProjectId) return;

    let cancelled = false;
    api
      .get(`/projects/catalog/${deepLinkedProjectId}`)
      .then((res) => {
        if (cancelled) return;
        setSelectedProject(res.data);
        setIsModalOpen(true);
      })
      .catch(() => {
        if (!cancelled) setError('That problem statement could not be opened.');
      })
      .finally(() => {
        if (cancelled) return;
        // Drop the param so a later close/reopen isn't fought by this effect.
        searchParams.delete('project');
        setSearchParams(searchParams, { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [token, deepLinkedProjectId]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">All Projects & Catalog</h1>
            <Info className="h-4 w-4 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Browse open problem statements and choose the right challenge for your team.
          </p>
        </div>

        <button
          onClick={() => navigate('/projects/propose')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Propose Idea
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search catalog projects..."
            className="w-full pl-10 pr-12 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
          />
        </div>

        {/* Dropdowns Filter Strip */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Domain Dropdown */}
          <select
            value={selectedDomain}
            onChange={(e) => {
              setSelectedDomain(e.target.value);
              setSelectedSector('all'); // previous subdomain may not exist under the new domain
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Subdomain / Sector Dropdown */}
          <select
            value={selectedSector}
            onChange={(e) => {
              setSelectedSector(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Subdomains</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Difficulty Dropdown */}
          <select
            value={selectedDifficulty}
            onChange={(e) => {
              setSelectedDifficulty(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Difficulty</option>
            <option value="1">Easy (Level 1)</option>
            <option value="2">Medium (Level 2)</option>
            <option value="3">Hard (Level 3)</option>
          </select>

          {/* Type Dropdown */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="Software">Software</option>
            <option value="Hardware">Hardware</option>
            <option value="IoT">IoT</option>
            <option value="Hybrid">Hybrid</option>
          </select>

          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedDomain('all');
              setSelectedSector('all');
              setSelectedDifficulty('all');
              setSelectedType('all');
              setCurrentPage(1);
            }}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Reset Filters"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse p-6" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-center text-sm">
          {error}
        </div>
      ) : paginatedProjects.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <SlidersHorizontal className="h-8 w-8 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No project statements match your criteria</h3>
          <p className="text-xs text-slate-500">Try adjusting your search filters or clearing filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedProjects.map((p) => (
            <ProjectCard key={p.id} project={p} onViewDetails={handleOpenDetailModal} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && paginatedProjects.length > 0 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 font-medium">
            Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredProjects.length)} of {filteredProjects.length} projects
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {[...Array(totalPages)].slice(0, 7).map((_, idx) => {
              const pageNum = idx + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <ProjectDetailModal
        project={selectedProject}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProject(null);
        }}
        onSelectSuccess={() => {
          fetchCatalog();
          navigate('/projects');
        }}
      />
    </div>
  );
};
