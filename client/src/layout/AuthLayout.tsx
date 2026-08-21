import React from 'react';
import { Outlet } from 'react-router-dom';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#ECEFF2] p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Subtle ambient lighting / bloom in background */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-300/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-300/30 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full flex justify-center relative z-10">
        <Outlet />
      </div>
    </div>
  );
};

