import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
  ArrowRight,
  Trophy,
  Layers,
  ChevronLeft,
} from 'lucide-react';
import {
  capstoneService,
  CapstoneMcqQuestionClient,
  CapstoneMcqSubmitResult,
} from '../services/capstone.service';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const CapstoneMcqPage: React.FC = () => {
  const { selectionId } = useParams<{ selectionId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [questions, setQuestions] = useState<CapstoneMcqQuestionClient[]>([]);

  // Selected answers: map questionId -> selectedOption (0 to 5)
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CapstoneMcqSubmitResult | null>(null);

  useEffect(() => {
    if (!selectionId) {
      setError('Invalid selection identifier');
      setLoading(false);
      return;
    }

    const fetchQuestions = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await capstoneService.getMcq(selectionId);
        setProjectName(res.projectName || 'Capstone Project');
        setQuestions(res.questions || []);
      } catch (err: any) {
        console.error('Error loading MCQs:', err);
        setError(
          err.response?.data?.message ||
            'Unable to load MCQ evaluation. Please ensure your repository was submitted and analyzed.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [selectionId]);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (result) return; // Locked once submitted
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;
  const isAllAnswered = totalCount > 0 && answeredCount === totalCount;

  const handleSubmit = async () => {
    if (!selectionId || !isAllAnswered || submitting) return;

    try {
      setSubmitting(true);
      setError(null);

      const payload = Object.entries(answers).map(([questionId, selectedOption]) => ({
        questionId,
        selectedOption,
      }));

      const res = await capstoneService.submitMcq(selectionId, payload);
      setResult(res);
    } catch (err: any) {
      console.error('Error submitting answers:', err);
      setError(err.response?.data?.message || 'Failed to submit evaluation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <h2 className="text-base font-bold text-slate-800">Loading MCQ Evaluation</h2>
          <p className="text-xs text-slate-500">
            Preparing your 15 code-specific evaluation questions...
          </p>
        </div>
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md p-8 bg-white rounded-2xl border border-rose-200 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Assessment Unavailable</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/projects')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to My Projects
          </button>
        </div>
      </div>
    );
  }

  // Final Result View
  if (result) {
    const percentage = result.percentage;
    const isPass = percentage >= 50;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto shadow-inner">
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
              Evaluation Completed
            </span>
            <h1 className="text-2xl font-black text-slate-900 mt-3">Capstone Assessment Result</h1>
            <p className="text-xs text-slate-500 mt-1">{projectName}</p>
          </div>

          {/* Score Display Card */}
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="text-4xl font-black text-slate-900 tracking-tight">
              {result.score} <span className="text-2xl text-slate-400 font-normal">/ {result.totalQuestions}</span>
            </div>
            <div className="text-xs font-semibold text-slate-600">
              Accuracy: <span className={isPass ? 'text-emerald-600' : 'text-amber-600'}>{percentage}%</span>
            </div>

            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isPass ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 leading-relaxed text-left">
            <span className="font-semibold block mb-0.5">Evaluation Finalized:</span>
            Your final score of <strong>{result.score}/15</strong> has been permanently recorded in your project record. The generated evaluation questions have now been securely cleared from the system.
          </div>

          <button
            onClick={() => navigate('/projects')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition cursor-pointer"
          >
            <span>Return to My Projects</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24">
      {/* Top Fixed Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Capstone MCQ Assessment
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-700">{projectName}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-0.5">
              Code & Architecture Deep Evaluation
            </h1>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="text-right">
              <span className="text-xs font-bold text-slate-900">
                {answeredCount} of {totalCount} Answered
              </span>
              <span className="text-[10px] text-slate-500 block">
                {totalCount - answeredCount} remaining
              </span>
            </div>
            <div className="w-28 h-2.5 bg-slate-100 rounded-full overflow-hidden shrink-0 border border-slate-200">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Instructions Banner */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-indigo-950 text-xs leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Assessment Instructions:</span>
          </div>
          <p>
            Please answer all <strong>15 questions</strong>. Each question has exactly <strong>6 options</strong>, synthesized from the code, dependencies, and implementation of your submitted repository. Your responses will be scored immediately upon submission.
          </p>
        </div>

        {/* Questions List */}
        <div className="space-y-6">
          {questions.map((q, qIndex) => {
            const selectedOption = answers[q.id];
            const isAnswered = selectedOption !== undefined;

            return (
              <div
                key={q.id}
                className={`p-6 rounded-2xl bg-white border transition-all duration-200 ${
                  isAnswered
                    ? 'border-indigo-200 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Question Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {qIndex + 1}
                    </span>
                    {q.topic && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        {q.topic}
                      </span>
                    )}
                    {q.difficulty && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize bg-slate-50 text-slate-500 border border-slate-200">
                        {q.difficulty}
                      </span>
                    )}
                  </div>

                  {isAnswered && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Answered
                    </span>
                  )}
                </div>

                {/* Question Text */}
                <h2 className="text-sm font-bold text-slate-900 leading-snug mb-4">
                  {q.question}
                </h2>

                {/* 6 Radio Options */}
                <div className="space-y-2">
                  {q.options.map((opt, optIndex) => {
                    const isSelected = selectedOption === optIndex;

                    return (
                      <button
                        key={optIndex}
                        type="button"
                        onClick={() => handleSelectOption(q.id, optIndex)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-600 text-indigo-950 ring-2 ring-indigo-500/10 font-medium'
                            : 'bg-slate-50/50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {/* Option Radio/Letter Badge */}
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {OPTION_LETTERS[optIndex] || optIndex + 1}
                        </span>

                        <span className="leading-relaxed flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Bottom Sticky Action Bar */}
      <footer className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 p-4 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            {isAllAnswered ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                All 15 questions answered. Ready to submit!
              </span>
            ) : (
              <span>
                Please answer all 15 questions before submitting ({totalCount - answeredCount} remaining).
              </span>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isAllAnswered || submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scoring Assessment...
              </>
            ) : (
              <>
                <span>Submit Assessment</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};
