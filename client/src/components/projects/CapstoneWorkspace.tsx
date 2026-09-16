import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Clock,
  Github,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowLeft,
  ExternalLink,
  Loader2,
  AlertCircle,
  HelpCircle,
  Award,
  Code2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  CapstoneProjectWorkspaceData,
  capstoneService,
} from '../../services/capstone.service';

interface CapstoneWorkspaceProps {
  data: CapstoneProjectWorkspaceData;
  onRefresh: () => void;
}

export const CapstoneWorkspace: React.FC<CapstoneWorkspaceProps> = ({
  data,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const { project, selection, problem, metrics } = data;

  const [githubUrl, setGithubUrl] = useState(selection.githubUrl || '');
  const [bypassTimeCheck, setBypassTimeCheck] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const totalQuestions = selection.totalQuestions || problem.questionCount || 15;
  const isCompleted = selection.status === 'COMPLETED';
  const isMcqReady = selection.status === 'MCQ_READY' || selection.status === 'SUBMITTED';
  const isClaimed = selection.status === 'CLAIMED';

  const scorePercentage =
    isCompleted && selection.mcqScore !== null && selection.mcqScore !== undefined
      ? Math.round((selection.mcqScore / totalQuestions) * 100)
      : 0;

  const handleSubmitGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) {
      setSubmitError('Please enter your GitHub repository URL.');
      return;
    }

    const ghPattern = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+(\/)?$/;
    if (!ghPattern.test(githubUrl.trim())) {
      setSubmitError('Please enter a valid GitHub repository URL (e.g. https://github.com/username/project).');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(null);

      await capstoneService.submitGithub(selection.id, githubUrl.trim(), bypassTimeCheck);
      setSubmitSuccess('Repository submitted successfully! MCQs generated.');
      onRefresh();
    } catch (err: any) {
      console.error('Failed to submit GitHub repository:', err);
      setSubmitError(
        err.response?.data?.message ||
          'Failed to submit repository. Verify the repository is public and accessible.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const difficultyColor = (diff?: string | null) => {
    const d = (diff || '').toLowerCase();
    if (d === 'hard' || d === 'level 3') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (d === 'medium' || d === 'level 2') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* Top Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate('/projects')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mr-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All Projects
            </button>
            <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Capstone Sprint
            </span>
            {project.domain && (
              <span className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {project.domain}
              </span>
            )}
            {project.difficultyLevel && (
              <span
                className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${difficultyColor(
                  project.difficultyLevel
                )}`}
              >
                {project.difficultyLevel}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
            {project.name}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed
            </span>
          ) : isMcqReady ? (
            <button
              onClick={() => navigate(`/capstone/${selection.id}/mcq`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition interactive-tap cursor-pointer"
            >
              <Sparkles className="w-4 h-4" /> Attend MCQ Evaluation
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold shadow-xs">
              <Clock className="w-4 h-4 text-amber-600" /> In Development
            </span>
          )}
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Days Balance Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Days Balance
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                {metrics.daysBalance}{' '}
                <span className="text-sm font-semibold text-slate-500">
                  {metrics.daysBalance === 1 ? 'Day Left' : 'Days Balance'}
                </span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[10px] font-semibold text-slate-500">
              <span>Day {Math.min(7, metrics.elapsedDays + 1)} of 7</span>
              <span>Deadline: {formatDateTime(selection.dueAt)}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  metrics.daysBalance === 0 ? 'bg-amber-500' : 'bg-indigo-600'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(10, ((7 - metrics.daysBalance) / 7) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Technical MCQs Configured Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Evaluation MCQs
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                {totalQuestions}{' '}
                <span className="text-sm font-semibold text-slate-500">Questions</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Code2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 leading-relaxed">
            AI evaluates your submitted repository architecture, framework patterns, and algorithmic flow.
          </p>
        </div>

        {/* Assessment Result / Current Stage Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Status / Score
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                {isCompleted ? (
                  <span className="text-emerald-700">
                    {selection.mcqScore} / {totalQuestions}
                  </span>
                ) : isMcqReady ? (
                  <span className="text-blue-600 text-lg">MCQ Ready</span>
                ) : (
                  <span className="text-amber-600 text-lg">Active Sprint</span>
                )}
              </h3>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isCompleted
                  ? 'bg-emerald-50 text-emerald-600'
                  : isMcqReady
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              {isCompleted ? (
                <Award className="w-5 h-5" />
              ) : isMcqReady ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <Calendar className="w-5 h-5" />
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            {isCompleted
              ? `Score: ${scorePercentage}% — Mastery evaluated and certified.`
              : isMcqReady
              ? 'Repository analyzed. Click Attend MCQ to start.'
              : 'Submit repository when ready or after the 7-day cycle.'}
          </p>
        </div>
      </div>

      {/* Main Grid: Problem Statement & Submission Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Problem Statement & Technologies (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" /> Problem Statement
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Carefully review the functional requirements and deliverable scope.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {problem.problemText || project.problemStatement || project.description}
            </div>

            {/* Technologies */}
            {problem.technologies && problem.technologies.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Target Technologies & Tools
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {problem.technologies.map((tech, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50/60 text-indigo-700 border border-indigo-100"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Student Proposed Approach (if any) */}
            {project.differentiationApproach && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Your Claim Approach / Strategy
                </h3>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 italic">
                  "{project.differentiationApproach}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Submission Flow & Status (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* COMPLETED STATE */}
          {isCompleted && (
            <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-xs space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Capstone Completed
                  </h3>
                  <p className="text-xs text-slate-500">
                    Submitted on {formatDateTime(selection.completedAt || selection.submittedAt)}
                  </p>
                </div>
              </div>

              {/* Score Showcase */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    MCQ Assessment Score
                  </span>
                  <span className="text-2xl font-black text-emerald-700 tabular-nums">
                    {selection.mcqScore} / {totalQuestions}
                  </span>
                </div>
                <div className="w-full h-2 bg-emerald-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                    style={{ width: `${scorePercentage}%` }}
                  />
                </div>
                <p className="text-[11px] text-emerald-800 font-medium">
                  {scorePercentage >= 70
                    ? 'Outstanding! Your codebase mastery and technical implementation meet project standards.'
                    : 'Capstone completed. Review your technical concepts to strengthen future evaluations.'}
                </p>
              </div>

              {/* Submitted repo link */}
              {selection.githubUrl && (
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Submitted Repository
                  </span>
                  <a
                    href={selection.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline break-all"
                  >
                    <Github className="w-4 h-4 shrink-0 text-slate-700" />
                    {selection.githubUrl}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* MCQ READY STATE */}
          {isMcqReady && !isCompleted && (
            <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-xs space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Repository Evaluated
                  </h3>
                  <p className="text-xs text-slate-500">
                    Your code analysis is complete and MCQs are generated.
                  </p>
                </div>
              </div>

              {selection.githubUrl && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <Github className="w-4 h-4 text-slate-700 shrink-0" />
                    <span className="text-slate-700 font-medium truncate">{selection.githubUrl}</span>
                  </div>
                  <a
                    href={selection.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1.5 text-xs text-blue-900">
                <p className="font-bold flex items-center gap-1.5 text-blue-950">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  {totalQuestions} Code-Aware MCQs Awaiting You
                </p>
                <p className="leading-relaxed">
                  Questions test component architecture, framework idioms, and code logic extracted directly from your repository.
                </p>
              </div>

              <button
                onClick={() => navigate(`/capstone/${selection.id}/mcq`)}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md transition interactive-tap cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Attend MCQ Assessment
              </button>
            </div>
          )}

          {/* CLAIMED / SUBMIT STATE */}
          {isClaimed && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Github className="w-4 h-4 text-slate-700" /> Submit Repository
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submit your public GitHub repository to unlock your {totalQuestions}-question MCQ evaluation.
                </p>
              </div>

              {submitSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {submitSuccess}
                </div>
              )}

              {submitError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitGithub} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    GitHub Repository URL <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Github className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="url"
                      required
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/username/repository"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Repository must be public with commits solving the problem statement.
                  </p>
                </div>

                {/* Testing bypass option */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-800 block">
                      Immediate Submission Mode
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Allow submission without waiting the full 7 days.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bypassTimeCheck}
                      onChange={(e) => setBypassTimeCheck(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl shadow-sm transition interactive-tap cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing Repository & Generating MCQs...
                    </>
                  ) : (
                    <>
                      <Github className="w-4 h-4" />
                      Submit GitHub Repository
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
