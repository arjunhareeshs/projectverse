import React, { useState, useEffect } from 'react';
import {
  Rocket,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Activity,
  CheckCircle2,
  TrendingUp,
  Shield,
  Target,
  BarChart3,
} from 'lucide-react';
import { adminService } from '../../services/admin.service';

interface StandoutProject {
  id: string;
  projectId: string;
  projectName?: string;
  teamName?: string;
  domain?: string;
  verdict: 'PROMISING' | 'STARTUP_WORTHY';
  confidence: number;
  evidenceScore: number;
  cyclesEvaluated: number;
  avgScore: number;
  minScore: number;
  trendDelta: number;
  oneLinePitch?: string;
  marketProblem?: string;
  differentiator?: string;
  defensibility?: string;
  targetMarket?: string;
  evidenceHighlights: string[];
  risks: string[];
  nextSteps: string[];
  isFallback: boolean;
  status: 'OPEN' | 'ACKNOWLEDGED';
  scoreHistory?: { cycle: number; score: number }[];
  createdAt: string;
}

const VERDICT_STYLES = {
  STARTUP_WORTHY: {
    gradient: 'from-amber-500 to-yellow-500',
    bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
    border: 'border-amber-200',
    badge: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white',
    label: '🚀 Startup Worthy',
  },
  PROMISING: {
    gradient: 'from-indigo-400 to-violet-500',
    bg: 'bg-gradient-to-br from-indigo-50 to-violet-50',
    border: 'border-indigo-200',
    badge: 'bg-gradient-to-r from-indigo-400 to-violet-500 text-white',
    label: '⭐ Promising',
  },
};

function EvidenceScoreRing({ score }: { score: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 80 ? '#f59e0b' : score >= 60 ? '#6366f1' : '#94a3b8';
  return (
    <div className="flex flex-col items-center">
      <svg width="72" height="72" className="rotate-[-90deg]">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
        />
        <text
          x="36" y="41"
          textAnchor="middle"
          style={{
            fill: color,
            fontSize: '14px',
            fontWeight: 800,
            transform: 'rotate(90deg)',
            transformOrigin: '36px 36px',
          }}
        >
          {Math.round(score)}
        </text>
      </svg>
      <span className="text-[10px] text-slate-500 font-medium mt-1">Evidence</span>
    </div>
  );
}

function MiniSparkline({ data }: { data: { cycle: number; score: number }[] }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data.map(d => d.score)) - 5;
  const max = Math.max(...data.map(d => d.score)) + 5;
  const w = 180; const h = 40;
  const xStep = w / (data.length - 1);
  const yScale = (v: number) => h - ((v - min) / (max - min)) * h;

  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${i * xStep} ${yScale(d.score)}`)
    .join(' ');

  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={path} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={i * xStep} cy={yScale(d.score)} r="3" fill="#6366f1" />
      ))}
    </svg>
  );
}

function StandoutCard({ project, onAcknowledge }: { project: StandoutProject; onAcknowledge: (id: string) => void }) {
  const style = VERDICT_STYLES[project.verdict] || VERDICT_STYLES.PROMISING;
  const [acting, setActing] = useState(false);

  const act = async () => {
    setActing(true);
    await onAcknowledge(project.id);
    setActing(false);
  };

  return (
    <div className={`rounded-3xl border-2 overflow-hidden ${style.bg} ${style.border} shadow-lg`}>
      {/* Top banner */}
      <div className={`bg-gradient-to-r ${style.gradient} px-6 py-3 flex items-center justify-between`}>
        <span className="text-white font-bold text-sm tracking-wide">{style.label}</span>
        <span className="text-white/80 text-xs">{new Date(project.createdAt).toLocaleDateString()}</span>
      </div>

      <div className="p-6">
        {/* Title row */}
        <div className="flex items-start gap-5 mb-6">
          <EvidenceScoreRing score={project.evidenceScore} />

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 leading-snug">
              {project.projectName || 'Unnamed Project'}
            </h2>
            {project.teamName && (
              <p className="text-sm text-slate-500 font-medium mt-0.5">{project.teamName}</p>
            )}
            {project.oneLinePitch && (
              <p className="mt-2 text-sm text-slate-700 leading-relaxed italic">
                "{project.oneLinePitch}"
              </p>
            )}

            {/* Gate stats strip */}
            <div className="flex flex-wrap gap-4 mt-3">
              <Stat icon={<BarChart3 className="h-3.5 w-3.5 text-violet-500" />} label="Avg Score" value={`${Math.round(project.avgScore)}/100`} />
              <Stat icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500" />} label="Trend" value={`${project.trendDelta >= 0 ? '+' : ''}${project.trendDelta.toFixed(1)}`} />
              <Stat icon={<Shield className="h-3.5 w-3.5 text-blue-500" />} label="Cycles" value={`${project.cyclesEvaluated}`} />
              <Stat icon={<Target className="h-3.5 w-3.5 text-amber-500" />} label="Min Score" value={`${Math.round(project.minScore)}`} />
            </div>
          </div>

          {/* Score history sparkline */}
          {project.scoreHistory && project.scoreHistory.length >= 2 && (
            <div className="hidden sm:block shrink-0">
              <p className="text-[10px] text-slate-400 font-medium mb-1 text-center">Score trajectory</p>
              <MiniSparkline data={project.scoreHistory} />
            </div>
          )}
        </div>

        {/* 3-column market breakdown */}
        {(project.marketProblem || project.differentiator || project.defensibility) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {project.marketProblem && (
              <InfoBox label="Market Problem" text={project.marketProblem} />
            )}
            {project.differentiator && (
              <InfoBox label="Differentiator" text={project.differentiator} />
            )}
            {project.defensibility && (
              <InfoBox label="Defensibility" text={project.defensibility} />
            )}
          </div>
        )}

        {/* Evidence highlights */}
        {project.evidenceHighlights.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Why This Cleared the Gate</p>
            <ul className="space-y-1.5">
              {project.evidenceHighlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risks & next steps */}
        {(project.risks.length > 0 || project.nextSteps.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {project.risks.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Risks</p>
                <ul className="space-y-1">
                  {project.risks.map((r, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {project.nextSteps.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Next Steps</p>
                <ul className="space-y-1">
                  {project.nextSteps.map((s, i) => (
                    <li key={i} className="text-xs text-slate-600">→ {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Acknowledge */}
        {project.status === 'OPEN' && (
          <button
            onClick={act}
            disabled={acting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Acknowledge
          </button>
        )}
        {project.status !== 'OPEN' && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledged
          </span>
        )}

        {project.isFallback && (
          <p className="text-[10px] text-slate-400 mt-2">* Evaluated without LLM adjudication (lexical gate only)</p>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[11px] text-slate-500 font-medium">{label}:</span>
      <span className="text-[11px] font-bold text-slate-800">{value}</span>
    </div>
  );
}

function InfoBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="p-3 rounded-xl bg-white border border-slate-200">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xs text-slate-700 leading-relaxed">{text}</p>
    </div>
  );
}

export const AdminStandouts: React.FC = () => {
  const [projects, setProjects] = useState<StandoutProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<string>('all');

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminService.getStandoutProjects({ status: 'OPEN' });
      setProjects(res);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load standout projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAcknowledge = async (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'ACKNOWLEDGED' as const } : p));
    try {
      await adminService.updateStandoutProject(id, { status: 'ACKNOWLEDGED' });
    } catch {
      load();
    }
  };

  const displayProjects = verdictFilter === 'all'
    ? projects
    : projects.filter(p => p.verdict === verdictFilter.toUpperCase());

  // Startup worthy first
  const sorted = [...displayProjects].sort((a, b) =>
    a.verdict === 'STARTUP_WORTHY' && b.verdict !== 'STARTUP_WORTHY' ? -1 : 1
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-100 text-amber-600">
            <Rocket className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Standout Projects</h1>
            <p className="text-sm text-slate-500 mt-0.5">Projects with sustained excellence across multiple evaluation cycles</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {['all', 'startup_worthy', 'promising'].map(v => (
              <button
                key={v}
                onClick={() => setVerdictFilter(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  verdictFilter === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {v === 'all' ? 'All' : v === 'startup_worthy' ? '🚀 Startup' : '⭐ Promising'}
              </button>
            ))}
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">Loading standout analysis…</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertTriangle className="h-10 w-10 text-rose-400" />
          <p className="text-sm text-slate-600 font-medium">{error}</p>
          <button onClick={load} className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <Activity className="h-10 w-10" />
          <p className="text-sm font-medium">No standout projects yet</p>
          <p className="text-xs text-slate-400 text-center max-w-xs">
            Projects must complete ≥3 evaluation cycles with consistent high scores before appearing here
          </p>
        </div>
      )}

      {!loading && !error && sorted.length > 0 && (
        <div className="space-y-6">
          {sorted.map(project => (
            <StandoutCard key={project.id} project={project} onAcknowledge={handleAcknowledge} />
          ))}
        </div>
      )}
    </div>
  );
};
