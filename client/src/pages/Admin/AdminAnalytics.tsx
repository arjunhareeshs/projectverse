import React from 'react';

export const AdminAnalytics: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-5xl mb-4">⚙️</div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Admin Analytics</h1>
      <p className="text-muted-foreground max-w-sm">KPIs: project completion, team productivity, budget utilization.</p>
      <p className="mt-2 text-xs text-muted-foreground">Admin module — being built in the next phase.</p>
    </div>
  );
};
