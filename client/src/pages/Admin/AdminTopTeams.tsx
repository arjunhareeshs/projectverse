import React, { useState, useEffect } from 'react';
import { Trophy, Github, AlertCircle, ChevronDown, ChevronUp, Users, FolderGit2 } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import { ScoreRing } from './components/ScoreRing';
import { CategoryBars } from './components/CategoryBars';
import { EmptyState, ErrorState, SkeletonGrid } from './components/CommonState';

interface EnrichedTopTeam {
  teamId: string;
  name: string;
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
  plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  currentProject: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  members: Array<{
    id: string;
    fullName: string;
    regNo: string | null;
    ssgDomain: string | null;
  }>;
}

interface DomainTeamGroup {
  domain: string;
  displayName: string;
  teams: EnrichedTopTeam[];
}

export const AdminTopTeams: React.FC = () => {
  const [limit, setLimit] = useState<number>(5);
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [groups, setGroups] = useState<DomainTeamGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const fetchTopTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getTopTeams(limit);
      setGroups(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch top teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopTeams();
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
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Top Team Rankings</h1>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Per-domain podium derived from multi-cycle execution, productivity, quality, and collaboration metrics.
              </p>
            </div>
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

      {/* Domain Filter Chips */}
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
            All Domains ({groups.reduce((sum, g) => sum + g.teams.length, 0)})
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

      {/* Main Content State */}
      {loading ? (
        <SkeletonGrid count={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTopTeams} />
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          title="No Ranked Teams Found"
          description="There are currently no active team rankings available for the selected domain filter."
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
                  {group.teams.length} Team{group.teams.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Medallion Cards (Ranks 1–3) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {group.teams.slice(0, 3).map((team, idx) => {
                  const rank = idx + 1;
                  const med = getRankMedallion(rank);
                  const isExpanded = expandedTeamId === team.teamId;

                  return (
                    <div
                      key={team.teamId}
                      className={`relative bg-white rounded-2xl border p-5 transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between ${
                        rank === 1 ? 'border-amber-300/80 ring-1 ring-amber-200/50' : 'border-slate-200/80'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex justify-between items-start mb-3">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r ${med.bg} shadow-xs`}
                        >
                          {med.label}
                        </span>

                        <div className="flex items-center gap-2">
                          {team.githubLinked && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full" title="GitHub Repo Linked">
                              <Github className="h-3 w-3 text-slate-700" />
                              Linked
                            </span>
                          )}
                          {team.plagiarismRisk && team.plagiarismRisk !== 'LOW' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              <AlertCircle className="h-3 w-3 text-rose-600" />
                              {team.plagiarismRisk} Plagiarism
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Team Info & Score */}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-black text-slate-900 truncate">{team.name}</h3>
                          <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                            {team.currentProject?.name || 'No active project'}
                          </p>
                          {team.domainPercentile !== null && (
                            <span className="inline-block mt-2 text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                              Top {100 - Math.round(team.domainPercentile)}% of Domain
                            </span>
                          )}
                        </div>
                        <ScoreRing score={team.score} size={60} strokeWidth={6} />
                      </div>

                      {/* Category Bars */}
                      <div className="pt-3 border-t border-slate-100">
                        <CategoryBars categories={team.categories} />
                      </div>

                      {/* Expandable Member Details */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => setExpandedTeamId(isExpanded ? null : team.teamId)}
                          className="w-full flex items-center justify-between text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            {team.members.length} Team Members
                          </span>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 animate-in fade-in-50 text-xs">
                            {team.currentProject?.description && (
                              <div className="bg-slate-50 p-2.5 rounded-xl text-slate-600 leading-relaxed font-medium mb-2">
                                <span className="font-extrabold text-slate-800 block text-[10px] uppercase tracking-wider mb-0.5">
                                  Project Description
                                </span>
                                {team.currentProject.description}
                              </div>
                            )}
                            <div className="space-y-1">
                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                                Roster
                              </span>
                              {team.members.map((m) => (
                                <div key={m.id} className="flex justify-between items-center bg-slate-50/70 p-2 rounded-lg">
                                  <span className="font-bold text-slate-800">{m.fullName}</span>
                                  <span className="font-mono text-slate-500 text-[10px]">{m.regNo || 'N/A'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Compact Rows (Ranks 4+) */}
              {group.teams.length > 3 && (
                <div className="space-y-2 mt-4">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block px-1">
                    Runner-up Teams (Ranks 4–{group.teams.length})
                  </span>
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white overflow-hidden text-xs">
                    {group.teams.slice(3).map((team, idx) => {
                      const rank = idx + 4;
                      const isExpanded = expandedTeamId === team.teamId;

                      return (
                        <div key={team.teamId} className="p-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-mono font-black text-slate-600 text-xs">
                                #{rank}
                              </span>
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-900 truncate">{team.name}</h4>
                                <p className="text-[11px] font-medium text-slate-500 truncate">
                                  {team.currentProject?.name || 'No project'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-5 shrink-0">
                              <div className="hidden sm:block w-48">
                                <CategoryBars categories={team.categories} />
                              </div>
                              <ScoreRing score={team.score} size={42} strokeWidth={4} />
                              <button
                                onClick={() => setExpandedTeamId(isExpanded ? null : team.teamId)}
                                className="text-slate-400 hover:text-indigo-600 p-1"
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 font-medium">
                                {team.members.map((m) => (
                                  <div key={m.id} className="flex justify-between bg-slate-50 p-2 rounded-lg">
                                    <span>{m.fullName}</span>
                                    <span className="font-mono text-slate-400 text-[10px]">{m.regNo || ''}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
