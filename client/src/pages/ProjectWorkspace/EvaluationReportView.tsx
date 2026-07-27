import React from 'react';
import { ArrowLeft, CheckCircle2, AlertTriangle, Lightbulb, Users, ShieldAlert } from 'lucide-react';
import { EvaluationReportContent } from '../../types/projectLog';
import { ScoreTable } from '../../components/lifecycle/ScoreTable';

interface EvaluationReportViewProps {
  report: EvaluationReportContent;
  onBack: () => void;
}

export const EvaluationReportView: React.FC<EvaluationReportViewProps> = ({ report, onBack }) => {
  const getRiskBadge = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => {
    if (risk === 'LOW') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (risk === 'MEDIUM') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Evaluations List
      </button>

      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-xs text-indigo-900 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                Cycle #{report.cycle} (15-Day Verification)
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getRiskBadge(
                  report.plagiarismRisk
                )}`}
              >
                Plagiarism Risk: {report.plagiarismRisk}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">15-Day Verification Report</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Evaluation Period: {report.periodStart} to {report.periodEnd}
            </p>
          </div>

          <div className="flex items-center gap-4 text-center">
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="block text-[10px] font-bold text-gray-400 uppercase">Overall Score</span>
              <span className="text-xl font-extrabold text-indigo-600">{report.overallScore} / 100</span>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="block text-[10px] font-bold text-gray-400 uppercase">Authenticity</span>
              <span className="text-xl font-extrabold text-emerald-600">
                {report.authenticityConfidence?.score || 90}%
              </span>
            </div>
          </div>
        </div>

        {/* Mentor Feedback Highlight */}
        <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-1">
          <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-indigo-600" /> AI Mentor Summary Feedback
          </h4>
          <p className="text-xs text-indigo-900 leading-relaxed">{report.mentorFeedback}</p>
        </div>
      </div>

      {/* Parameter Score Table */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-gray-900">Parameter Breakdown</h3>
        <ScoreTable report={report} />
      </div>

      {/* Per-Member Participation */}
      {report.memberParticipation?.perMember && report.memberParticipation.perMember.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" /> Per-Member Contribution Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.memberParticipation.perMember.map((mem, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-white border border-gray-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-gray-900">{mem.name || mem.userId}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                    {mem.score} / 100
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{mem.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing Work & Suspicious Behaviour */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Missing Work */}
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-2xs space-y-3">
          <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Missing / Delayed Work Items
          </h4>
          {report.missingWork && report.missingWork.length > 0 ? (
            <ul className="space-y-2 text-xs text-gray-700">
              {report.missingWork.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/50 border border-amber-100">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 italic">No missing work items recorded for this cycle.</p>
          )}
        </div>

        {/* Suspicious Behaviour */}
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-2xs space-y-3">
          <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-rose-500" /> Authenticity & Plagiarism Flags
          </h4>
          {report.suspiciousBehaviour && report.suspiciousBehaviour.length > 0 ? (
            <ul className="space-y-2 text-xs text-gray-700">
              {report.suspiciousBehaviour.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50/50 border border-rose-100">
                  <span className="text-rose-600 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-700 font-medium bg-emerald-50 p-3 rounded-lg border border-emerald-100">
              ✓ No suspicious commit patterns or plagiarism risks flagged.
            </p>
          )}
        </div>
      </div>

      {/* Next 15-Day Recommendations */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 space-y-3 shadow-2xs">
        <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 uppercase tracking-wider">
          <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Next 15-Day Action Recommendations
        </h4>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-800 font-medium">
          {report.next15DayRecommendations?.map((rec, idx) => (
            <li key={idx} className="p-3 rounded-xl bg-white border border-indigo-100 shadow-2xs flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
