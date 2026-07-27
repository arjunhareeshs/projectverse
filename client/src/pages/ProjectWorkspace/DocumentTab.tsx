import React, { useEffect, useState } from 'react';
import { Download, FileText, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { ExecutionDocContent, ProjectLogState } from '../../types/projectLog';
import { lifecycleService } from '../../services/lifecycle.service';
import { SkillGapCard } from '../../components/lifecycle/SkillGapCard';

interface DocumentTabProps {
  projectId: string;
  logState?: ProjectLogState | null;
  onLaunchWizard?: () => void;
  initialFallback?: boolean;
}

export const DocumentTab: React.FC<DocumentTabProps> = ({
  projectId,
  logState,
  onLaunchWizard,
  initialFallback,
}) => {
  const [doc, setDoc] = useState<ExecutionDocContent | null>(null);
  const [version, setVersion] = useState<number>(1);
  const [allVersions, setAllVersions] = useState<number[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showConfirmRegen, setShowConfirmRegen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasFallback, setWasFallback] = useState(false);

  const memberNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (logState?.team?.members) {
      logState.team.members.forEach((m) => {
        map[m.userId] = m.name;
      });
    }
    return map;
  }, [logState?.team?.members]);

  const fetchDoc = async (ver?: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await lifecycleService.getDocument(projectId, ver);
      if (data && data.doc) {
        setDoc(data.doc);
        setVersion(data.version || 1);
        if (data.allVersions) setAllVersions(data.allVersions);
      } else {
        setDoc(null);
      }
    } catch (err) {
      console.error('Failed to load execution document', err);
      setDoc(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setWasFallback(!!initialFallback);
    fetchDoc(selectedVersion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedVersion]);

  const handleVersionChange = (v: number) => {
    setSelectedVersion(v);
  };

  const handleDownload = async (format: 'md' | 'pdf') => {
    setDownloading(format);
    try {
      await lifecycleService.downloadDocument(projectId, format);
    } catch (err) {
      console.error(`Download ${format} failed`, err);
    } finally {
      setDownloading(null);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setShowConfirmRegen(false);
    try {
      const res = await lifecycleService.generateDocument(projectId);
      if (res && res.doc) {
        setDoc(res.doc);
        setWasFallback(!!res.fallback);
        const newVer = version + 1;
        setVersion(newVer);
        setAllVersions((prev) => [newVer, ...prev]);
        setSelectedVersion(undefined); // Reset to latest
      }
    } catch (err: any) {
      console.error('Regeneration failed', err);
      setError(err?.response?.data?.message || 'Failed to regenerate execution document.');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto" />
        <p className="text-xs text-gray-500 font-medium">Loading execution document...</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="py-16 px-6 max-w-md mx-auto text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
          <FileText className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-gray-900">No Execution Document Found</h3>
          <p className="text-xs text-gray-500">
            This project has not generated an official execution document yet. Run the intake setup to generate one.
          </p>
        </div>
        {onLaunchWizard && (
          <button
            onClick={onLaunchWizard}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition shadow-xs"
          >
            <Sparkles className="w-4 h-4" /> Run Setup & Generate Document
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
            v{version}
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              Official Project Execution Document
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                {selectedVersion && selectedVersion !== allVersions[0] ? `Version ${version}` : 'Active Version'}
              </span>
            </h2>
            <p className="text-xs text-gray-500">
              Canonical baseline document for project objectives, work packages, and evaluation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {allVersions.length > 1 && (
            <select
              value={selectedVersion ?? allVersions[0]}
              onChange={(e) => handleVersionChange(Number(e.target.value))}
              className="px-2.5 py-1.5 border border-gray-200 bg-white rounded-xl text-xs font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            >
              {allVersions.map((v) => (
                <option key={v} value={v}>
                  Version {v}{v === allVersions[0] ? ' (latest)' : ''}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => handleDownload('md')}
            disabled={downloading === 'md'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-700 transition shadow-2xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading === 'md' ? 'Downloading...' : 'Markdown (.md)'}
          </button>

          <button
            onClick={() => handleDownload('pdf')}
            disabled={downloading === 'pdf'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-700 transition shadow-2xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading === 'pdf' ? 'Downloading...' : 'PDF (.pdf)'}
          </button>

          <button
            onClick={() => setShowConfirmRegen(true)}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-xs font-bold text-indigo-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmRegen && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
          <h4 className="text-xs font-bold text-amber-900">Confirm Document Regeneration</h4>
          <p className="text-xs text-amber-800">
            Regenerating will create a new version of the execution document and re-evaluate uniqueness guarantees. Are you sure?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition"
            >
              Yes, Regenerate Document
            </button>
            <button
              onClick={() => setShowConfirmRegen(false)}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold hover:bg-amber-100 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {wasFallback && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            The AI service was unavailable when this document was generated, so a deterministic template
            plan was produced instead. Regenerate once AI is configured for a tailored document.
          </span>
        </div>
      )}

      {/* Uniqueness Notes Banner (Engine 2) */}
      {doc.uniquenessNotes && (
        <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-indigo-950">AI Uniqueness Guarantee Note</h4>
            <p className="text-xs text-indigo-900 leading-relaxed">{doc.uniquenessNotes}</p>
          </div>
        </div>
      )}

      {/* Document Content - 10 Structured Sections */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 space-y-8 shadow-2xs">
        {/* 1. Overview */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            1. Project Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-700">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
              <span className="font-bold text-gray-900 block">Background</span>
              <p className="leading-relaxed">{doc.overview.background}</p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
              <span className="font-bold text-gray-900 block">Purpose</span>
              <p className="leading-relaxed">{doc.overview.purpose}</p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
              <span className="font-bold text-gray-900 block">Problem Statement</span>
              <p className="leading-relaxed">{doc.overview.problemStatement}</p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
              <span className="font-bold text-gray-900 block">Expected Outcome</span>
              <p className="leading-relaxed">{doc.overview.expectedOutcome}</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1 text-xs">
            <span className="font-bold text-gray-900 block">Project Scope</span>
            <p className="leading-relaxed text-gray-700">{doc.overview.scope}</p>
          </div>
        </section>

        {/* 2. Objectives */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            2. Measurable Objectives
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
            {doc.objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{obj}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. Deliverables */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            3. Target Deliverables
          </h3>
          <div className="flex flex-wrap gap-2">
            {doc.deliverables.map((del, i) => (
              <span key={i} className="px-3 py-1.5 bg-gray-100 border border-gray-200 text-gray-800 rounded-lg text-xs font-medium">
                ✓ {del}
              </span>
            ))}
          </div>
        </section>

        {/* 4. Work Breakdown & Percentage Allocation */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            4. Work Breakdown & Percentage Allocation
          </h3>
          <div className="space-y-3">
            {doc.workBreakdown.map((pkg) => (
              <div key={pkg.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-gray-900">
                  <span>{pkg.name}</span>
                  <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {pkg.percentage}% Allocation
                  </span>
                </div>
                <p className="text-xs text-gray-600">{pkg.description}</p>
                <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${pkg.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Required Skills & Skill Gap Analysis */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            5. Required Skills & Learning Directions
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {doc.skillsRequired.map((s, i) => (
              <span key={i} className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-semibold rounded-md">
                {s}
              </span>
            ))}
          </div>

          <SkillGapCard
            gaps={logState?.skills?.gaps || []}
            learningResources={doc.learningResources}
            memberNames={memberNames}
          />
        </section>

        {/* 6. Milestones Schedule */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            6. Project Milestones Schedule
          </h3>
          <div className="overflow-hidden border border-gray-200 rounded-xl bg-white">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold uppercase">
                  <th className="py-2.5 px-4">Milestone</th>
                  <th className="py-2.5 px-4">Expected Output</th>
                  <th className="py-2.5 px-4 text-right">Completion Week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {doc.milestones.map((ms, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-bold text-gray-900">{ms.name}</td>
                    <td className="py-3 px-4 text-gray-700">{ms.expectedOutput}</td>
                    <td className="py-3 px-4 text-right font-bold text-indigo-700">Week {ms.completionWeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 7. Risk Analysis */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            7. Risks & Mitigation Factors
          </h3>
          <ul className="space-y-2 text-xs text-gray-700">
            {doc.risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/40 border border-amber-100">
                <span className="text-amber-600 font-bold">⚠️</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 8. Success Criteria */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            8. Evaluation & Success Criteria
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
            {doc.successCriteria.map((crit, i) => (
              <li key={i} className="p-3 rounded-lg bg-emerald-50/40 border border-emerald-100 text-emerald-950 font-medium">
                🎯 {crit}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};
