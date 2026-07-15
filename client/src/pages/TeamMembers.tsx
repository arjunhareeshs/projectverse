import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Users, UserCheck, Mail, Search, ArrowLeft, Award, PieChart as PieIcon, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { teamService } from '../services/team.service';
export const MEMBER_MOCK_DETAILS: Record<string, { regNo: string; project: string; skills: string[] }> = {
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

const ROLE_COLOR: Record<string, { color: string; bg: string }> = {
  'Team Leader': { color: '#7C3AED', bg: '#F0EBFF' },
  'Co-Lead': { color: '#4338CA', bg: '#EEF2FF' },
  'Frontend Developer': { color: '#059669', bg: '#ECFDF5' },
  'Backend Developer': { color: '#059669', bg: '#ECFDF5' },
  'Full Stack Developer': { color: '#059669', bg: '#ECFDF5' },
  'UI/UX Designer': { color: '#DC2626', bg: '#FEF2F2' },
  'DevOps Engineer': { color: '#D97706', bg: '#FFF7ED' },
  Member: { color: '#6366F1', bg: '#EEF2FF' },
};

function roleStyle(role: string) {
  return ROLE_COLOR[role] || ROLE_COLOR.Member;
}

function getInitials(name: string): string {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

const RANK_COLORS = ['#F5B400', '#A0A0B8', '#D97706', '#8B8BA8'];

export const TeamMembers: React.FC = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const currentUser = useSelector((state: any) => state.auth?.user);

  const [team, setTeam] = useState<any>(null);
  const [invites, setInvites] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const [search, setSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Frontend Developer');
  const [sending, setSending] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  useEffect(() => {
    if (!teamId) return;
    const load = async () => {
      try {
        const [teamData, inviteData, taskData] = await Promise.all([
          teamService.getTeamById(teamId),
          teamService.getInvites(teamId),
          teamService.getTeamTasks(teamId),
        ]);
        setTeam(teamData);
        setInvites(inviteData);
        setTasks(taskData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [teamId]);

  const isCaptainOrAdmin = team && currentUser && (team.leadId === currentUser.id || currentUser.role === 'ADMIN');
  const pendingInvites = invites.filter((i) => i.status === 'pending');

  // Contributions/XP derived from real completed-task counts (no fabricated data).
  const memberStats = useMemo(() => {
    const map = new Map<string, { contributions: number; xp: number }>();
    tasks.forEach((t: any) => {
      if (!t.assigneeId) return;
      const isDone = t.status === 'done' || t.status === 'completed';
      const cur = map.get(t.assigneeId) || { contributions: 0, xp: 0 };
      if (isDone) { cur.contributions += 1; cur.xp += 50; } else { cur.xp += 10; }
      map.set(t.assigneeId, cur);
    });
    return map;
  }, [tasks]);

  const members = (team?.teamMembers || []).filter((tm: any) =>
    tm.user.fullName.toLowerCase().includes(search.toLowerCase()) ||
    tm.roleLabel.toLowerCase().includes(search.toLowerCase()) ||
    tm.user.email.toLowerCase().includes(search.toLowerCase())
  );

  const topContributors = [...(team?.teamMembers || [])]
    .map((tm: any) => ({ ...tm, stat: memberStats.get(tm.user.id) || { contributions: 0, xp: 0 } }))
    .sort((a, b) => b.stat.contributions - a.stat.contributions)
    .slice(0, 4);

  const roleDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    (team?.teamMembers || []).forEach((tm: any) => { counts[tm.roleLabel] = (counts[tm.roleLabel] || 0) + 1; });
    return Object.entries(counts);
  }, [team]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !inviteEmail) return;
    setSending(true);
    try {
      const invite = await teamService.inviteMember(teamId, { email: inviteEmail, roleLabel: inviteRole });
      setInvites((prev) => [invite, ...prev]);
      setInviteEmail('');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to send invite.');
    } finally {
      setSending(false);
    }
  };

  const respond = async (inviteId: string, action: 'accept' | 'decline') => {
    if (!teamId) return;
    try {
      if (action === 'accept') await teamService.acceptInvite(teamId, inviteId);
      else await teamService.declineInvite(teamId, inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to respond to invite.');
    }
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading members…</div>;
  if (!team) return <div className="p-6 text-muted-foreground">Team not found.</div>;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      <button onClick={() => navigate(`/teams/${teamId}`)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Team
      </button>

      <div>
        <h1 className="text-[22px] font-bold text-foreground">Team Members</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your team members, roles, and permissions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Members', value: `${team.members?.length || 0} / ${team.maxMembers || 6}`, color: '#7C3AED' },
              { label: 'Active Members', value: team.members?.length || 0, color: '#1FA855' },
              { label: 'Pending Invites', value: pendingInvites.length, color: '#D97706' },
              { label: 'Open Slots', value: Math.max(0, (team.maxMembers || 6) - (team.members?.length || 0)), color: '#7C3AED' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}1A` }}>
                  <Users className="h-4 w-4" style={{ color: s.color }} />
                </span>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-b border-border flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <button onClick={() => setFilter('all')} className={cn('pb-2.5 text-sm font-semibold border-b-[2.5px] -mb-px transition-colors', filter === 'all' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
                All Members ({team.members?.length || 0})
              </button>
              <button onClick={() => setFilter('pending')} className={cn('pb-2.5 text-sm font-semibold border-b-[2.5px] -mb-px transition-colors', filter === 'pending' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
                Pending Invites ({pendingInvites.length})
              </button>
            </div>
            <button className="mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
              <UserCheck className="h-3.5 w-3.5" /> Member Roles Guide
            </button>
          </div>

          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, skills, or email…"
              className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {filter === 'all' ? (
            <div className="rounded-xl border border-border bg-card overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[2fr_1.2fr_1fr_0.7fr_0.9fr_1fr] gap-3 px-5 py-3 border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Member</span><span>Role</span><span>Skills</span><span className="text-right">XP</span><span className="text-right">Contributions</span><span>Joined</span>
                </div>
                <div className="divide-y divide-border">
                  {members.map((tm: any) => {
                    const style = roleStyle(tm.roleLabel);
                    const stat = memberStats.get(tm.user.id) || { contributions: 0, xp: 0 };
                    const skills = tm.user.skills || ['HTML', 'CSS', 'JavaScript'];
                    return (
                      <div
                        key={tm.id}
                        onClick={() => setSelectedMember({ ...tm.user, roleLabel: tm.roleLabel })}
                        className="grid grid-cols-[2fr_1.2fr_1fr_0.7fr_0.9fr_1fr] gap-3 px-5 py-3.5 items-center hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 bg-primary">
                            {getInitials(tm.user.fullName)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{tm.user.fullName}{tm.user.id === currentUser?.id && ' (You)'}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{tm.user.email}</p>
                          </div>
                        </div>
                        <span className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: style.color, backgroundColor: style.bg }}>
                          {tm.roleLabel}
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {skills.slice(0, 2).map((s: string) => (
                            <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground font-medium">{s}</span>
                          ))}
                          {skills.length > 2 && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground font-medium">+{skills.length - 2}</span>}
                        </div>
                        <span className="text-right text-sm font-bold text-primary">{stat.xp}</span>
                        <span className="text-right text-sm text-foreground">{stat.contributions}</span>
                        <span className="text-xs text-muted-foreground">{new Date(tm.joinedAt).toLocaleDateString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Candidate</span><span>Proposed Role</span><span>Action</span>
              </div>
              <div className="divide-y divide-border">
                {pendingInvites.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">No pending invites.</div>}
                {pendingInvites.map((inv: any) => (
                  <div key={inv.id} className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-5 py-3.5 items-center hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{inv.user?.fullName || inv.email.split('@')[0]}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {inv.email}</p>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-full bg-indigo-500/10 text-indigo-500 px-2.5 py-1 text-[11px] font-semibold">{inv.roleLabel}</span>
                    <div className="flex items-center gap-2">
                      {isCaptainOrAdmin && (
                        <>
                          <button onClick={() => respond(inv.id, 'accept')} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs font-semibold hover:bg-emerald-500/20 transition-colors">Accept</button>
                          <button onClick={() => respond(inv.id, 'decline')} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 text-xs font-semibold hover:bg-red-500/20 transition-colors">Decline</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-6">
          {isCaptainOrAdmin && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-3">Invite Member</h3>
              <form onSubmit={sendInvite} className="flex flex-col gap-3">
                <input
                  required type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email or username"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <select
                  value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {Object.keys(ROLE_COLOR).filter(r => r !== 'Team Leader' && r !== 'Member').map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button disabled={sending} type="submit" className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {sending ? 'Sending…' : 'Send Invite'}
                </button>
              </form>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Award className="h-4 w-4 text-amber-500" /> Top Contributors</h3>
            <div className="flex flex-col gap-3">
              {topContributors.map((tm: any, idx: number) => (
                <div key={tm.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-4" style={{ color: RANK_COLORS[idx] }}>#{idx + 1}</span>
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold bg-gradient-to-br from-primary to-secondary shrink-0">
                    {getInitials(tm.user.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{tm.user.fullName}</p>
                    <p className="text-[10px] text-muted-foreground">{tm.stat.contributions} commits</p>
                  </div>
                  <span className="text-[10px] font-bold text-primary shrink-0">{(tm.stat.xp / 1000).toFixed(1)}k XP</span>
                </div>
              ))}
              {topContributors.length === 0 && <p className="text-xs text-muted-foreground">No contribution data yet.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><PieIcon className="h-4 w-4 text-primary" /> Role Distribution</h3>
            <div className="flex flex-col gap-2">
              {roleDistribution.map(([role, count]) => {
                const style = roleStyle(role);
                return (
                  <div key={role} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: style.color }} />
                    <span className="text-foreground flex-1 truncate">{role}</span>
                    <span className="text-muted-foreground font-semibold">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        {selectedMember && (() => {
          const initials = getInitials(selectedMember.fullName);
          const primarySkills = (selectedMember.userSkills || []).filter((s: any) => s.skillType === 'primary');
          const secondarySkills = (selectedMember.userSkills || []).filter((s: any) => s.skillType === 'secondary');
          const specSkills = (selectedMember.userSkills || []).filter((s: any) => s.skillType === 'specialization');

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all duration-300"
              onClick={() => setSelectedMember(null)}
            >
              <div
                className="relative w-full max-w-lg rounded-3xl border border-border/80 bg-card/90 backdrop-blur-xl p-6 shadow-2xl flex flex-col overflow-y-auto max-h-[90vh] transition-transform duration-300 scale-100 animate-fadeIn"
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
                  <div className="h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md border-2 border-card bg-primary">
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
      </div>
    </div>
  );
};
