import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import {
  proposalService,
  proposalToEvaluationResult,
  ProposalListItem,
  PersistedProposal,
} from '../services/proposal.service';
import { AiEvaluationPanel } from '../components/projects/AiEvaluationPanel';

const verdictBadge = (verdict: ProposalListItem['verdict']) => {
  switch (verdict) {
    case 'ACCEPTED':
      return { icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' };
    case 'NEEDS_IMPROVEMENT':
      return { icon: AlertCircle, className: 'bg-amber-100 text-amber-700' };
    default:
      return { icon: XCircle, className: 'bg-rose-100 text-rose-700' };
  }
};

/**
 * Lets a student "watch" the AI's reasoning behind every proposal they've
 * submitted — the rubric/perspective scores, duplicate check, and reasons
 * persisted by proposeProblemStatement, fetched back via GET /proposals/*
 * instead of only being visible for the lifetime of the original response.
 */
export const MyProposals: React.FC = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<PersistedProposal | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    proposalService
      .getMyProposals()
      .then((data) => {
        setProposals(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => setError('Failed to load your proposals.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    proposalService
      .getProposal(selectedId)
      .then(setSelected)
      .catch(() => setError('Failed to load this proposal.'))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
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
            Every proposal you've submitted, with the AI's full scoring and reasoning.
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
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <div className="space-y-2">
            {proposals.map((p) => {
              const badge = verdictBadge(p.verdict);
              const Icon = badge.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                    selectedId === p.id
                      ? 'border-indigo-300 bg-indigo-50/60'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}>
                      <Icon className="h-3 w-3" />
                      {p.verdict.replace('_', ' ')}
                    </span>
                    {p.scores?.overallScore !== undefined && (
                      <span className="text-xs font-bold text-slate-700">{p.scores.overallScore}/100</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    {new Date(p.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </button>
              );
            })}
          </div>

          <div>
            {detailLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-12 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading evaluation...
              </div>
            )}
            {!detailLoading && selected && <AiEvaluationPanel evaluation={proposalToEvaluationResult(selected)} />}
          </div>
        </div>
      )}
    </div>
  );
};
