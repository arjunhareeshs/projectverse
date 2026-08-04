import React, { useState, useEffect } from 'react';
import { GitCompareArrows, CheckCircle2, XCircle, ShieldAlert, AlertTriangle, Info, RefreshCw, Loader2, Zap } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import { SeverityBadge } from './components/SeverityBadge';

interface OverlapMember {
  id: string;
  projectId: string;
  teamId: string | null;
  project: {
    id: string;
    name: string;
    domain: string | null;
    team: {
      id: string;
      name: string;
    } | null;
  };
}

interface OverlapFlag {
  id: string;
  clusterHash: string;
  domain: string | null;
  severity: 'DISTINCT' | 'PARTIAL_OVERLAP' | 'SUBSTANTIAL_OVERLAP' | 'NEAR_DUPLICATE';
  similarityScore: number;
  confidence: number;
  overlappingFeatures: string[];
  sharedTechnologies: string[];
  keyDifferences: string[];
  rationale: string;
  recommendedAction: string;
  isFallback: boolean;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'DISMISSED' | 'SUPPRESSED';
  reviewNote: string | null;
  createdAt: string;
  members: OverlapMember[];
}

export const AdminOverlaps: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [flags, setFlags] = useState<OverlapFlag[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverlaps = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getOverlaps({ status: statusFilter, pageSize: 50 });
      setFlags(data.flags || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load overlap flags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverlaps();
  }, [statusFilter]);

  const handleUpdateStatus = async (flagId: string, newStatus: 'ACKNOWLEDGED' | 'DISMISSED') => {
    // Optimistic update
    setFlags((prev) =>
      prev.map((f) => (f.id === flagId ? { ...f, status: newStatus } : f))
    );

    try {
      await adminService.updateOverlapStatus(flagId, { status: newStatus });
    } catch {
      fetchOverlaps();
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
            <GitCompareArrows className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Overlap & Collision Intelligence</h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Automated cluster detection flags teams building identical or highly overlapping features.
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-extrabold">
            {['OPEN', 'ACKNOWLEDGED', 'DISMISSED', 'ALL'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === st ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={fetchOverlaps}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 transition-colors shadow-2xs"
            title="Refresh Overlap Flags"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-semibold text-slate-600">Analyzing project clusters and feature similarity...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-rose-50/50 rounded-2xl border border-rose-200 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
          <p className="text-sm text-rose-900 font-bold">{error}</p>
          <button onClick={fetchOverlaps} className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-2xs">
            Retry
          </button>
        </div>
      ) : flags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 bg-white rounded-2xl border border-slate-200/80 text-center">
          <Zap className="h-10 w-10 text-slate-300" />
          <h3 className="text-sm font-bold text-slate-800">No Overlap Flags Found</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            There are currently no {statusFilter.toLowerCase()} overlap flags detected across active projects.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {flags.map((flag) => {
            const pctSim = Math.round(flag.similarityScore * 100);

            return (
              <div
                key={flag.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs hover:shadow-md transition-all space-y-5"
              >
                {/* Header Strip */}
                <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <SeverityBadge severity={flag.severity} />
                    {flag.isFallback && (
                      <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Lexical Evidence Only
                      </span>
                    )}
                    <span className="text-xs font-semibold text-slate-400">
                      Domain: <strong className="text-slate-700">{flag.domain || 'General'}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Similarity</span>
                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pctSim >= 80 ? 'bg-rose-500' : pctSim >= 70 ? 'bg-amber-500' : 'bg-sky-500'
                        }`}
                        style={{ width: `${pctSim}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-black text-slate-800">{pctSim}%</span>
                  </div>
                </div>

                {/* Team Collision Strip */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 flex flex-wrap items-center justify-center gap-4">
                  {flag.members.map((m, idx) => (
                    <React.Fragment key={m.id}>
                      <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs">
                          T{idx + 1}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900">{m.project?.team?.name || 'Unassigned Team'}</h4>
                          <p className="text-[11px] font-semibold text-slate-500 truncate max-w-[200px]">
                            {m.project?.name || 'Project'}
                          </p>
                        </div>
                      </div>
                      {idx < flag.members.length - 1 && (
                        <div className="flex items-center justify-center text-slate-400">
                          <GitCompareArrows className="h-5 w-5 text-rose-500" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Overlapping Features */}
                {flag.overlappingFeatures.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block">
                      Specific Overlapping Features (Shared Deliverables)
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {flag.overlappingFeatures.map((feat, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-xl text-xs font-extrabold bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs"
                        >
                          ⚠️ {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Differences */}
                {flag.keyDifferences.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">
                      Key Differentiators & Unique Angles
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {flag.keyDifferences.map((diff, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                        >
                          ✓ {diff}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rationale & Recommended Action */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                    <span className="font-extrabold text-slate-700 block uppercase tracking-wider text-[10px]">
                      Auditor Rationale
                    </span>
                    <p className="text-slate-600 leading-relaxed font-medium">{flag.rationale}</p>
                  </div>
                  <div className="bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100 space-y-1">
                    <span className="font-extrabold text-indigo-900 block uppercase tracking-wider text-[10px]">
                      Recommended Action
                    </span>
                    <p className="text-indigo-950 leading-relaxed font-semibold">{flag.recommendedAction}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                {flag.status === 'OPEN' && (
                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleUpdateStatus(flag.id, 'DISMISSED')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
                    >
                      <XCircle className="h-4 w-4 text-slate-400" />
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(flag.id, 'ACKNOWLEDGED')}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all shadow-xs"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Acknowledge & Flag
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
