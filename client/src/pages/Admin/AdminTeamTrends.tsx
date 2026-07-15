import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/admin.service';

const DOMAIN_COLORS: Record<string, { bar: string; badge: string; dot: string; text: string }> = {
  AI:             { bar: '#6366f1', badge: 'bg-indigo-100 text-indigo-600', dot: 'bg-indigo-400', text: 'text-indigo-600' },
  Web:            { bar: '#ec4899', badge: 'bg-pink-100 text-pink-600',    dot: 'bg-pink-400',    text: 'text-pink-600' },
  Mobile:         { bar: '#f97316', badge: 'bg-orange-100 text-orange-600', dot: 'bg-orange-400', text: 'text-orange-600' },
  IoT:            { bar: '#10b981', badge: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-400', text: 'text-emerald-600' },
  'Data Science': { bar: '#3b82f6', badge: 'bg-blue-100 text-blue-600',   dot: 'bg-blue-400',    text: 'text-blue-600' },
  Cybersecurity:  { bar: '#ef4444', badge: 'bg-red-100 text-red-600',     dot: 'bg-red-400',     text: 'text-red-600' },
  Cloud:          { bar: '#06b6d4', badge: 'bg-cyan-100 text-cyan-600',   dot: 'bg-cyan-400',    text: 'text-cyan-600' },
  Blockchain:     { bar: '#8b5cf6', badge: 'bg-violet-100 text-violet-600', dot: 'bg-violet-400', text: 'text-violet-600' },
};

const STATUS_COLORS: Record<string, string> = {
  completed:   'text-green-600',
  'in-progress': 'text-indigo-600',
  planned:     'text-gray-400',
  'not-started': 'text-gray-400',
  'at-risk':   'text-orange-500',
  'on-track':  'text-green-600',
};

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-pink-500', 'bg-orange-500', 'bg-emerald-500',
  'bg-blue-500', 'bg-red-500', 'bg-cyan-500', 'bg-violet-500',
  'bg-yellow-500', 'bg-teal-500',
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function getDomainColor(domain: string) {
  return DOMAIN_COLORS[domain] || DOMAIN_COLORS['AI'];
}

function StatusDot({ status }: { status: string }) {
  const label = status === 'completed' ? 'Completed'
    : status === 'in-progress' || status === 'on-track' ? 'On Track'
    : status === 'at-risk' ? 'At Risk'
    : status === 'planned' ? 'On Track'
    : 'Not Started';

  const colorClass = label === 'Completed' ? 'text-green-600' : label === 'On Track' ? 'text-green-600' : label === 'At Risk' ? 'text-orange-500' : 'text-gray-400';
  const dotClass = label === 'Completed' ? 'bg-green-500' : label === 'On Track' ? 'bg-green-500' : label === 'At Risk' ? 'bg-orange-400' : 'bg-gray-300';

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

// Fallback mock data that matches screenshots
const MOCK_DOMAIN_WISE: Record<string, any[]> = {
  AI: [
    { id: '1', name: 'AI Pioneers', ranking: { totalPoints: 970 } },
    { id: '2', name: 'AI Nexus', ranking: { totalPoints: 410 } },
  ],
  Web: [
    { id: '3', name: 'Web Pioneers', ranking: { totalPoints: 840 } },
    { id: '4', name: 'Web Nexus', ranking: { totalPoints: 590 } },
  ],
  Mobile: [
    { id: '5', name: 'Mobile Pioneers', ranking: { totalPoints: 730 } },
    { id: '6', name: 'Mobile Nexus', ranking: { totalPoints: 520 } },
  ],
  IoT: [
    { id: '7', name: 'IoT Pioneers', ranking: { totalPoints: 800 } },
    { id: '8', name: 'IoT Nexus', ranking: { totalPoints: 600 } },
  ],
  'Data Science': [
    { id: '9', name: 'Data Pioneers', ranking: { totalPoints: 910 } },
    { id: '10', name: 'Data Forge', ranking: { totalPoints: 490 } },
  ],
  Cybersecurity: [
    { id: '11', name: 'Cybersecurity Pioneers', ranking: { totalPoints: 730 } },
    { id: '12', name: 'Cybersecurity Nexus', ranking: { totalPoints: 490 } },
  ],
  Cloud: [
    { id: '13', name: 'Cloud Pioneers', ranking: { totalPoints: 820 } },
    { id: '14', name: 'Cloud Nexus', ranking: { totalPoints: 470 } },
  ],
  Blockchain: [
    { id: '15', name: 'Blockchain Pioneers', ranking: { totalPoints: 930 } },
    { id: '16', name: 'Blockchain Nexus', ranking: { totalPoints: 560 } },
  ],
};

const MOCK_TOP10 = [
  { id: '1', name: 'AI Pioneers', domain: 'AI', projects: [{ name: 'MediScan AI', description: 'Early disease detection from chest X-rays using deep learning', status: 'completed' }], members: [{fullName:'J'},{fullName:'M'},{fullName:'L'},{fullName:'C'}], ranking: { totalPoints: 940, rank: 1 } },
  { id: '9', name: 'Data Pioneers', domain: 'Data Science', projects: [{ name: 'TransitIQ', description: 'Predictive analytics for city bus demand and routing', status: 'planned' }], members: [{fullName:'M'},{fullName:'L'},{fullName:'C'},{fullName:'A'}], ranking: { totalPoints: 830, rank: 2 } },
  { id: '15', name: 'Blockchain Pioneers', domain: 'Blockchain', projects: [{ name: 'AgriChain', description: 'Farm-to-fork supply chain provenance on blockchain', status: 'in-progress' }], members: [{fullName:'A'},{fullName:'F'},{fullName:'R'},{fullName:'S'}], ranking: { totalPoints: 830, rank: 3 } },
  { id: '5', name: 'Mobile Pioneers', domain: 'Mobile', projects: [{ name: 'SafeRoute', description: 'Personal safety navigation app with community alerts', status: 'in-progress' }], members: [{fullName:'T'},{fullName:'J'},{fullName:'V'},{fullName:'R'}], ranking: { totalPoints: 780, rank: 4 } },
  { id: '11', name: 'Cybersecurity Pioneers', domain: 'Cybersecurity', projects: [{ name: 'PhishNet', description: 'ML-powered phishing detection for regional-language emails', status: 'in-progress' }], members: [{fullName:'Z'},{fullName:'K'},{fullName:'I'},{fullName:'D'}], ranking: { totalPoints: 760, rank: 5 } },
  { id: '3', name: 'Web Pioneers', domain: 'Web', projects: [{ name: 'EduBridge', description: 'Low-bandwidth learning platform for rural classrooms', status: 'in-progress' }], members: [{fullName:'N'},{fullName:'Z'},{fullName:'K'}], ranking: { totalPoints: 740, rank: 6 } },
  { id: '7', name: 'IoT Pioneers', domain: 'IoT', projects: [{ name: 'AquaGuard', description: 'Smart water quality monitoring for public reservoirs', status: 'planned' }], members: [{fullName:'B'},{fullName:'D'},{fullName:'M'},{fullName:'K'}], ranking: { totalPoints: 730, rank: 7 } },
  { id: '13', name: 'Cloud Pioneers', domain: 'Cloud', projects: [{ name: 'ScaleLite', description: 'Auto-scaling cost optimizer for student startup workloads', status: 'planned' }], members: [{fullName:'R'},{fullName:'S'},{fullName:'T'},{fullName:'Y'}], ranking: { totalPoints: 680, rank: 8 } },
  { id: '4', name: 'Web Nexus', domain: 'Web', projects: [{ name: 'LocalLoop', description: 'Hyperlocal marketplace connecting neighborhood vendors', status: 'at-risk' }], members: [{fullName:'I'},{fullName:'O'},{fullName:'M'}], ranking: { totalPoints: 650, rank: 9 } },
  { id: '16', name: 'Blockchain Nexus', domain: 'Blockchain', projects: [{ name: 'CertiFy', description: 'Tamper-proof academic credential verification network', status: 'in-progress' }], members: [{fullName:'S'},{fullName:'J'},{fullName:'M'}], ranking: { totalPoints: 650, rank: 10 } },
];

const MOCK_UNIQUE_PROJECTS = [
  { id: '1', name: 'MediScan AI', description: 'Early disease detection from chest X-rays using deep learning', status: 'completed', team: { name: 'AI Pioneers', domain: 'AI' }, progress: 100 },
  { id: '2', name: 'EduBridge', description: 'Low-bandwidth learning platform for rural classrooms', status: 'in-progress', team: { name: 'Web Pioneers', domain: 'Web' }, progress: 84 },
  { id: '3', name: 'SafeRoute', description: 'Personal safety navigation app with community alerts', status: 'in-progress', team: { name: 'Mobile Pioneers', domain: 'Mobile' }, progress: 73 },
  { id: '4', name: 'AquaGuard', description: 'Smart water quality monitoring for public reservoirs', status: 'planned', team: { name: 'IoT Pioneers', domain: 'IoT' }, progress: 80 },
  { id: '5', name: 'TransitIQ', description: 'Predictive analytics for city bus demand and routing', status: 'planned', team: { name: 'Data Pioneers', domain: 'Data Science' }, progress: 91 },
  { id: '6', name: 'PhishNet', description: 'ML-powered phishing detection for regional-language emails', status: 'in-progress', team: { name: 'Cybersecurity Pioneers', domain: 'Cybersecurity' }, progress: 73 },
  { id: '7', name: 'ScaleLite', description: 'Auto-scaling cost optimizer for student startup workloads', status: 'planned', team: { name: 'Cloud Pioneers', domain: 'Cloud' }, progress: 82 },
  { id: '8', name: 'AgriChain', description: 'Farm-to-fork supply chain provenance on blockchain', status: 'in-progress', team: { name: 'Blockchain Pioneers', domain: 'Blockchain' }, progress: 93 },
];

export const AdminTeamTrends: React.FC = () => {
  const [data, setData] = useState<any>({ domainWise: MOCK_DOMAIN_WISE, top10: MOCK_TOP10, uniqueProjects: MOCK_UNIQUE_PROJECTS });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getTeamTrends()
      .then(d => {
        if (d && Object.keys(d.domainWise || {}).length > 0) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const domains = Object.keys(data.domainWise || MOCK_DOMAIN_WISE);

  return (
    <div className="min-h-screen bg-[#f7f8fa] p-6 space-y-6">
      {/* Page Title */}
      <h1 className="text-xl font-bold text-gray-900">Team Trends</h1>

      {/* Domain-Wise Top Teams */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-4">Domain-Wise Top Teams</h2>
        <div className="grid grid-cols-4 gap-4">
          {domains.map(domain => {
            const teams = data.domainWise[domain];
            const colors = getDomainColor(domain);
            return (
              <div key={domain} className="rounded-xl border border-gray-100 p-4 space-y-3 hover:shadow-sm transition-shadow">
                {/* Domain badge */}
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                  {domain}
                </span>
                {/* Top 2 teams */}
                {teams.slice(0, 2).map((team: any, i: number) => {
                  const pts = team.ranking?.totalPoints ?? 0;
                  const pct = Math.min(100, Math.round(pts / 10));
                  return (
                    <div key={team.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-800">
                          <span className="text-gray-400 mr-1">#{i + 1}</span>
                          {team.name}
                        </span>
                        <span className="text-xs font-bold text-gray-700">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: colors.bar }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      {/* Top 10 Teams */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-4">Top 10 Teams</h2>
        <div className="space-y-0 divide-y divide-gray-50">
          {(data.top10 || MOCK_TOP10).map((team: any, i: number) => {
            const colors = getDomainColor(team.domain || '');
            const pts = team.ranking?.totalPoints ?? 0;
            const pct = Math.min(100, Math.round(pts / 10));
            const project = team.projects?.[0];
            return (
              <div key={team.id} className="flex items-center gap-4 py-3.5">
                {/* Rank */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i < 3 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {i + 1}
                </div>

                {/* Team info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-gray-900">{team.name}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
                      <span className={`h-1 w-1 rounded-full ${colors.dot}`} />
                      {team.domain}
                    </span>
                  </div>
                  {project && (
                    <p className="text-xs text-gray-400 truncate">
                      {project.name} — {project.description}
                    </p>
                  )}
                </div>

                {/* Members */}
                <div className="hidden sm:flex items-center -space-x-2 shrink-0">
                  {(team.members || []).slice(0, 4).map((m: any, mi: number) => (
                    <div
                      key={mi}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white ${AVATAR_COLORS[mi % AVATAR_COLORS.length]}`}
                    >
                      {getInitials(m.fullName || '?')}
                    </div>
                  ))}
                </div>

                {/* Points */}
                <div className="text-right shrink-0 w-16">
                  <span className="text-sm font-bold text-gray-800">{Math.round(pts / 10)} pts</span>
                </div>

                {/* Progress bar */}
                <div className="hidden sm:flex items-center gap-2 shrink-0 w-32">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: colors.bar }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 w-8">{pct}%</span>
                </div>

                {/* Status */}
                <div className="shrink-0 w-20 text-right">
                  <StatusDot status={project?.status || 'planned'} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Unique Team Projects */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-4">Unique Team Projects</h2>
        <div className="grid grid-cols-4 gap-4">
          {(data.uniqueProjects || MOCK_UNIQUE_PROJECTS).map((proj: any) => {
            const colors = getDomainColor(proj.team?.domain || '');
            return (
              <div key={proj.id} className="rounded-xl border border-gray-100 p-4 space-y-2.5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <svg className="h-5 w-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
                    <span className={`h-1 w-1 rounded-full ${colors.dot}`} />
                    {proj.team?.domain}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{proj.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{proj.description}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{proj.team?.name}</span>
                  <StatusDot status={proj.status} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
