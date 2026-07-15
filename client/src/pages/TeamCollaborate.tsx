import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeft, Handshake, Users, X, Crown, Clock } from 'lucide-react';
import { cn } from '../utils/cn';
import { teamService } from '../services/team.service';

function getInitials(name: string): string {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
const labelClass = 'text-xs font-semibold text-muted-foreground mb-1.5 block';

export const TeamCollaborate: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useSelector((state: any) => state.auth?.user);

  const [team, setTeam] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [targetTeam, setTargetTeam] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [teamData, allTeams, collabs] = await Promise.all([
          teamService.getTeamById(id),
          teamService.getTeams(),
          teamService.getCollaborations(id),
        ]);
        setTeam(teamData);
        setTeams(allTeams);
        setOutgoing(collabs.outgoing);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const isCaptainOrAdmin = team && currentUser && (team.leadId === currentUser.id || currentUser.role === 'ADMIN');

  const otherTeams = teams
    .filter((t) => t.id !== id)
    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || (t.domain || '').toLowerCase().includes(search.toLowerCase()));

  const statusFor = (toTeamId: string) => outgoing.find((c) => c.toTeamId === toTeamId && c.status === 'pending');

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!team) return <div className="p-6 text-muted-foreground">Team not found.</div>;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      <button onClick={() => navigate(`/teams/${id}`)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {team.name}
      </button>

      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Handshake className="h-6 w-6 text-primary" /> Cross-Domain Collaboration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discover other teams and propose a joint project across domains.
        </p>
      </div>

      {!isCaptainOrAdmin && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          Only <strong>{team.name}</strong>'s team lead can send collaboration requests. You can still browse other teams below.
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search teams by name or domain…"
        className="w-full sm:w-80 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {otherTeams.map((t) => {
          const pending = statusFor(t.id);
          const full = (t.members?.length || 0) >= (t.maxMembers || 6);
          return (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm"
                    style={{ backgroundColor: t.color || '#7C3AED', boxShadow: `0 3px 8px ${t.color || '#7C3AED'}55` }}
                  >
                    {getInitials(t.name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{t.name}</h3>
                    <p className="text-[11px] text-muted-foreground truncate">{t.domain || 'General'}</p>
                  </div>
                </div>
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', full ? 'bg-orange-500/10 text-orange-500' : 'bg-emerald-500/10 text-emerald-500')}>
                  {full ? 'Full' : 'Recruiting'}
                </span>
              </div>

              {t.description && <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{t.description}</p>}

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {t.members?.length || 0} / {t.maxMembers || 6} Members</span>
                {t.lead && (
                  <span className="flex items-center gap-1"><Crown className="h-3 w-3 text-yellow-400" /> {t.lead.fullName}</span>
                )}
              </div>

              {isCaptainOrAdmin && (
                pending ? (
                  <button disabled className="w-full py-2 rounded-lg bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed">
                    <Clock className="h-3.5 w-3.5" /> Request Sent
                  </button>
                ) : (
                  <button
                    onClick={() => setTargetTeam(t)}
                    className="w-full py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Handshake className="h-3.5 w-3.5" /> Request Collaboration
                  </button>
                )
              )}
            </div>
          );
        })}
        {otherTeams.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">No other teams found.</div>
        )}
      </div>

      {targetTeam && (
        <CollaborationRequestModal
          fromTeamId={id!}
          toTeam={targetTeam}
          onClose={() => setTargetTeam(null)}
          onSent={() => {
            setOutgoing((prev) => [...prev, { toTeamId: targetTeam.id, status: 'pending' }]);
            setTargetTeam(null);
          }}
        />
      )}
    </div>
  );
};

const CollaborationRequestModal: React.FC<{ fromTeamId: string; toTeam: any; onClose: () => void; onSent: () => void }> = ({ fromTeamId, toTeam, onClose, onSent }) => {
  const [projectName, setProjectName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await teamService.createCollaboration(fromTeamId, { toTeamId: toTeam.id, projectName, message });
      onSent();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send request.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Handshake className="h-4 w-4 text-primary" /> Collaborate with {toTeam.name}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Proposed Project Name</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Smart Campus x IoT Integration" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="What would you like to build together?" className={inputClass} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button disabled={sending} type="submit" className="w-full py-2.5 mt-1 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
            {sending ? 'Sending…' : 'Send Collaboration Request'}
          </button>
        </form>
      </div>
    </div>
  );
};
