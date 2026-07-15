import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { ChatDockProvider, useChatDock } from '../chat/ChatDockContext';
import { ChatDock } from '../chat/ChatDock';
import { ChatLauncher } from '../chat/ChatLauncher';
import { useDispatch } from 'react-redux';
import { authService } from '../services/auth.service';
import { setCredentials } from '../features/auth/authSlice';

const LayoutInner: React.FC = () => {
  const { contentLeft, contentRight } = useChatDock();
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
    <div className="min-h-screen bg-background">
      <ChatDock />
      <Sidebar />
      <Navbar />
      <div
        className="flex min-h-screen flex-col transition-[padding] duration-300 ease-out"
        style={{ paddingLeft: contentLeft, paddingRight: contentRight }}
      >
        <main className="flex-1 overflow-x-hidden pt-16">
          <div className="mx-auto max-w-[1400px] p-6">
            <Outlet />
          </div>
        </main>
      </div>
      <ChatLauncher />
    </div>
  );
};

export const MainLayout: React.FC = () => {
  return (
    <ChatDockProvider>
      <LayoutInner />
    </ChatDockProvider>
  );
};
