import React from 'react';
import { useAppSelector } from '../../app/hooks';
import { Award, BookOpen, GraduationCap, Star, Shield, HelpCircle, Layers, CheckCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

export const StudentDashboardProfile: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);

  if (!user || user.role !== 'STUDENT' || !user.department) {
    return null;
  }

  const primarySkills = (user.userSkills || []).filter((s: any) => s.skillType === 'primary');
  const secondarySkills = (user.userSkills || []).filter((s: any) => s.skillType === 'secondary');
  const specSkills = (user.userSkills || []).filter((s: any) => s.skillType === 'specialization');

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* Decorative gradient blur background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0">
            {user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">{user.fullName}</h2>
              <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                Student Profile
              </span>
              {user.year && (
                <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-full bg-secondary/10 text-secondary uppercase tracking-wider">
                  Year {user.year}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{user.department}</span>
              {user.regNo && <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[10px] text-foreground">Reg No: {user.regNo}</span>}
            </p>
          </div>
        </div>

        {/* Highlight Stats (AP & Rank) */}
        <div className="flex items-center gap-6 shrink-0 bg-muted/30 px-4 py-2.5 rounded-xl border border-border/40">
          <div className="text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Activity Points (AP)</span>
            <span className="text-lg font-bold text-foreground">{user.rewardPoints || 0}</span>
          </div>
          <div className="h-8 w-px bg-border/80" />
          <div className="text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Technical Rank</span>
            <span className="text-lg font-bold text-primary">
              {user.activityPoints ? `#${user.activityPoints}` : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Profile Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-5 border-b border-border/60 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Learning Mode</span>
          <p className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
            <BookOpen className="h-3.5 w-3.5 text-secondary shrink-0" />
            <span>{user.learningMode || 'N/A'}</span>
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">SSG Specialization</span>
          <p className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
            <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>{user.ssgEnrolled ? `${user.ssgDomain || 'SSG Enrolled'}` : 'Not Enrolled'}</span>
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Residency & Cluster</span>
          <p className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
            <Shield className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>
              {user.resident === 'H' ? 'Hosteller' : 'Day scholar'} ({user.cluster || 'N/A'})
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Team / Group Info</span>
          <p className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
            <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>
              {user.team ? `${user.team.name} (${user.team.groupLevel || 'Level N/A'})` : 'No Team Assigned'}
            </span>
          </p>
        </div>
      </div>

      {/* Team Ranking Row */}
      {user.team?.ranking && (
        <div className="py-2.5 px-4 mt-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10 flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500" />
            <span className="text-muted-foreground font-medium">Team Leaderboard Standing ({user.team.groupCode})</span>
          </div>
          <span className="font-bold text-indigo-600">Rank #{user.team.ranking.rank} ({user.team.ranking.totalPoints} total points)</span>
        </div>
      )}

      {/* Skills Roster Section */}
      <div className="mt-5">
        <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-3">Skills Roster (Real-time DB)</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Primary */}
          <div>
            <span className="text-[9px] uppercase font-semibold text-primary tracking-widest block mb-2">Primary Skills</span>
            <div className="space-y-2">
              {primarySkills.map((s: any) => (
                <div key={s.skillName} className="bg-primary/5 border border-primary/10 rounded-xl p-2.5 flex flex-col gap-1 transition-colors hover:bg-primary/10">
                  <span className="text-xs font-semibold text-foreground">{s.skillName}</span>
                  <div className="flex justify-between items-center text-[9px] text-muted-foreground mt-0.5">
                    {s.skillRank ? <span>Rank #{s.skillRank} / {s.totalRanks || 3221}</span> : <span>Unranked</span>}
                    {s.totalPoints > 0 && <span className="font-bold text-primary">{s.totalPoints} RP</span>}
                  </div>
                </div>
              ))}
              {primarySkills.length === 0 && <p className="text-xs text-muted-foreground italic">None</p>}
            </div>
          </div>

          {/* Secondary */}
          <div>
            <span className="text-[9px] uppercase font-semibold text-emerald-600 tracking-widest block mb-2">Secondary Skills</span>
            <div className="space-y-2">
              {secondarySkills.map((s: any) => (
                <div key={s.skillName} className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5 flex flex-col gap-1 transition-colors hover:bg-emerald-500/10">
                  <span className="text-xs font-semibold text-foreground">{s.skillName}</span>
                  <div className="flex justify-between items-center text-[9px] text-muted-foreground mt-0.5">
                    {s.skillRank ? <span>Rank #{s.skillRank} / {s.totalRanks || 3221}</span> : <span>Unranked</span>}
                    {s.totalPoints > 0 && <span className="font-bold text-emerald-600">{s.totalPoints} RP</span>}
                  </div>
                </div>
              ))}
              {secondarySkills.length === 0 && <p className="text-xs text-muted-foreground italic">None</p>}
            </div>
          </div>

          {/* Specialization */}
          <div>
            <span className="text-[9px] uppercase font-semibold text-amber-600 tracking-widest block mb-2">Specialization</span>
            <div className="space-y-2">
              {specSkills.map((s: any) => (
                <div key={s.skillName} className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-2.5 flex flex-col gap-1 transition-colors hover:bg-amber-500/10">
                  <span className="text-xs font-semibold text-foreground">{s.skillName}</span>
                  <div className="flex justify-between items-center text-[9px] text-muted-foreground mt-0.5">
                    {s.skillRank ? <span>Rank #{s.skillRank} / {s.totalRanks || 3221}</span> : <span>Unranked</span>}
                    {s.totalPoints > 0 && <span className="font-bold text-amber-600">{s.totalPoints} RP</span>}
                  </div>
                </div>
              ))}
              {specSkills.length === 0 && <p className="text-xs text-muted-foreground italic">None</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
