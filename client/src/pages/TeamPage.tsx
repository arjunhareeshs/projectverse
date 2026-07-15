import React, { useEffect, useState } from 'react';
import {
  Users,
  Mail,
  Shield,
  UserCheck,
  Search,
  Plus,
  MoreHorizontal,
  Crown,
  X,
  Handshake,
  FolderKanban,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { teamService } from '../services/team.service';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { MEMBER_MOCK_DETAILS, CollaborationModal } from './TeamDetailPage';

interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  lead?: TeamMember;
  members: TeamMember[];
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  ADMIN: { label: 'Admin', icon: Shield, color: 'text-red-400', bg: 'bg-red-400/10' },
  STUDENT: { label: 'Student', icon: UserCheck, color: 'text-primary', bg: 'bg-primary/10' },
};

const AVATAR_COLORS = [
  'bg-primary', 'bg-secondary', 'bg-warning', 'bg-success', 'bg-info',
  'bg-purple-500', 'bg-pink-500', 'bg-orange-500',
];

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function getAvatarColor(id: string): string {
  const idx = id.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

const DOMAIN_OPTIONS = ['Full Stack Development', 'Web Development', 'AI/ML', 'Cyber Security', 'IoT', 'DSA/Tools'];

export const TeamPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useSelector((state: any) => state.auth?.user);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await teamService.getTeams();
      setTeams(res || []);
    } catch (err) {
      console.error(err);
      setTeams([]);
      setLoadError('Failed to load teams from the database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) &&
    (!domainFilter || (t as any).domain === domainFilter)
  );

  const myTeam = teams.find((t) => t.members.some((m) => m.id === currentUser?.id));

  // Flatten all members for the "All Members" section
  const allMembers = Array.from(
    new Map(
      teams.flatMap((t) => t.members).map((m) => [m.id, m])
    ).values()
  ).filter((m) => m.fullName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? 'Loading…' : `${allMembers.length} members across ${teams.length} teams`}
          </p>
        </div>
        {myTeam ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCollabModal(true)}
              className="flex items-center gap-2 rounded-lg bg-indigo-500/10 px-4 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-500/20 transition-colors shadow-sm"
            >
              <Handshake className="h-4 w-4" />
              Collaborate
            </button>
            <Link
              to={`/teams/${myTeam.id}`}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <Users className="h-4 w-4" />
              Go to My Team
            </Link>
          </div>
        ) : (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create Team
          </button>
        )}
      </div>

      {myTeam && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          You're already part of <strong>{myTeam.name}</strong>. You can only belong to one team at a time — leave it from the team page if you'd like to join or create another.
        </div>
      )}

      {/* Search + Domain filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search members or teams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">All Domains</option>
          {DOMAIN_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {domainFilter && (
          <button onClick={() => setDomainFilter('')} className="text-xs font-semibold text-primary hover:underline">
            Reset
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="rounded-xl border border-border bg-card h-48 animate-pulse" />)}
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-red-500 font-semibold">{loadError}</p>
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Teams Section */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Teams</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((team) => (
                <div key={team.id} className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-all duration-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <Link to={`/teams/${team.id}`} className="hover:underline">
                          <h3 className="font-semibold text-foreground flex flex-wrap items-center gap-2">
                            {team.name}
                            {(team as any).groupLevel && (
                              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                                {(team as any).groupLevel}
                              </span>
                            )}
                            {(team as any).ranking && (
                              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 uppercase tracking-wider">
                                Rank #{(team as any).ranking.rank}
                              </span>
                            )}
                          </h3>
                        </Link>
                        {((team as any).description || (team as any).groupCode) && (
                          <div className="flex flex-col gap-1 mt-1">
                            {(team as any).groupCode && (
                              <span className="w-fit text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/50">
                                Code: {(team as any).groupCode}
                              </span>
                            )}
                            {team.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{team.description}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>

                  {team.lead && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-muted/50">
                      <Crown className="h-3.5 w-3.5 text-yellow-400" />
                      <span className="text-xs text-muted-foreground">Lead:</span>
                      <span className="text-xs font-semibold text-foreground">{team.lead.fullName}</span>
                    </div>
                  )}

                  {/* Member Avatars */}
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {team.members.slice(0, 5).map((member) => (
                        <div
                          key={member.id}
                          title={member.fullName}
                          onClick={(e) => { e.preventDefault(); setSelectedMember({ ...member, roleLabel: member.role }); }}
                          className={cn(
                            'h-8 w-8 rounded-full border-2 border-card flex items-center justify-center text-white text-[10px] font-bold cursor-pointer hover:scale-110 transition-transform',
                            getAvatarColor(member.id)
                          )}
                        >
                          {getInitials(member.fullName)}
                        </div>
                      ))}
                      {team.members.length > 5 && (
                        <div className="h-8 w-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          +{team.members.length - 5}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{team.members.length} members</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Members Table */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">All Members</h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_1fr_48px] gap-4 px-5 py-3 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Member</span>
                <span>Role</span>
                <span>Teams</span>
                <span></span>
              </div>
              <div className="divide-y divide-border">
                {allMembers.map((member) => {
                  const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.DEVELOPER;
                  const RoleIcon = roleConfig.icon;
                  const memberTeams = teams.filter((t) => t.members.some((m) => m.id === member.id));

                  return (
                    <div
                      key={member.id}
                      className="grid grid-cols-[2fr_1fr_1fr_48px] gap-4 px-5 py-3.5 items-center hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold', getAvatarColor(member.id))}>
                          {getInitials(member.fullName)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{member.fullName}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {member.email}
                          </p>
                        </div>
                      </div>

                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold w-fit', roleConfig.bg, roleConfig.color)}>
                        <RoleIcon className="h-3 w-3" />
                        {roleConfig.label}
                      </span>

                      <div className="flex items-center gap-1 flex-wrap">
                        {memberTeams.map((t) => (
                          <span key={t.id} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground font-medium">
                            {t.name}
                          </span>
                        ))}
                      </div>

                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {showCollabModal && myTeam && (
        <CollaborationModal fromTeamId={myTeam.id} onClose={() => setShowCollabModal(false)} />
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

      {showCreateModal && (
        <CreateTeamModal
          leaderName={currentUser?.fullName || ''}
          leaderId={currentUser?.id || ''}
          onClose={() => setShowCreateModal(false)}
          onCreated={(teamId) => {
            localStorage.setItem('student_team_state', 'Tech Innovators');
            setShowCreateModal(false);
            load();
            navigate(`/teams/${teamId}`);
          }}
        />
      )}
    </div>
  );
};

const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
const labelClass = 'text-xs font-semibold text-muted-foreground mb-1.5 block';

const CreateTeamModal: React.FC<{ leaderName: string; leaderId: string; onClose: () => void; onCreated: (teamId: string) => void }> = ({ leaderName, leaderId, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState(DOMAIN_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const team = await teamService.createTeam({ name, description, domain, leadId: leaderId });
      onCreated(team.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create team.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-[460px] rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <span className="text-lg">👥</span> Create New Team
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Team Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Code Warriors" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is your team building? Describe your goals…"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className={inputClass}>
              {DOMAIN_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Team Leader Name</label>
            <input readOnly value={leaderName} className={cn(inputClass, 'bg-[#FAF9FF] cursor-not-allowed')} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            disabled={saving}
            type="submit"
            className="w-full py-2.5 mt-1 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Team & Initialize'}
          </button>
        </form>
      </div>
    </div>
  );
};
