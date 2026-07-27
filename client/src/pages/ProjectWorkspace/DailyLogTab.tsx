import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Send,
  Filter,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  UserCheck,
  Flame,
} from 'lucide-react';
import { DailyLogEntry } from '../../types/projectLog';
import { lifecycleService } from '../../services/lifecycle.service';
import { useAppSelector } from '../../app/hooks';

interface DailyLogTabProps {
  projectId: string;
}

export const DailyLogTab: React.FC<DailyLogTabProps> = ({ projectId }) => {
  const currentUser = useAppSelector((state) => state.auth.user);

  const [logs, setLogs] = useState<DailyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [workDone, setWorkDone] = useState('');
  const [hoursSpent, setHoursSpent] = useState<number | undefined>(undefined);
  const [blockers, setBlockers] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(['']);

  // Filters
  const [filterMember, setFilterMember] = useState<string>('ALL');
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await lifecycleService.getDailyLogs(projectId, {
        userId: filterMember !== 'ALL' ? filterMember : undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
      });
      const items = Array.isArray(data) ? data : [];
      setLogs(items);

      // Prefill today's entry for current user if it exists
      const todaysMine = items.find(
        (l) => l.userId === currentUser?.id && l.date.slice(0, 10) === todayStr
      );
      if (todaysMine) {
        setWorkDone(todaysMine.workDone || '');
        setHoursSpent(todaysMine.hoursSpent);
        setBlockers(todaysMine.blockers || '');
        setEvidenceUrls(
          todaysMine.evidenceUrls && todaysMine.evidenceUrls.length > 0
            ? todaysMine.evidenceUrls
            : ['']
        );
      }
    } catch (err) {
      console.error('Failed to load daily logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [projectId, filterMember, filterFrom, filterTo]);

  const handleAddEvidenceUrl = () => {
    setEvidenceUrls([...evidenceUrls, '']);
  };

  const handleEvidenceChange = (index: number, val: string) => {
    const next = [...evidenceUrls];
    next[index] = val;
    setEvidenceUrls(next);
  };

  const handleRemoveEvidenceUrl = (index: number) => {
    setEvidenceUrls(evidenceUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workDone.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const validUrls = evidenceUrls.map((u) => u.trim()).filter((u) => u.length > 0);

    try {
      await lifecycleService.saveDailyLog(projectId, {
        workDone: workDone.trim(),
        hoursSpent: hoursSpent ? Number(hoursSpent) : undefined,
        blockers: blockers.trim() || undefined,
        evidenceUrls: validUrls.length > 0 ? validUrls : undefined,
      });

      setSuccessMsg("Today's work log saved successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchLogs();
    } catch (err: any) {
      console.error('Failed to save daily log', err);
      if (err?.response?.status === 409) {
        setError('Log entries can only be edited within a 2-day window.');
      } else {
        setError(err?.response?.data?.message || 'Failed to save log entry.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Compute Streak / Nudge Strip (Count of logged days in last 7 days per member)
  const computeMemberStreaks = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const memberMap: Record<string, { name: string; count: number }> = {};

    logs.forEach((log) => {
      const logDate = new Date(log.date);
      if (logDate >= sevenDaysAgo) {
        const uId = log.userId;
        const name = log.userName || uId;
        if (!memberMap[uId]) {
          memberMap[uId] = { name, count: 0 };
        }
        memberMap[uId].count += 1;
      }
    });

    return Object.entries(memberMap);
  };

  const streakItems = computeMemberStreaks();

  // Group logs by date desc
  const groupedLogs = logs.reduce((acc, log) => {
    const d = log.date.slice(0, 10);
    if (!acc[d]) acc[d] = [];
    acc[d].push(log);
    return acc;
  }, {} as Record<string, DailyLogEntry[]>);

  const uniqueMembers = Array.from(
    new Set(logs.map((l) => JSON.stringify({ id: l.userId, name: l.userName || l.userId })))
  ).map((s) => JSON.parse(s));

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Entry Composer (Top) */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" /> Today's Work Log ({todayStr})
            </h3>
            <p className="text-xs text-gray-500">Record your daily contributions and progress.</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            {currentUser?.fullName || 'Current Member'}
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              What did you accomplish today? <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={workDone}
              onChange={(e) => setWorkDone(e.target.value)}
              placeholder="Describe your code commits, design work, hardware setup, or tasks completed..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Hours Spent (optional)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={hoursSpent !== undefined ? hoursSpent : ''}
                  onChange={(e) =>
                    setHoursSpent(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  placeholder="e.g. 3.5"
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Blockers / Issues (optional)
              </label>
              <input
                type="text"
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                placeholder="Any technical blockers or dependencies?"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Evidence URLs (Repeat Field) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">
              Evidence Links (GitHub commits, PRs, docs, screenshots)
            </label>
            {evidenceUrls.map((url, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleEvidenceChange(idx, e.target.value)}
                    placeholder="https://github.com/org/repo/commit/..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                </div>
                {evidenceUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveEvidenceUrl(idx)}
                    className="p-2 text-gray-400 hover:text-rose-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddEvidenceUrl}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 pt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Another Evidence Link
            </button>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !workDone.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-xs disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> {submitting ? 'Saving Log...' : "Save Today's Log"}
            </button>
          </div>
        </form>
      </div>

      {/* Streak / Nudge Strip */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900">7-Day Team Log Activity</h4>
            <p className="text-[11px] text-gray-500">
              Days logged by members in the last 7 days. Stay consistent before AI review.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {streakItems.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No logs recorded in the last 7 days yet.</span>
          ) : (
            streakItems.map(([uId, data]) => (
              <div
                key={uId}
                className="px-3 py-1 bg-white border border-indigo-100 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs"
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold text-gray-800">{data.name}:</span>
                <span className="font-bold text-orange-600">{data.count} / 7 days</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Team Timeline & Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            Team Work Timeline
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </div>
            <select
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
              className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700"
            >
              <option value="ALL">All Members</option>
              {uniqueMembers.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700"
              placeholder="From"
            />
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700"
              placeholder="To"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading timeline...</div>
        ) : Object.keys(groupedLogs).length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 bg-gray-50 rounded-2xl border border-gray-100">
            No work logs found for the selected filters.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedLogs).map(([dateStr, dayLogs]) => (
              <div key={dateStr} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-gray-900 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                    {new Date(dateStr).toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div className="space-y-3 pl-2 border-l-2 border-indigo-100">
                  {dayLogs.map((log) => {
                    const isMine = log.userId === currentUser?.id;
                    const logDate = new Date(log.createdAt || log.date);
                    const daysOld = (Date.now() - logDate.getTime()) / (1000 * 3600 * 24);
                    const isReadOnly = daysOld > 2;

                    return (
                      <div
                        key={log.id}
                        className="p-4 rounded-xl bg-white border border-gray-200 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900">
                              {log.userName || log.userId}
                            </span>
                            {isMine && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                You
                              </span>
                            )}
                            {log.hoursSpent && (
                              <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {log.hoursSpent} hrs
                              </span>
                            )}
                          </div>
                          {isReadOnly && (
                            <span className="text-[10px] text-gray-400 font-medium">Read-only (Locked)</span>
                          )}
                        </div>

                        <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {log.workDone}
                        </p>

                        {log.blockers && (
                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-800">
                            <span className="font-bold">Blocker: </span>
                            {log.blockers}
                          </div>
                        )}

                        {log.evidenceUrls && log.evidenceUrls.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {log.evidenceUrls.map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100"
                              >
                                <LinkIcon className="w-3 h-3" /> Evidence #{i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
