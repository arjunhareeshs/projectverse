import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Sparkles, Check } from 'lucide-react';
import { ProjectCategory } from '../../types/projectLog';
import { lifecycleService } from '../../services/lifecycle.service';

interface DurationStepProps {
  projectId: string;
  category: ProjectCategory;
  months: number;
  startDate: string;
  onChange: (data: { months: number; startDate: string }) => void;
}

export const DurationStep: React.FC<DurationStepProps> = ({
  projectId,
  category,
  months,
  startDate,
  onChange,
}) => {
  const [currentMonths, setCurrentMonths] = useState(months || 6);
  const [currentStartDate, setCurrentStartDate] = useState(
    startDate || new Date().toISOString().split('T')[0]
  );
  const [advisory, setAdvisory] = useState<string | null>(null);
  const [suggestedMonths, setSuggestedMonths] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await lifecycleService.checkDuration(projectId, category, currentMonths);
        if (res && res.advisory) {
          setAdvisory(res.advisory);
          if (res.suggestedMonths) {
            setSuggestedMonths(res.suggestedMonths);
          }
        } else {
          setAdvisory(null);
          setSuggestedMonths(null);
        }
      } catch (err) {
        console.error('Duration check failed', err);
      } finally {
        setChecking(false);
      }
    }, 400);

    onChange({ months: currentMonths, startDate: currentStartDate });
    return () => clearTimeout(timer);
  }, [currentMonths, currentStartDate, category, projectId]);

  const handleApplySuggestion = () => {
    if (suggestedMonths) {
      setCurrentMonths(suggestedMonths);
      setAdvisory(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-gray-900">Project Duration & Schedule</h3>
        <p className="text-xs text-gray-500">
          Specify the expected duration in months and project start date.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Months Stepper */}
        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
          <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-600" /> Duration (Months)
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentMonths(Math.max(1, currentMonths - 1))}
              className="w-10 h-10 rounded-xl bg-white border border-gray-300 font-bold text-gray-700 text-lg hover:bg-gray-100 transition shadow-2xs flex items-center justify-center"
            >
              -
            </button>
            <span className="font-bold text-xl text-indigo-900 min-w-12 text-center">
              {currentMonths} mo
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonths(Math.min(18, currentMonths + 1))}
              className="w-10 h-10 rounded-xl bg-white border border-gray-300 font-bold text-gray-700 text-lg hover:bg-gray-100 transition shadow-2xs flex items-center justify-center"
            >
              +
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            Typical range: Mini (2-3 months), Final Year (6 months).
          </p>
        </div>

        {/* Start Date */}
        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
          <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Start Date
          </label>
          <input
            type="date"
            value={currentStartDate}
            onChange={(e) => setCurrentStartDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          <p className="text-[11px] text-gray-500">
            Target End Date: {' '}
            {new Date(
              new Date(currentStartDate || Date.now()).setMonth(
                new Date(currentStartDate || Date.now()).getMonth() + currentMonths
              )
            ).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* AI Advisory Callout */}
      {advisory && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-900">AI Duration Advisory</h4>
              <p className="text-xs text-amber-800 leading-relaxed">{advisory}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {suggestedMonths && (
              <button
                type="button"
                onClick={handleApplySuggestion}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" /> Apply {suggestedMonths} Months Suggestion
              </button>
            )}
            <button
              type="button"
              onClick={() => setAdvisory(null)}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold hover:bg-amber-100/50 transition"
            >
              Keep {currentMonths} Months Anyway
            </button>
          </div>
        </div>
      )}

      {checking && <p className="text-xs text-gray-400">Checking duration with AI mentor...</p>}
    </div>
  );
};
