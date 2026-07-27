import React, { useEffect, useState } from 'react';
import { X, Trophy, Users, FolderGit2, CheckCircle2, Clock, Activity, ExternalLink, ShieldCheck, Github } from 'lucide-react';
import { adminService } from '../../services/admin.service';

interface AdminTeamDetailPanelProps {
  teamId: string | null;
  onClose: () => void;
}

export const AdminTeamDetailPanel: React.FC<AdminTeamDetailPanelProps> = ({ teamId, onClose }) => {
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    setError(null);
    adminService
      .getTeamById(teamId)
      .then((data) => {
        setTeam(data);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Failed to load team details');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [teamId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!teamId) return null;

  const liveRanking = team?.liveRanking || {
    score: 0,
    rank: '-',
    domain: null,
    domainRank: null,
    domainPercentile: null,
    deadlineCompleteness: 0,
    finishment: 0,
    productivity: 0,
    categories: { execution: 0, productivity: 0, quality: 0, collaboration: 0 },
    githubLinked: false,
    plagiarismRisk: null,
    hasActivity: false,
  };
  const categories = liveRanking.categories || { execution: 0, productivity: 0, quality: 0, collaboration: 0 };

  const activeProject = team?.projects && team.projects.length > 0 ? team.projects[0] : null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-[#0f172a] text-slate-100 shadow-2xl flex flex-col border-l border-slate-800 animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
                style={{ backgroundColor: team?.color || '#7C3AED' }}
              >
                {team?.name ? team.name.slice(0, 2).toUpperCase() : 'TM'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{team?.name || 'Team Details'}</h2>
                  {team?.groupCode && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {team.groupCode}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  {team?.domain ? `${team.domain} Domain` : 'General Domain'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Close panel (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium">Loading team intelligence...</p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            ) : (
              <>
                {/* 4 Stat Overview Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                      <span>PERFORMANCE RANK</span>
                      <Trophy className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="mt-2 text-2xl font-extrabold text-amber-400">
                      #{liveRanking.rank}
                    </div>
                  </div>

                  <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                      <span>LIVE SCORE</span>
                      <Activity className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="mt-2 text-2xl font-extrabold text-emerald-400">
                      {liveRanking.score}%
                    </div>
                  </div>

                  <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                      <span>MEMBERS</span>
                      <Users className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="mt-2 text-2xl font-extrabold text-sky-400">
                      {team?.members?.length || 0}
                    </div>
                  </div>

                  <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                      <span>FINISHMENT</span>
                      <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="mt-2 text-2xl font-extrabold text-indigo-400">
                      {Math.round((liveRanking.finishment || 0) * 100)}%
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Bar — 4 weighted categories */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-200">Performance Breakdown</span>
                    <div className="flex items-center gap-2">
                      {liveRanking.domainRank && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          #{liveRanking.domainRank} in {team?.domain || 'domain'} ({liveRanking.domainPercentile}th pct)
                        </span>
                      )}
                      {liveRanking.githubLinked && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 border border-slate-600 flex items-center gap-1">
                          <Github className="w-3 h-3" /> Linked
                        </span>
                      )}
                      {liveRanking.plagiarismRisk === 'HIGH' && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                          Plagiarism risk: HIGH
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${Math.round(categories.execution * 35)}%` }}
                      title="Execution — deadlines, finishment, milestones (35%)"
                    />
                    <div
                      className="bg-sky-500 h-full transition-all duration-500"
                      style={{ width: `${Math.round(categories.productivity * 25)}%` }}
                      title="Productivity — daily logs, GitHub activity (25%)"
                    />
                    <div
                      className="bg-amber-500 h-full transition-all duration-500"
                      style={{ width: `${Math.round(categories.quality * 25)}%` }}
                      title="Quality/Authenticity — AI evaluation reports (25%)"
                    />
                    <div
                      className="bg-fuchsia-500 h-full transition-all duration-500"
                      style={{ width: `${Math.round(categories.collaboration * 15)}%` }}
                      title="Collaboration — contributor balance, work packages, flags (15%)"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px] pt-1">
                    <div>
                      <span className="text-emerald-400 font-bold block">{Math.round(categories.execution * 100)}%</span>
                      <span className="text-slate-500">Execution</span>
                    </div>
                    <div>
                      <span className="text-sky-400 font-bold block">{Math.round(categories.productivity * 100)}%</span>
                      <span className="text-slate-500">Productivity</span>
                    </div>
                    <div>
                      <span className="text-amber-400 font-bold block">{Math.round(categories.quality * 100)}%</span>
                      <span className="text-slate-500">Quality</span>
                    </div>
                    <div>
                      <span className="text-fuchsia-400 font-bold block">{Math.round(categories.collaboration * 100)}%</span>
                      <span className="text-slate-500">Collaboration</span>
                    </div>
                  </div>
                </div>

                {/* Active Project */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="w-5 h-5 text-violet-400" />
                      <h3 className="text-sm font-bold text-white">Active Project</h3>
                    </div>
                    {activeProject?.status && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {activeProject.status}
                      </span>
                    )}
                  </div>

                  {activeProject ? (
                    <div className="space-y-2">
                      <h4 className="text-base font-semibold text-violet-200">{activeProject.name}</h4>
                      {activeProject.description && (
                        <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">
                          {activeProject.description}
                        </p>
                      )}
                      {activeProject.repoLink && (
                        <a
                          href={activeProject.repoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 hover:underline pt-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Repository ({activeProject.repoLink})
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No active project assigned yet.</p>
                  )}
                </div>

                {/* Member Roster Table */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-sky-400" />
                      <h3 className="text-sm font-bold text-white">Team Roster</h3>
                    </div>
                    <span className="text-xs text-slate-400">
                      {team?.members?.length || 0} Members
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Student</th>
                          <th className="px-4 py-3 font-semibold">Reg No</th>
                          <th className="px-4 py-3 font-semibold">Student Rank</th>
                          <th className="px-4 py-3 font-semibold">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {team?.members?.map((m: any) => {
                          const isLead = team.leadId === m.id;
                          return (
                            <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-violet-600/30 text-violet-300 border border-violet-500/40 flex items-center justify-center font-bold text-xs">
                                    {m.fullName.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-medium text-slate-100 flex items-center gap-1.5">
                                      {m.fullName}
                                      {isLead && (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                          Lead
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400">{m.ssgDomain || 'General'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs font-mono text-slate-400">
                                {m.regNo || '-'}
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-amber-400">
                                #{m.rank || m.liveRanking?.rank || '-'}
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  {m.performanceScore ?? m.liveRanking?.score ?? 0}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Achievements Timeline */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Achievements & Recognition</h3>
                  </div>

                  {team?.achievements && team.achievements.length > 0 ? (
                    <div className="space-y-3">
                      {team.achievements.map((ach: any) => (
                        <div
                          key={ach.id}
                          className="flex items-start justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-colors"
                        >
                          <div>
                            <h4 className="text-sm font-semibold text-slate-200">{ach.title}</h4>
                            <p className="text-xs text-slate-400 mt-0.5">{ach.description}</p>
                            <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                              <Clock className="w-3 h-3" />
                              {new Date(ach.date).toLocaleDateString()}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            +{ach.points} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No team achievements recorded yet.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
