import React from 'react';

interface ScoreRingProps {
  score: number; // 0 - 100
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 56,
  strokeWidth = 5,
  label,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.min(100, Math.max(0, score));
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  let colorClass = 'text-indigo-600';
  if (normalizedScore >= 85) colorClass = 'text-amber-500';
  else if (normalizedScore >= 75) colorClass = 'text-emerald-500';
  else if (normalizedScore >= 60) colorClass = 'text-indigo-600';
  else colorClass = 'text-slate-400';

  return (
    <div className="flex flex-col items-center justify-center shrink-0">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="text-slate-100"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className={`${colorClass} transition-all duration-700 ease-out`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
          />
        </svg>
        <span className="absolute text-xs font-black text-slate-800 tracking-tighter font-mono">
          {Math.round(score)}
        </span>
      </div>
      {label && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</span>}
    </div>
  );
};
