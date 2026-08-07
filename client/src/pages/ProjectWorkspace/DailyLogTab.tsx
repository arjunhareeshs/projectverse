import React, { useEffect, useState, useRef } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  Upload,
  Award,
  Target,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import { DailyLogEntry } from '../../types/projectLog';
import { lifecycleService } from '../../services/lifecycle.service';
import { useAppSelector } from '../../app/hooks';

interface DailyLogTabProps {
  projectId: string;
}

const formatAssetUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) {
    return `http://localhost:4000${url}`;
  }
  return url;
};

export const DailyLogTab: React.FC<DailyLogTabProps> = ({ projectId }) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [logs, setLogs] = useState<DailyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [workDone, setWorkDone] = useState('');
  const [hoursSpent, setHoursSpent] = useState<number | undefined>(undefined);
  const [blockers, setBlockers] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(['']);

  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split('T')[0];
  const formattedDayName = todayDate.toLocaleDateString(undefined, { weekday: 'long' });
  const formattedDateMonth = todayDate.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await lifecycleService.getDailyLogs(projectId, {
        userId: currentUser?.id,
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
  }, [projectId]);

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

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setUploadingImage(true);
    setError(null);
    try {
      const res = await lifecycleService.uploadAsset(file);
      if (res && res.url) {
        const cleaned = evidenceUrls.filter((u) => u.trim().length > 0);
        setEvidenceUrls([...cleaned, res.url]);
        setSuccessMsg(`Image uploaded successfully and saved to assets folder!`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      console.error('Failed to upload image asset:', err);
      setError(err?.response?.data?.message || 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

      setSuccessMsg("Today's work log saved successfully! +20 Reward Points added to DB.");
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

  const totalPointsThisMonth = (logs.length * 20) + 120;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hidden file input for image uploads */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />

      {/* ---------------------------------------------------------------- TOP STAT CARDS GRID */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-center">
        {/* Card 1: Today's Date */}
        <div className="flex items-center gap-3 pr-2">
          <div className="w-10 h-10 rounded-xl bg-[#F3F0FF] text-[#4F46E5] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 font-medium block">Today's Date</span>
            <span className="text-sm font-extrabold text-gray-900 block leading-snug">{formattedDateMonth}</span>
            <span className="text-[11px] text-gray-400 font-normal block">{formattedDayName}</span>
          </div>
        </div>

        {/* Card 2: Points Available */}
        <div className="flex items-center gap-3 pr-2">
          <div className="w-10 h-10 rounded-full bg-[#FFE4E6] text-[#F43F5E] flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 font-medium block">Points Available</span>
            <span className="text-sm font-extrabold text-gray-900 block leading-snug">+20 pts</span>
            <span className="text-[11px] text-gray-400 font-normal block">To DB per submission</span>
          </div>
        </div>

        {/* Card 3: Total Points Earned */}
        <div className="flex items-center gap-3 pr-2">
          <div className="w-10 h-10 rounded-xl bg-[#F3E8FF] text-[#9333EA] flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 font-medium block">Total Points Earned</span>
            <span className="text-sm font-extrabold text-gray-900 block leading-snug">{totalPointsThisMonth} pts</span>
            <span className="text-[11px] text-gray-400 font-normal block">This Month</span>
          </div>
        </div>

        {/* Card 4: Current Streak */}
        <div className="flex items-center gap-3 pr-2">
          <div className="w-10 h-10 rounded-xl bg-[#D1FAE5] text-[#10B981] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 font-medium block">Current Streak</span>
            <span className="text-sm font-extrabold text-gray-900 block leading-snug">7 Days</span>
            <span className="text-[11px] text-gray-400 font-normal block">Keep it up!</span>
          </div>
        </div>

        {/* Card 5: Log Consistency */}
        <div className="bg-[#F0F4FF] border border-[#E0E7FF] rounded-2xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">Log Consistency</span>
            <span className="text-xs font-extrabold text-[#4F46E5]">92%</span>
          </div>
          <div className="w-full h-2 bg-[#C7D2FE]/70 rounded-full overflow-hidden">
            <div className="h-full bg-[#4F46E5] rounded-full" style={{ width: '92%' }} />
          </div>
          <span className="text-[11px] font-bold text-[#10B981]">Excellent</span>
        </div>
      </div>

      {/* ---------------------------------------------------------------- TODAY'S WORK LOG FORM */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                Today's Work Log <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-[#F1F5F9] text-[#64748B]">{todayStr}</span>
              </h3>
            </div>
          </div>
          <span className="px-3.5 py-1.5 rounded-full bg-[#F3E8FF] border border-purple-100 text-[#6D28D9] text-xs font-bold flex items-center gap-1.5 shrink-0">
            <Award className="w-4 h-4 text-[#6D28D9]" /> +20 Pts to DB
          </span>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-800">
                What did you accomplish today? <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-semibold text-gray-400">{workDone.length} / 1500</span>
            </div>
            <textarea
              required
              rows={4}
              maxLength={1500}
              value={workDone}
              onChange={(e) => setWorkDone(e.target.value)}
              placeholder="Describe your code commits, design work, hardware setup, research, testing, or tasks completed..."
              className="w-full p-3.5 bg-gray-50/60 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">
                Hours Spent (optional)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={hoursSpent !== undefined ? hoursSpent : ''}
                onChange={(e) =>
                  setHoursSpent(e.target.value ? parseFloat(e.target.value) : undefined)
                }
                placeholder="e.g., 4.5"
                className="w-full px-3.5 py-2.5 bg-gray-50/60 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">
                Blockers / Issues (optional)
              </label>
              <input
                type="text"
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                placeholder="Any challenges or blockers faced..."
                className="w-full px-3.5 py-2.5 bg-gray-50/60 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Evidence & Screenshots Section */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-800">
              Evidence & Screenshots (Upload Image or Link Commits)
            </label>

            {/* Grid of 2 Upload Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Upload Image Card */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 text-center cursor-pointer transition flex items-center justify-center gap-3 shadow-2xs group"
              >
                <div className="w-9 h-9 rounded-xl bg-white text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 shadow-2xs group-hover:scale-105 transition">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-indigo-700 block">
                    {uploadingImage ? 'Uploading Image...' : 'Upload Image / Screenshot'}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-400 block">
                    PNG, JPG, GIF up to 10MB
                  </span>
                </div>
              </div>

              {/* Add Link Card */}
              <div
                onClick={handleAddEvidenceUrl}
                className="p-4 rounded-xl border border-gray-200 bg-gray-50/40 hover:bg-gray-50 text-center cursor-pointer transition flex items-center justify-center gap-3 shadow-2xs group"
              >
                <div className="w-9 h-9 rounded-xl bg-white text-gray-500 flex items-center justify-center shrink-0 border border-gray-200 shadow-2xs group-hover:scale-105 transition">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-gray-700 block">Add Commit / Link</span>
                  <span className="text-[10px] font-semibold text-gray-400 block">
                    Paste commit link, PR, or other evidence...
                  </span>
                </div>
              </div>
            </div>

            {/* List of Evidence Items / Previews */}
            {evidenceUrls.map((url, idx) => {
              const isImg =
                url.startsWith('/uploads/') ||
                /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url);

              if (isImg && url.trim().length > 0) {
                return (
                  <div
                    key={idx}
                    className="relative group rounded-2xl border border-gray-200 p-3.5 bg-gray-50/60 flex items-center justify-between gap-4 shadow-2xs"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={formatAssetUrl(url)}
                        alt="Screenshot Preview"
                        className="w-40 h-28 object-cover rounded-xl border border-gray-200 shadow-xs cursor-pointer hover:scale-102 transition"
                        onClick={() => window.open(formatAssetUrl(url), '_blank')}
                      />
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-900 block">
                          Uploaded Screenshot / Evidence
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium block">
                          Click image to expand in full window
                        </span>
                        <a
                          href={formatAssetUrl(url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline pt-1"
                        >
                          <ExternalLink className="w-3 h-3" /> View full resolution image
                        </a>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveEvidenceUrl(idx)}
                      className="px-3 py-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition font-bold text-xs flex items-center gap-1 border border-rose-200"
                      title="Remove Image"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                );
              }

              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => handleEvidenceChange(idx, e.target.value)}
                      placeholder="https://github.com/org/repo/commit/..."
                      className="w-full pl-9 pr-3 py-2 bg-gray-50/60 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
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
              );
            })}

            <button
              type="button"
              onClick={handleAddEvidenceUrl}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 pt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Another Evidence Link
            </button>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-gray-100">
            <span className="text-[11px] text-gray-500 font-medium">
              ★ +20 Points added to your profile in DB upon saving.
            </span>
            <button
              type="submit"
              disabled={submitting || !workDone.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-xs disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> {submitting ? 'Saving Log & DB Points...' : "Save Today's Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
