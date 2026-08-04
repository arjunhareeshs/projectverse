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
  HelpCircle,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Lock,
  ArrowRight,
  RefreshCw,
  Info,
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
      color: 'bg-blue-50 text-blue-600 border-blue-100',
      title: 'Problem Relevance',
      desc: 'Is it solving a real and important problem?',
    },
    {
      icon: MessageSquare,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      title: 'Problem Clarity',
      desc: 'Is the problem well-defined and understandable?',
    },
    {
      icon: Code,
      color: 'bg-purple-50 text-purple-600 border-purple-100',
      title: 'Technical Feasibility',
      desc: 'Can it be realistically implemented?',
    },
    {
      icon: Lightbulb,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      title: 'Innovation',
      desc: 'How novel and unique is the proposed idea?',
    },
    {
      icon: Target,
      color: 'bg-cyan-50 text-cyan-600 border-cyan-100',
      title: 'Expected Outcome',
      desc: 'Is the outcome clearly defined and valuable?',
    },
    {
      icon: FileText,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      title: 'Feature Completeness',
      desc: 'Are the proposed features sufficient?',
    },
    {
      icon: Users,
      color: 'bg-rose-50 text-rose-600 border-rose-100',
      title: 'Industry & Social Impact',
      desc: 'Will it benefit industry or society?',
    },
    {
      icon: Star,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
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
      // The server re-scores on publish and can reach a different verdict than the
      // preview (e.g. a near-duplicate was added in between). Swap in its result so
      // the panel explains the rejection instead of just flashing a message.
      const serverEvaluation = err.response?.data?.evaluation;
      if (serverEvaluation) setEvaluation(serverEvaluation);
      setError(err.response?.data?.message || 'Failed to publish project to catalog.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Lightbulb className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Propose New Problem Statement</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Describe your idea clearly. The AI model will evaluate it based on industry-grade criteria.
          </p>
        </div>

        <button
          onClick={() => setShowHowItWorks(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <HelpCircle className="h-4 w-4 text-blue-600" />
          How it works?
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Criteria (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">AI Evaluation Criteria</h2>
            <p className="text-xs text-slate-500 mb-6">
              Your submission will be evaluated on the following aspects.
            </p>

            <div className="space-y-4">
              {criteriaList.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-start gap-3.5">
                    <div
                      className={`p-2.5 rounded-xl border shrink-0 ${item.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-800">{item.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-normal">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-900 leading-relaxed">
                The AI model evaluates your submission based on these criteria before forwarding it for faculty review.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Input & Results (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {!evaluation ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col gap-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Describe Your Project</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Provide all the details about your project in the text box below.
                </p>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
                  placeholder="Enter your project overview, problem statement, features, expected outcome, target users, technology ideas, and any other relevant details..."
                  className="w-full h-80 p-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-sm text-slate-800 placeholder:text-slate-400 resize-none outline-none transition-all"
                />
                <div className="absolute bottom-3 right-4 text-[11px] text-slate-400 font-mono">
                  {description.length} / 5000 characters
                </div>
              </div>

              {/* What to include chips */}
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-2">
                  What to include in your description?
                </span>
                <div className="flex flex-wrap gap-2">
                  {chipTemplates.map((chip, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleInsertChip(chip.snippet)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
                    >
                      + {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tip alert */}
              <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/60 flex items-center gap-2.5">
                <Lightbulb className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-900 font-medium">
                  Be specific and clear. More accurate details help the AI evaluate your proposal better.
                </p>
              </div>

              {/* Submit CTA */}
              <div className="flex flex-col items-end gap-2 pt-2">
                <button
                  onClick={handleEvaluate}
                  disabled={loading || description.length < 30}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-500/20"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Evaluating with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Submit for AI Evaluation
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Lock className="h-3 w-3" />
                  Your data is secure and confidential
                </div>
              </div>
            </div>
          ) : (
            /* Evaluation Results View */
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">AI Evaluation Report</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review your proposal score and detailed rubric assessment below.
                  </p>
                </div>
                <button
                  onClick={() => setEvaluation(null)}
                  className="text-xs text-blue-600 hover:underline font-medium"
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
              When you submit your problem statement, our AI model analyzes your proposal against 5 core industry criteria: Problem Relevance, Technical Feasibility, Clarity, Novelty, and Expected Impact.
            </p>
            <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <li><strong>Stateless Evaluation:</strong> Your text is first scored without writing to the database.</li>
              <li><strong>Duplicate Prefilter:</strong> Checks existing catalog projects to ensure novelty.</li>
              <li><strong>Single-Team Catalog Slot:</strong> On acceptance, your project is published to the catalog reserved exclusively for your team (1 team slot).</li>
            </ul>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHowItWorks(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
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
