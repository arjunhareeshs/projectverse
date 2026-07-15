import React, { useState, useRef } from 'react';
import { Users, Users2, Trophy, Upload, X, Plus, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { adminService } from '../../services/admin.service';

type Section = 'students' | 'teams' | 'achievements';
type EntryMode = 'manual' | 'bulk';

const DOMAINS = ['AI', 'Web', 'Mobile', 'IoT', 'Data Science', 'Cybersecurity', 'Cloud', 'Blockchain'];
const STATUSES = ['planned', 'in-progress', 'completed', 'at-risk'];
const YEARS = ['I', 'II', 'III', 'IV'];

interface Toast {
  type: 'success' | 'error';
  message: string;
}

export const AdminUpload: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('students');
  const [entryMode, setEntryMode] = useState<EntryMode>('manual');
  const [toast, setToast] = useState<Toast | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Student form state
  const [studentForm, setStudentForm] = useState({
    fullName: '',
    studentId: '',
    email: '',
    domain: '',
    teamId: '',
    year: '',
  });

  // Team form state
  const [teamForm, setTeamForm] = useState({
    name: '',
    domain: '',
    problemStatement: '',
    projectTitle: '',
    status: 'planned',
    leadEmail: '',
  });

  // Achievement form state
  const [achForm, setAchForm] = useState({
    title: '',
    description: '',
    type: 'individual',
    recipientId: '',
    teamId: '',
    points: '',
    date: new Date().toISOString().split('T')[0],
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Upload card icons ──────────────────────────────────────────────────────
  const sections = [
    {
      id: 'students' as Section,
      Icon: Users,
      label: 'Students',
      sub: 'Add one-by-one or bulk import roster.',
    },
    {
      id: 'teams' as Section,
      Icon: Users2,
      label: 'Teams',
      sub: 'Register teams with problem statements.',
    },
    {
      id: 'achievements' as Section,
      Icon: Trophy,
      label: 'Achievements',
      sub: 'Log wins for individuals or teams.',
    },
  ];

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploading(true);
      await adminService.createStudent(studentForm);
      showToast('success', `Student "${studentForm.fullName}" added successfully!`);
      setStudentForm({ fullName: '', studentId: '', email: '', domain: '', teamId: '', year: '' });
    } catch (err: any) {
      showToast('error', err.response?.data?.message || err.message || 'Failed to add student');
    } finally {
      setUploading(false);
    }
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploading(true);
      await adminService.createTeam(teamForm);
      showToast('success', `Team "${teamForm.name}" created successfully!`);
      setTeamForm({ name: '', domain: '', problemStatement: '', projectTitle: '', status: 'planned', leadEmail: '' });
    } catch (err: any) {
      showToast('error', err.response?.data?.message || err.message || 'Failed to create team');
    } finally {
      setUploading(false);
    }
  };

  const handleAchievementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploading(true);
      await adminService.createAchievement({
        ...achForm,
        points: parseInt(achForm.points) || 0,
      });
      showToast('success', `Achievement "${achForm.title}" logged!`);
      setAchForm({ title: '', description: '', type: 'individual', recipientId: '', teamId: '', points: '', date: new Date().toISOString().split('T')[0] });
    } catch (err: any) {
      showToast('error', err.response?.data?.message || err.message || 'Failed to log achievement');
    } finally {
      setUploading(false);
    }
  };

  const handleBulkUpload = async (file: File) => {
    try {
      setUploading(true);
      let result: any;
      if (activeSection === 'students') result = await adminService.bulkUploadStudents(file);
      else if (activeSection === 'teams') result = await adminService.bulkUploadTeams(file);
      else result = await adminService.bulkUploadAchievements(file);

      showToast('success', `Bulk upload done: ${result.created} created, ${result.skipped} skipped`);
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Bulk upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Field component ────────────────────────────────────────────────────────
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition bg-white";
  const selectCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition bg-white appearance-none";

  return (
    <div className="min-h-screen bg-[#f7f8fa] p-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-16 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium animate-in slide-in-from-right transition-all ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          )}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Page Title */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Uploads</h1>
          <p className="text-sm text-gray-400 mt-0.5">Three flows: students, teams, achievements. Manual or bulk .xlsx.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
          <Upload className="h-3 w-3" />
          Admin-only
        </span>
      </div>

      {/* Section Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {sections.map(({ id, Icon, label, sub }) => (
          <button
            key={id}
            onClick={() => { setActiveSection(id); setEntryMode('manual'); }}
            className={`flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all hover:shadow-md ${
              activeSection === id
                ? 'border-indigo-300 bg-white shadow-md ring-1 ring-indigo-300'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                activeSection === id ? 'bg-indigo-600' : 'bg-indigo-500'
              } shadow-md`}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
              <p className="text-xs text-indigo-500 mt-1.5 font-medium">Bulk .xlsx</p>
            </div>
          </button>
        ))}
      </div>

      {/* Entry Panel */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">
            {activeSection === 'students'
              ? 'Student Entry'
              : activeSection === 'teams'
              ? 'Team Entry'
              : 'Achievement Entry'}
          </h2>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button
              onClick={() => setEntryMode('manual')}
              className={`px-4 py-1.5 font-medium transition-colors ${
                entryMode === 'manual' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => setEntryMode('bulk')}
              className={`px-4 py-1.5 font-medium transition-colors ${
                entryMode === 'bulk' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              Bulk .xlsx
            </button>
          </div>
        </div>

        {/* Manual Forms */}
        {entryMode === 'manual' && (
          <div className="p-6">

            {/* ── Students Form ── */}
            {activeSection === 'students' && (
              <form onSubmit={handleStudentSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <Field label="Full name">
                    <input
                      className={inputCls}
                      placeholder="Sara Menon"
                      value={studentForm.fullName}
                      onChange={e => setStudentForm(p => ({ ...p, fullName: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Student ID">
                    <input
                      className={inputCls}
                      placeholder="S-0041"
                      value={studentForm.studentId}
                      onChange={e => setStudentForm(p => ({ ...p, studentId: e.target.value }))}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      className={inputCls}
                      placeholder="sara@school.edu"
                      value={studentForm.email}
                      onChange={e => setStudentForm(p => ({ ...p, email: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Domain">
                    <div className="relative">
                      <select
                        className={selectCls}
                        value={studentForm.domain}
                        onChange={e => setStudentForm(p => ({ ...p, domain: e.target.value }))}
                      >
                        <option value="">Pick domain</option>
                        {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </Field>
                  <Field label="Assign to team">
                    <div className="relative">
                      <select
                        className={selectCls}
                        value={studentForm.teamId}
                        onChange={e => setStudentForm(p => ({ ...p, teamId: e.target.value }))}
                      >
                        <option value="">Optional</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </Field>
                  <Field label="Year / batch">
                    <input
                      className={inputCls}
                      placeholder="2026"
                      value={studentForm.year}
                      onChange={e => setStudentForm(p => ({ ...p, year: e.target.value }))}
                    />
                  </Field>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    {uploading ? 'Adding...' : 'Add student'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Teams Form ── */}
            {activeSection === 'teams' && (
              <form onSubmit={handleTeamSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <Field label="Team name">
                    <input
                      className={inputCls}
                      placeholder="AI Pioneers"
                      value={teamForm.name}
                      onChange={e => setTeamForm(p => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Domain">
                    <div className="relative">
                      <select
                        className={selectCls}
                        value={teamForm.domain}
                        onChange={e => setTeamForm(p => ({ ...p, domain: e.target.value }))}
                      >
                        <option value="">Pick domain</option>
                        {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </Field>
                  <Field label="Project title">
                    <input
                      className={inputCls}
                      placeholder="MediScan AI"
                      value={teamForm.projectTitle}
                      onChange={e => setTeamForm(p => ({ ...p, projectTitle: e.target.value }))}
                    />
                  </Field>
                  <Field label="Status">
                    <div className="relative">
                      <select
                        className={selectCls}
                        value={teamForm.status}
                        onChange={e => setTeamForm(p => ({ ...p, status: e.target.value }))}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </Field>
                  <div className="col-span-2">
                    <Field label="Problem statement">
                      <textarea
                        className={inputCls + ' resize-none h-24'}
                        placeholder="Describe the problem being solved..."
                        value={teamForm.problemStatement}
                        onChange={e => setTeamForm(p => ({ ...p, problemStatement: e.target.value }))}
                      />
                    </Field>
                  </div>
                  <Field label="Lead email (optional)">
                    <input
                      type="email"
                      className={inputCls}
                      placeholder="lead@school.edu"
                      value={teamForm.leadEmail}
                      onChange={e => setTeamForm(p => ({ ...p, leadEmail: e.target.value }))}
                    />
                  </Field>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    {uploading ? 'Creating...' : 'Create team'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Achievements Form ── */}
            {activeSection === 'achievements' && (
              <form onSubmit={handleAchievementSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <Field label="Achievement title">
                    <input
                      className={inputCls}
                      placeholder="1st Place – National Hackathon"
                      value={achForm.title}
                      onChange={e => setAchForm(p => ({ ...p, title: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Type">
                    <div className="relative">
                      <select
                        className={selectCls}
                        value={achForm.type}
                        onChange={e => setAchForm(p => ({ ...p, type: e.target.value }))}
                      >
                        <option value="individual">Individual</option>
                        <option value="team">Team</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </Field>
                  <Field label="Points">
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="100"
                      value={achForm.points}
                      onChange={e => setAchForm(p => ({ ...p, points: e.target.value }))}
                    />
                  </Field>
                  <Field label="Date">
                    <input
                      type="date"
                      className={inputCls}
                      value={achForm.date}
                      onChange={e => setAchForm(p => ({ ...p, date: e.target.value }))}
                    />
                  </Field>
                  {achForm.type === 'individual' ? (
                    <Field label="Student ID / Reg No">
                      <input
                        className={inputCls}
                        placeholder="PV2404"
                        value={achForm.recipientId}
                        onChange={e => setAchForm(p => ({ ...p, recipientId: e.target.value }))}
                      />
                    </Field>
                  ) : (
                    <Field label="Team ID">
                      <input
                        className={inputCls}
                        placeholder="Team identifier"
                        value={achForm.teamId}
                        onChange={e => setAchForm(p => ({ ...p, teamId: e.target.value }))}
                      />
                    </Field>
                  )}
                  <div className="col-span-2">
                    <Field label="Description">
                      <textarea
                        className={inputCls + ' resize-none h-20'}
                        placeholder="Describe the achievement..."
                        value={achForm.description}
                        onChange={e => setAchForm(p => ({ ...p, description: e.target.value }))}
                      />
                    </Field>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60"
                  >
                    <Trophy className="h-4 w-4" />
                    {uploading ? 'Logging...' : 'Log achievement'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Bulk Upload Panel */}
        {entryMode === 'bulk' && (
          <div className="p-8">
            {/* Hidden file input */}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleBulkUpload(file);
                e.target.value = '';
              }}
            />

            {/* Large blue-gradient upload card */}
            <div
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer mx-auto max-w-lg rounded-2xl overflow-hidden shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #4f6ef7 0%, #6b8af7 40%, #7b9bf8 70%, #a0b4f8 100%)',
              }}
            >
              {/* Wave decoration */}
              <div className="relative px-8 py-10 flex flex-col items-center text-center">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full mb-4 shadow-lg"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  <Upload className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">
                  {activeSection === 'students' ? 'Students' : activeSection === 'teams' ? 'Teams' : 'Achievements'}
                </h3>
                <p className="text-white/80 text-sm mb-1">
                  {activeSection === 'students'
                    ? 'Bulk upload student records with name, roll no, domain, skills, progress'
                    : activeSection === 'teams'
                    ? 'Bulk upload teams with project titles, problem statements, status'
                    : 'Bulk upload achievements for individual students or full teams'}
                </p>
                <div
                  className="mt-4 flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-white"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
                  </svg>
                  .xlsx / .csv
                </div>

                {/* Decorative wave lines */}
                <svg className="absolute bottom-0 left-0 w-full opacity-20" viewBox="0 0 400 60" preserveAspectRatio="none">
                  <path d="M0,30 Q100,0 200,30 T400,30 L400,60 L0,60 Z" fill="white" />
                </svg>
                <svg className="absolute bottom-0 left-0 w-full opacity-10" viewBox="0 0 400 50" preserveAspectRatio="none">
                  <path d="M0,20 Q100,50 200,20 T400,20 L400,50 L0,50 Z" fill="white" />
                </svg>
              </div>
            </div>

            {uploading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-indigo-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                Uploading and processing...
              </div>
            )}

            <p className="mt-4 text-center text-xs text-gray-400">
              Drag & drop or click to select your Excel / CSV file. Max 10MB.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
