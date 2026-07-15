import React from 'react';

export const TeamManagement: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-5xl mb-4">⚙️</div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Team Management</h1>
      <p className="text-muted-foreground max-w-sm">Create teams, assign leads and members, track performance.</p>
      <p className="mt-2 text-xs text-muted-foreground">Admin module — being built in the next phase.</p>
    </div>
  );
};
