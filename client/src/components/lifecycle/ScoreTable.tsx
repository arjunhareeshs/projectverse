import React from 'react';
import { EvaluationReportContent } from '../../types/projectLog';

interface ScoreTableProps {
  report: EvaluationReportContent;
}

export const ScoreTable: React.FC<ScoreTableProps> = ({ report }) => {
  const parameters = [
    { label: 'Scope Adherence', data: report.scopeAdherence },
    { label: 'Technical Progress', data: report.technicalProgress },
    { label: 'Timeline Compliance', data: report.timelineCompliance },
    { label: 'Member Participation', data: report.memberParticipation },
    { label: 'Documentation Quality', data: report.documentationQuality },
    { label: 'Authenticity Confidence', data: report.authenticityConfidence },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  return (
    <div className="overflow-hidden border border-gray-200 rounded-xl bg-white shadow-2xs">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/70 text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <th className="py-3 px-4">Evaluation Parameter</th>
            <th className="py-3 px-4 text-center w-28">Score</th>
            <th className="py-3 px-4">Notes & Insights</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {parameters.map((param, idx) => (
            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
              <td className="py-3 px-4 font-semibold text-gray-800">{param.label}</td>
              <td className="py-3 px-4 text-center">
                <span
                  className={`inline-flex items-center justify-center font-bold px-2.5 py-1 rounded-lg border text-xs ${getScoreColor(
                    param.data.score
                  )}`}
                >
                  {param.data.score} / 100
                </span>
              </td>
              <td className="py-3 px-4 text-xs text-gray-600 leading-relaxed">{param.data.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
