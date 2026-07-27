import React, { useEffect, useState } from 'react';
import { X, Trophy, User as UserIcon, Building2, BookOpen, Award, Activity, CheckCircle2, ShieldCheck, Github } from 'lucide-react';
import { adminService } from '../../services/admin.service';

interface AdminStudentDetailPanelProps {
  studentId: string | null;
  onClose: () => void;
}

export const AdminStudentDetailPanel: React.FC<AdminStudentDetailPanelProps> = ({ studentId, onClose }) => {
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    adminService
      .getStudentById(studentId)
      .then((data) => {
        setStudent(data);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Failed to load student details');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [studentId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!studentId) return null;

  const liveRanking = student?.liveRanking || {
    score: student?.performanceScore || 0,
    rank: student?.rank || '-',
    domain: null,
    domainRank: null,
    domainPercentile: null,
    deadlineCompleteness: 0,
    finishment: 0,
    productivity: 0,
    categories: { execution: 0, productivity: 0, quality: 0, collaboration: 0 },
    githubLinked: false,
    hasActivity: false,
  };
  const categories = liveRanking.categories || { execution: 0, productivity: 0, quality: 0, collaboration: 0 };

  const initials = student?.fullName
    ? student.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'ST';

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
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-bold flex items-center justify-center text-sm shadow-md border border-violet-400/30">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{student?.fullName || 'Student Details'}</h2>
                  {student?.regNo && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                      {student.regNo}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  {student?.email}
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
                <p className="text-sm font-medium">Loading student intelligence...</p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            ) : (
              <>
                {/* 3 Stat Overview Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                      <span>PERFORMANCE SCORE</span>
                      <Activity className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-emerald-400">{liveRanking.score}%</span>
                      <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        Rank #{liveRanking.rank}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                      <span>REWARD POINTS</span>
                      <Trophy className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="mt-2 text-2xl font-extrabold text-amber-400">
                      {student?.rewardPoints || 0} pts
                    </div>
                  </div>

                  <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                      <span>ACTIVITY POINTS</span>
                      <Award className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="mt-2 text-2xl font-extrabold text-sky-400">
                      {student?.activityPoints || 0} pts
                    </div>
                  </div>
                </div>

                {/* Individual Performance Metrics Breakdown */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-200">Contribution Signals</span>
                    <div className="flex items-center gap-2">
                      {liveRanking.domainRank && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          #{liveRanking.domainRank} in domain ({liveRanking.domainPercentile}th pct)
                        </span>
                      )}
                      {liveRanking.githubLinked ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 border border-slate-600 flex items-center gap-1">
                          <Github className="w-3 h-3" /> Linked
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-800">
                          GitHub not linked
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block">Execution</span>
                      <span className="text-emerald-400 font-bold text-sm">
                        {Math.round(categories.execution * 100)}%
                      </span>
                    </div>
                    <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block">Productivity</span>
                      <span className="text-sky-400 font-bold text-sm">
                        {Math.round(categories.productivity * 100)}%
                      </span>
                    </div>
                    <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block">Quality</span>
                      <span className="text-amber-400 font-bold text-sm">
                        {Math.round(categories.quality * 100)}%
                      </span>
                    </div>
                    <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block">Collab.</span>
                      <span className="text-fuchsia-400 font-bold text-sm">
                        {Math.round(categories.collaboration * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Team Info Card */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-violet-400" />
                    <h3 className="text-sm font-bold text-white">Assigned Team</h3>
                  </div>

                  {student?.team ? (
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-semibold text-violet-200">{student.team.name}</h4>
                          {student.team.groupCode && (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                              {student.team.groupCode}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {student.team.domain ? `${student.team.domain} Domain` : 'General Domain'}
                        </p>
                      </div>

                      {student.team.leadId === student.id && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Team Lead
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">Not currently assigned to a team.</p>
                  )}
                </div>

                {/* Profile Details Table */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-sky-400" />
                    <h3 className="text-sm font-bold text-white">Academic & Profile Details</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800/80">
                      <span className="text-xs text-slate-400 block">SSG Domain</span>
                      <span className="font-semibold text-slate-200">{student?.ssgDomain || student?.team?.domain || 'General'}</span>
                    </div>

                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800/80">
                      <span className="text-xs text-slate-400 block">Department</span>
                      <span className="font-semibold text-slate-200">{student?.department || student?.deptCode || 'Not set'}</span>
                    </div>

                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800/80">
                      <span className="text-xs text-slate-400 block">Year of Study</span>
                      <span className="font-semibold text-slate-200">{student?.year ? `Year ${student.year}` : 'Not set'}</span>
                    </div>

                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800/80">
                      <span className="text-xs text-slate-400 block">Cluster</span>
                      <span className="font-semibold text-slate-200">{student?.cluster || 'Not set'}</span>
                    </div>

                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800/80">
                      <span className="text-xs text-slate-400 block">Learning Mode</span>
                      <span className="font-semibold text-slate-200">{student?.learningMode || 'Not set'}</span>
                    </div>

                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800/80">
                      <span className="text-xs text-slate-400 block">Hostel / Day Scholar</span>
                      <span className="font-semibold text-slate-200">
                        {student?.resident === 'H' ? 'Hosteller' : student?.resident === 'D' ? 'Day Scholar' : 'Not set'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800/80">
                      <span className="text-xs text-slate-400 block">Gender</span>
                      <span className="font-semibold text-slate-200">{student?.gender || 'Not set'}</span>
                    </div>
                  </div>
                </div>

                {/* Registered Skills & Ranks */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-bold text-white">Registered Skills</h3>
                    </div>
                    <span className="text-xs text-slate-400">
                      {student?.userSkills?.length || 0} Skills Recorded
                    </span>
                  </div>

                  {student?.userSkills && student.userSkills.length > 0 ? (
                    <div className="space-y-2">
                      {student.userSkills.map((sk: any) => (
                        <div
                          key={sk.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-800"
                        >
                          <div>
                            <span className="text-sm font-medium text-slate-200">{sk.skillName}</span>
                            {sk.skillType && (
                              <span className="ml-2 px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-slate-800 text-slate-400">
                                {sk.skillType}
                              </span>
                            )}
                            {sk.skillRank != null && sk.totalRanks != null && (
                              <div className="text-[11px] text-amber-400/90 font-semibold mt-1">
                                Rank #{sk.skillRank} of {sk.totalRanks}
                              </div>
                            )}
                          </div>
                          <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                            {sk.totalPoints} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No skills registered yet.</p>
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
