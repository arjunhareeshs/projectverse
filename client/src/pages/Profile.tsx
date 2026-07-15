import React from 'react';

export const Profile: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-5xl mb-4">🚧</div>
      <h1 className="text-2xl font-bold text-foreground mb-2">User Profile</h1>
      <p className="text-muted-foreground max-w-sm">View and update your profile information.</p>
      <p className="mt-2 text-xs text-muted-foreground">This module is coming soon — currently being built.</p>
    </div>
  );
};
