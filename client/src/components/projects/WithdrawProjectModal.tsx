import React, { useState } from 'react';
import { AlertTriangle, X, LogOut, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface WithdrawProjectModalProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const WithdrawProjectModal: React.FC<WithdrawProjectModalProps> = ({
  isOpen,
  projectId,
  projectName,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for withdrawing from the project.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post(`/projects/${projectId}/withdraw`, {
        reason: reason.trim(),
      });
      setReason('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Withdraw error:', err);
      setError(
        err.response?.data?.message || 'Failed to withdraw from project. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-xl font-sans animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Confirm Project Withdrawal
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Are you sure you want to withdraw from this project?
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 text-slate-400 rounded-lg hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleWithdraw} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-xs text-amber-800 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-900">
              <LogOut className="w-4 h-4 shrink-0 text-amber-600" />
              Slot Restoration Notice:
            </p>
            <p>
              Withdrawing will delete this project selection for your team (**{projectName}**).
              The problem statement slot will be restored back to the catalog so other teams can claim it.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Why are you withdrawing? <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              rows={4}
              placeholder="Please explain the reason for withdrawing from this project (e.g. technical pivot, domain mismatch, team re-alignment)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition resize-none"
              required
            />
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Withdrawing...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  Confirm Withdrawal
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
