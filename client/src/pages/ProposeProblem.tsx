import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  MessageSquare,
  Code,
  Lightbulb,
  FileText,
  Users,
  Star,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Info,
  FileEdit,
} from 'lucide-react';
import { proposalService, ProposalEvaluationResult } from '../services/proposal.service';

export const ProposeProblem: React.FC = () => {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<ProposalEvaluationResult | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

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

  const handleEvaluate = async () => {
    if (!description.trim() || description.trim().length < 50) {
      setError('Please provide a detailed description of at least 50 characters before submitting.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await proposalService.evaluateProposal(description);
      setEvaluation(result);
    } catch (err: any) {
      console.error('Error evaluating proposal:', err);
      setError(err.response?.data?.message || 'Failed to evaluate proposal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!evaluation || evaluation.verdict !== 'ACCEPTED') return;

    try {
      setSubmitting(true);
      setError(null);
      await proposalService.submitProposal({
        rawText: description,
        evaluation,
      });
      navigate('/projects');
    } catch (err: any) {
      console.error('Error publishing proposal:', err);
      const serverEvaluation = err.response?.data?.evaluation;
      if (serverEvaluation) setEvaluation(serverEvaluation);
      setError(err.response?.data?.message || 'Failed to publish project to catalog.');
    } finally {
      setSubmitting(false);
    }
  };

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

        <button
          onClick={() => setShowHowItWorks(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-xs font-bold text-[#4F46E5] hover:bg-gray-50 transition shadow-2xs"
        >
          <Info className="h-4 w-4 text-[#4F46E5]" />
          How it works?
        </button>
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

        {/* Right Column: Input & Results (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {!evaluation ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-2xs flex flex-col gap-5">
              <div>
                <h2 className="text-xl font-extrabold text-[#0F172A]">Describe Your Project</h2>
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
                  onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
                  placeholder="Enter your project overview, problem statement, features, expected outcome, target users, technology ideas, and any other relevant details..."
                  className="w-full h-72 text-xs text-slate-800 placeholder:text-gray-400 outline-none resize-none bg-transparent"
                />
                <div className="text-xs text-gray-400 font-semibold text-right pt-2">
                  {description.length} / 5000
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
                  onClick={handleEvaluate}
                  disabled={loading || description.length < 30}
                  className="flex items-center justify-center px-6 py-3 rounded-xl bg-[#1E40AF] hover:bg-[#1E3A8A] text-white font-bold text-xs disabled:opacity-50 transition shadow-md"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Evaluating with AI...</span>
                    </div>
                  ) : (
                    "Submit for AI Evaluation"
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Evaluation Results View */
            <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-2xs flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#0F172A]">AI Evaluation Report</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Review your proposal score and detailed rubric assessment below.
                  </p>
                </div>
                <button
                  onClick={() => setEvaluation(null)}
                  className="text-xs text-[#4F46E5] hover:underline font-bold"
                >
                  Edit Submission
                </button>
              </div>

              {/* Verdict Header Card */}
              <div
                className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  evaluation.verdict === 'ACCEPTED'
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : evaluation.verdict === 'NEEDS_IMPROVEMENT'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-rose-50/70 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  {evaluation.verdict === 'ACCEPTED' ? (
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
                  ) : evaluation.verdict === 'NEEDS_IMPROVEMENT' ? (
                    <AlertCircle className="h-8 w-8 text-amber-600 shrink-0" />
                  ) : (
                    <XCircle className="h-8 w-8 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <span className="text-xs font-semibold tracking-wider uppercase opacity-75">
                      Proposal Status
                    </span>
                    <h3 className="text-lg font-bold">
                      {evaluation.verdict === 'ACCEPTED'
                        ? 'Accepted — Ready for Catalog'
                        : evaluation.verdict === 'NEEDS_IMPROVEMENT'
                        ? 'Needs Improvement'
                        : 'Proposal Rejected'}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-xl border border-black/5 shadow-sm">
                  <span className="text-xs text-slate-500 font-medium">Overall Score</span>
                  <span className="text-xl font-black text-slate-900">{evaluation.overallScore}/100</span>
                </div>
              </div>

              {/* Duplicate check info if any */}
              {evaluation.duplicate?.isDuplicate && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Potential Duplicate Found: </span>
                    Similarity score {evaluation.duplicate.similarityScore}% with existing project "{evaluation.duplicate.similarProjectTitle}".
                  </div>
                </div>
              )}

              {/* Rubric Breakdown Grid */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Criteria Assessment Breakdown
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(evaluation.rubrics).map(([key, val]) => (
                    <div key={key} className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-800 capitalize">
                          {key.replace(/([A-Z])/g, ' $1')}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          val.score >= 70 ? 'bg-emerald-100 text-emerald-700' : val.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {val.score}/100
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">{val.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reasons / Improvement Hints */}
              {evaluation.improvementHints.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 mb-2">Suggestions for Improvement:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {evaluation.improvementHints.map((hint, i) => (
                      <li key={i} className="text-xs text-slate-600">{hint}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setEvaluation(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Re-evaluate Proposal
                </button>

                {evaluation.verdict === 'ACCEPTED' && (
                  <button
                    onClick={handlePublish}
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm shadow-emerald-500/20"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        Publish & Reserve Slot
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
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
              <li><strong>Stateless Evaluation:</strong> Your text is first scored without writing to the database.</li>
              <li><strong>Duplicate Prefilter:</strong> Checks existing catalog projects to ensure novelty.</li>
              <li><strong>Single-Team Catalog Slot:</strong> On acceptance, your project is published to the catalog reserved exclusively for your team (1 team slot).</li>
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

