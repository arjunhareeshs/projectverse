import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Users, Mail, Crown, Activity, CheckCircle, Clock,
  AlertTriangle, BarChart2, MessageSquare,
  RefreshCw, ArrowLeft,
  Send, Plus, X, UserPlus, FolderKanban, TrendingUp,
  Settings, ClipboardList, Layers, CircleDot, LogOut,
  Handshake, Search as SearchIcon, ShieldCheck,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, ComposedChart,
} from 'recharts';
import { teamService } from '../services/team.service';
import { cn } from '../utils/cn';
export const MEMBER_MOCK_DETAILS: Record<string, { regNo: string; project: string; skills: string[] }> = {
  'rahul.verma@projectverse.com': {
    regNo: '2021CSE0042',
    project: 'Smart Campus Management System',
    skills: ['Database Design', 'PostgreSQL', 'SQL', 'Node.js', 'Express']
  },
  'arun.kumar@projectverse.com': {
    regNo: '2021CSE0018',
    project: 'Smart Campus Management System',
    skills: ['UI/UX Design', 'Figma', 'CSS Grid', 'Tailwind CSS', 'React']
  },
  'priya.sharma@projectverse.com': {
    regNo: '2021CSE0087',
    project: 'Smart Campus Management System',
    skills: ['React', 'TypeScript', 'CSS Modules', 'State Management']
  },
  'karthik.m@projectverse.com': {
    regNo: '2021CSE0056',
    project: 'Mobile App',
    skills: ['Docker', 'Kubernetes', 'CI/CD', 'AWS', 'GitHub Actions']
  },
  'student@projectverse.com': {
    regNo: '2021CSE0102',
    project: 'Smart Campus Management System',
    skills: ['Full Stack Dev', 'Next.js', 'Node.js', 'PostgreSQL', 'TypeScript']
  },
  'admin@projectverse.com': {
    regNo: '2021CSE0001',
    project: 'Smart Campus Management System',
    skills: ['Project Management', 'System Architecture', 'Agile', 'Scrum']
  }
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkloadEntry {
  memberId: string;
  memberName: string;
  taskCount: number;
  completedCount: number;
  overdueCount: number;
  isHighLoad: boolean;
}

interface OverdueTask {
  taskId: string;
  title: string;
  assignee: string;
  daysOverdue: number;
  priority: string;
}

interface CoordinationMetrics {
  teamName: string;
  captainName: string;
  totalMembers: number;
  activeProjects: number;
  workloadPerMember: WorkloadEntry[];
  teamAverageTaskLoad: number;
  captainTaskShare: number;
  overdueTaskCount: number;
  overdueTaskList: OverdueTask[];
  avgTurnaroundDays: number | null;
  silentTaskCount: number;
  commentsLast30Days: { date: string; count: number }[];
  meetingsLast14Days: number;
  milestoneHitRate: number | null;
  inactiveMembers: string[];
  turnaroundTrend: { week: string; avgDays: number }[];
  meetingCadence: { week: string; meetings: number; projects: number }[];
  milestoneTrend: { month: string; hitRate: number }[];
  delegationRatio: { name: string; value: number }[];
  memberEngagement: { memberName: string; weeklyActivity: { week: string; count: number }[] }[];
  radarScore: { subject: string; A: number; fullMark: number }[];
}

type TabKey = 'overview' | 'members' | 'tasks' | 'projects' | 'progress' | 'activity' | 'chat';

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
];

const DONUT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

const TASK_COLUMNS: { key: string; label: string; dot: string }[] = [
  { key: 'todo', label: 'TO DO', dot: 'bg-slate-400' },
  { key: 'progress', label: 'IN PROGRESS', dot: 'bg-amber-500' },
  { key: 'review', label: 'IN REVIEW', dot: 'bg-blue-500' },
  { key: 'done', label: 'DONE', dot: 'bg-emerald-500' },
];

function normalizeStatus(status: string): string {
  if (status === 'completed') return 'done';
  if (status === 'in_progress' || status === 'in-progress') return 'progress';
  if (status === 'in_review' || status === 'in-review') return 'review';
  if (TASK_COLUMNS.some(c => c.key === status)) return status;
  return 'todo';
}

function getInitials(name: string): string {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function getAvatarColor(id: string): string {
  return AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];
}

function timeAgo(date: string | Date): string {
  const d = new Date(date).getTime();
  const diffMs = Date.now() - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const priorityColor: Record<string, string> = {
  critical: 'text-red-500 bg-red-500/10 border-red-500/30',
  high: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  medium: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
  low: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color?: string;
}> = ({ icon, label, value, sub, color = 'text-primary' }) => (
  <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center', color.replace('text-', 'bg-') + '/10')}>
        <span className={color}>{icon}</span>
      </span>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
    <p className={cn('text-3xl font-bold mt-1', color)}>{value}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const Modal: React.FC<{ title: string; icon?: string; onClose: () => void; children: React.ReactNode }> = ({ title, icon, onClose, children }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    onClick={onClose}
  >
    <div
      className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          {icon && <span className="text-lg">{icon}</span>} {title}
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
const labelClass = 'text-xs font-semibold text-muted-foreground mb-1.5 block';

// ── Main Page ─────────────────────────────────────────────────────────────────

export const TeamDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useSelector((state: any) => state.auth?.user);

  const [team, setTeam] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [metrics, setMetrics] = useState<CoordinationMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [joinRequested, setJoinRequested] = useState(false);
  const [collabs, setCollabs] = useState<{ incoming: any[]; outgoing: any[] }>({ incoming: [], outgoing: [] });
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Tab-scoped data
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | 'pending'>('all');

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  const isMember = !!(team && currentUser && team.members?.some((m: any) => m.id === currentUser.id));
  const isCaptainOrAdmin =
    team && currentUser &&
    (team.leadId === currentUser.id || currentUser.role === 'ADMIN');

  const loadCore = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [teamData, statsData] = await Promise.all([
        teamService.getTeamById(id),
        teamService.getTeamStats(id)
      ]);
      setTeam(teamData);
      setStats(statsData);
    } catch (err) {
      console.error(err);
      setLoadError('Could not load this team. The server may be temporarily unavailable.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { loadCore(); }, [loadCore]);

  const loadMetrics = useCallback(async () => {
    if (!id) return;
    setIsLoadingMetrics(true);
    try {
      const m = await teamService.getCoordinationMetrics(id);
      setMetrics(m);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [id]);

  useEffect(() => {
    if (isCaptainOrAdmin) loadMetrics();
  }, [isCaptainOrAdmin, loadMetrics]);

  const loadTasks = useCallback(async () => {
    if (!id) return;
    try {
      const t = await teamService.getTeamTasks(id);
      setTasks(t);
    } catch (err) { console.error(err); }
    finally { setTasksLoaded(true); }
  }, [id]);

  const loadProjects = useCallback(async () => {
    if (!id) return;
    try {
      const p = await teamService.getTeamProjects(id);
      setProjects(p);
    } catch (err) { console.error(err); }
    finally { setProjectsLoaded(true); }
  }, [id]);

  const loadProgress = useCallback(async () => {
    if (!id) return;
    try { setProgress(await teamService.getTeamProgress(id)); } catch (err) { console.error(err); }
  }, [id]);

  const loadActivity = useCallback(async () => {
    if (!id) return;
    try { setActivityLog(await teamService.getTeamActivity(id)); } catch (err) { console.error(err); }
  }, [id]);

  const loadInvites = useCallback(async () => {
    if (!id) return;
    try { setInvites(await teamService.getInvites(id)); } catch (err) { console.error(err); }
  }, [id]);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    try { setMessages(await teamService.getMessages(id)); } catch (err) { console.error(err); }
  }, [id]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages]);

  const loadCollabs = useCallback(async () => {
    if (!id) return;
    try { setCollabs(await teamService.getCollaborations(id)); } catch (err) { console.error(err); }
  }, [id]);

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === 'tasks' && !tasksLoaded) loadTasks();
    if (tab === 'projects' && !projectsLoaded) loadProjects();
    if (tab === 'progress' && !progress) loadProgress();
    if (tab === 'activity') loadActivity();
    if (tab === 'chat') loadMessages();
    if (tab === 'members') loadInvites();
  };

  useEffect(() => {
    // Preload invites for the members badge count once team is known.
    if (team && isMember) loadInvites();
    if (team && isCaptainOrAdmin) loadCollabs();
  }, [team, isMember, isCaptainOrAdmin, loadInvites, loadCollabs]);

  useEffect(() => {
    if (candidateQuery.trim().length < 2) { setCandidates([]); return; }
    const t = setTimeout(async () => {
      try { setCandidates(await teamService.searchCandidates(candidateQuery.trim())); } catch (err) { console.error(err); }
    }, 300);
    return () => clearTimeout(t);
  }, [candidateQuery]);

  const handleRequestJoin = async () => {
    if (!id) return;
    try {
      await teamService.requestToJoin(id);
      setJoinRequested(true);
    } catch (err) {
      console.error(err);
      alert('Failed to send join request.');
    }
  };

  const handleSendMessage = async () => {
    if (!id || !messageDraft.trim()) return;
    try {
      const msg = await teamService.sendMessage(id, messageDraft.trim());
      setMessages(prev => [...prev, msg]);
      setMessageDraft('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleTaskStatusChange = async (taskId: string, status: string) => {
    if (!id) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    try {
      await teamService.updateTaskStatus(id, taskId, status);
    } catch (err) {
      console.error(err);
      loadTasks();
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    if (!id) return;
    try {
      await teamService.acceptInvite(id, inviteId);
      await Promise.all([loadInvites(), loadCore()]);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to accept invite.');
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    if (!id) return;
    try {
      await teamService.declineInvite(id, inviteId);
      loadInvites();
    } catch (err) { console.error(err); }
  };

  const handleLeaveTeam = async () => {
    if (!id || !currentUser) return;
    if (!confirm('Leave this team? You can join or create another one afterwards.')) return;
    try {
      await teamService.leaveTeam(id, currentUser.id);
      navigate('/team');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to leave team.');
    }
  };

  const handleAcceptCollab = async (collabId: string) => {
    try {
      await teamService.acceptCollaboration(collabId);
      await Promise.all([loadCollabs(), loadCore(), loadProjects()]);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to accept collaboration.');
    }
  };

  const handleDeclineCollab = async (collabId: string) => {
    try {
      await teamService.declineCollaboration(collabId);
      loadCollabs();
    } catch (err) { console.error(err); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading team...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-64 text-center p-6">
        <p className="text-sm text-red-500 font-semibold">{loadError}</p>
        <button
          onClick={loadCore}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!team) {
    return <div className="p-6 text-muted-foreground">Team not found.</div>;
  }

  const allTabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: Layers },
    { key: 'members', label: 'Members', icon: Users },
    { key: 'tasks', label: 'Tasks', icon: ClipboardList },
    { key: 'projects', label: 'Projects', icon: FolderKanban },
    { key: 'progress', label: 'Progress', icon: TrendingUp },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'chat', label: 'Chat', icon: MessageSquare },
  ];
  const visibleTabs = isMember ? allTabs : allTabs.filter(t => t.key !== 'activity' && t.key !== 'chat');

  const pendingInvites = invites.filter(i => i.status === 'pending');

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Back link removed */}

      {/* Hero */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div
              className="h-[50px] w-[50px] shrink-0 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-md"
              style={{ backgroundColor: team.color || '#7C3AED' }}
            >
              {getInitials(team.name)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
                {team.isPublic !== false && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                    Public Team
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                {team.description || 'No description provided.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMember && (
              <button
                onClick={() => setShowCollabModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <Handshake className="h-4 w-4 text-primary" /> Collaborate
              </button>
            )}
            {isCaptainOrAdmin ? (
              <>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" /> Edit Team
                </button>
                <button
                  onClick={() => { setShowInviteForm(true); switchTab('members'); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Invite Members
                </button>
              </>
            ) : isMember ? (
              null
            ) : (
              <button
                onClick={handleRequestJoin}
                disabled={joinRequested}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" /> {joinRequested ? 'Request Sent' : 'Request to Join Team'}
              </button>
            )}
          </div>
        </div>

        {/* Quick metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
          {[
            { icon: '🏷️', label: 'Domain', value: team.domain || 'General' },
            { icon: '📁', label: 'Project', value: team.currentProjectLabel || team.projects?.[0]?.name || 'None' },
            { icon: '🧩', label: 'Team Type', value: 'Project Based' },
            { icon: '👥', label: 'Members', value: `${team.members?.length || 0} / ${team.maxMembers || 6}` },
            { icon: '⏱️', label: 'Duration', value: '6 – 12 Months' },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
              <span className="text-lg">{m.icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
                <p className="text-xs font-semibold text-foreground truncate">{m.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap border-b-[3px] -mb-px transition-colors',
              activeTab === t.key
                ? 'border-primary text-primary font-extrabold'
                : 'border-transparent text-muted-foreground font-semibold hover:text-foreground'
            )}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<Activity className="h-4 w-4" />} label="Active Projects" value={stats.activeProjects} color="text-primary" />
              <StatCard icon={<CheckCircle className="h-4 w-4" />} label="Completion Rate"
                value={`${stats.taskCompletionRate.toFixed(1)}%`} sub={`${stats.totalTasks} total tasks`} color="text-emerald-500" />
              <StatCard icon={<Clock className="h-4 w-4" />} label="Overdue Tasks"
                value={stats.overdueCount} color={stats.overdueCount > 0 ? 'text-orange-500' : 'text-emerald-500'} />
              <StatCard icon={<Users className="h-4 w-4" />} label="Members" value={team.members?.length || 0} color="text-violet-500" />
            </div>
          )}

          {/* Quick actions for members */}
          {isMember && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button onClick={() => navigate('/kanban')} className="rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors p-4 text-left">
                <span className="text-xl">➕</span>
                <p className="text-xs font-bold text-emerald-600 mt-1">Add Members</p>
              </button>
              <button onClick={() => { switchTab('projects'); setShowProjectModal(true); }} className="rounded-xl bg-indigo-500/10 hover:bg-indigo-500/15 transition-colors p-4 text-left">
                <span className="text-xl">📁</span>
                <p className="text-xs font-bold text-indigo-600 mt-1">Create Project</p>
              </button>
              <button onClick={() => { switchTab('tasks'); setShowTaskModal(true); }} className="rounded-xl bg-amber-500/10 hover:bg-amber-500/15 transition-colors p-4 text-left">
                <span className="text-xl">✅</span>
                <p className="text-xs font-bold text-amber-600 mt-1">Create Task</p>
              </button>
              <button onClick={() => switchTab('chat')} className="rounded-xl bg-pink-500/10 hover:bg-pink-500/15 transition-colors p-4 text-left">
                <span className="text-xl">💬</span>
                <p className="text-xs font-bold text-pink-600 mt-1">Team Chat</p>
              </button>
            </div>
          )}

          {/* ── CAPTAIN-ONLY: Leadership Coordination Panel ── */}
          {isCaptainOrAdmin && metrics && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Leadership Coordination Dashboard</h2>
                <span className="ml-2 px-2 py-0.5 text-[10px] rounded-full border border-yellow-500/40 text-yellow-500 bg-yellow-500/10 font-semibold uppercase tracking-wider">
                  Captain View
                </span>
                <button
                  onClick={loadMetrics}
                  disabled={isLoadingMetrics}
                  className="ml-auto flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <RefreshCw className={cn('h-3 w-3', isLoadingMetrics && 'animate-spin')} /> Refresh
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center">
                  <div className="w-full mb-3 text-left">
                    <h3 className="text-sm font-bold text-foreground">Team Health Index</h3>
                    <p className="text-xs text-muted-foreground">Composite review scores</p>
                  </div>
                  <div className="w-full h-[220px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={metrics.radarScore}>
                        <PolarGrid stroke="rgba(255, 255, 255, 0.05)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#666', fontSize: 8 }} />
                        <Radar name="Team Health" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center">
                  <div className="w-full mb-3 text-left">
                    <h3 className="text-sm font-bold text-foreground">Delegation Ratio</h3>
                    <p className="text-xs text-muted-foreground">Captain's workload proportion</p>
                  </div>
                  <div className="w-full h-[180px] flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={metrics.delegationRatio} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value">
                          {metrics.delegationRatio.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                      <span className="text-xl font-bold text-foreground">{metrics.captainTaskShare.toFixed(0)}%</span>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Captain Share</span>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs mt-3">
                    {metrics.delegationRatio.map((entry, idx) => (
                      <div key={entry.name} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: DONUT_COLORS[idx] }} />
                        <span className="text-muted-foreground">{entry.name} ({entry.value})</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 flex flex-col">
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-foreground">Turnaround Time Trend</h3>
                    <p className="text-xs text-muted-foreground">Avg days from creation to completion</p>
                  </div>
                  <div className="flex-1 min-h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics.turnaroundTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                        <XAxis dataKey="week" tick={{ fill: '#888', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: '#888', fontSize: 10 }} tickLine={false} axisLine={false} width={24} />
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} formatter={(v: any) => [`${v} days`, 'Avg Turnaround']} />
                        <Line type="monotone" dataKey="avgDays" stroke="#38bdf8" strokeWidth={2.5} dot={{ fill: '#38bdf8', r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-2xl border border-border bg-card p-6 flex flex-col">
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-foreground">Meeting Cadence Timeline</h3>
                    <p className="text-xs text-muted-foreground">Meetings (Bar) vs Active Projects (Line)</p>
                  </div>
                  <div className="flex-1 min-h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={metrics.meetingCadence}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                        <XAxis dataKey="week" tick={{ fill: '#888', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="left" tick={{ fill: '#888', fontSize: 10 }} tickLine={false} axisLine={false} width={16} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#888', fontSize: 10 }} tickLine={false} axisLine={false} width={16} />
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                        <Bar yAxisId="left" dataKey="meetings" fill="#818cf8" radius={[3, 3, 0, 0]} barSize={16} />
                        <Line yAxisId="right" type="monotone" dataKey="projects" stroke="#34d399" strokeWidth={2} dot={{ fill: '#34d399', r: 2 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 flex flex-col">
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-foreground">Milestone Hit-rate Trend</h3>
                    <p className="text-xs text-muted-foreground">Commitment accuracy over sprints</p>
                  </div>
                  <div className="flex-1 min-h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.milestoneTrend} barSize={20}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                        <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#888', fontSize: 10 }} tickLine={false} axisLine={false} width={24} />
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} formatter={(v: any) => [`${v}%`, 'Hit Rate']} />
                        <Bar dataKey="hitRate" fill="#34d399" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 flex flex-col">
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-foreground">Workload Distribution</h3>
                    <p className="text-xs text-muted-foreground">Avg: {metrics.teamAverageTaskLoad.toFixed(1)} tasks. Red shows &gt;2x avg.</p>
                  </div>
                  <div className="flex-1 min-h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.workloadPerMember} barSize={18}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                        <XAxis dataKey="memberName" tick={{ fill: '#888', fontSize: 9 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: '#888', fontSize: 10 }} tickLine={false} axisLine={false} width={16} />
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} formatter={(v: any) => [v, 'Tasks']} />
                        <Bar dataKey="taskCount" radius={[3, 3, 0, 0]} fill="#6366f1" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="text-sm font-bold text-foreground mb-1">Communication Activity</h3>
                  <p className="text-xs text-muted-foreground mb-4">Comments per day — last 30 days</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={metrics.commentsLast30Days}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: '#888', fontSize: 10 }} tickLine={false} axisLine={false} width={24} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#aaa', fontSize: 10 }} formatter={(v: any) => [v, 'Comments']} />
                      <Line type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Meetings (last 14d): <strong className="text-foreground">{metrics.meetingsLast14Days}</strong></span>
                    {metrics.milestoneHitRate != null && (
                      <span>Milestone hit rate: <strong className="text-foreground">{metrics.milestoneHitRate.toFixed(0)}%</strong></span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="text-sm font-bold text-foreground mb-1">
                    Overdue Tasks <span className="ml-2 text-orange-500 font-bold">{metrics.overdueTaskCount}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">Sorted oldest first</p>
                  <div className="flex flex-col gap-2 max-h-[170px] overflow-y-auto scrollbar-thin">
                    {metrics.overdueTaskList.length === 0 ? (
                      <p className="text-xs text-emerald-500 py-2">✓ No overdue tasks — great job!</p>
                    ) : (
                      metrics.overdueTaskList.map(t => (
                        <div key={t.taskId} className="flex items-start gap-3 p-2 rounded-lg bg-muted/40">
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">{t.title}</p>
                            <p className="text-[10px] text-muted-foreground">{t.assignee} · {t.daysOverdue}d overdue</p>
                          </div>
                          <span className={cn('ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border shrink-0', priorityColor[t.priority] || priorityColor.medium)}>
                            {t.priority}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Team Roster */}
          <div>
            <h2 className="text-lg font-bold text-foreground mb-4">Team Roster</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {team.teamMembers?.map((tm: any) => {
                const member = tm.user;
                const isLead = team.leadId === member.id;
                const workload = metrics?.workloadPerMember.find(w => w.memberId === member.id);
                const engagement = metrics?.memberEngagement.find(e => e.memberName === member.fullName);

                return (
                  <div
                    key={member.id}
                    onClick={() => setSelectedMember({ ...member, roleLabel: tm.roleLabel })}
                    className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 overflow-hidden cursor-pointer hover:border-primary/45 hover:shadow-md transition-all duration-200"
                  >
                    <div className={cn('h-12 w-12 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0', getAvatarColor(member.id))}>
                      {getInitials(member.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                        <span className="truncate">{member.fullName}</span>
                        {member.id === currentUser?.id && <span className="text-muted-foreground font-normal text-xs shrink-0">(You)</span>}
                        {isLead && <Crown className="h-3.5 w-3.5 text-yellow-400 shrink-0" />}
                        {workload?.isHighLoad && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{member.email}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground font-medium uppercase tracking-wider shrink-0">{tm.roleLabel}</span>
                        {workload && <span className="text-[10px] text-muted-foreground shrink-0">{workload.taskCount} tasks</span>}
                      </div>
                    </div>
                    {engagement && (
                      <div className="flex flex-col items-center shrink-0 w-14">
                        <div className="w-14 h-7">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={engagement.weeklyActivity}>
                              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <span className="text-[7px] text-muted-foreground uppercase tracking-widest mt-1 block whitespace-nowrap">Activity</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="flex flex-col gap-5">
          {/* Team Overview card */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: team.color || '#7C3AED' }}
              >
                {getInitials(team.name)}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground truncate">{team.name}</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Public Team</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                <span>Project: <strong className="text-foreground">{team.currentProjectLabel || team.projects?.[0]?.name || 'None'}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>Team Capacity: <strong className="text-foreground">{team.maxMembers || 6} Members</strong></span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Duration: <strong className="text-foreground">6 – 12 Months</strong></span>
              </div>
            </div>
          </div>

          {/* Role Distribution donut */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Role Distribution</h3>
            <RoleDistributionChart teamMembers={team.teamMembers || []} />
          </div>

          {/* Incoming collaboration requests (captain/admin only) */}
          {isCaptainOrAdmin && collabs.incoming.filter(c => c.status === 'pending').length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Handshake className="h-4 w-4 text-primary" /> Collaboration Requests
              </h3>
              <div className="flex flex-col gap-3">
                {collabs.incoming.filter(c => c.status === 'pending').map((c) => (
                  <div key={c.id} className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs font-semibold text-foreground">{c.fromTeam.name}</p>
                    {c.projectName && <p className="text-[11px] text-muted-foreground mt-0.5">Proposing: {c.projectName}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => handleAcceptCollab(c.id)} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 text-[11px] font-semibold hover:bg-emerald-500/20 transition-colors">Accept</button>
                      <button onClick={() => handleDeclineCollab(c.id)} className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 text-[11px] font-semibold hover:bg-red-500/20 transition-colors">Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite New Members (search by name/regNo) */}
          {isCaptainOrAdmin && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-3">Invite New Members</h3>
              <CandidateInviteForm
                teamId={id!}
                query={candidateQuery}
                setQuery={setCandidateQuery}
                candidates={candidates}
                onInvited={() => { setCandidateQuery(''); setCandidates([]); loadInvites(); }}
              />
            </div>
          )}

          {/* Member Guidelines */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Member Guidelines</h3>
            <ul className="flex flex-col gap-2 text-xs text-foreground">
              {[
                'Invite only verified students',
                'Assign appropriate roles',
                'Keep your team active and engaged',
                'Remove inactive members if required',
              ].map((g) => (
                <li key={g} className="flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" /> {g}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowGuidelines(true)}
              className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> View Guidelines
            </button>
          </div>
        </div>
        </div>
      )}

      {/* ── MEMBERS TAB ──────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<Users className="h-4 w-4" />} label="Total Members" value={`${team.members?.length || 0} / ${team.maxMembers || 6}`} color="text-primary" />
              <StatCard icon={<CheckCircle className="h-4 w-4" />} label="Active Members" value={team.members?.length || 0} color="text-emerald-500" />
              <StatCard icon={<Mail className="h-4 w-4" />} label="Pending Invites" value={pendingInvites.length} color="text-amber-500" />
              <StatCard icon={<CircleDot className="h-4 w-4" />} label="Open Slots" value={Math.max(0, (team.maxMembers || 6) - (team.members?.length || 0))} color="text-violet-500" />
            </div>

            <div className="flex items-center gap-4 border-b border-border">
              <button
                onClick={() => setMemberFilter('all')}
                className={cn('pb-2.5 text-sm font-semibold border-b-[2.5px] -mb-px transition-colors', memberFilter === 'all' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}
              >
                All Members ({team.members?.length || 0})
              </button>
              {isMember && (
                <button
                  onClick={() => setMemberFilter('pending')}
                  className={cn('pb-2.5 text-sm font-semibold border-b-[2.5px] -mb-px transition-colors', memberFilter === 'pending' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}
                >
                  Pending Invites ({pendingInvites.length})
                </button>
              )}
              <button
                onClick={() => navigate(`/teams/${id}/members`)}
                className="pb-2.5 ml-auto text-xs font-semibold text-primary hover:underline"
              >
                Open Full Member Manager →
              </button>
            </div>

            {memberFilter === 'all' ? (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Member</span><span>Role</span><span>Joined On</span><span>Status</span>
                </div>
                <div className="divide-y divide-border">
                  {team.teamMembers?.map((tm: any) => (
                    <div
                      key={tm.id}
                      onClick={() => setSelectedMember({ ...tm.user, roleLabel: tm.roleLabel })}
                      className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3.5 items-center hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', getAvatarColor(tm.user.id))}>
                          {getInitials(tm.user.fullName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {tm.user.fullName}{tm.user.id === currentUser?.id && ' (You)'}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{tm.user.email}</p>
                        </div>
                      </div>
                      <span className="inline-flex w-fit items-center rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold">{tm.roleLabel}</span>
                      <span className="text-xs text-muted-foreground">{new Date(tm.joinedAt).toLocaleDateString()}</span>
                      <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">● Active</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Candidate</span><span>Proposed Role</span><span>Action</span>
                </div>
                <div className="divide-y divide-border">
                  {pendingInvites.length === 0 && (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground">No pending invites or join requests.</div>
                  )}
                  {pendingInvites.map((inv: any) => (
                    <div key={inv.id} className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-5 py-3.5 items-center hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{inv.user?.fullName || inv.email.split('@')[0]}</p>
                        <p className="text-[11px] text-muted-foreground">{inv.email} {inv.type === 'JOIN_REQUEST' && <span className="ml-1 text-primary">· Join Request</span>}</p>
                      </div>
                      <span className="inline-flex w-fit items-center rounded-full bg-indigo-500/10 text-indigo-500 px-2.5 py-1 text-[11px] font-semibold">{inv.roleLabel}</span>
                      <div className="flex items-center gap-2">
                        {(isCaptainOrAdmin || inv.userId === currentUser?.id) && (
                          <>
                            <button onClick={() => handleAcceptInvite(inv.id)} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs font-semibold hover:bg-emerald-500/20 transition-colors">Accept</button>
                            <button onClick={() => handleDeclineInvite(inv.id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 text-xs font-semibold hover:bg-red-500/20 transition-colors">Decline</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isMember && (
            <div className="rounded-2xl border border-border bg-card p-5 h-fit">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Invite New Members</h3>
                <button onClick={() => setShowInviteForm(v => !v)} className="text-primary text-xs font-semibold">{showInviteForm ? 'Hide' : 'Show'}</button>
              </div>
              {showInviteForm && <InviteForm teamId={id!} onSent={loadInvites} />}
            </div>
          )}
        </div>
      )}

      {/* ── TASKS TAB (Kanban) ───────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Team Tasks</h2>
            {isMember && (
              <button onClick={() => setShowTaskModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                <Plus className="h-4 w-4" /> Create Task
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {TASK_COLUMNS.map((col) => {
              const colTasks = tasks.filter(t => normalizeStatus(t.status) === col.key);
              return (
                <div key={col.key} className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-primary/15 p-3 min-h-[300px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('h-2 w-2 rounded-full', col.dot)} />
                    <span className="text-xs font-bold text-foreground">{col.label}</span>
                    <span className="text-[10px] text-muted-foreground">({colTasks.length})</span>
                  </div>
                  {colTasks.map((t) => (
                    <div key={t.id} className={cn('rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5', col.key === 'done' && 'opacity-70')}>
                      <p className={cn('text-[11.5px] font-bold text-foreground', col.key === 'done' && 'line-through')}>{t.title}</p>
                      {t.description && <p className="text-[9.5px] text-muted-foreground line-clamp-2">{t.description}</p>}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] text-muted-foreground">{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No due date'}</span>
                        <span className="text-[9px] font-semibold text-primary">{t.assignee?.fullName?.split(' ')[0] || 'Unassigned'}</span>
                      </div>
                      {isMember && (
                        <select
                          value={col.key}
                          onChange={(e) => handleTaskStatusChange(t.id, e.target.value)}
                          className="mt-1 text-[9px] rounded-md border border-border bg-background px-1.5 py-1 focus:outline-none"
                        >
                          {TASK_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                  {colTasks.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-4">No tasks</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PROJECTS TAB ─────────────────────────────────────────── */}
      {activeTab === 'projects' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Team Projects</h2>
            {isMember && (
              <button onClick={() => setShowProjectModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                <Plus className="h-4 w-4" /> New Project
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p: any) => (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">MERN Stack</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p.status}</span>
                </div>
                <h3 className="text-[15px] font-extrabold text-foreground">{p.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{p.description || 'No description.'}</p>
                <div className="flex items-center justify-between mt-4 mb-1.5">
                  <span className="text-[10px] text-muted-foreground">{p.taskCount} tasks</span>
                  <span className="text-xs font-bold text-primary">{p.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]" style={{ width: `${p.progress}%` }} />
                </div>
              </div>
            ))}
            {projectsLoaded && projects.length === 0 && (
              <div className="col-span-2 text-center py-10 text-sm text-muted-foreground">No projects yet.</div>
            )}
          </div>
        </div>
      )}

      {/* ── PROGRESS TAB ─────────────────────────────────────────── */}
      {activeTab === 'progress' && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-bold text-foreground mb-1">Team Velocity Burn-down Chart</h2>
          <p className="text-xs text-muted-foreground mb-6">
            {progress ? `${progress.completedTasks} / ${progress.totalTasks} tasks completed` : 'Loading…'}
          </p>
          {progress && (
            <div className="flex items-end gap-2 h-[220px] border-b-[2.5px] border-[#E4E2F1] pb-0">
              {progress.weeks.map((w: any) => (
                <div key={w.week} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                  <span className="text-[9px] text-muted-foreground">{w.percent}%</span>
                  <div
                    className="w-full rounded-t-[3px]"
                    style={{ height: `${Math.max(w.percent, 2)}%`, background: 'linear-gradient(180deg, #7C3AED, #A78BFA)' }}
                  />
                  <span className="text-[8.5px] text-muted-foreground mt-1">{w.week}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITY TAB ─────────────────────────────────────────── */}
      {activeTab === 'activity' && isMember && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-bold text-foreground mb-4">Activity Log</h2>
          <div className="flex flex-col gap-3">
            {activityLog.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No recent activity.</p>}
            {activityLog.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3">
                <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0', getAvatarColor(a.user.id))}>
                  {getInitials(a.user.fullName)}
                </div>
                <p className="text-sm text-foreground flex-1">
                  <span className="font-semibold">{a.user.fullName}</span> {a.action}
                </p>
                <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CHAT TAB ──────────────────────────────────────────────── */}
      {activeTab === 'chat' && isMember && (
        <div className="rounded-2xl border border-border bg-card flex flex-col h-[520px] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground leading-tight">Team Chat Room</h2>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {team.members?.length || 0} members online
                </span>
              </div>
            </div>
          </div>
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1 scroll-smooth">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <MessageSquare className="h-8 w-8 opacity-30" />
                <p className="text-sm">No messages yet. Say hello!</p>
              </div>
            )}
            {messages.map((m: any, idx: number) => {
              const mine = m.userId === currentUser?.id;
              const prev = messages[idx - 1];
              const isGrouped = prev && prev.userId === m.userId && (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 120_000;
              return (
                <div key={m.id} className={cn('flex items-end gap-2 max-w-[75%]', mine ? 'self-end flex-row-reverse' : 'self-start', isGrouped ? 'mt-0.5' : 'mt-3')}>
                  {!mine && (
                    <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0', isGrouped ? 'opacity-0' : getAvatarColor(m.userId))}>
                      {getInitials(m.user?.fullName || '')}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    {!isGrouped && (
                      <span className={cn('text-[10px] text-muted-foreground mb-1', mine && 'text-right')}>
                        {mine ? 'You' : m.user?.fullName} · {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <div
                      className={cn(
                        'px-3.5 py-2 text-sm shadow-sm',
                        mine
                          ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                          : 'bg-muted text-foreground rounded-2xl rounded-tl-sm'
                      )}
                    >
                      {m.message}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/20">
            <input
              value={messageDraft}
              onChange={(e) => setMessageDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message…"
              className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageDraft.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 shadow-sm"
            >
              <Send className="h-3.5 w-3.5" /> Send
            </button>
          </div>
        </div>
      )}

      {/* ── MODALS ───────────────────────────────────────────────── */}
      {showEditModal && (
        <EditTeamModal team={team} onClose={() => setShowEditModal(false)} onSaved={() => { setShowEditModal(false); loadCore(); }} />
      )}
      {showTaskModal && (
        <CreateTaskModal teamId={id!} members={team.teamMembers || []} onClose={() => setShowTaskModal(false)} onCreated={() => { setShowTaskModal(false); loadTasks(); }} />
      )}
      {showProjectModal && (
        <CreateProjectModal teamId={id!} onClose={() => setShowProjectModal(false)} onCreated={() => { setShowProjectModal(false); loadProjects(); }} />
      )}
      {showCollabModal && (
        <CollaborationModal fromTeamId={id!} onClose={() => setShowCollabModal(false)} />
      )}
      {showGuidelines && (
        <Modal title="Member Guidelines" icon="🛡️" onClose={() => setShowGuidelines(false)}>
          <div className="flex flex-col gap-3 text-sm text-foreground">
            <p><strong>Invite only verified students.</strong> Confirm a candidate's registration number or campus email before sending an invite so the roster stays trustworthy.</p>
            <p><strong>Assign appropriate roles.</strong> Match the role label to what someone will actually work on — it drives how their workload shows up in the coordination dashboard.</p>
            <p><strong>Keep your team active and engaged.</strong> Regular check-ins, task updates, and chat activity keep the whole team's engagement score healthy.</p>
            <p><strong>Remove inactive members if required.</strong> A team lead can remove a member who has gone silent so their seat can go to someone active.</p>
          </div>
        </Modal>
      )}

      {selectedMember && (() => {
        const initials = getInitials(selectedMember.fullName);
        const avatarBg = getAvatarColor(selectedMember.id);
        const primarySkills = (selectedMember.userSkills || []).filter((s: any) => s.skillType === 'primary');
        const secondarySkills = (selectedMember.userSkills || []).filter((s: any) => s.skillType === 'secondary');
        const specSkills = (selectedMember.userSkills || []).filter((s: any) => s.skillType === 'specialization');

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all duration-300"
            onClick={() => setSelectedMember(null)}
          >
            <div
              className="relative w-full max-w-lg rounded-3xl border border-border/80 bg-card/90 backdrop-blur-xl p-6 shadow-2xl flex flex-col overflow-y-auto max-h-[90vh] transition-transform duration-300 scale-100"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedMember(null)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-muted/50"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Profile Header */}
              <div className="flex flex-col items-center text-center pb-4 border-b border-border/60">
                <div className={cn("h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md border-2 border-card", avatarBg)}>
                  {initials}
                </div>
                <h3 className="text-xl font-bold text-foreground mt-3 leading-tight">{selectedMember.fullName}</h3>
                <span className="px-3 py-0.5 mt-1.5 text-[10px] font-bold rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                  {selectedMember.roleLabel || selectedMember.teamRole || 'Team Member'}
                </span>
                <p className="text-xs text-muted-foreground mt-1">{selectedMember.email}</p>
                {selectedMember.regNo && (
                  <div className="mt-2 text-xs font-mono bg-muted/50 px-2 py-0.5 rounded border border-border/60 text-foreground">
                    Reg No: {selectedMember.regNo}
                  </div>
                )}
              </div>

              {/* Grid with Details */}
              <div className="grid grid-cols-2 gap-3 py-4 text-xs border-b border-border/60">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Department</span>
                  <p className="font-semibold text-foreground mt-0.5">{selectedMember.department || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Year / Cluster</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {selectedMember.year ? `${selectedMember.year} Year` : 'N/A'} ({selectedMember.cluster || 'N/A'})
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Learning Mode</span>
                  <p className="font-semibold text-foreground mt-0.5">{selectedMember.learningMode || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Residency</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {selectedMember.resident === 'H' ? '🏡 Hosteller' : selectedMember.resident === 'D' ? '🚌 Day scholar' : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Specialization (SSG)</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {selectedMember.ssgEnrolled ? `✅ ${selectedMember.ssgDomain || 'SSG'}` : '❌ Not enrolled'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Points & Ranks</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    ⚡ AP: {selectedMember.rewardPoints || 0}
                    {selectedMember.activityPoints ? ` | 🏆 Rank: #${selectedMember.activityPoints}` : ''}
                  </p>
                </div>
              </div>

              {/* Team Wise Rank */}
              {team?.ranking && (
                <div className="py-2.5 px-3 mt-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Team Leaderboard Position</span>
                  <span className="font-bold text-indigo-600">Rank #{team.ranking.rank} ({team.ranking.totalPoints} pts)</span>
                </div>
              )}

              {/* Skills & Expertise List */}
              <div className="mt-4 flex-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-2.5">Skills & Expertise (Real-time DB)</span>
                
                <div className="space-y-3">
                  {/* Primary Skills */}
                  {primarySkills.length > 0 && (
                    <div>
                      <span className="text-[9px] uppercase font-semibold text-primary tracking-widest block mb-1">Primary</span>
                      <div className="space-y-1.5">
                        {primarySkills.map((s: any) => (
                          <div key={s.skillName} className="flex justify-between items-center bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10">
                            <span className="text-xs font-medium text-foreground">{s.skillName}</span>
                            <div className="flex gap-2 text-[10px]">
                              {s.skillRank && <span className="bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">Rank #{s.skillRank} / {s.totalRanks || 3221}</span>}
                              {s.totalPoints > 0 && <span className="bg-indigo-500/15 text-indigo-600 px-1.5 py-0.5 rounded font-semibold">{s.totalPoints} RP</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Secondary Skills */}
                  {secondarySkills.length > 0 && (
                    <div>
                      <span className="text-[9px] uppercase font-semibold text-emerald-600 tracking-widest block mb-1">Secondary</span>
                      <div className="space-y-1.5">
                        {secondarySkills.map((s: any) => (
                          <div key={s.skillName} className="flex justify-between items-center bg-emerald-500/5 px-2.5 py-1.5 rounded-lg border border-emerald-500/10">
                            <span className="text-xs font-medium text-foreground">{s.skillName}</span>
                            <div className="flex gap-2 text-[10px]">
                              {s.skillRank && <span className="bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5 rounded font-semibold">Rank #{s.skillRank} / {s.totalRanks || 3221}</span>}
                              {s.totalPoints > 0 && <span className="bg-indigo-500/15 text-indigo-600 px-1.5 py-0.5 rounded font-semibold">{s.totalPoints} RP</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Specialization */}
                  {specSkills.length > 0 && (
                    <div>
                      <span className="text-[9px] uppercase font-semibold text-amber-600 tracking-widest block mb-1">Specialization</span>
                      <div className="space-y-1.5">
                        {specSkills.map((s: any) => (
                          <div key={s.skillName} className="flex justify-between items-center bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/10">
                            <span className="text-xs font-medium text-foreground">{s.skillName}</span>
                            <div className="flex gap-2 text-[10px]">
                              {s.skillRank && <span className="bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded font-semibold">Rank #{s.skillRank} / {s.totalRanks || 3221}</span>}
                              {s.totalPoints > 0 && <span className="bg-indigo-500/15 text-indigo-600 px-1.5 py-0.5 rounded font-semibold">{s.totalPoints} RP</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {primarySkills.length === 0 && secondarySkills.length === 0 && specSkills.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No skills registered in the database for this student.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ── Role Distribution Donut ──────────────────────────────────────────────

const ROLE_DONUT_COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];

const RoleDistributionChart: React.FC<{ teamMembers: any[] }> = ({ teamMembers }) => {
  const counts = new Map<string, number>();
  teamMembers.forEach((tm) => counts.set(tm.roleLabel, (counts.get(tm.roleLabel) || 0) + 1));
  const data = Array.from(counts.entries()).map(([name, value]) => ({ name, value }));

  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6">No members yet.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
              {data.map((_, i) => <Cell key={i} fill={ROLE_DONUT_COLORS[i % ROLE_DONUT_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 w-full">
        {data.map((d, i) => {
          const pct = Math.round((d.value / teamMembers.length) * 100);
          return (
            <div key={d.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ROLE_DONUT_COLORS[i % ROLE_DONUT_COLORS.length] }} />
              <span className="truncate">{d.name} ({d.value}/{pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Candidate Invite Form (search by name / regNo) ───────────────────────

const CandidateInviteForm: React.FC<{
  teamId: string; query: string; setQuery: (v: string) => void; candidates: any[]; onInvited: () => void;
}> = ({ teamId, query, setQuery, candidates, onInvited }) => {
  const [roleLabel, setRoleLabel] = useState(ROLE_OPTIONS[0]);
  const [sending, setSending] = useState(false);

  const invite = async (email: string) => {
    setSending(true);
    try {
      await teamService.inviteMember(teamId, { email, roleLabel });
      onInvited();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to send invite.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or registration no."
          className={cn(inputClass, 'pl-8')}
        />
      </div>
      <select value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} className={inputClass}>
        {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      {candidates.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
          {candidates.map((c) => (
            <button
              key={c.id}
              disabled={sending || !!c.teamId}
              onClick={() => invite(c.email)}
              className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 hover:bg-muted px-3 py-2 text-left transition-colors disabled:opacity-50"
            >
              <span className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{c.fullName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{c.regNo || c.email}</p>
              </span>
              <span className="text-[10px] font-semibold text-primary shrink-0">{c.teamId ? 'In a team' : 'Invite'}</span>
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && candidates.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No matching students found.</p>
      )}
    </div>
  );
};

// ── Invite Form ────────────────────────────────────────────────────────────

const ROLE_OPTIONS = ['Frontend Developer', 'Backend Developer', 'UI/UX Designer', 'DevOps Engineer', 'Full Stack Developer'];

const InviteForm: React.FC<{ teamId: string; onSent: () => void }> = ({ teamId, onSent }) => {
  const [email, setEmail] = useState('');
  const [roleLabel, setRoleLabel] = useState(ROLE_OPTIONS[0]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    try {
      await teamService.inviteMember(teamId, { email, roleLabel, message });
      setEmail(''); setMessage('');
      onSent();
      alert('Invitation sent!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to send invite.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Email</label>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Role</label>
        <select value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} className={inputClass}>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Personal message (optional)</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className={inputClass} />
      </div>
      <button disabled={sending} type="submit" className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
        {sending ? 'Sending…' : 'Send Invitation'}
      </button>
    </form>
  );
};

// ── Edit Team Modal ──────────────────────────────────────────────────────

const EditTeamModal: React.FC<{ team: any; onClose: () => void; onSaved: () => void }> = ({ team, onClose, onSaved }) => {
  const [name, setName] = useState(team.name || '');
  const [description, setDescription] = useState(team.description || '');
  const [currentProjectLabel, setCurrentProjectLabel] = useState(team.currentProjectLabel || '');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await teamService.updateTeam(team.id, { name, description, currentProjectLabel });
      onSaved();
    } catch (err) {
      console.error(err);
      alert('Failed to update team.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit Team Info" icon="⚙️" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className={labelClass}>Team Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Currently Going Project</label>
          <input value={currentProjectLabel} onChange={(e) => setCurrentProjectLabel(e.target.value)} className={inputClass} />
        </div>
        <button disabled={saving} type="submit" className="w-full py-2.5 mt-1 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </Modal>
  );
};

// ── Create Task Modal ────────────────────────────────────────────────────

const CreateTaskModal: React.FC<{ teamId: string; members: any[]; onClose: () => void; onCreated: () => void }> = ({ teamId, members, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await teamService.createTeamTask(teamId, { title, description, dueDate: dueDate || undefined, assigneeId: assigneeId || undefined });
      onCreated();
    } catch (err) {
      console.error(err);
      alert('Failed to create task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Create New Task" icon="✅" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className={labelClass}>Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Due Date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Assign To Member</label>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputClass}>
            <option value="">Unassigned</option>
            {members.map((m: any) => <option key={m.user.id} value={m.user.id}>{m.user.fullName}</option>)}
          </select>
        </div>
        <button disabled={saving} type="submit" className="w-full py-2.5 mt-1 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
          {saving ? 'Creating…' : 'Create Task'}
        </button>
      </form>
    </Modal>
  );
};

// ── Create Project Modal ─────────────────────────────────────────────────

const CreateProjectModal: React.FC<{ teamId: string; onClose: () => void; onCreated: () => void }> = ({ teamId, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await teamService.createTeamProject(teamId, { name, description });
      onCreated();
    } catch (err) {
      console.error(err);
      alert('Failed to create project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Create New Project" icon="📁" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className={labelClass}>Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
        </div>
        <button disabled={saving} type="submit" className="w-full py-2.5 mt-1 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
          {saving ? 'Creating…' : 'Create Project'}
        </button>
      </form>
    </Modal>
  );
};

// ── Collaboration Modal ──────────────────────────────────────────────────

export const CollaborationModal: React.FC<{
  fromTeamId: string;
  onClose: () => void;
}> = ({ fromTeamId, onClose }) => {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [projectName, setProjectName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const allTeams = await teamService.getTeams();
        setTeams(allTeams.filter((t: any) => t.id !== fromTeamId));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, [fromTeamId]);

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.domain || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    setSending(true);
    setError(null);
    try {
      await teamService.createCollaboration(fromTeamId, {
        toTeamId: selectedTeam.id,
        projectName,
        message,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send collaboration request.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl border border-border/80 bg-card/95 backdrop-blur-xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" /> Cross-Team Collaboration
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-muted/50">
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="h-16 w-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center text-3xl font-bold animate-bounce">
              ✓
            </div>
            <div>
              <h4 className="text-md font-bold text-foreground">Invitation Sent!</h4>
              <p className="text-xs text-muted-foreground mt-1.5">
                Your collaboration request has been successfully delivered to <strong>{selectedTeam?.name}</strong>.
              </p>
            </div>
            <button onClick={onClose} className="mt-4 px-6 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
              Close
            </button>
          </div>
        ) : selectedTeam ? (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 overflow-y-auto py-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
              <div
                className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm"
                style={{ backgroundColor: selectedTeam.color || '#7C3AED' }}
              >
                {getInitials(selectedTeam.name)}
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold">Proposing to collaborate with:</p>
                <h4 className="text-sm font-bold text-foreground">{selectedTeam.name}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="ml-auto text-xs font-bold text-primary hover:underline"
              >
                Change Team
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className={labelClass}>Proposed Joint Project Name</label>
                <input
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Smart Utility Sensor Integration"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Collaboration Description</label>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Describe your joint goals, domain overlap, and how both teams can coordinate..."
                  className={inputClass}
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted font-semibold text-sm transition-colors"
              >
                Back
              </button>
              <button
                disabled={sending}
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Collaboration Invitation'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden py-4 gap-3">
            <p className="text-xs text-muted-foreground">
              Select another active team to propose a joint cross-domain project.
            </p>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search other teams by name or domain..."
                className={cn(inputClass, 'pl-9')}
              />
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
                Loading teams...
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                {filteredTeams.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTeam(t)}
                    className="rounded-2xl border border-border bg-card/60 p-4 hover:border-primary/50 hover:bg-muted/40 cursor-pointer flex items-center gap-3 transition-all duration-200 group"
                  >
                    <div
                      className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm"
                      style={{ backgroundColor: t.color || '#7C3AED' }}
                    >
                      {getInitials(t.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{t.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{t.domain || 'General'}</p>
                    </div>
                    <button className="text-[11px] font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0">
                      Invite
                    </button>
                  </div>
                ))}
                {filteredTeams.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-8">No other teams found.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
