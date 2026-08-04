import React, { useState, useEffect } from 'react';
import { GraduationCap, Github, Users, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import { ScoreRing } from './components/ScoreRing';
import { CategoryBars } from './components/CategoryBars';
import { EmptyState, ErrorState, SkeletonGrid } from './components/CommonState';

interface EnrichedTopStudent {
  userId: string;
  fullName: string;
  regNo: string | null;
  department: string | null;
  domain: string;
  score: number;
  globalRank: number;
  domainRank: number | null;
  domainPercentile: number | null;
  categories: {
    execution: number;
    productivity: number;
    quality: number;
    collaboration: number;
  };
  githubLinked: boolean;
  team: {
    id: string;
    name: string;
    domain: string | null;
  } | null;
  topSkills: Array<{
    skillName: string;
    level: string;
    totalPoints: number;
  }>;
}

interface DomainStudentGroup {
  domain: string;
  displayName: string;
  students: EnrichedTopStudent[];
}

export const AdminTopStudents: React.FC = () => {
  const [limit, setLimit] = useState<number>(5);
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [groups, setGroups] = useState<DomainStudentGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTopStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getTopStudents(limit);
      setGroups(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch top students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopStudents();
  }, [limit]);

  const filteredGroups = selectedDomain === 'ALL'
    ? groups
    : groups.filter((g) => g.domain === selectedDomain);

  const allDomains = Array.from(new Set(groups.map((g) => g.domain)));

  const getRankMedallion = (rank: number) => {
    if (rank === 1) return { bg: 'from-amber-400 to-amber-600 text-white', label: '1st Gold' };
    if (rank === 2) return { bg: 'from-slate-300 to-slate-500 text-white', label: '2nd Silver' };
    if (rank === 3) return { bg: 'from-amber-700 to-amber-900 text-white', label: '3rd Bronze' };
    return { bg: 'bg-slate-100 text-slate-700', label: `#${rank}` };
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Top Student Rankings</h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Individual performance leaderboard aggregated across personal tasks, work log cadence, and team execution.
            </p>
          </div>
        </div>

        {/* Top-N Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show Top:</span>
          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-extrabold">
            {[3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  limit === n ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Domain Filters */}
      {allDomains.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedDomain('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              selectedDomain === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Domains ({groups.reduce((sum, g) => sum + g.students.length, 0)})
          </button>
          {allDomains.map((dom) => (
            <button
              key={dom}
              onClick={() => setSelectedDomain(dom)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                selectedDomain === dom
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {dom === '__none__' ? 'Unassigned' : dom}
            </button>
          ))}
        </div>
      )}

      {/* Content State */}
      {loading ? (
        <SkeletonGrid count={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTopStudents} />
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          title="No Student Rankings Found"
          description="There are currently no active student rankings available for the selected domain filter."
        />
      ) : (
        <div className="space-y-10">
          {filteredGroups.map((group) => (
            <section key={group.domain} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                  {group.displayName}
                </h2>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {group.students.length} Student{group.students.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Medallion Cards (Ranks 1–3) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {group.students.slice(0, 3).map((student, idx) => {
                  const rank = idx + 1;
                  const med = getRankMedallion(rank);
                  const initials = student.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

                  return (
                    <div
                      key={student.userId}
                      className={`relative bg-white rounded-2xl border p-5 transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between ${
                        rank === 1 ? 'border-amber-300/80 ring-1 ring-amber-200/50' : 'border-slate-200/80'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex justify-between items-start mb-3">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r ${med.bg} shadow-xs`}>
                          {med.label}
                        </span>

                        {student.githubLinked && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                            <Github className="h-3 w-3 text-slate-700" />
                            GitHub Linked
                          </span>
                        )}
                      </div>

                      {/* Avatar & Student Info */}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-md shadow-indigo-100">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-black text-slate-900 truncate">{student.fullName}</h3>
                            <p className="text-xs font-semibold text-slate-500 truncate">
                              {student.regNo || 'No ID'} {student.department ? `• ${student.department}` : ''}
                            </p>
                            {student.team && (
                              <span className="inline-block mt-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                {student.team.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <ScoreRing score={student.score} size={54} strokeWidth={5} />
                      </div>

                      {/* Top Skills */}
                      {student.topSkills.length > 0 && (
                        <div className="mb-3 space-y-1">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Top Skills</span>
                          <div className="flex flex-wrap gap-1">
                            {student.topSkills.map((sk) => (
                              <span key={sk.skillName} className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                {sk.skillName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Category Bars */}
                      <div className="pt-3 border-t border-slate-100">
                        <CategoryBars categories={student.categories} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Compact Rows (Ranks 4+) */}
              {group.students.length > 3 && (
                <div className="space-y-2 mt-4">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block px-1">
                    Runner-up Students (Ranks 4–{group.students.length})
                  </span>
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white overflow-hidden text-xs">
                    {group.students.slice(3).map((student, idx) => {
                      const rank = idx + 4;
                      const initials = student.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

                      return (
                        <div key={student.userId} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-mono font-black text-slate-600 text-xs">
                              #{rank}
                            </span>
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xs">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 truncate">{student.fullName}</h4>
                              <p className="text-[11px] font-medium text-slate-500 truncate">
                                {student.regNo || ''} {student.team ? `• ${student.team.name}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-5 shrink-0">
                            <div className="hidden sm:block w-44">
                              <CategoryBars categories={student.categories} />
                            </div>
                            <ScoreRing score={student.score} size={42} strokeWidth={4} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
