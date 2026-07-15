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
  
  // States for backend data
  const [streakData, setStreakData] = useState<any>({
    currentStreak: 12,
    longestStreak: 28,
    totalContributions: 276,
    gridData: {},
  });
  
  const [kpis, setKpis] = useState<any>({
    tasksCompleted: { value: 24, change: '+18%', trendUp: true, sparkline: [12, 15, 14, 18, 20, 22, 24] },
    projectsActive: { value: 8, change: '+2', trendUp: true, sparkline: [6, 6, 7, 7, 8, 8, 8] },
    hoursFocused: { value: '42.5h', change: '+12%', trendUp: true, sparkline: [30, 32, 35, 38, 40, 41, 42.5] },
    pendingTasks: { value: 16, change: '-6%', trendUp: false, sparkline: [22, 20, 21, 19, 18, 17, 16] },
    teamMembers: { value: 14, change: '+2', trendUp: true, sparkline: [8, 10, 11, 12, 13, 14, 14] },
  });

  const [teamGrowth, setTeamGrowth] = useState<any[]>([
    { month: 'Jan', count: 4 },
    { month: 'Feb', count: 5 },
    { month: 'Mar', count: 8 },
    { month: 'Apr', count: 12 },
    { month: 'May', count: 14 },
    { month: 'Jun', count: 17 },
    { month: 'Jul', count: 24 },
  ]);

  const [projectActivity, setProjectActivity] = useState<any>({
    total: 128,
    completed: 48,
    inProgress: 42,
    onHold: 18,
    todo: 20,
  });

  const [deadlines, setDeadlines] = useState<any[]>([
    { id: '1', title: 'Project Website Redesign', date: 'Jul 18, 2025', daysLeft: '3 days left', badgeColor: 'red' },
    { id: '2', title: 'Mobile App Development', date: 'Jul 22, 2025', daysLeft: '7 days left', badgeColor: 'green' },
    { id: '3', title: 'API Integration', date: 'Jul 30, 2025', daysLeft: '15 days left', badgeColor: 'yellow' },
    { id: '4', title: 'Documentation Update', date: 'Aug 5, 2025', daysLeft: '21 days left', badgeColor: 'green' },
  ]);

  const [hackathons, setHackathons] = useState<any[]>([
    { id: '1', name: 'Smart India Hackathon 2025', dateRange: 'Aug 1 - Aug 3, 2025', status: 'Upcoming' },
    { id: '2', name: 'HackMIT 2025', dateRange: 'Sep 5 - Sep 7, 2025', status: 'Upcoming' },
    { id: '3', name: 'Google Solution Challenge', dateRange: 'Oct 10 - Oct 12, 2025', status: 'Upcoming' },
  ]);

  const [contests, setContests] = useState<any[]>([
    { id: '1', name: 'Biweekly Contest 128', time: 'Jul 12, 2025 8:30 PM', status: 'Register' },
    { id: '2', name: 'Weekly Contest 445', time: 'Jul 19, 2025 8:30 PM', status: 'Register' },
    { id: '3', name: 'Biweekly Contest 129', time: 'Jul 26, 2025 8:30 PM', status: 'Register' },
  ]);

  const [recentActivities, setRecentActivities] = useState<any[]>([
    { id: '1', userName: 'Arjun', action: 'completed the task', detail: '✓ Fix authentication bug', timeAgo: '2h ago' },
    { id: '2', userName: 'Sneha', action: 'updated project', detail: '✓ Mobile App Development', timeAgo: '5h ago' },
    { id: '3', userName: 'Rohit', action: 'created a new task', detail: '✓ Design dashboard layout', timeAgo: '1d ago' },
    { id: '4', userName: 'You', action: 'uploaded a document', detail: '✓ Project Requirements.pdf', timeAgo: '1d ago' },
  ]);

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
      if (resHacks && resHacks.length > 0) setHackathons(resHacks);
      if (resContests && resContests.length > 0) setContests(resContests);
      if (resRecent) setRecentActivities(resRecent);
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

  // Format contribution grid
  const renderContributionGrid = () => {
    const grid: React.ReactNode[] = [];
    const months = ['Jul', 'Aug', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    
    // We render 53 columns (weeks), each with 7 cells (days)
    // To match screenshot grid layout, we will construct columns
    const now = new Date();
    const totalWeeks = 52;
    
    for (let w = 0; w < totalWeeks; w++) {
      const weekCells = [];
      for (let d = 0; d < 7; d++) {
        // Calculate date of the cell
        const daysAgo = ((totalWeeks - w) * 7) + (6 - d);
        const cellDate = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
        const cellDateStr = cellDate.toISOString().split('T')[0];
        
        const count = streakData.gridData[cellDateStr] || 0;
        
        let colorClass = 'bg-gray-100'; // level 0
        if (count === 1) colorClass = 'bg-green-200';
        else if (count === 2) colorClass = 'bg-green-300';
        else if (count === 3) colorClass = 'bg-green-500';
        else if (count >= 4) colorClass = 'bg-green-700';

        weekCells.push(
          <div
            key={d}
            title={`${cellDateStr}: ${count} contributions`}
            className={`w-[10px] h-[10px] rounded-[2px] ${colorClass} transition-colors duration-200 hover:scale-125 hover:shadow-sm cursor-pointer`}
          />
        );
      }
      grid.push(
        <div key={w} className="flex flex-col gap-[3px]">
          {weekCells}
        </div>
      );
    }

    return (
      <div className="flex gap-[3px] overflow-x-auto pb-2 scrollbar-thin">
        {grid}
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
    { name: 'Completed', value: projectActivity.completed, color: '#10B981' },
    { name: 'In Progress', value: projectActivity.inProgress, color: '#3B82F6' },
    { name: 'On Hold', value: projectActivity.onHold, color: '#F59E0B' },
    { name: 'To Do', value: projectActivity.todo, color: '#8B5CF6' },
  ];

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
                {streakData.currentStreak} days <span className="text-orange-500 text-sm">🔥</span>
              </span>
            </div>
            <div className="h-8 w-[1px] bg-gray-100" />
            <div className="text-right">
              <span className="text-xs text-gray-400 block font-medium">Longest streak</span>
              <span className="text-lg font-bold text-gray-800 flex items-center gap-1.5 justify-end">
                {streakData.longestStreak} days <span className="text-yellow-500 text-sm">🏆</span>
              </span>
            </div>
            
            <div className="flex items-center gap-2 ml-4">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <FileText className="w-4 h-4 text-gray-400" />
                Generate Weekly Report
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <CheckSquare className="w-4 h-4 text-gray-400" />
                Add Task
              </button>
            </div>
          </div>
        </div>

        {/* Heatmap calendar */}
        <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-5 mb-4">
          <div className="flex justify-between text-[11px] text-gray-400 font-medium mb-2 pr-6">
            <span>Jul</span>
            <span>Aug</span>
            <span>Oct</span>
            <span>Nov</span>
            <span>Dec</span>
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
            <span>Jul</span>
          </div>
          
          <div className="flex gap-4">
            <div className="flex flex-col justify-between text-[11px] text-gray-400 font-semibold h-[90px] pt-1">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div className="flex-1">
              {renderContributionGrid()}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 font-medium pt-2 border-t border-gray-50 gap-2">
          <button className="text-gray-400 hover:text-indigo-600 flex items-center gap-1">
            Learn how we count contributions <span className="text-sm font-bold">ⓘ</span>
          </button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span>Less</span>
              <div className="w-[10px] h-[10px] bg-gray-100 rounded-[2px]" />
              <div className="w-[10px] h-[10px] bg-green-200 rounded-[2px]" />
              <div className="w-[10px] h-[10px] bg-green-300 rounded-[2px]" />
              <div className="w-[10px] h-[10px] bg-green-500 rounded-[2px]" />
              <div className="w-[10px] h-[10px] bg-green-700 rounded-[2px]" />
              <span>More</span>
            </div>
            <div className="h-3 w-[1px] bg-gray-200" />
            <span>Total contributions: {streakData.totalContributions}</span>
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
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                Team Growth
              </h3>
              <p className="text-xs text-gray-400">Team members over time</p>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50">
              This Year
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
          <div className="w-full h-[200px]">
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
        </div>

        {/* Project Activity donut chart */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Project Activity
            </h3>
            <p className="text-xs text-gray-400 mb-4">Activity overview for the last 30 days</p>
          </div>
          
          <div className="flex items-center justify-between gap-2 flex-1">
            <div className="relative w-[120px] h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={55}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-gray-800">{projectActivity.total}</span>
                <span className="text-[9px] text-gray-400 font-medium uppercase tracking-wider">Total</span>
              </div>
            </div>
            
            <div className="flex-1 space-y-1.5 pl-4">
              {pieData.map((d, idx) => {
                const percentage = projectActivity.total > 0 
                  ? ((d.value / projectActivity.total) * 100).toFixed(1)
                  : '0.0';
                return (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span>{d.name}</span>
                    </div>
                    <span className="font-semibold text-gray-700">{d.value} <span className="text-gray-400 font-normal">({percentage}%)</span></span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <button className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold flex items-center gap-1 pt-4 border-t border-gray-50 mt-4">
            View full analytics <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              Upcoming Deadlines
            </h3>
            <button className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold flex items-center gap-0.5">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="space-y-3.5 flex-1">
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
            <button className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold flex items-center gap-0.5">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="space-y-4 flex-1">
            {hackathons.map((h, index) => {
              // Generate circular colored icon
              const colors = ['bg-indigo-500', 'bg-pink-500', 'bg-blue-500'];
              const initials = h.name.split(' ').map((w: string) => w[0]).join('').substring(0, 3);
              return (
                <div key={h.id} className="flex items-center justify-between hover:bg-gray-50/50 p-1.5 rounded-xl transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${colors[index % colors.length]} flex items-center justify-center text-white text-[10px] font-bold`}>
                      {initials}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">{h.name}</h4>
                      <span className="text-[10px] text-gray-400 font-semibold">{h.dateRange}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-green-50 text-green-600 border border-green-100 px-2 py-0.5 rounded-full">
                    {h.status}
                  </span>
                </div>
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
            <button className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold flex items-center gap-0.5">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="space-y-4 flex-1">
            {contests.map((c) => (
              <div key={c.id} className="flex items-center justify-between hover:bg-gray-50/50 p-1.5 rounded-xl transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold">
                    LC
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800">{c.name}</h4>
                    <span className="text-[10px] text-gray-400 font-semibold">{c.time}</span>
                  </div>
                </div>
                <button className="text-[10px] font-bold border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-3.5 py-1 rounded-xl transition-all">
                  {c.status}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Recent Activity
            </h3>
            <button className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold flex items-center gap-0.5">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="space-y-3.5 flex-1">
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
        </div>
      </motion.div>
    </motion.div>
  );
};
