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
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProjectCard, ProjectCardData } from '../components/projects/ProjectCard';
import { ProjectDetailModal, ProjectDetailPayload } from '../components/projects/ProjectDetailModal';
import { CapstoneDetailModal } from '../components/projects/CapstoneDetailModal';
import { capstoneService, CapstoneProblem } from '../services/capstone.service';

export const ProjectCatalogPage: React.FC = () => {
  // Mode selection: Normal Projects | Capstone Projects
  const [catalogMode, setCatalogMode] = useState<'normal' | 'capstone'>('normal');

  // Normal catalog state
  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Capstone catalog state
  const [capstoneProblems, setCapstoneProblems] = useState<CapstoneProblem[]>([]);
  const [capstoneLoading, setCapstoneLoading] = useState(false);
  const [selectedCapstone, setSelectedCapstone] = useState<CapstoneProblem | null>(null);
  const [isCapstoneModalOpen, setIsCapstoneModalOpen] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Modal state for normal catalog
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

  const fetchCapstones = async () => {
    try {
      setCapstoneLoading(true);
      const data = await capstoneService.getProblems();
      setCapstoneProblems(data);
    } catch (err: any) {
      console.error('Error fetching capstones:', err);
    } finally {
      setCapstoneLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCatalog();
      fetchCapstones();
    }
  }, [token]);

  // Extract unique domains & sectors for filters
  const domains = useMemo(() => {
    const set = new Set<string>();
    if (catalogMode === 'normal') {
      projects.forEach((p) => {
        if (p.domain) set.add(p.domain);
      });
    } else {
      capstoneProblems.forEach((p) => {
        if (p.domain) set.add(p.domain);
      });
    }
    return Array.from(set).sort();
  }, [projects, capstoneProblems, catalogMode]);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (!p.sector) return;
      if (selectedDomain !== 'all' && p.domain !== selectedDomain) return;
      set.add(p.sector);
    });
    return Array.from(set).sort();
  }, [projects, selectedDomain]);

  // Filtered normal projects
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

  // Filtered capstones
  const filteredCapstones = useMemo(() => {
    return capstoneProblems.filter((p) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const haystack = [
          p.title,
          p.problemText,
          p.domain,
          p.difficulty,
          ...(p.technologies || []),
        ];
        const matches = haystack.some((field) => (field || '').toLowerCase().includes(query));
        if (!matches) return false;
      }
      if (selectedDomain !== 'all' && p.domain !== selectedDomain) return false;
      if (selectedDifficulty !== 'all' && p.difficulty !== selectedDifficulty) return false;
      return true;
    });
  }, [capstoneProblems, searchQuery, selectedDomain, selectedDifficulty]);

  // Pagination calculation
  const currentItemsCount = catalogMode === 'normal' ? filteredProjects.length : filteredCapstones.length;
  const totalPages = Math.ceil(currentItemsCount / pageSize) || 1;

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  const paginatedCapstones = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCapstones.slice(start, start + pageSize);
  }, [filteredCapstones, currentPage, pageSize]);

  const handleOpenDetailModal = async (projectCard: ProjectCardData) => {
    try {
      const res = await api.get(`/projects/catalog/${projectCard.id}`);
      setSelectedProject(res.data);
    } catch {
      setSelectedProject(projectCard as any);
    }
    setIsModalOpen(true);
  };

  const handleOpenCapstoneModal = (capstone: CapstoneProblem) => {
    setSelectedCapstone(capstone);
    setIsCapstoneModalOpen(true);
  };

  // ?project=<id> deep link for proposals
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
            <h1 className="text-2xl font-bold text-slate-900">
              {catalogMode === 'normal' ? 'All Projects & Catalog' : 'Capstone Projects Catalog'}
            </h1>
            <Info className="h-4 w-4 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {catalogMode === 'normal'
              ? 'Browse open problem statements and choose the right challenge for your team.'
              : 'Choose a 7-day capstone challenge. Build, submit your repo, and pass the code MCQ evaluation.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Top-Right Segmented Control: Normal Projects | Capstone Projects */}
          <div className="inline-flex p-1 bg-slate-200/80 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                setCatalogMode('normal');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                catalogMode === 'normal'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Normal Projects
            </button>
            <button
              onClick={() => {
                setCatalogMode('capstone');
                setCurrentPage(1);
                if (capstoneProblems.length === 0) fetchCapstones();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                catalogMode === 'capstone'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Capstone Projects
            </button>
          </div>

          {catalogMode === 'normal' && (
            <button
              onClick={() => navigate('/projects/propose')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              Propose Idea
            </button>
          )}
        </div>
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
            placeholder={
              catalogMode === 'normal'
                ? 'Search catalog projects...'
                : 'Search capstone problem statements...'
            }
            className="w-full pl-10 pr-12 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
          />
        </div>

        {/* Dropdowns Filter Strip */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Domain Dropdown */}
          <select
            value={selectedDomain}
            onChange={(e) => {
              setSelectedDomain(e.target.value);
              setSelectedSector('all');
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Subdomain (only for normal) */}
          {catalogMode === 'normal' && (
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
          )}

          {/* Difficulty Dropdown */}
          <select
            value={selectedDifficulty}
            onChange={(e) => {
              setSelectedDifficulty(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Difficulty</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          {/* Type Dropdown (normal mode only) */}
          {catalogMode === 'normal' && (
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
          )}

          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedDomain('all');
              setSelectedSector('all');
              setSelectedDifficulty('all');
              setSelectedType('all');
              setCurrentPage(1);
            }}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Reset Filters"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      {catalogMode === 'normal' ? (
        // Normal Catalog View
        loading ? (
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
        )
      ) : (
        // Capstone Catalog View
        capstoneLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse p-6" />
            ))}
          </div>
        ) : paginatedCapstones.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
            <Sparkles className="h-8 w-8 text-indigo-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Capstone problems found</h3>
            <p className="text-xs text-slate-500">
              There are currently no active capstone problem statements matching your filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedCapstones.map((c) => (
              <div
                key={c.id}
                onClick={() => handleOpenCapstoneModal(c)}
                className="group relative bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-500/40 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  {/* Badge Strip */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Capstone
                      </span>
                      {c.domain && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {c.domain}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                      <Clock className="w-3 h-3 text-amber-600" />
                      7 Days
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2">
                    {c.title}
                  </h3>

                  {/* Snippet */}
                  <p className="text-xs text-slate-600 mt-2.5 line-clamp-3 leading-relaxed">
                    {c.problemText}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                  {/* Technologies */}
                  {c.technologies && c.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.technologies.slice(0, 4).map((tech, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[10px] font-medium text-slate-600"
                        >
                          {tech}
                        </span>
                      ))}
                      {c.technologies.length > 4 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-slate-400">
                          +{c.technologies.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Claim Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCapstoneModal(c);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white text-xs font-semibold transition-all group-hover:bg-indigo-600 group-hover:text-white"
                  >
                    <span>Claim Capstone Project</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Pagination */}
      {currentItemsCount > 0 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 font-medium">
            Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, currentItemsCount)} of {currentItemsCount} problem statements
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {[...Array(totalPages)].slice(0, 7).map((_, idx) => {
              const pageNum = idx + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-indigo-600 text-white'
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
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Normal Project Detail Modal */}
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

      {/* Capstone Detail & Claim Modal */}
      <CapstoneDetailModal
        problem={selectedCapstone}
        isOpen={isCapstoneModalOpen}
        onClose={() => {
          setIsCapstoneModalOpen(false);
          setSelectedCapstone(null);
        }}
        onClaimSuccess={() => {
          navigate('/projects');
        }}
      />
    </div>
  );
};
