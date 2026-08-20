import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useDispatch } from 'react-redux';
import { authService } from '../services/auth.service';
import { setCredentials } from '../features/auth/authSlice';

export const MainLayout: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const syncUser = async () => {
      try {
        const res = await authService.getCurrentUser();
        if (res && res.user) {
          const token = localStorage.getItem('pv_token') || '';
          dispatch(setCredentials({ user: res.user, token }));
        }
      } catch (err) {
        console.error('Failed to sync current user profile:', err);
      }
    };
    syncUser();
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <Navbar />
      <div
        className="flex min-h-screen flex-col"
        style={{ paddingLeft: 256, paddingRight: 0 }}
      >
        <main className="flex-1 overflow-x-hidden pt-16">
          <div className="mx-auto max-w-[1400px] p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
