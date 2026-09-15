import React, { useEffect, useState } from 'react';
import {
  Plus,
  Sparkles,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Code2,
  Users,
  Trophy,
  Loader2,
  X,
  AlertCircle,
  Power,
} from 'lucide-react';
import {
  capstoneService,
  CapstoneProblem,
  CapstoneAdminStats,
  CreateCapstoneProblemDto,
} from '../../services/capstone.service';

export const AdminCapstoneProblems: React.FC = () => {
  const [problems, setProblems] = useState<CapstoneProblem[]>([]);
  const [stats, setStats] = useState<CapstoneAdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<CapstoneProblem | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    title: '',
    problemText: '',
    domain: 'Full-Stack Web',
    difficulty: 'Medium',
    technologies: '',
    isActive: true,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [problemsData, statsData] = await Promise.all([
        capstoneService.getProblems(),
        capstoneService.getAdminStats(),
      ]);
      setProblems(problemsData);
      setStats(statsData);
    } catch (err: any) {
      console.error('Error fetching admin capstone data:', err);
      setError(err.response?.data?.message || 'Failed to load capstone problems.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    setEditingProblem(null);
    setFormData({
      title: '',
      problemText: '',
      domain: 'Full-Stack Web',
      difficulty: 'Medium',
      technologies: '',
      isActive: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: CapstoneProblem) => {
    setEditingProblem(p);
    setFormData({
      title: p.title,
      problemText: p.problemText,
      domain: p.domain || 'Full-Stack Web',
      difficulty: p.difficulty || 'Medium',
      technologies: p.technologies?.join(', ') || '',
      isActive: p.isActive,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.problemText.trim()) {
      setFormError('Title and problem statement text are required.');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError(null);

      const techList = formData.technologies
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: CreateCapstoneProblemDto = {
        title: formData.title.trim(),
        problemText: formData.problemText.trim(),
        domain: formData.domain.trim(),
        difficulty: formData.difficulty.trim(),
        technologies: techList,
        isActive: formData.isActive,
      };

      if (editingProblem) {
        await capstoneService.updateProblem(editingProblem.id, payload);
      } else {
        await capstoneService.createProblem(payload);
      }

      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save problem statement.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (p: CapstoneProblem) => {
    try {
      await capstoneService.updateProblem(p.id, { isActive: !p.isActive });
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (p: CapstoneProblem) => {
    if (!confirm(`Are you sure you want to remove or deactivate "${p.title}"?`)) return;
    try {
      await capstoneService.deleteProblem(p.id);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete problem statement');
    }
  };

  const filteredProblems = problems.filter((p) => {
    if (statusFilter === 'active' && !p.isActive) return false;
    if (statusFilter === 'inactive' && p.isActive) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const haystack = [p.title, p.problemText, p.domain, ...(p.technologies || [])];
      return haystack.some((f) => (f || '').toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Capstone Problem Statements</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
              Admin Portal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage weekly capstone challenges, review student claim volume, and inspect MCQ scores.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Problem Statement
        </button>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Total Problems</span>
            <span className="text-2xl font-bold text-slate-900 leading-tight block tabular-nums">
              {stats?.totalProblems ?? 0}
            </span>
            <span className="text-[11px] text-indigo-600 font-medium">{stats?.activeProblems ?? 0} Active</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Student Claims</span>
            <span className="text-2xl font-bold text-slate-900 leading-tight block tabular-nums">
              {stats?.totalSelections ?? 0}
            </span>
            <span className="text-[11px] text-slate-500">Claimed capstones</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Completions</span>
            <span className="text-2xl font-bold text-slate-900 leading-tight block tabular-nums">
              {stats?.completedCount ?? 0}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">MCQ evaluated</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Average MCQ Score</span>
            <span className="text-2xl font-bold text-slate-900 leading-tight block tabular-nums">
              {stats?.avgScore ? `${stats.avgScore} / 15` : '—'}
            </span>
            <span className="text-[11px] text-slate-500">Across completions</span>
          </div>
        </div>
      </div>

      {/* Control Strip & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search problems..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center p-1 bg-slate-200/80 rounded-xl border border-slate-200">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({problems.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active ({problems.filter((p) => p.isActive).length})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              statusFilter === 'inactive'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inactive ({problems.filter((p) => !p.isActive).length})
          </button>
        </div>
      </div>

      {/* Problems Table */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 mt-2">Loading capstone statements...</p>
        </div>
      ) : filteredProblems.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
          <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">No capstone problem statements found</p>
          <p className="text-xs text-slate-500">Click "Add Problem Statement" to create your first weekly challenge.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-5">Problem Statement</th>
                <th className="py-3 px-4">Domain & Difficulty</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Claims</th>
                <th className="py-3 px-4 text-center">Completed</th>
                <th className="py-3 px-4 text-center">Avg MCQ Score</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProblems.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-4 px-5 max-w-sm">
                    <span className="font-bold text-slate-900 block leading-snug">{p.title}</span>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{p.problemText}</p>
                    {p.technologies && p.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.technologies.map((t, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-medium"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="py-4 px-4 align-middle">
                    <span className="font-medium text-slate-700 block">{p.domain || 'General'}</span>
                    <span className="text-[10px] text-slate-500 block">{p.difficulty || 'Medium'}</span>
                  </td>

                  <td className="py-4 px-4 text-center align-middle">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        p.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-center align-middle font-semibold text-slate-900 tabular-nums">
                    {p.stats?.selectionsCount ?? 0}
                  </td>

                  <td className="py-4 px-4 text-center align-middle font-semibold text-slate-900 tabular-nums">
                    {p.stats?.completedCount ?? 0}
                  </td>

                  <td className="py-4 px-4 text-center align-middle font-bold text-slate-900 tabular-nums">
                    {p.stats?.avgScore ? `${p.stats.avgScore}/15` : '—'}
                  </td>

                  <td className="py-4 px-5 text-right align-middle">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleToggleActive(p)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          p.isActive
                            ? 'text-amber-600 border-amber-200 hover:bg-amber-50'
                            : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                        }`}
                        title={p.isActive ? 'Deactivate Problem' : 'Activate Problem'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(p)}
                        className="p-1.5 text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        title="Edit Problem"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-1.5 text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Delete Problem"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingProblem ? 'Edit Capstone Problem' : 'Add Weekly Capstone Problem'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Distributed Task Queue & Resilient Worker System"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    placeholder="e.g. Full-Stack Web, AI/ML, Cloud"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Difficulty
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Problem Statement <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.problemText}
                  onChange={(e) => setFormData({ ...formData, problemText: e.target.value })}
                  placeholder="Describe the problem, requirements, architecture expectations, and deliverables..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:border-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Technologies (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.technologies}
                  onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
                  placeholder="Node.js, Redis, Docker, PostgreSQL, React"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Active (visible to students in catalog)
                </label>
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 disabled:opacity-50 cursor-pointer"
                >
                  {formSubmitting ? 'Saving...' : editingProblem ? 'Save Changes' : 'Create Problem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
