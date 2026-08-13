import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { proposalService, ProposalListItem, ProposalStatus } from '../services/proposal.service';

const POLL_INTERVAL_MS = 5000;

const statusBadge = (status: ProposalStatus) => {
  switch (status) {
    case 'PENDING':
      return { icon: RefreshCw, label: 'Analyzing', className: 'bg-indigo-100 text-indigo-700', spin: true };
    case 'ACCEPTED':
      return { icon: CheckCircle2, label: 'Accepted', className: 'bg-emerald-100 text-emerald-700', spin: false };
    case 'NEEDS_IMPROVEMENT':
      return { icon: AlertCircle, label: 'Needs improvement', className: 'bg-amber-100 text-amber-700', spin: false };
    case 'FAILED':
      return { icon: XCircle, label: 'Analysis failed', className: 'bg-slate-200 text-slate-700', spin: false };
    default:
      return { icon: XCircle, label: 'Not accepted', className: 'bg-rose-100 text-rose-700', spin: false };
  }
};

/**
 * Status list for every proposal the student has submitted. Analysis runs
 * detached on the server, so a proposal submitted and then navigated away from
 * still lands here with its final outcome. Numeric scoring is intentionally
 * never shown — the backend does not return it to students.
 */
export const MyProposals: React.FC = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await proposalService.getMyProposals();
        if (cancelled) return;
        setProposals(data);
        setError(null);
        // Keep refreshing only while something is still being analyzed.
        if (data.some((p) => p.status === 'PENDING')) {
          pollRef.current = window.setTimeout(load, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setError('Failed to load your proposals.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/projects/propose')}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-[#0F172A]">My Proposals</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Every proposal you've submitted and where it stands.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading proposals...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>
      )}

      {!loading && !error && proposals.length === 0 && (
        <div className="p-8 rounded-xl border border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
          You haven't submitted any proposals yet.
        </div>
      )}

      {!loading && proposals.length > 0 && (
        <div className="space-y-3">
          {proposals.map((p) => {
            const badge = statusBadge(p.status);
            const Icon = badge.icon;
            return (
              <div
                key={p.id}
                className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 truncate">{p.title}</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Submitted{' '}
                    {new Date(p.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.className}`}
                  >
                    <Icon className={`h-3 w-3 ${badge.spin ? 'animate-spin' : ''}`} />
                    {badge.label}
                  </span>

                  {p.canClaim && (
                    <button
                      onClick={() => navigate(`/projects/catalog?project=${p.publishedProjectId}`)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition"
                    >
                      Claim Project
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}

                  {p.status === 'ACCEPTED' && p.claimed && (
                    <span className="text-[11px] font-semibold text-slate-500">Claimed</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
