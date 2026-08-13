import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Code2,
  Clock,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Bookmark,
  FileText,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import { proposalService, ApproachCheckResult } from '../../services/proposal.service';

export interface ProjectDetailPayload {
  id: string;
  name: string;
  shortName?: string;
  soul?: string;
  problemStatement?: string;
  description?: string;
  backgroundContext?: string;
  type?: string;
  domain?: string;
  sector?: string;
  difficultyLevel?: string;
  technologies?: string[];
  targetUsers?: string;
  expectedOutcome?: string;
  expectedImpact?: string;
  constraints?: string;
  outOfScope?: string;
  deliverables?: string[] | any;
  courseOutcomes?: string[];
  programOutcomes?: string[];
  skillsGained?: string[];
  prerequisites?: string[];
  hardwareComponents?: string[]
  budgetEstimateInr?: number;
  budgetNotes?: string;
  standards?: string[];
  referenceLinks?: string[];
  suggestedDurationWeeks?: number;
  typeSpecific?: any;
  claims?: { teamName: string; approachSummary: string }[];
  slotsLeft?: number;
  maxTeams?: number;
}

interface ProjectDetailModalProps {
  project: ProjectDetailPayload | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectSuccess: () => void;
}

/* -----------------------------------------------------------------------
   AI analysis verdict badge colours
   --------------------------------------------------------------------- */
const verdictColour = (verdict?: string) => {
  if (verdict === 'ACCEPT') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (verdict === 'REJECT') return 'bg-rose-50 border-rose-200 text-rose-700';
  return 'bg-amber-50 border-amber-200 text-amber-700';
};

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  isOpen,
  onClose,
  onSelectSuccess,
}) => {
  const [approachText, setApproachText] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ApproachCheckResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  /* Reset state each time a new project opens */
  useEffect(() => {
    if (isOpen) {
      setApproachText('');
      setAnalysisResult(null);
      setError(null);
    }
  }, [isOpen, project?.id]);

  if (!isOpen || !project) return null;

  const maxCap    = project.maxTeams ?? 3;
  const slotsLeft = project.slotsLeft ?? maxCap;
  const claimed   = maxCap - slotsLeft;

  /* The full text of the problem statement — prefer the long form */
  const fullProblemStatement =
    project.problemStatement ||
    project.description ||
    project.backgroundContext ||
    'No problem statement provided.';

  /* ------------------------------------------------------------------ */
  const handleAnalyse = async () => {
    if (approachText.trim().length < 30) {
      setError('Please write at least 30 characters about your approach before analysing.');
      return;
    }
    try {
      setAnalysing(true);
      setError(null);
      const res = await proposalService.checkApproachUniqueness(project.id, approachText);
      setAnalysisResult(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Analysis failed. Please try again.');
    } finally {
      setAnalysing(false);
    }
  };

  const handleClaim = async () => {
    if (!analysisResult || analysisResult.verdict !== 'ACCEPT') {
      setError('Run AI analysis first and ensure your approach is accepted.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await proposalService.selectProjectWithApproach(project.id, approachText);
      onSelectSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to claim project.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="relative bg-white w-full max-w-3xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'fadeScaleIn .18s ease' }}
      >
        <style>{`
          @keyframes fadeScaleIn {
            from { opacity: 0; transform: scale(.97) translateY(8px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          .modal-scroll::-webkit-scrollbar { width: 4px; }
          .modal-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        `}</style>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="px-8 pt-7 pb-5 border-b border-slate-100 shrink-0">
          {/* close + bookmark */}
          <div className="absolute top-5 right-5 flex items-center gap-2">
            <button
              onClick={() => setBookmarked(b => !b)}
              className={`p-2 rounded-xl border transition-colors ${
                bookmarked
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Bookmark className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* type badge */}
          <span className="inline-block mb-3 px-3 py-1 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-wider border border-blue-100">
            {project.type || 'Software'}
          </span>

          {/* title */}
          <h2 className="text-xl font-extrabold text-slate-900 pr-20 leading-snug">
            {project.name}
          </h2>

          {/* soul / subtitle */}
          {project.soul && (
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">{project.soul}</p>
          )}

          {/* meta strip */}
          <div className="mt-4 flex flex-wrap gap-5">
            <MetaBadge icon={<Users className="h-3.5 w-3.5 text-emerald-600" />} label="Teams">
              <span className={`font-bold text-xs ${slotsLeft === 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {claimed}/{maxCap} claimed
              </span>
            </MetaBadge>

            {project.domain && (
              <MetaBadge icon={<FileText className="h-3.5 w-3.5 text-blue-500" />} label="Domain">
                <span className="font-bold text-xs text-slate-800">{project.domain}</span>
              </MetaBadge>
            )}

            {project.technologies && project.technologies.length > 0 && (
              <MetaBadge icon={<Code2 className="h-3.5 w-3.5 text-violet-500" />} label="Tech Stack">
                <span className="font-bold text-xs text-slate-800">
                  {project.technologies.slice(0, 3).join(', ')}
                </span>
              </MetaBadge>
            )}

            <MetaBadge icon={<Clock className="h-3.5 w-3.5 text-amber-500" />} label="Duration">
              <span className="font-bold text-xs text-slate-800">
                {project.suggestedDurationWeeks ?? 12} Weeks
              </span>
            </MetaBadge>
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto modal-scroll px-8 py-6 space-y-6">

          {/* ① Full Problem Statement */}
          <section>
            <SectionLabel icon={<FileText className="h-4 w-4" />} text="Problem Statement" />
            <div className="mt-3 p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-sm text-slate-700 leading-7 whitespace-pre-line">
                {fullProblemStatement}
              </p>
            </div>
          </section>

          {/* ② Claim — text field + AI analysis */}
          <section className="pt-2">
            <SectionLabel icon={<Lightbulb className="h-4 w-4" />} text="Claim This Project" />
            <p className="mt-1 text-xs text-slate-500">
              Describe how your team will approach this problem uniquely. The AI will analyse your approach before you can claim the slot.
            </p>

            {/* error banner */}
            {error && (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* textarea */}
            <div className="mt-3 relative">
              <textarea
                value={approachText}
                onChange={e => {
                  setApproachText(e.target.value);
                  setAnalysisResult(null); // reset analysis on edit
                  setError(null);
                }}
                placeholder="Explain your unique technical approach, architecture choices, or target user focus… (min 30 chars)"
                rows={5}
                className="w-full p-4 rounded-2xl border border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 text-sm text-slate-800 placeholder:text-slate-400 resize-none outline-none transition-all leading-relaxed"
              />
              <span className="absolute bottom-3 right-4 text-[11px] text-slate-400">
                {approachText.length} chars
              </span>
            </div>

            {/* AI result card */}
            {analysisResult && (
              <div className={`mt-3 p-4 rounded-2xl border text-sm ${verdictColour(analysisResult.verdict)}`}>
                <div className="flex items-center gap-2 font-bold mb-1">
                  {analysisResult.verdict === 'ACCEPT' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  Uniqueness Score: {analysisResult.uniquenessScore}/100 — {analysisResult.verdict}
                </div>
                <p className="text-xs leading-relaxed opacity-90">{analysisResult.reason}</p>
                {analysisResult.suggestions && analysisResult.suggestions.length > 0 && (
                  <ul className="mt-2 list-disc list-inside text-xs space-y-0.5 opacity-80">
                    {analysisResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* action buttons */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              {/* Analyse button */}
              <button
                onClick={handleAnalyse}
                disabled={analysing || approachText.trim().length < 30}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {analysing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analysing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    Analyse with AI
                  </>
                )}
              </button>

              {/* Claim button */}
              <button
                onClick={handleClaim}
                disabled={
                  submitting ||
                  !analysisResult ||
                  analysisResult.verdict !== 'ACCEPT' ||
                  slotsLeft <= 0
                }
                className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Claiming…
                  </>
                ) : slotsLeft <= 0 ? (
                  'Capacity Full'
                ) : (
                  <>
                    Choose this Project
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </section>

          {/* ③ Other teams' claims on THIS problem statement (read-only, if any) */}
          {project.claims && project.claims.length > 0 && (
            <section className="pt-2">
              <SectionLabel
                icon={<Users className="h-4 w-4" />}
                text="Approaches Claimed On This Problem Statement"
              />
              <div className="mt-3 space-y-2">
                {project.claims.map((c, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <span className="font-bold text-slate-700">{c.teamName}</span>
                    <p className="mt-0.5 text-slate-500 italic">"{c.approachSummary}"</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Tiny helper components ──────────────────────────────────────────── */

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500">{icon}</span>
      <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide">{text}</h3>
    </div>
  );
}

function MetaBadge({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[11px] text-slate-400 font-medium">{label}:</span>
      {children}
    </div>
  );
}
