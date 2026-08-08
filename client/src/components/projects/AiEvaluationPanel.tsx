import React from 'react';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { ProposalEvaluationResult } from '../../services/proposal.service';

interface AiEvaluationPanelProps {
  evaluation: ProposalEvaluationResult;
}

/**
 * The AI evaluation report — verdict, rubric breakdown, the 5-perspective
 * "strengths" scoring, hardware constraints, and extracted features with
 * reward points, each with the model's own rationale. Extracted from
 * ProposeProblem.tsx so the same reasoning can be rendered both from the
 * live evaluate-preview response and from a persisted proposal fetched
 * later via GET /proposals/:id.
 */
export const AiEvaluationPanel: React.FC<AiEvaluationPanelProps> = ({ evaluation }) => {
  return (
    <div className="space-y-6">
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

      {/* Five-perspective validation — the project's "strengths" view */}
      {evaluation.perspectives && (
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            Multi-Perspective Validation
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(evaluation.perspectives).map(([key, val]) => (
              <div key={key} className="p-3.5 rounded-xl border border-indigo-200/60 bg-indigo-50/40 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-800 capitalize">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      val.score >= 70 ? 'bg-emerald-100 text-emerald-700' : val.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {val.score}/100
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{val.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hardware constraints, if this is a Hardware/IoT/Hybrid proposal */}
      {evaluation.hardwareConstraints && (
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            Hardware Constraints
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-800 block mb-1">Component Availability</span>
              <p className="text-[11px] text-slate-500 leading-snug">{evaluation.hardwareConstraints.componentAvailability}</p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-800 block mb-1">Integration Complexity</span>
              <p className="text-[11px] text-slate-500 leading-snug">{evaluation.hardwareConstraints.integrationComplexity}</p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-800 block mb-1">Problem/Solution Complexity</span>
              <p className="text-[11px] text-slate-500 leading-snug">{evaluation.hardwareConstraints.problemSolutionComplexity}</p>
            </div>
          </div>
        </div>
      )}

      {/* AI-extracted features + reward points preview */}
      {!!evaluation.features?.length && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Extracted Features & Reward Points
            </h4>
            <span className="text-xs font-bold text-indigo-600">
              {evaluation.features.reduce((sum, f) => sum + f.points, 0)} / 1,000 pts
            </span>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {evaluation.features.map((f, i) => (
              <div key={i} className="p-3.5 bg-white flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">{f.name}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">{f.description}</p>
                  <p className="text-[10px] text-indigo-500 mt-1">AI: {f.aiRationale}</p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 ${
                      f.importance === 'High'
                        ? 'bg-rose-100 text-rose-800'
                        : f.importance === 'Medium'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {f.importance}
                  </span>
                  <span className="block text-sm font-extrabold text-slate-900">{f.points} pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
    </div>
  );
};
