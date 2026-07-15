import React from 'react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-5xl mb-4">🚧</div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Settings</h1>
      <p className="text-muted-foreground max-w-sm">Configure your workspace and preferences.</p>
      <p className="mt-2 text-xs text-muted-foreground">This module is coming soon — currently being built.</p>
    </div>
  );
};
