import React, { useEffect, useState } from 'react';
import { ShieldCheck, Play, ArrowRight } from 'lucide-react';
import { EvaluationReportContent } from '../../types/projectLog';
import { lifecycleService } from '../../services/lifecycle.service';
import { EvaluationReportView } from './EvaluationReportView';
import { useAppSelector } from '../../app/hooks';

interface EvaluationsTabProps {
  projectId: string;
}

export const EvaluationsTab: React.FC<EvaluationsTabProps> = ({ projectId }) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const isAdmin = currentUser?.role === 'ADMIN';

  const [reports, setReports] = useState<Array<{
    id: string;
    cycle: number;
    periodStart: string;
    periodEnd: string;
    overallScore: number;
    authenticityScore: number;
    plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    createdAt: string;
  }>>([]);

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [activeFullReport, setActiveFullReport] = useState<EvaluationReportContent | null>(null);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const data = await lifecycleService.getEvaluations(projectId);
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load evaluations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, [projectId]);

  const handleSelectReport = async (reportId: string) => {
    setLoading(true);
    try {
      const full = await lifecycleService.getEvaluationReport(projectId, reportId);
      setActiveFullReport(full);
      setSelectedReportId(reportId);
    } catch (err) {
      console.error('Failed to load full report', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunManualEvaluation = async () => {
    setRunning(true);
    try {
      await lifecycleService.runEvaluation(projectId);
      await fetchEvaluations();
    } catch (err) {
      console.error('Manual evaluation trigger failed', err);
    } finally {
      setRunning(false);
    }
  };

  if (activeFullReport && selectedReportId) {
    return (
      <EvaluationReportView
        report={activeFullReport}
        onBack={() => {
          setSelectedReportId(null);
          setActiveFullReport(null);
        }}
      />
    );
  }

  const getRiskBadge = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => {
    if (risk === 'LOW') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (risk === 'MEDIUM') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" /> 15-Day AI Verification Reviews
          </h3>
          <p className="text-xs text-gray-500">
            Bi-weekly verification audits evaluating scope adherence, authenticity, and plagiarism risk.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleRunManualEvaluation}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-2xs disabled:opacity-50 shrink-0"
          >
            <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Running Review...' : 'Run Cycle Review (Admin)'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">Loading evaluation cycles...</div>
      ) : reports.length === 0 ? (
        <div className="py-16 px-6 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 space-y-3 max-w-md mx-auto">
          <ShieldCheck className="w-10 h-10 text-gray-400 mx-auto" />
          <div>
            <h4 className="text-sm font-bold text-gray-900">No Evaluation Reports Generated Yet</h4>
            <p className="text-xs text-gray-500 mt-1">
              First AI verification review runs automatically after 15 days of project activity.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((rep) => (
            <div
              key={rep.id}
              onClick={() => handleSelectReport(rep.id)}
              className="p-5 rounded-2xl bg-white border border-gray-200 shadow-2xs hover:shadow-md transition cursor-pointer space-y-4 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-indigo-900 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                  Cycle #{rep.cycle}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRiskBadge(
                    rep.plagiarismRisk
                  )}`}
                >
                  Risk: {rep.plagiarismRisk}
                </span>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-900">
                  {rep.periodStart} → {rep.periodEnd}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">15-Day Verification Report</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="block text-[10px] text-gray-400 font-bold uppercase">Overall</span>
                  <span className="font-extrabold text-sm text-indigo-600">{rep.overallScore} / 100</span>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="block text-[10px] text-gray-400 font-bold uppercase">Authenticity</span>
                  <span className="font-extrabold text-sm text-emerald-600">
                    {rep.authenticityScore}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:underline pt-1">
                <span>View Full Verification Report</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
