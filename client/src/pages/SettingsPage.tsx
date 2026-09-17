import React, { useState } from 'react';
import { Sparkles, Shield, Key } from 'lucide-react';
import { AISettingsModal } from '../components/ai/AISettingsModal';

export const SettingsPage: React.FC = () => {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Settings & Integrations</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your account preferences, personal API keys, and workspace intelligence providers.
        </p>
      </div>

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* AI Provider BYOK Card */}
        <div className="rounded-3xl border border-indigo-100 dark:border-indigo-950/80 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-indigo-950/20 dark:via-slate-900 dark:to-purple-950/10 p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none">
                <Sparkles className="h-6 w-6" />
              </div>
              <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-950 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                BYOK v2.0
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white">AI Provider Keys</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Configure your personal <strong>Groq</strong> (Primary) and <strong>NVIDIA NIM</strong> (Fallback) API keys. All keys are encrypted using AES-256-GCM.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-indigo-50 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-xs"
            >
              <Key className="h-4 w-4" />
              <span>Configure AI Keys</span>
            </button>
          </div>
        </div>

        {/* Security & Isolation Card */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-none">
                <Shield className="h-6 w-6" />
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                Active
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white">Security & Encryption</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              ProjectVerse derives all provider requests strictly from your authenticated session. Your keys are never logged or exposed in audit trails.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Cipher: AES-256-GCM</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Zero-Leak Guard</span>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AISettingsModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </div>
  );
};
