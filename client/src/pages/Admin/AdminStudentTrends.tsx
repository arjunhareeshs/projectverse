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

const AVATAR_BG_COLORS = [
  'bg-emerald-500', 'bg-indigo-500', 'bg-pink-500', 'bg-blue-500',
  'bg-red-500', 'bg-cyan-500', 'bg-violet-500', 'bg-orange-500'
];

function getDomainColor(domain: string) {
  return DOMAIN_COLORS[domain] || DOMAIN_COLORS['AI'];
}

// Fallback Mock Data for Students
const MOCK_DOMAIN_WISE = {
  AI: [
    { id: 's1', fullName: 'Chris P.', initials: 'CP', score: 100 },
    { id: 's2', fullName: 'Jake T.', initials: 'JT', score: 100 },
  ],
  Web: [
    { id: 's3', fullName: 'Noah G.', initials: 'NG', score: 97 },
    { id: 's4', fullName: 'Zara H.', initials: 'ZH', score: 80 },
  ],
  Mobile: [
    { id: 's5', fullName: 'June R.', initials: 'JR', score: 82 },
    { id: 's6', fullName: 'Tariq K.', initials: 'TK', score: 79 },
  ],
  IoT: [
    { id: 's7', fullName: 'Diya H.', initials: 'DH', score: 83 },
    { id: 's8', fullName: 'Kira W.', initials: 'KW', score: 94 },
  ],
  'Data Science': [
    { id: 's9', fullName: 'Mia K.', initials: 'MK', score: 96 },
    { id: 's10', fullName: 'Noah G.', initials: 'NG', score: 61 },
  ],
  Cybersecurity: [
    { id: 's11', fullName: 'Zara H.', initials: 'ZH', score: 79 },
    { id: 's12', fullName: 'Kai J.', initials: 'KJ', score: 58 },
  ],
  Cloud: [
    { id: 's13', fullName: 'Yusuf L.', initials: 'YL', score: 78 },
    { id: 's14', fullName: 'Sam N.', initials: 'SN', score: 77 },
  ],
  Blockchain: [
    { id: 's15', fullName: 'Ray E.', initials: 'RE', score: 80 },
    { id: 's16', fullName: 'Sana O.', initials: 'SO', score: 83 },
  ],
};

const MOCK_TOP10 = [
  { id: 's1', fullName: 'Chris P.', initials: 'CP', regNo: 'PV2404', domain: 'AI', team: { name: 'AI Pioneers' }, score: 99, progress: 100, skills: ['Python', 'PyTorch', 'NLP'] },
  { id: 's2', fullName: 'Jake T.', initials: 'JT', regNo: 'PV2401', domain: 'AI', team: { name: 'AI Pioneers' }, score: 91, progress: 100, skills: ['Python', 'PyTorch', 'NLP'] },
  { id: 's9', fullName: 'Mia K.', initials: 'MK', regNo: 'PV2402', domain: 'AI', team: { name: 'AI Pioneers' }, score: 90, progress: 99, skills: ['Python', 'PyTorch'] },
  { id: 's7', fullName: 'Diya H.', initials: 'DH', regNo: 'PV2433', domain: 'IoT', team: { name: 'IoT Pioneers' }, score: 85, progress: 83, skills: ['Arduino', 'Raspberry Pi', 'MQTT'] },
  { id: 's4', fullName: 'Zara H.', initials: 'ZH', regNo: 'PV2453', domain: 'Cybersecurity', team: { name: 'Cybersecurity Pioneers' }, score: 82, progress: 79, skills: ['Pentesting', 'Networks', 'Cryptography'] },
  { id: 's13', fullName: 'Yusuf L.', initials: 'YL', regNo: 'PV2468', domain: 'Cloud', team: { name: 'Cloud Pioneers' }, score: 82, progress: 78, skills: ['AWS', 'Docker', 'Kubernetes'] },
  { id: 's15', fullName: 'Ray E.', initials: 'RE', regNo: 'PV2478', domain: 'Blockchain', team: { name: 'Blockchain Pioneers' }, score: 82, progress: 80, skills: ['Solidity', 'Web3.js'] },
  { id: 's16', fullName: 'Sana O.', initials: 'SO', regNo: 'PV2479', domain: 'Blockchain', team: { name: 'Blockchain Pioneers' }, score: 82, progress: 83, skills: ['Solidity', 'Web3.js'] },
  { id: 's9_2', fullName: 'Mia K.', initials: 'MK', regNo: 'PV2442', domain: 'Data Science', team: { name: 'Data Pioneers' }, score: 81, progress: 96, skills: ['Pandas', 'SQL', 'Tableau'] },
  { id: 's17', fullName: 'Leo R.', initials: 'LR', regNo: 'PV2403', domain: 'AI', team: { name: 'AI Pioneers' }, score: 79, progress: 100, skills: ['Python', 'PyTorch', 'NLP'] },
];

const MOCK_TOP_PROJECTS = [
  { id: 's1', fullName: 'Chris P.', initials: 'CP', regNo: 'PV2404', domain: 'AI', projectName: 'MediScan AI', projectDesc: 'Early disease detection from chest X-rays using deep learning', progress: 100 },
  { id: 's3', fullName: 'Noah G.', initials: 'NG', regNo: 'PV2412', domain: 'Web', projectName: 'EduBridge', projectDesc: 'Low-bandwidth learning platform for rural classrooms', progress: 97 },
  { id: 's5', fullName: 'June R.', initials: 'JR', regNo: 'PV2423', domain: 'Mobile', projectName: 'SafeRoute', projectDesc: 'Personal safety navigation app with community alerts', progress: 82 },
  { id: 's7', fullName: 'Diya H.', initials: 'DH', regNo: 'PV2433', domain: 'IoT', projectName: 'AquaGuard', projectDesc: 'Smart water quality monitoring for public reservoirs', progress: 83 },
  { id: 's9_2', fullName: 'Mia K.', initials: 'MK', regNo: 'PV2442', domain: 'Data Science', projectName: 'TransitIQ', projectDesc: 'Predictive analytics for city bus demand and routing', progress: 96 },
  { id: 's4', fullName: 'Zara H.', initials: 'ZH', regNo: 'PV2453', domain: 'Cybersecurity', projectName: 'PhishNet', projectDesc: 'ML-powered phishing detection for regional-language emails', progress: 79 },
  { id: 's13', fullName: 'Yusuf L.', initials: 'YL', regNo: 'PV2468', domain: 'Cloud', projectName: 'ScaleLite', projectDesc: 'Auto-scaling cost optimizer for student startup workloads', progress: 78 },
  { id: 's15', fullName: 'Ray E.', initials: 'RE', regNo: 'PV2478', domain: 'Blockchain', projectName: 'AgriChain', projectDesc: 'Farm-to-fork supply chain provenance on blockchain', progress: 80 },
];

export const AdminStudentTrends: React.FC = () => {
  const [data, setData] = useState<any>({ domainWise: MOCK_DOMAIN_WISE, top10: MOCK_TOP10, topProjects: MOCK_TOP_PROJECTS });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getStudentTrends()
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
      <h1 className="text-xl font-bold text-gray-900">Student Trends</h1>

      {/* Domain-Wise Top Students */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-4">Domain-Wise Top Students</h2>
        <div className="grid grid-cols-4 gap-4">
          {domains.map(domain => {
            const students = data.domainWise[domain] || [];
            const colors = getDomainColor(domain);
            return (
              <div key={domain} className="rounded-xl border border-gray-100 p-4 space-y-3 hover:shadow-sm transition-shadow">
                {/* Domain badge */}
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                  {domain}
                </span>
                {/* Top 2 students */}
                {students.slice(0, 2).map((s: any, i: number) => {
                  const scoreVal = s.score ?? 50;
                  const pct = Math.min(100, scoreVal);
                  const avatarColor = AVATAR_BG_COLORS[i % AVATAR_BG_COLORS.length];
                  return (
                    <div key={s.id} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor}`}>
                          {s.initials || getInitials(s.fullName)}
                        </div>
                        <div className="flex-1 flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-800">{s.fullName}</span>
                          <span className="font-bold text-gray-700">{pct}%</span>
                        </div>
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

      {/* Top 10 Students */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-4">Top 10 Students</h2>
        <div className="space-y-0 divide-y divide-gray-50">
          {(data.top10 || MOCK_TOP10).map((student: any, i: number) => {
            const colors = getDomainColor(student.domain || '');
            const scoreVal = student.score ?? 50;
            const progressVal = student.progress ?? 50;
            const avatarColor = AVATAR_BG_COLORS[i % AVATAR_BG_COLORS.length];
            return (
              <div key={student.id} className="flex items-center gap-4 py-3.5">
                {/* Rank */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i < 3 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {i + 1}
                </div>

                {/* Avatar */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor}`}>
                  {student.initials || getInitials(student.fullName)}
                </div>

                {/* Student info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-gray-900">{student.fullName}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
                      <span className={`h-1 w-1 rounded-full ${colors.dot}`} />
                      {student.domain}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {student.regNo} • {student.team?.name || 'No Team'} • {student.skills?.join(', ') || 'No skills'}
                  </p>
                </div>

                {/* Points */}
                <div className="text-right shrink-0 w-16">
                  <span className="text-sm font-bold text-gray-800">{scoreVal} pts</span>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-2 shrink-0 w-32">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${progressVal}%`, backgroundColor: colors.bar }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 w-8">{progressVal}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Top Student Projects */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-4">Top Student Projects</h2>
        <div className="grid grid-cols-4 gap-4">
          {(data.topProjects || MOCK_TOP_PROJECTS).map((proj: any, idx: number) => {
            const colors = getDomainColor(proj.domain || '');
            const avatarColor = AVATAR_BG_COLORS[idx % AVATAR_BG_COLORS.length];
            return (
              <div key={proj.id} className="rounded-xl border border-gray-100 p-4 space-y-3.5 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor}`}>
                      {proj.initials || getInitials(proj.fullName)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">{proj.fullName}</h4>
                      <p className="text-[10px] text-gray-400">{proj.regNo}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
                    <span className={`h-1 w-1 rounded-full ${colors.dot}`} />
                    {proj.domain}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{proj.projectName}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{proj.projectDesc}</p>
                </div>
                <div className="space-y-1">
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${proj.progress}%`, backgroundColor: colors.bar }}
                    />
                  </div>
                  <div className="text-right text-[10px] font-bold text-gray-700">{proj.progress}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

function getInitials(name: string) {
  if (!name) return 'S';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}
