import React from 'react';

interface CategoryBarsProps {
  categories: {
    execution: number;
    productivity: number;
    quality: number;
    collaboration: number;
  };
}

export const CategoryBars: React.FC<CategoryBarsProps> = ({ categories }) => {
  const items = [
    { label: 'Exec', val: categories.execution, color: 'bg-indigo-500' },
    { label: 'Prod', val: categories.productivity, color: 'bg-emerald-500' },
    { label: 'Qual', val: categories.quality, color: 'bg-amber-500' },
    { label: 'Collab', val: categories.collaboration, color: 'bg-sky-500' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 w-full">
      {items.map((item) => {
        const pct = Math.min(100, Math.max(0, Math.round((item.val || 0) * 100)));
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
              <span>{item.label}</span>
              <span className="font-mono text-slate-700">{pct}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${item.color} rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
