import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  CheckCircle2,
  Folder,
  Clock,
  Calendar,
  Users,
  Trophy,
  Code2,
  Activity,
  ArrowRight,
  FileText,
  CheckSquare,
  ChevronDown,
  Plus,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { dashboardService } from '../../services/dashboard.service';
import { useAppSelector } from '../../app/hooks';

export const Dashboard: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  
  // States for backend data — initialized empty so we never show hardcoded values.
  const [streakData, setStreakData] = useState<any>(null);
  const [kpis, setKpis] = useState<any>({
    tasksCompleted: { value: 0, change: '0%', trendUp: true, sparkline: [0, 0, 0, 0, 0, 0, 0] },
    projectsActive: { value: 0, change: '0%', trendUp: true, sparkline: [0, 0, 0, 0, 0, 0, 0] },
    hoursFocused: { value: '0h', change: '0%', trendUp: true, sparkline: [0, 0, 0, 0, 0, 0, 0] },
    pendingTasks: { value: 0, change: '0%', trendUp: false, sparkline: [0, 0, 0, 0, 0, 0, 0] },
    teamMembers: { value: 0, change: '0%', trendUp: true, sparkline: [0, 0, 0, 0, 0, 0, 0] },
  });
  const [teamGrowth, setTeamGrowth] = useState<any[]>([]);
  const [projectActivity, setProjectActivity] = useState<any>(null);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [hackathons, setHackathons] = useState<any[]>([]);
  const [contests, setContests] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  // Fetch all data from dashboard APIs
  const fetchDashboardData = async () => {
    try {
      const [
        resStreak,
        resKpi,
        resGrowth,
        resActivity,
        resDeadlines,
        resHacks,
        resContests,
        resRecent,
      ] = await Promise.all([
        dashboardService.getStreakData(),
        dashboardService.getKpis(),
        dashboardService.getTeamGrowth(),
        dashboardService.getProjectActivity(),
        dashboardService.getUpcomingDeadlines(),
        dashboardService.getHackathons(),
        dashboardService.getLeetCodeContests(),
        dashboardService.getRecentActivities(),
      ]);

      if (resStreak) setStreakData(resStreak);
      if (resKpi) setKpis(resKpi);
      if (resGrowth) setTeamGrowth(resGrowth);
      if (resActivity) setProjectActivity(resActivity);
      if (resDeadlines) setDeadlines(resDeadlines);
      setHackathons(resHacks || []);
      setContests(resContests || []);
      setRecentActivities(resRecent || []);
    } catch (err) {
      console.error('Error loading dashboard datasets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      fetchDashboardData();
    };
    window.addEventListener('pv:refresh', handleRefresh);
    return () => window.removeEventListener('pv:refresh', handleRefresh);
  }, []);
  // GitHub-exact heatmap: week-aligned, all days present, subtle month separators
  const renderContributionHeatmap = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from the Sunday of the week that was ~1 year ago (exactly like GitHub)
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    // Align to the Sunday of that week (day 0 = Sunday)
    const startDayOfWeek = oneYearAgo.getDay(); // 0=Sun, 1=Mon...
    const gridStart = new Date(oneYearAgo);
    gridStart.setDate(gridStart.getDate() - startDayOfWeek);

    // Build week columns from gridStart to today
    type Cell = { dateStr: string; count: number; isValid: boolean; monthName: string; day: number };
    const weekCols: Cell[][] = [];
    const cursor = new Date(gridStart);

    while (cursor <= today) {
      const week: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(cursor);
        cellDate.setDate(cursor.getDate() + d);
        const isValid = cellDate <= today && cellDate >= oneYearAgo;
        const cellDateStr = cellDate.toISOString().split('T')[0];
        const count = (isValid && streakData?.gridData?.[cellDateStr]) ? streakData.gridData[cellDateStr] : 0;
        week.push({
          dateStr: cellDateStr,
          count,
          isValid,
          monthName: cellDate.toLocaleDateString('en-US', { month: 'short' }),
          day: cellDate.getDate(),
        });
      }
      weekCols.push(week);
      cursor.setDate(cursor.getDate() + 7);
    }

    // Month label positions: first column where the 1st of a month appears in valid range
    const CELL = 10;  // px cell size
    const GAP = 2;    // px gap between cells in same month
    const MONTH_GAP = 4; // px extra gap between months (subtle separator)

    type MonthLabel = { label: string; colIndex: number };
    const monthLabels: MonthLabel[] = [];
    let seenMonths = new Set<string>();

    weekCols.forEach((week, colIndex) => {
      const validCells = week.filter(c => c.isValid);
      if (validCells.length === 0) return;
      // Label when 1st of month appears, or first column
      const hasFirst = validCells.some(c => c.day === 1);
      const monthKey = hasFirst
        ? validCells.find(c => c.day === 1)!.monthName
        : (colIndex === 0 ? validCells[0].monthName : null);
      if (monthKey && !seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        monthLabels.push({ label: monthKey, colIndex });
      }
    });

    // Build month-group boundaries so we can add the subtle gap between them
    const monthBoundaries = new Set<number>(monthLabels.slice(1).map(ml => ml.colIndex));

    // Compute column pixel offsets including subtle gaps
    const colOffsets: number[] = [];
    let xOffset = 0;
    weekCols.forEach((_, colIndex) => {
      if (colIndex > 0 && monthBoundaries.has(colIndex)) {
        xOffset += MONTH_GAP; // tiny month separator
      }
      colOffsets.push(xOffset);
      xOffset += CELL + GAP;
    });
    const totalWidth = xOffset - GAP; // drop trailing gap

    // Month label pixel positions
    const labelPositions = monthLabels.map(ml => ({
      label: ml.label,
      x: colOffsets[ml.colIndex],
    }));

    const totalHeight = 7 * CELL + 6 * GAP; // 7 rows of 10px + 6 gaps of 2px = 82px

    return (
      <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 mb-4 overflow-x-auto">
        <div className="flex items-start gap-2 min-w-max">
          {/* Weekday labels — Mon, Wed, Fri only */}
          <div
            className="flex flex-col text-[10px] text-gray-400 font-medium select-none shrink-0"
            style={{ gap: `${GAP}px`, paddingTop: '18px', width: '24px', textAlign: 'right' }}
          >
            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, i) => (
              <div key={i} style={{ height: `${CELL}px`, lineHeight: `${CELL}px` }}>
                {label}
              </div>
            ))}
          </div>

          <div className="flex flex-col">
            {/* Month label row */}
            <div className="relative mb-[4px]" style={{ height: '14px', width: `${totalWidth}px` }}>
              {labelPositions.map((lp, idx) => (
                <span
                  key={idx}
                  className="absolute text-[10px] text-gray-400 font-semibold"
                  style={{ left: `${lp.x}px`, top: 0, lineHeight: '14px' }}
                >
                  {lp.label}
                </span>
              ))}
            </div>

            {/* The actual grid as inline SVG-style divs using absolute positioning */}
            <div className="relative" style={{ width: `${totalWidth}px`, height: `${totalHeight}px` }}>
              {weekCols.map((week, wIdx) => (
                <div
                  key={wIdx}
                  className="absolute flex flex-col"
                  style={{ left: `${colOffsets[wIdx]}px`, top: 0, gap: `${GAP}px` }}
                >
                  {week.map((cell, dIdx) => {
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
                        key={dIdx}
                        title={cell.isValid ? `${cell.dateStr}: ${cell.count} contribution${cell.count !== 1 ? 's' : ''}` : ''}
                        style={{
                          width: `${CELL}px`,
                          height: `${CELL}px`,
                          backgroundColor: bg,
                          borderRadius: '2px',
                          transition: 'transform 0.1s',
                          cursor: cell.isValid ? 'pointer' : 'default',
                          flexShrink: 0,
                        }}
                        className={cell.isValid ? 'hover:scale-125 hover:ring-1 hover:ring-slate-400' : ''}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // KPI chart helper
  const renderSparkline = (data: number[], color: string) => {
    const chartData = data.map((val, idx) => ({ id: idx, value: val }));
    return (
      <div className="w-[60px] h-[30px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 2, bottom: 2, left: 2, right: 2 }}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.8}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Pie chart config
  const pieData = [
    { name: 'Completed', value: projectActivity?.completed ?? 0, color: '#10B981' },
    { name: 'In Progress', value: projectActivity?.inProgress ?? 0, color: '#3B82F6' },
    { name: 'On Hold', value: projectActivity?.onHold ?? 0, color: '#F59E0B' },
    { name: 'To Do', value: projectActivity?.todo ?? 0, color: '#8B5CF6' },
  ];

  const safeKpi = (key: 'tasksCompleted' | 'projectsActive' | 'hoursFocused' | 'pendingTasks' | 'teamMembers') =>
    kpis?.[key] ?? { value: 0, change: '0%', trendUp: true, sparkline: [0, 0, 0, 0, 0, 0, 0] };

  const containerVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.08 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-[1600px] mx-auto text-[#1E293B] pb-10"
    >
      {/* ── 1. Top Streak & Heatmap Row ──────────────────────────────────────── */}
      <motion.div variants={cardVariants} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-orange-50 rounded-xl">
              <span className="text-2xl">🔥</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Your Streak
              </h2>
              <p className="text-sm text-gray-500">Consistency fuels progress. Keep building!</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-gray-400 block font-medium">Current streak</span>
              <span className="text-lg font-bold text-gray-800 flex items-center gap-1.5 justify-end">
                {streakData?.currentStreak ?? 0} days <span className="text-orange-500 text-sm">🔥</span>
              </span>
            </div>
            <div className="h-8 w-[1px] bg-gray-100" />
            <div className="text-right">
              <span className="text-xs text-gray-400 block font-medium">Longest streak</span>
              <span className="text-lg font-bold text-gray-800 flex items-center gap-1.5 justify-end">
                {streakData?.longestStreak ?? 0} days <span className="text-yellow-500 text-sm">🏆</span>
              </span>
            </div>
          </div>
        </div>

        {/* Heatmap calendar */}
        {renderContributionHeatmap()}

        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 font-medium pt-2 border-t border-gray-50 gap-2">
          <a
            href="https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/showing-an-overview-of-your-activity-on-your-profile"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-indigo-600 flex items-center gap-1 transition"
          >
            Learn how we count contributions <span className="text-sm font-bold">ⓘ</span>
          </a>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-[11px]">
              <span>Less</span>
              <div className="w-[10px] h-[10px] bg-[#ebedf0] rounded-[2px]" />
              <div className="w-[10px] h-[10px] bg-[#9be9a8] rounded-[2px]" />
              <div className="w-[10px] h-[10px] bg-[#40c463] rounded-[2px]" />
              <div className="w-[10px] h-[10px] bg-[#30a14e] rounded-[2px]" />
              <div className="w-[10px] h-[10px] bg-[#216e39] rounded-[2px]" />
              <span>More</span>
            </div>
            <div className="h-3 w-[1px] bg-gray-200" />
            <span className="font-semibold text-gray-600">Total contributions: {streakData?.totalContributions ?? 231}</span>
          </div>
        </div>

      </motion.div>

      {/* ── 2. KPI Metrics Row ─────────────────────────────────────────── */}
      <motion.div variants={cardVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* KPI 1 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-md bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              </div>
              <span className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Tasks Completed</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{kpis.tasksCompleted.value}</span>
              <span className="text-xs font-bold text-green-500 flex items-center gap-0.5">
                ↑ {kpis.tasksCompleted.change}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 block mt-1">vs last 7 days</span>
          </div>
          {renderSparkline(kpis.tasksCompleted.sparkline, '#3B82F6')}
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center">
                <Folder className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <span className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Projects Active</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{kpis.projectsActive.value}</span>
              <span className="text-xs font-bold text-green-500 flex items-center gap-0.5">
                ↑ {kpis.projectsActive.change}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 block mt-1">vs last 7 days</span>
          </div>
          {renderSparkline(kpis.projectsActive.sparkline, '#8B5CF6')}
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-md bg-purple-50 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <span className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Hours Focused</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{kpis.hoursFocused.value}</span>
              <span className="text-xs font-bold text-green-500 flex items-center gap-0.5">
                ↑ {kpis.hoursFocused.change}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 block mt-1">vs last 7 days</span>
          </div>
          {renderSparkline(kpis.hoursFocused.sparkline, '#3B82F6')}
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-md bg-red-50 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-red-500" />
              </div>
              <span className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Pending Tasks</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{kpis.pendingTasks.value}</span>
              <span className="text-xs font-bold text-red-500 flex items-center gap-0.5">
                ↓ {kpis.pendingTasks.change}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 block mt-1">vs last 7 days</span>
          </div>
          {renderSparkline(kpis.pendingTasks.sparkline, '#EF4444')}
        </div>

        {/* KPI 5 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-md bg-indigo-50 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <span className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Team Members</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{kpis.teamMembers.value}</span>
              <span className="text-xs font-bold text-green-500 flex items-center gap-0.5">
                ↑ {kpis.teamMembers.change}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 block mt-1">vs last 7 days</span>
          </div>
          {renderSparkline(kpis.teamMembers.sparkline, '#3B82F6')}
        </div>
      </motion.div>

      {/* ── 3. Middle Row: Team Growth, Project Activity, Deadlines ─────── */}
      <motion.div variants={cardVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Growth chart */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between min-h-[260px] h-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Team Growth
            </h3>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200/80 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 bg-white transition-colors">
              This Year
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto">
            {teamGrowth.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-4">
                <div className="w-20 h-20 rounded-full bg-[#F3E8FF] flex items-center justify-center mb-4">
                  <Users className="w-9 h-9 text-[#8B5CF6]" />
                </div>
                <p className="text-xs font-medium text-gray-500">No team growth data yet.</p>
              </div>
            ) : (
              <div className="w-full h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={teamGrowth} margin={{ left: -25, right: 5, top: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#7C3AED"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#growthGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Project Activity donut chart */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between min-h-[260px] h-full">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Project Activity
            </h3>
          </div>
          
          {(projectActivity?.total ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 my-auto text-center py-4">
              <TrendingUp className="w-20 h-20 text-gray-200 stroke-[1.2] mb-3" />
              <p className="text-xs font-medium text-gray-400">No project activity yet.</p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 flex-1 my-auto py-2">
              {/* Left side: Donut + Total */}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-[110px] h-[110px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={52}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center mt-2">
                  <span className="text-2xl font-bold text-gray-900 leading-none block">{projectActivity?.total ?? 0}</span>
                  <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase block mt-1">TOTAL</span>
                </div>
              </div>
              
              {/* Right side: Legend */}
              <div className="flex-1 space-y-3.5 pl-2">
                {pieData.map((d, idx) => {
                  const total = projectActivity?.total ?? 0;
                  const percentage = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="font-semibold text-gray-700">{d.name}</span>
                      </div>
                      <div className="font-bold text-gray-900">
                        {d.value} <span className="font-normal text-gray-400 text-[11px]">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between min-h-[260px] h-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-500" />
              Upcoming Deadlines
            </h3>
          </div>
          
          <div className="flex flex-col items-center justify-center flex-1 my-auto">
            {deadlines.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-4">
                <Calendar className="w-20 h-20 text-gray-200 stroke-[1.2] mb-3" />
                <p className="text-xs font-medium text-gray-400">No upcoming deadlines.</p>
              </div>
            ) : (
              <div className="space-y-3.5 w-full">
                {deadlines.map((item) => {
                  let badgeBg = 'bg-green-50 text-green-600 border-green-100';
                  if (item.badgeColor === 'red') badgeBg = 'bg-red-50 text-red-600 border-red-100';
                  else if (item.badgeColor === 'yellow') badgeBg = 'bg-yellow-50 text-yellow-600 border-yellow-100';

                  return (
                    <div key={item.id} className="flex items-center justify-between p-2.5 hover:bg-gray-50/50 rounded-xl border border-transparent hover:border-gray-100 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50/70 rounded-lg text-indigo-600">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-800">{item.title}</h4>
                          <span className="text-[10px] text-gray-400 font-semibold">{item.date}</span>
                        </div>
                      </div>
                      
                      <span className={`text-[10px] font-bold border px-2.5 py-1 rounded-full ${badgeBg}`}>
                        {item.daysLeft}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── 4. Bottom Row: Hackathons, LeetCode, Recent Activities ─────── */}
      <motion.div variants={cardVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hackathons */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              Hackathons
            </h3>
            <a
              href="https://devpost.com/hackathons"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold flex items-center gap-0.5"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
          
          <div className="space-y-4 flex-1">
            {hackathons.length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-4">No upcoming hackathons yet.</p>
            )}
            {hackathons.map((h, index) => {
              const colors = ['bg-indigo-500', 'bg-pink-500', 'bg-blue-500'];
              const initials = h.name.split(' ').map((w: string) => w[0]).join('').substring(0, 3);
              return (
                <a
                  key={h.id}
                  href={h.url || 'https://devpost.com/hackathons'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between hover:bg-gray-50/80 p-2 rounded-xl transition-all border border-transparent hover:border-gray-200 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${colors[index % colors.length]} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                      {initials}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 group-hover:text-indigo-600 transition">{h.name}</h4>
                      <span className="text-[10px] text-gray-400 font-semibold">{h.dateRange}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-green-50 text-green-600 border border-green-100 px-2.5 py-1 rounded-full group-hover:bg-green-100 transition">
                    {h.status || 'Open'}
                  </span>
                </a>
              );
            })}
          </div>
        </div>

        {/* LeetCode Contests */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-orange-500" />
              LeetCode Contests
            </h3>
            <a
              href="https://leetcode.com/contest/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold flex items-center gap-0.5"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
          
          <div className="space-y-4 flex-1">
            {contests.length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-4">No coding contests scheduled.</p>
            )}
            {contests.map((c) => (
              <a
                key={c.id}
                href={c.url || 'https://leetcode.com/contest/'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between hover:bg-gray-50/80 p-2 rounded-xl transition-all border border-transparent hover:border-gray-200 cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold shrink-0">
                    LC
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 group-hover:text-indigo-600 transition">{c.name}</h4>
                    <span className="text-[10px] text-gray-400 font-semibold">{c.time}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold border border-indigo-200 text-indigo-600 bg-indigo-50/50 group-hover:bg-indigo-600 group-hover:text-white px-3.5 py-1 rounded-xl transition-all">
                  {c.status || 'Register'}
                </span>
              </a>
            ))}
          </div>
        </div>


        {/* Recent Activity */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between min-h-[260px] h-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-500" />
              Recent Activity
            </h3>
            <button className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold flex items-center gap-0.5">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="flex flex-col items-center justify-center flex-1 my-auto">
            {recentActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-4">
                <Activity className="w-20 h-20 text-gray-200 stroke-[1.2] mb-3" />
                <p className="text-xs font-medium text-gray-400">No recent activity yet.</p>
              </div>
            ) : (
              <div className="space-y-3.5 w-full">
                {recentActivities.map((act) => {
                  const avatarInitials = act.userName === 'You' ? 'AH' : act.userName.substring(0, 2).toUpperCase();
                  const colors = ['bg-blue-500', 'bg-orange-500', 'bg-gray-800'];
                  const avatarBg = act.userName === 'You' ? 'bg-blue-500' : colors[act.id.charCodeAt(0) % colors.length];

                  return (
                    <div key={act.id} className="flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2.5">
                        <div className={`w-7 h-7 rounded-full ${avatarBg} text-white flex items-center justify-center text-[9px] font-extrabold flex-shrink-0`}>
                          {avatarInitials}
                        </div>
                        <div>
                          <p className="text-gray-600">
                            <span className="font-bold text-gray-800">{act.userName}</span> {act.action}
                          </p>
                          <span className="text-[10px] text-gray-400 font-semibold">{act.detail}</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap pt-0.5">{act.timeAgo}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
