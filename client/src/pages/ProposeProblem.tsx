import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  MessageSquare,
  Code,
  Lightbulb,
  FileText,
  Users,
  Star,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Info,
  FileEdit,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  proposalService,
  PersistedProposal,
  MIN_PROPOSAL_LENGTH,
  MAX_PROPOSAL_LENGTH,
} from '../services/proposal.service';

const POLL_INTERVAL_MS = 3000;

export const ProposeProblem: React.FC = () => {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  /* Set once the proposal is accepted by the server; from then on the page
     only reflects server state, polled until analysis finishes. */
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<PersistedProposal | null>(null);
  const pollRef = useRef<number | null>(null);

  const criteriaList = [
    {
      icon: Target,
      color: 'bg-[#E0F2FE] text-[#0284C7]',
      title: 'Problem Relevance',
      desc: 'Is it solving a real and important problem?',
    },
    {
      icon: MessageSquare,
      color: 'bg-[#DCFCE7] text-[#16A34A]',
      title: 'Problem Clarity',
      desc: 'Is the problem well-defined and understandable?',
    },
    {
      icon: Code,
      color: 'bg-[#F3E8FF] text-[#9333EA]',
      title: 'Technical Feasibility',
      desc: 'Can it be realistically implemented?',
    },
    {
      icon: Lightbulb,
      color: 'bg-[#FEF3C7] text-[#D97706]',
      title: 'Innovation',
      desc: 'How novel and unique is the proposed idea?',
    },
    {
      icon: Target,
      color: 'bg-[#E0F2FE] text-[#0284C7]',
      title: 'Expected Outcome',
      desc: 'Is the outcome clearly defined and valuable?',
    },
    {
      icon: FileText,
      color: 'bg-[#EEF2FF] text-[#4F46E5]',
      title: 'Feature Completeness',
      desc: 'Are the proposed features sufficient?',
    },
    {
      icon: Users,
      color: 'bg-[#FFE4E6] text-[#E11D48]',
      title: 'Industry & Social Impact',
      desc: 'Will it benefit industry or society?',
    },
    {
      icon: Star,
      color: 'bg-[#FFEDD5] text-[#EA580C]',
      title: 'Overall Recommendation',
      desc: 'Accept, Improve, or Reject',
    },
  ];

  const chipTemplates = [
    { label: 'Project Overview', snippet: '\n\n### Project Overview\n' },
    { label: 'Problem Statement', snippet: '\n\n### Problem Statement\n' },
    { label: 'Key Features', snippet: '\n\n### Key Features\n- ' },
    { label: 'Expected Outcome', snippet: '\n\n### Expected Outcome\n' },
    { label: 'Target Users', snippet: '\n\n### Target Users\n' },
  ];

  const handleInsertChip = (snippet: string) => {
    if (description.includes(snippet.trim())) return;
    setDescription((prev) => (prev ? prev + snippet : snippet.trimStart()));
  };

  /* Poll while the server-side analysis is still running. The analysis itself
     is detached from this page — leaving and coming back to My Proposals shows
     the same outcome. */
  useEffect(() => {
    if (!proposalId) return;
    if (proposal && proposal.status !== 'PENDING') return;

    let cancelled = false;

    const tick = async () => {
      try {
        const latest = await proposalService.getProposal(proposalId);
        if (cancelled) return;
        setProposal(latest);
        if (latest.status === 'PENDING') {
          pollRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch {
        if (cancelled) return;
        // Transient failure — keep polling rather than dropping the student on
        // an error screen for an analysis that is still running.
        pollRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [proposalId, proposal?.status]);

  const handleSubmit = async () => {
    const trimmed = description.trim();
    if (trimmed.length < MIN_PROPOSAL_LENGTH) {
      setError(`Please provide a detailed description of at least ${MIN_PROPOSAL_LENGTH} characters.`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const { proposalId: newId } = await proposalService.submitProposal(trimmed);
      setProposalId(newId);
    } catch (err: any) {
      console.error('Error submitting proposal:', err);
      setError(err.response?.data?.message || 'Failed to submit proposal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaim = () => {
    if (!proposal?.publishedProjectId) return;
    navigate(`/projects/catalog?project=${proposal.publishedProjectId}`);
  };

  const status = proposal?.status ?? (proposalId ? 'PENDING' : null);

  return (
    <div className="min-h-screen bg-[#FAFAFC] p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] border border-indigo-100 text-[#4F46E5] flex items-center justify-center shrink-0">
            <FileEdit className="h-5 w-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
            Propose New Problem Statement
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/projects/proposals')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-xs font-bold text-slate-600 hover:bg-gray-50 transition shadow-2xs"
          >
            My Proposals
          </button>
          <button
            onClick={() => setShowHowItWorks(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-xs font-bold text-[#4F46E5] hover:bg-gray-50 transition shadow-2xs"
          >
            <Info className="h-4 w-4 text-[#4F46E5]" />
            How it works?
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Criteria (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-2xs">
            <h2 className="text-lg font-extrabold text-[#0F172A]">AI Evaluation Criteria</h2>
            <p className="text-xs text-[#64748B] mt-1 mb-6">
              Your submission will be evaluated on the following aspects.
            </p>

            <div className="space-y-4">
              {criteriaList.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-start gap-3.5">
                    <div className={`p-2.5 rounded-xl shrink-0 ${item.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#0F172A]">{item.title}</h4>
                      <p className="text-[11px] text-[#64748B] leading-snug">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Input or Outcome (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {!status ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-2xs flex flex-col gap-5">
              <div>
                <h2 className="text-xl font-extrabold text-[#0F172A]">Describe Your Project</h2>
                <p className="text-xs text-[#64748B] mt-1">
                  You can submit this proposal once — review it carefully before submitting.
                </p>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-semibold">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 p-4 bg-white focus-within:ring-2 focus-within:ring-[#4F46E5]/20 focus-within:border-[#4F46E5] transition">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, MAX_PROPOSAL_LENGTH))}
                  placeholder="Enter your project overview, problem statement, features, expected outcome, target users, technology ideas, and any other relevant details..."
                  className="w-full h-72 text-xs text-slate-800 placeholder:text-gray-400 outline-none resize-none bg-transparent"
                />
                <div className="text-xs text-gray-400 font-semibold text-right pt-2">
                  {description.length} / {MAX_PROPOSAL_LENGTH}
                </div>
              </div>

              {/* What to include chips */}
              <div>
                <span className="text-xs font-bold text-gray-800 block mb-2">
                  What to include in your description?
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {chipTemplates.map((chip, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleInsertChip(chip.snippet)}
                      className="px-3.5 py-1.5 rounded-full border border-gray-200 bg-gray-50/80 hover:bg-gray-100 text-xs font-semibold text-slate-700 transition flex items-center gap-1"
                    >
                      <span className="text-[#4F46E5] font-bold">+</span> {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit CTA */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || description.trim().length < MIN_PROPOSAL_LENGTH}
                  className="flex items-center justify-center px-6 py-3 rounded-xl bg-[#1E40AF] hover:bg-[#1E3A8A] text-white font-bold text-xs disabled:opacity-50 transition shadow-md"
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Submitting...</span>
                    </div>
                  ) : (
                    'Submit Proposal'
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Outcome view — status only, no scores */
            <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-2xs flex flex-col gap-5">
              {status === 'PENDING' && (
                <div className="flex flex-col items-center text-center py-8 gap-3">
                  <RefreshCw className="h-7 w-7 text-[#4F46E5] animate-spin" />
                  <h2 className="text-lg font-extrabold text-[#0F172A]">Analyzing your proposal...</h2>
                  <p className="text-xs text-[#64748B] max-w-sm leading-relaxed">
                    This can take a minute. You can safely leave this page — the analysis keeps
                    running, and the result will be waiting in <strong>My Proposals</strong>.
                  </p>
                  <button
                    onClick={() => navigate('/projects/proposals')}
                    className="mt-2 px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50 transition"
                  >
                    Go to My Proposals
                  </button>
                </div>
              )}

              {status === 'ACCEPTED' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-[#0F172A]">Proposal accepted</h2>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        Your problem statement has been published to the catalog with a slot
                        reserved for one team.
                      </p>
                    </div>
                  </div>

                  {proposal?.reasons && proposal.reasons.length > 0 && (
                    <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside bg-slate-50 p-4 rounded-xl border border-slate-200">
                      {proposal.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={handleClaim}
                      disabled={!proposal?.canClaim}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm shadow-emerald-500/20"
                    >
                      {proposal?.claimed ? 'Already Claimed' : 'Claim Project'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {(status === 'NEEDS_IMPROVEMENT' || status === 'REJECTED') && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        status === 'NEEDS_IMPROVEMENT'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {status === 'NEEDS_IMPROVEMENT' ? (
                        <AlertCircle className="h-5 w-5" />
                      ) : (
                        <XCircle className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-[#0F172A]">
                        {status === 'NEEDS_IMPROVEMENT' ? 'Needs improvement' : 'Not accepted'}
                      </h2>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        This proposal was not published to the catalog.
                      </p>
                    </div>
                  </div>

                  {proposal?.reasons && proposal.reasons.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-gray-800 block mb-2">Why</span>
                      <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside bg-slate-50 p-4 rounded-xl border border-slate-200">
                        {proposal.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {proposal?.improvementHints && proposal.improvementHints.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-gray-800 block mb-2">
                        What to strengthen next time
                      </span>
                      <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside bg-slate-50 p-4 rounded-xl border border-slate-200">
                        {proposal.improvementHints.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {status === 'FAILED' && (
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                    <XCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-[#0F172A]">Analysis could not finish</h2>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Something went wrong on our side. Please submit your proposal again.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => navigate('/projects/proposals')}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  View all my proposals
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* How it works Modal */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">How AI Evaluation Works</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              When you submit your problem statement, our AI model analyzes your proposal against core industry criteria: Problem Relevance, Technical Feasibility, Clarity, Novelty, and Expected Impact.
            </p>
            <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <li><strong>Single Submission:</strong> Each proposal is submitted once and analyzed server-side.</li>
              <li><strong>Runs In Background:</strong> You can leave the page — the analysis keeps running and the outcome appears in My Proposals.</li>
              <li><strong>Duplicate Prefilter:</strong> Checks existing catalog projects to ensure novelty.</li>
              <li><strong>Single-Team Catalog Slot:</strong> On acceptance, your statement is published to the catalog with one team slot, which you claim from the catalog.</li>
            </ul>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHowItWorks(false)}
                className="px-4 py-2 rounded-xl bg-[#4F46E5] text-white text-xs font-bold hover:bg-[#4338CA]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
