import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { useAppSelector } from '../app/hooks';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Radio,
  Ban,
  MoreVertical,
  FileText,
  LayoutGrid,
  List,
  Wind,
  Trash2,
  Sprout,
  Activity,
  Droplets,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { teamService } from '../services/team.service';

export interface MyProjectItem {
  id: string;
  name: string;
  categoryTag?: string; // 'FINAL YEAR' | 'MINI' | 'RESEARCH'
  domain?: string;
  subdomain?: string;
  teamName?: string;
  memberCount?: number;
  teamAvatars?: Array<{ initials: string; bg: string }>;
  moreMembersCount?: number;
  status: 'In Progress' | 'Review' | 'Completed' | 'On Hold';
  progressPercent: number;
  lastUpdated: string;
  iconType?: 'wind' | 'trash' | 'sprout' | 'activity' | 'droplets' | 'default';
  iconBg?: string;
  iconColor?: string;
}

const MOCK_MY_PROJECTS: MyProjectItem[] = [
  {
    id: 'proj-1',
    name: 'Wind Powered Child Warming System',
    categoryTag: 'FINAL YEAR',
    domain: 'Smart Cities',
    subdomain: 'Renewable Energy',
    teamName: 'Team Alpha',
    memberCount: 5,
    teamAvatars: [
      { initials: 'SA', bg: 'bg-indigo-600' },
      { initials: 'AR', bg: 'bg-blue-600' },
      { initials: 'KM', bg: 'bg-sky-600' },
    ],
    moreMembersCount: 2,
    status: 'In Progress',
    progressPercent: 68,
    lastUpdated: 'Aug 3, 2025 10:30 AM',
    iconType: 'wind',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    id: 'proj-2',
    name: 'Smart Waste Management System',
    categoryTag: 'FINAL YEAR',
    domain: 'Smart Cities',
    subdomain: 'Waste Management',
    teamName: 'Team Beta',
    memberCount: 4,
    teamAvatars: [
      { initials: 'VS', bg: 'bg-rose-500' },
      { initials: 'PR', bg: 'bg-amber-500' },
      { initials: 'AK', bg: 'bg-purple-600' },
    ],
    moreMembersCount: 1,
    status: 'In Progress',
    progressPercent: 45,
    lastUpdated: 'Aug 3, 2025 09:15 AM',
    iconType: 'trash',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  {
    id: 'proj-3',
    name: 'AI Based Crop Disease Detection',
    categoryTag: 'FINAL YEAR',
    domain: 'Agriculture',
    subdomain: 'AI/ML',
    teamName: 'Team Gamma',
    memberCount: 5,
    teamAvatars: [
      { initials: 'SK', bg: 'bg-amber-600' },
      { initials: 'MJ', bg: 'bg-emerald-600' },
      { initials: 'RG', bg: 'bg-orange-500' },
    ],
    moreMembersCount: 2,
    status: 'Review',
    progressPercent: 75,
    lastUpdated: 'Aug 2, 2025 04:45 PM',
    iconType: 'sprout',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    id: 'proj-4',
    name: 'Health Monitoring Wearable Device',
    categoryTag: 'FINAL YEAR',
    domain: 'Healthcare',
    subdomain: 'IoT',
    teamName: 'Team Delta',
    memberCount: 4,
    teamAvatars: [
      { initials: 'NA', bg: 'bg-rose-600' },
      { initials: 'KP', bg: 'bg-red-500' },
      { initials: 'AM', bg: 'bg-amber-600' },
    ],
    moreMembersCount: 1,
    status: 'On Hold',
    progressPercent: 20,
    lastUpdated: 'Aug 1, 2025 11:20 AM',
    iconType: 'activity',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
  },
  {
    id: 'proj-5',
    name: 'Smart Water Quality Monitoring',
    categoryTag: 'FINAL YEAR',
    domain: 'Environment',
    subdomain: 'IoT',
    teamName: 'Team Epsilon',
    memberCount: 5,
    teamAvatars: [
      { initials: 'SV', bg: 'bg-blue-600' },
      { initials: 'RK', bg: 'bg-indigo-600' },
      { initials: 'DP', bg: 'bg-sky-500' },
    ],
    moreMembersCount: 2,
    status: 'Completed',
    progressPercent: 100,
    lastUpdated: 'Jul 30, 2025 03:10 PM',
    iconType: 'droplets',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
];

export const AllProjects: React.FC = () => {
  const [projectsList, setProjectsList] = useState<MyProjectItem[]>(MOCK_MY_PROJECTS);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<string>('recently_updated');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const user = useAppSelector((s) => s.auth.user);
  const navigate = useNavigate();

  const fetchUserProjects = async () => {
    try {
      setLoading(true);

      let rawProjects: any[] = [];
      if (user?.teamId) {
        try {
          const teamProjs = await teamService.getTeamProjects(user.teamId);
          if (Array.isArray(teamProjs) && teamProjs.length > 0) {
            rawProjects = teamProjs;
          }
        } catch (e) {
          console.log('Failed to fetch team projects:', e);
        }
      }

      if (rawProjects.length === 0) {
        try {
          const activeRes = await api.get('/projects/active');
          if (Array.isArray(activeRes.data) && activeRes.data.length > 0) {
            rawProjects = activeRes.data;
          }
        } catch (e) {
          // ignore
        }
      }

      if (rawProjects.length > 0) {
        const mapped: MyProjectItem[] = rawProjects.map((p: any, idx: number) => {
          const statuses: Array<'In Progress' | 'Review' | 'Completed' | 'On Hold'> = [
            'In Progress',
            'Review',
            'Completed',
            'On Hold',
          ];
          const icons: Array<'wind' | 'trash' | 'sprout' | 'activity' | 'droplets'> = [
            'wind',
            'trash',
            'sprout',
            'activity',
            'droplets',
          ];
          const iconBgs = ['bg-purple-100', 'bg-emerald-100', 'bg-amber-100', 'bg-rose-100', 'bg-blue-100'];
          const iconColors = [
            'text-purple-600',
            'text-emerald-600',
            'text-amber-600',
            'text-rose-600',
            'text-blue-600',
          ];

          const statusVal = p.status
            ? p.status === 'COMPLETED'
              ? 'Completed'
              : p.status === 'ON_HOLD'
              ? 'On Hold'
              : p.status === 'REVIEW'
              ? 'Review'
              : 'In Progress'
            : statuses[idx % statuses.length];

          const iconVal = icons[idx % icons.length];
          const membersList = p.team?.members || p.members || [];

          return {
            id: p.id,
            name: p.name || p.title || p.shortName || 'Project ' + (idx + 1),
            categoryTag: p.category || (p.type ? String(p.type).toUpperCase() : 'FINAL YEAR'),
            domain: p.domain || 'Smart Cities',
            subdomain: p.sector || p.subdomain || 'General',
            teamName: p.team?.name || 'My Team',
            memberCount: membersList.length || 4,
            teamAvatars:
              membersList.length > 0
                ? membersList.slice(0, 3).map((m: any, i: number) => ({
                    initials: ((m.name || m.fullName || `Member ${i + 1}`).split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'M').toUpperCase(),
                    bg: ['bg-indigo-600', 'bg-blue-600', 'bg-sky-600', 'bg-purple-600'][i % 4],
                  }))
                : [
                    { initials: 'SA', bg: 'bg-indigo-600' },
                    { initials: 'AR', bg: 'bg-blue-600' },
                    { initials: 'KM', bg: 'bg-sky-600' },
                  ],
            moreMembersCount: Math.max(0, (membersList.length || 4) - 3),
            status: statusVal,
            progressPercent: p.progress !== undefined ? p.progress : statusVal === 'Completed' ? 100 : Math.floor(30 + ((idx * 23) % 65)),
            lastUpdated: p.updatedAt
              ? new Date(p.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Aug 3, 2025 10:30 AM',
            iconType: iconVal,
            iconBg: iconBgs[idx % iconBgs.length],
            iconColor: iconColors[idx % iconColors.length],
          };
        });

        setProjectsList(mapped);
      }
    } catch (err) {
      console.error('Error fetching user projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProjects();
  }, []);

  // Filtered list calculation
  const filteredProjects = useMemo(() => {
    return projectsList.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDomain = (p.domain || '').toLowerCase().includes(q);
        const matchesSubdomain = (p.subdomain || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDomain && !matchesSubdomain) return false;
      }
      if (statusFilter !== 'all') {
        if (p.status.toLowerCase().replace(/\s+/g, '_') !== statusFilter.toLowerCase().replace(/\s+/g, '_')) {
          return false;
        }
      }
      return true;
    });
  }, [projectsList, searchQuery, statusFilter]);

  // Statistics metric calculations
  const totalCount = projectsList.length;
  const activeCount = projectsList.filter((p) => p.status === 'In Progress').length;
  const completedCount = projectsList.filter((p) => p.status === 'Completed').length;
  const onHoldCount = projectsList.filter((p) => p.status === 'On Hold').length;

  // Pagination calculation
  const totalPages = Math.ceil(filteredProjects.length / pageSize) || 1;
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  // Render project icon helper
  const renderProjectIcon = (type?: string) => {
    switch (type) {
      case 'wind':
        return <Wind className="w-5 h-5" />;
      case 'trash':
        return <Trash2 className="w-5 h-5" />;
      case 'sprout':
        return <Sprout className="w-5 h-5" />;
      case 'activity':
        return <Activity className="w-5 h-5" />;
      case 'droplets':
        return <Droplets className="w-5 h-5" />;
      default:
        return <Layers className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 font-sans space-y-6 max-w-7xl mx-auto">
      {/* ---------------------------------------------------------------- TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Projects</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            All the projects you are part of. Track progress and manage execution.
          </p>
        </div>

        <button
          onClick={() => navigate('/projects/propose')}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {/* ---------------------------------------------------------------- TOP METRIC STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Total Projects</span>
            <span className="text-2xl font-extrabold text-slate-900 leading-tight block">
              {totalCount}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">All projects</span>
          </div>
        </div>

        {/* Active Projects */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Active Projects</span>
            <span className="text-2xl font-extrabold text-slate-900 leading-tight block">
              {activeCount}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">In progress</span>
          </div>
        </div>

        {/* Completed Projects */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Completed Projects</span>
            <span className="text-2xl font-extrabold text-slate-900 leading-tight block">
              {completedCount}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Successfully completed</span>
          </div>
        </div>

        {/* On Hold */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Ban className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">On Hold</span>
            <span className="text-2xl font-extrabold text-slate-900 leading-tight block">
              {onHoldCount}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Temporarily paused</span>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- FILTER & CONTROLS STRIP */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
          >
            <Filter className="w-3.5 h-3.5 text-slate-400" /> Filter
          </button>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="In Progress">In Progress</option>
            <option value="Review">Review</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="recently_updated">Sort: Recently Updated</option>
            <option value="name">Sort: Name</option>
            <option value="progress">Sort: Progress</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- DATA TABLE LIST VIEW */}
      {viewMode === 'list' ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/90 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Project Details</th>
                  <th className="py-3 px-4 text-center">Team</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Progress</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProjects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="hover:bg-slate-50/80 transition group cursor-pointer"
                  >
                    {/* 1. Project Details */}
                    <td className="py-4 px-5">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl ${p.iconBg || 'bg-blue-100'} ${
                            p.iconColor || 'text-blue-600'
                          } flex items-center justify-center shrink-0 shadow-2xs mt-0.5`}
                        >
                          {renderProjectIcon(p.iconType)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition">
                              {p.name}
                            </span>
                            {p.categoryTag && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wide">
                                {p.categoryTag}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 space-x-1 font-medium">
                            <span>{p.domain || 'Smart Cities'}</span>
                            <span>•</span>
                            <span>{p.subdomain || 'General'}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            <span>{p.teamName || 'Team'}</span>
                            <span> • </span>
                            <span>{p.memberCount || 4} Members</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Team Avatar Stack */}
                    <td className="py-4 px-4 align-middle">
                      <div className="flex items-center justify-center -space-x-2 overflow-hidden">
                        {(p.teamAvatars || []).map((av, idx) => (
                          <div
                            key={idx}
                            className={`w-7 h-7 rounded-full ${av.bg} text-white font-bold text-[10px] flex items-center justify-center border-2 border-white ring-1 ring-slate-100 shadow-2xs`}
                          >
                            {av.initials}
                          </div>
                        ))}
                        {(p.moreMembersCount || 0) > 0 && (
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center border-2 border-white ring-1 ring-slate-200">
                            +{p.moreMembersCount}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 3. Status Badge */}
                    <td className="py-4 px-4 text-center align-middle">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          p.status === 'In Progress'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                            : p.status === 'Review'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                            : p.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    {/* 4. Progress */}
                    <td className="py-4 px-4 align-middle">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all"
                            style={{ width: `${p.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700 w-8 text-right">
                          {p.progressPercent}%
                        </span>
                      </div>
                    </td>

                    {/* 5. Last Updated */}
                    <td className="py-4 px-4 text-xs font-semibold text-slate-600 align-middle">
                      {p.lastUpdated}
                    </td>

                    {/* 6. Actions */}
                    <td className="py-4 px-5 text-right align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/projects/${p.id}`);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-2xs"
                        >
                          Daily Log & Workspace
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/projects/${p.id}/execution-doc`);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5" /> Execution Doc
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW OPTION */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:border-indigo-400 hover:shadow-md transition flex flex-col justify-between cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div
                    className={`w-10 h-10 rounded-2xl ${p.iconBg || 'bg-blue-100'} ${
                      p.iconColor || 'text-blue-600'
                    } flex items-center justify-center shrink-0`}
                  >
                    {renderProjectIcon(p.iconType)}
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      p.status === 'In Progress'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : p.status === 'Review'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : p.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition">
                    {p.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.domain} • {p.subdomain}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <span>{p.teamName} ({p.memberCount} Members)</span>
                  <div className="flex items-center -space-x-1.5">
                    {(p.teamAvatars || []).map((av, idx) => (
                      <div
                        key={idx}
                        className={`w-6 h-6 rounded-full ${av.bg} text-white font-bold text-[9px] flex items-center justify-center border border-white`}
                      >
                        {av.initials}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-700">
                    <span>Progress</span>
                    <span>{p.progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${p.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/projects/${p.id}`);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  Daily Log & Workspace
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/projects/${p.id}/execution-doc`);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
                >
                  <FileText className="w-3.5 h-3.5" /> Execution Doc
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------------------------------------------------------- FOOTER PAGINATION */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/80">
        <div className="text-xs text-slate-500 font-medium">
          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredProjects.length)} of {filteredProjects.length} projects
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition shadow-2xs"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {[...Array(totalPages)].map((_, idx) => {
              const pageNum = idx + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`h-8 w-8 rounded-xl text-xs font-bold transition ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white shadow-2xs'
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
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition shadow-2xs"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <select className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 outline-none cursor-pointer">
              <option value="5">5 / page</option>
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
