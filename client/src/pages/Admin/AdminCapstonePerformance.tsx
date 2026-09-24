import React, { useState } from 'react';
import {
  Search,
  ClipboardCheck,
  Loader2,
  AlertCircle,
  UserX,
  Target,
  CheckCircle2,
  Trophy,
  Pencil,
} from 'lucide-react';
import { capstoneService, StudentPerformance } from '../../services/capstone.service';
import { adminService } from '../../services/admin.service';

const statusStyles: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CLAIMED: 'bg-slate-100 text-slate-600 border border-slate-200',
  SUBMITTED: 'bg-blue-50 text-blue-700 border border-blue-200',
  MCQ_READY: 'bg-amber-50 text-amber-700 border border-amber-200',
  EXPIRED: 'bg-rose-50 text-rose-700 border border-rose-200',
};

export const AdminCapstonePerformance: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [result, setResult] = useState<StudentPerformance | null>(null);

  const [editingRegNo, setEditingRegNo] = useState(false);
  const [regNoInput, setRegNoInput] = useState('');
  const [savingRegNo, setSavingRegNo] = useState(false);
  const [regNoError, setRegNoError] = useState<string | null>(null);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setNotFound(false);
    setResult(null);

    try {
      const data = await capstoneService.getStudentPerformance(q);
      setResult(data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(err.response?.data?.message || 'Failed to search student performance.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') runSearch();
  };

  const handleSaveRegNo = async () => {
    if (!result || !regNoInput.trim()) return;
    setSavingRegNo(true);
    setRegNoError(null);
    try {
      await adminService.updateStudentRegNo(result.student.id, regNoInput.trim());
      setResult({ ...result, student: { ...result.student, regNo: regNoInput.trim() } });
      setEditingRegNo(false);
    } catch (err: any) {
      setRegNoError(err.response?.data?.message || 'Failed to save register number.');
    } finally {
      setSavingRegNo(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold text-slate-900">Capstone Performance</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
            Admin Portal
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Look up a student by email or register number to see every capstone project they've claimed and their MCQ test scores.
        </p>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-96">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by email or register number..."
          className="w-full pl-10 pr-24 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition"
        />
        <button
          onClick={runSearch}
          disabled={loading || !query.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-xs disabled:opacity-50 cursor-pointer"
        >
          Search
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 mt-2">Searching...</p>
        </div>
      )}

      {!loading && notFound && (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
          <UserX className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">No student found</p>
          <p className="text-xs text-slate-500">Check the email or register number and try again.</p>
        </div>
      )}

      {!loading && !notFound && !result && (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
          <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">Search for a student to begin</p>
          <p className="text-xs text-slate-500">Their capstone projects and marks will appear here.</p>
        </div>
      )}

      {!loading && result && (
        <>
          {/* Student profile header */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-base font-bold text-slate-900 block">{result.student.fullName}</span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                <span>{result.student.email}</span>
                <span className="text-slate-300">•</span>
                {result.student.regNo ? (
                  <span className="font-semibold text-slate-700">{result.student.regNo}</span>
                ) : editingRegNo ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={regNoInput}
                      onChange={(e) => setRegNoInput(e.target.value)}
                      placeholder="Enter register number"
                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-900 focus:border-indigo-500 outline-none"
                    />
                    <button
                      onClick={handleSaveRegNo}
                      disabled={savingRegNo || !regNoInput.trim()}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {savingRegNo ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingRegNo(false);
                        setRegNoError(null);
                      }}
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRegNoInput('');
                      setEditingRegNo(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700"
                  >
                    <Pencil className="w-3 h-3" />
                    No register number — set it
                  </button>
                )}
                {result.student.team && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>{result.student.team.name}</span>
                  </>
                )}
              </div>
              {regNoError && <p className="text-[11px] text-rose-600 mt-1">{regNoError}</p>}
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center">
                <span className="text-lg font-bold text-slate-900 block tabular-nums">{result.totalProjects}</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Projects</span>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-center">
                <span className="text-lg font-bold text-emerald-600 block tabular-nums">{result.testsCompleted}</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Tests Done</span>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-center">
                <span className="text-lg font-bold text-amber-600 block tabular-nums">
                  {result.testsCompleted > 0 ? result.averageScore : '—'}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Avg Score</span>
              </div>
            </div>
          </div>

          {/* Projects table */}
          {result.projects.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
              <Target className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No capstone projects claimed yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-5">Project</th>
                    <th className="py-3 px-4">Problem Statement</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Score</th>
                    <th className="py-3 px-4">Selected</th>
                    <th className="py-3 px-5">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.projects.map((p) => (
                    <tr key={p.selectionId} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-5 font-bold text-slate-900">{p.projectName}</td>
                      <td className="py-4 px-4 text-slate-600">{p.problemTitle || '—'}</td>
                      <td className="py-4 px-4 text-center align-middle">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            statusStyles[p.status] || 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {p.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
                          {p.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center align-middle font-bold text-slate-900 tabular-nums">
                        {p.mcqScore !== null ? (
                          <span className="inline-flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-amber-500" />
                            {p.mcqScore}/{p.totalQuestions}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-500">{new Date(p.selectedAt).toLocaleDateString()}</td>
                      <td className="py-4 px-5 text-slate-500">
                        {p.completedAt ? new Date(p.completedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
