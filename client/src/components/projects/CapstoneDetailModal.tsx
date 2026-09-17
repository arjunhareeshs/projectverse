import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Code2,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { capstoneService, CapstoneProblem } from '../../services/capstone.service';

interface CapstoneDetailModalProps {
  problem: CapstoneProblem | null;
  isOpen: boolean;
  onClose: () => void;
  onClaimSuccess: () => void;
}

export const CapstoneDetailModal: React.FC<CapstoneDetailModalProps> = ({
  problem,
  isOpen,
  onClose,
  onClaimSuccess,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen, problem?.id]);

  if (!isOpen || !problem) return null;

  const handleClaim = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await capstoneService.claimProblem(problem.id);
      onClaimSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to claim capstone project:', err);
      setError(err.response?.data?.message || 'Failed to claim capstone project. Please try again.');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="space-y-1 pr-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Capstone Challenge
              </span>
              {problem.domain && (
                <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {problem.domain}
                </span>
              )}
              {problem.difficulty && (
                <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${difficultyColor(problem.difficulty)}`}>
                  {problem.difficulty}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight pt-1">
              {problem.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 7-Day Deadline Notice */}
          <div className="flex items-start gap-3.5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-semibold block text-amber-950">
                7-Day Completion Timeline & MCQ Evaluation
              </span>
              Once claimed, you will have exactly <strong>7 days</strong> to build your solution.
              After 7 days, you will submit your GitHub repository link and take an AI-generated
              <strong> {problem.questionCount || 15}-question technical MCQ assessment</strong> tailored to your actual codebase.
            </div>
          </div>

          {/* Problem Statement */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Problem Statement
            </h3>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {problem.problemText}
            </div>
          </div>

          {/* Technologies */}
          {problem.technologies && problem.technologies.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Recommended Technologies
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {problem.technologies.map((tech, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50/70 border border-indigo-100 text-indigo-700 text-xs font-medium"
                  >
                    <Code2 className="w-3 h-3" />
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleClaim}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-200 transition-all cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Claiming Capstone...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Claim Capstone Project
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
