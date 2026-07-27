import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Trophy,
  Activity,
  FolderGit2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Award,
  BookOpen,
} from 'lucide-react';
import { adminService } from '../../services/admin.service';
import { AdminTeamDetailPanel } from './AdminTeamDetailPanel';
import { AdminStudentDetailPanel } from './AdminStudentDetailPanel';

export const AdminDirectory: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'teams' | 'students'>('teams');

  // Data states
  const [teams, setTeams] = useState<any[]>([]);
  const [teamsTotal, setTeamsTotal] = useState(0);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const [students, setStudents] = useState<any[]>([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Selected for slide-overs
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Fetch Teams
  useEffect(() => {
    setTeamsLoading(true);
    adminService
      .getTeams(1, 200) // fetch up to 200 for smooth client filtering
      .then((data) => {
        setTeams(data.teams || []);
        setTeamsTotal(data.total || data.teams?.length || 0);
      })
      .catch((err) => console.error('Failed to load teams:', err))
      .finally(() => setTeamsLoading(false));
  }, []);

  // Fetch Students
  useEffect(() => {
    setStudentsLoading(true);
    adminService
      .getStudents(1, 200)
      .then((data) => {
        setStudents(data.students || []);
        setStudentsTotal(data.total || data.students?.length || 0);
      })
      .catch((err) => console.error('Failed to load students:', err))
      .finally(() => setStudentsLoading(false));
  }, []);

  // Reset pagination on filter or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDomain, activeTab]);

  // Extract unique domains for filter dropdown
  const uniqueDomains = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => t.domain && set.add(t.domain));
    students.forEach((s) => (s.ssgDomain || s.team?.domain) && set.add(s.ssgDomain || s.team?.domain));
    return Array.from(set).filter(Boolean);
  }, [teams, students]);

  // Filtered Teams
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name?.toLowerCase().includes(q) ||
        t.groupCode?.toLowerCase().includes(q) ||
        t.domain?.toLowerCase().includes(q);

      const matchesDomain =
        selectedDomain === 'ALL' || (t.domain && t.domain.toLowerCase() === selectedDomain.toLowerCase());

      return matchesSearch && matchesDomain;
    });
  }, [teams, searchQuery, selectedDomain]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.fullName?.toLowerCase().includes(q) ||
        s.regNo?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.team?.name?.toLowerCase().includes(q);

      const domainStr = s.ssgDomain || s.team?.domain;
      const matchesDomain =
        selectedDomain === 'ALL' || (domainStr && domainStr.toLowerCase() === selectedDomain.toLowerCase());

      return matchesSearch && matchesDomain;
    });
  }, [students, searchQuery, selectedDomain]);

  // Pagination slicing
  const totalFilteredCount = activeTab === 'teams' ? filteredTeams.length : filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / itemsPerPage));

  const paginatedTeams = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTeams.slice(start, start + itemsPerPage);
  }, [filteredTeams, currentPage]);

  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(start, start + itemsPerPage);
  }, [filteredStudents, currentPage]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Users className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Admin Directory</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Explore teams and students with live performance scores, active projects, and contribution metrics.
          </p>
        </div>

        {/* Counts summary pills */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-center">
            <span className="text-xs font-semibold text-slate-400 block">TOTAL TEAMS</span>
            <span className="text-lg font-bold text-violet-400">{teamsTotal}</span>
          </div>
          <div className="px-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-center">
            <span className="text-xs font-semibold text-slate-400 block">TOTAL STUDENTS</span>
            <span className="text-lg font-bold text-sky-400">{studentsTotal}</span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Tabs, Search, Domain Filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
        
        {/* Dual Pill Tabs */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'teams'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Teams</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'teams' ? 'bg-violet-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {teamsTotal}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'students'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Students</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'students' ? 'bg-violet-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {studentsTotal}
            </span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-1 max-w-md items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'teams' ? 'Search by team name or group code...' : 'Search by name, ID or email...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="relative">
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
            >
              <option value="ALL">All Domains</option>
              {uniqueDomains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      {activeTab === 'teams' ? (
        teamsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Loading teams intelligence...</p>
          </div>
        ) : paginatedTeams.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500">
            No teams match the current search or domain filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedTeams.map((team) => {
              const liveRank = team.liveRanking || {
                score: 0,
                rank: '-',
                hasActivity: false,
              };
              const activeProj = team.projects && team.projects.length > 0 ? team.projects[0] : null;

              return (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500/50 dark:hover:border-violet-500/50 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Top Row: Group Code & Domain Tag */}
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                        {team.groupCode || 'Uncoded'}
                      </span>
                      {team.domain && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {team.domain}
                        </span>
                      )}
                    </div>

                    {/* Team Name & Lead */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                        {team.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {team.members?.length || 0} Members assigned
                      </p>
                    </div>

                    {/* Active Project Title */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
                        <FolderGit2 className="w-3.5 h-3.5 text-violet-500" />
                        <span>Active Project</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {activeProj?.name || team.currentProjectLabel || 'No active project'}
                      </p>
                    </div>
                  </div>

                  {/* Performance Score Bar */}
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-emerald-500" />
                        Live Performance
                      </span>
                      <div className="flex items-center gap-2">
                        {liveRank.domainRank && (
                          <span className="font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded text-[11px]">
                            #{liveRank.domainRank} domain
                          </span>
                        )}
                        <span className="font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded text-[11px]">
                          Rank #{liveRank.rank}
                        </span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                          {liveRank.score}%
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, liveRank.score)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Students Tab Grid */
        studentsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Loading students intelligence...</p>
          </div>
        ) : paginatedStudents.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500">
            No students match the current search or domain filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedStudents.map((student) => {
              const liveRank = student.liveRanking || {
                score: student.performanceScore || 0,
                rank: student.rank || '-',
              };

              const initials = student.fullName
                ? student.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                : 'ST';

              return (
                <div
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500/50 dark:hover:border-violet-500/50 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header: Avatar, Name & RegNo */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-bold flex items-center justify-center text-xs shadow border border-violet-400/30 flex-shrink-0">
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                          {student.fullName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                          {student.regNo || student.email}
                        </p>
                      </div>
                    </div>

                    {/* Team & Domain Tags */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {student.team?.name && (
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                          {student.team.name}
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {student.ssgDomain || student.team?.domain || 'General Domain'}
                      </span>
                    </div>

                    {/* Points Pills (Reward & Activity) */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Trophy className="w-3 h-3" />
                        {student.rewardPoints || 0} pts
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        <Award className="w-3 h-3" />
                        {student.activityPoints || 0} pts
                      </span>
                    </div>
                  </div>

                  {/* Individual Performance Score Bar */}
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-emerald-500" />
                        Individual Performance
                      </span>
                      <div className="flex items-center gap-2">
                        {liveRank.domainRank && (
                          <span className="font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded text-[11px]">
                            #{liveRank.domainRank} domain
                          </span>
                        )}
                        <span className="font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded text-[11px]">
                          Rank #{liveRank.rank}
                        </span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                          {liveRank.score}%
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, liveRank.score)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing Page <span className="font-bold text-slate-900 dark:text-white">{currentPage}</span> of{' '}
            <span className="font-bold text-slate-900 dark:text-white">{totalPages}</span> ({totalFilteredCount} total items)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 px-2">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Slide-over Detail Drawers */}
      <AdminTeamDetailPanel
        teamId={selectedTeamId}
        onClose={() => setSelectedTeamId(null)}
      />

      <AdminStudentDetailPanel
        studentId={selectedStudentId}
        onClose={() => setSelectedStudentId(null)}
      />
    </div>
  );
};
