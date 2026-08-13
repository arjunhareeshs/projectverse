import React, { useState, useEffect } from 'react';
import { Github, CheckCircle2, User as UserIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { setUser } from '../features/auth/authSlice';
import { authService } from '../services/auth.service';
import { dashboardService } from '../services/dashboard.service';

export const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const [githubUsername, setGithubUsername] = useState(user?.githubUsername || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streakData, setStreakData] = useState<any>(null);

  useEffect(() => {
    const fetchStreak = async () => {
      try {
        const data = await dashboardService.getStreakData();
        setStreakData(data);
      } catch (err) {
        console.error('Error fetching streak data in profile:', err);
      }
    };
    fetchStreak();
  }, []);

  const renderContributionHeatmap = () => {
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const oneYearAgoUTC = new Date(Date.UTC(today.getFullYear() - 1, today.getMonth(), today.getDate()));

    const months: { year: number; month: number; name: string }[] = [];
    const tempDate = new Date(today);
    tempDate.setMonth(tempDate.getMonth() - 12);
    for (let i = 0; i < 12; i++) {
      months.push({
        year: tempDate.getFullYear(),
        month: tempDate.getMonth(),
        name: tempDate.toLocaleDateString('en-US', { month: 'short' }),
      });
      tempDate.setMonth(tempDate.getMonth() + 1);
    }

    type GridCell = { dateStr: string; count: number; isValid: boolean; dayNum: number };

    const getMonthGridCols = (year: number, month: number) => {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const startWeekday = new Date(year, month, 1).getDay();

      const cols: GridCell[][] = [];
      let currentDay = 1;

      const totalSlots = startWeekday + daysInMonth;
      const numCols = Math.ceil(totalSlots / 7);

      for (let c = 0; c < numCols; c++) {
        const col: GridCell[] = [];
        for (let r = 0; r < 7; r++) {
          const slotIndex = c * 7 + r;
          if (slotIndex < startWeekday || currentDay > daysInMonth) {
            col.push({
              dateStr: '',
              count: 0,
              isValid: false,
              dayNum: 0,
            });
          } else {
            const pad = (n: number) => String(n).padStart(2, '0');
            const dateStr = `${year}-${pad(month + 1)}-${pad(currentDay)}`;
            
            const cellDate = new Date(Date.UTC(year, month, currentDay));
            const isValid = cellDate <= todayUTC && cellDate >= oneYearAgoUTC;

            const count = (isValid && streakData?.gridData?.[dateStr]) ? streakData.gridData[dateStr] : 0;

            col.push({
              dateStr,
              count,
              isValid,
              dayNum: currentDay,
            });
            currentDay++;
          }
        }
        cols.push(col);
      }
      return cols;
    };

    return (
      <div className="bg-card border border-border rounded-xl px-5 py-4 overflow-x-auto">
        <div className="flex items-start gap-2 min-w-max">
          {/* Weekday labels — Mon, Wed, Fri only */}
          <div
            className="flex flex-col text-[10px] text-muted-foreground font-medium select-none shrink-0"
            style={{ gap: '2px', paddingTop: '20px', width: '24px', textAlign: 'right', marginRight: '6px' }}
          >
            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, i) => (
              <div key={i} style={{ height: '10px', lineHeight: '10px' }}>
                {label}
              </div>
            ))}
          </div>

          {/* Month Blocks Container */}
          <div className="flex gap-4">
            {months.map((m, mIdx) => {
              const cols = getMonthGridCols(m.year, m.month);
              return (
                <div key={mIdx} className="flex flex-col">
                  {/* Month Label */}
                  <div className="text-[10px] text-muted-foreground font-semibold mb-[6px] text-left select-none h-4">
                    {m.name}
                  </div>
                  {/* Month Grid columns */}
                  <div className="flex gap-[2px]">
                    {cols.map((col, colIdx) => (
                      <div key={colIdx} className="flex flex-col gap-[2px]">
                        {col.map((cell, cellIdx) => {
                          let bg = '#ebedf0';
                          if (!cell.isValid) {
                            bg = 'transparent';
                          } else if (cell.count >= 4) {
                            bg = '#216e39';
                          } else if (cell.count === 3) {
                            bg = '#30a14e';
                          } else if (cell.count === 2) {
                            bg = '#40c463';
                          } else if (cell.count === 1) {
                            bg = '#9be9a8';
                          }

                          return (
                            <div
                              key={cellIdx}
                              title={cell.isValid ? `${cell.dateStr}: ${cell.count} contribution${cell.count !== 1 ? 's' : ''}` : ''}
                              style={{
                                width: '10px',
                                height: '10px',
                                backgroundColor: bg,
                                borderRadius: '2px',
                                cursor: cell.isValid ? 'pointer' : 'default',
                              }}
                              className={cell.isValid ? 'hover:scale-125 hover:ring-1 hover:ring-slate-400 transition-transform duration-100' : ''}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await authService.updateGithubUsername(githubUsername.trim() || null);
      dispatch(setUser({ ...user!, githubUsername: result.githubUsername }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save GitHub username');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto w-full space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{user?.fullName || 'Profile'}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-muted-foreground block">Registration No.</span>
            <span className="font-semibold text-foreground">{user?.regNo || 'Not set'}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Team</span>
            <span className="font-semibold text-foreground">{user?.team?.name || 'No team'}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Department</span>
            <span className="font-semibold text-foreground">{user?.department || user?.deptCode || 'Not set'}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Domain</span>
            <span className="font-semibold text-foreground">{user?.ssgDomain || 'Not set'}</span>
          </div>
        </div>
      </div>

      {/* Streak Widget */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-xl">
              <span className="text-2xl">🔥</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                Your Streak
              </h2>
              <p className="text-xs text-muted-foreground font-normal">Consistency fuels progress. Keep building!</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground block font-medium">Current streak</span>
              <span className="text-base font-bold text-foreground flex items-center gap-1.5 justify-end">
                {streakData?.currentStreak ?? 0} days <span className="text-orange-500 text-xs">🔥</span>
              </span>
            </div>
            <div className="h-8 w-[1px] bg-border" />
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground block font-medium">Longest streak</span>
              <span className="text-base font-bold text-foreground flex items-center gap-1.5 justify-end">
                {streakData?.longestStreak ?? 0} days <span className="text-yellow-500 text-xs">🏆</span>
              </span>
            </div>
          </div>
        </div>

        {/* Heatmap calendar */}
        {renderContributionHeatmap()}

        <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground font-medium pt-2 border-t border-border gap-2">
          <a
            href="https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/showing-an-overview-of-your-activity-on-your-profile"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary flex items-center gap-1 transition"
          >
            Learn how we count contributions <span className="text-xs font-bold">ⓘ</span>
          </a>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span>Less</span>
              <div className="w-[10px] h-[10px] bg-[#ebedf0] rounded-[2px]" />
              <div className="w-[10px] h-[10px] bg-[#9be9a8] rounded-[2px]" />
              <div className="w-[10px] h-[10px] bg-[#40c463] rounded-[2px]" />
              <div className="w-[10px] h-[10px] bg-[#30a14e] rounded-[2px]" />
              <div className="w-[10px] h-[10px] bg-[#216e39] rounded-[2px]" />
              <span>More</span>
            </div>
            <div className="h-3 w-[1px] bg-border" />
            <span className="font-semibold text-foreground">Total contributions: {streakData?.totalContributions ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Github className="w-4.5 h-4.5 text-foreground" />
          <h2 className="text-sm font-bold text-foreground">GitHub Account</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Link your GitHub username so your commits and contributions on your team's repository
          count toward your individual performance ranking.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background">
            <span className="text-muted-foreground text-sm">github.com/</span>
            <input
              type="text"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              placeholder="your-username"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {saved && (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> GitHub username saved.
          </p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <UserIcon className="w-3.5 h-3.5" />
        More profile settings are coming soon.
      </div>
    </div>
  );
};
