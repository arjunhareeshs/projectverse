import React, { useState } from 'react';
import { api } from '../../services/api';
import {
  ArrowRight,
  Sparkles,
  CheckCircle,
  AlertCircle,
  FileText,
  Target,
  Cpu,
  Users,
  Calendar,
  Layers,
  Lightbulb,
  Box,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TeamMemberSelect } from './TeamMemberSelect';

export const ProjectProposalForm: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    problemStatement: '',
    objective: '',
    description: '',
    expectedOutcome: '',
    technologies: '',
    requirements: '', // Hardware/Software Requirements
    innovation: '',
    scope: '',
    timeline: '',
  });

  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [similarity, setSimilarity] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const checkSimilarity = async () => {
    setLoading(true);
    try {
      const res = await api.post('/projects/similarity', {
        name: formData.name,
        problemStatement: formData.problemStatement,
        objective: formData.objective,
        expectedOutcome: formData.expectedOutcome,
      });
      setSimilarity(res.data);
      setStep(2);
    } catch (err) {
      console.error(err);
      // Proceed even if similarity fails
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const submitProject = async () => {
    setLoading(true);
    try {
      // Bundle Scope and Timeline into description
      const bundledDescription = `
${formData.description}

### Scope
${formData.scope}

### Estimated Timeline
${formData.timeline}
      `.trim();

      await api.post('/projects', {
        name: formData.name,
        domain: formData.domain,
        problemStatement: formData.problemStatement,
        objective: formData.objective,
        description: bundledDescription,
        expectedOutcome: formData.expectedOutcome,
        technologies: formData.technologies
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        requirements: formData.requirements,
        innovation: formData.innovation,
        teamMembers: teamMembers,
        status: 'pending_approval', // Needs admin approval
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert('Failed to submit proposal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-200 text-center max-w-2xl mx-auto my-12">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Proposal Submitted!</h2>
        <p className="text-gray-600 mb-8 text-lg">
          Your project proposal has been successfully submitted and is now awaiting administrator
          approval.
        </p>
        <button
          onClick={() => navigate('/projects')}
          className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition shadow-sm"
        >
          Return to All Projects
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto my-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Lightbulb className="w-8 h-8 text-primary" />
          Student-Proposed Project
        </h1>
        <p className="text-gray-500 mt-2">
          Submit your own project idea for administrator approval.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {step === 1 && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Section 1: Basic Details */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
                <FileText className="w-5 h-5 text-indigo-500" /> Basic Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Project Title *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter a concise title"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Domain *</label>
                  <select
                    name="domain"
                    value={formData.domain}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  >
                    <option value="">Select Domain</option>
                    <option value="Web Development">Web Development</option>
                    <option value="AI & Machine Learning">AI & Machine Learning</option>
                    <option value="Mobile Development">Mobile Development</option>
                    <option value="Cybersecurity">Cybersecurity</option>
                    <option value="IoT">Internet of Things</option>
                    <option value="Blockchain">Blockchain</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Technologies Required
                  </label>
                  <input
                    type="text"
                    name="technologies"
                    value={formData.technologies}
                    onChange={handleChange}
                    placeholder="React, Node, Python..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Provide a general overview of the project..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition h-24"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Core Concept */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
                <Target className="w-5 h-5 text-rose-500" /> Core Concept
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Problem Statement *
                  </label>
                  <textarea
                    name="problemStatement"
                    value={formData.problemStatement}
                    onChange={handleChange}
                    placeholder="What specific problem does this solve?"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition h-24"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Objective *
                  </label>
                  <textarea
                    name="objective"
                    value={formData.objective}
                    onChange={handleChange}
                    placeholder="What are the main goals?"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition h-24"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Expected Outcome *
                  </label>
                  <textarea
                    name="expectedOutcome"
                    value={formData.expectedOutcome}
                    onChange={handleChange}
                    placeholder="What is the final deliverable?"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition h-24"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Technicals & Scope */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
                <Cpu className="w-5 h-5 text-emerald-500" /> Technicals & Scope
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Hardware/Software Req.
                  </label>
                  <textarea
                    name="requirements"
                    value={formData.requirements}
                    onChange={handleChange}
                    placeholder="e.g., Raspberry Pi, AWS Free Tier"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition h-24"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Innovation Details
                  </label>
                  <textarea
                    name="innovation"
                    value={formData.innovation}
                    onChange={handleChange}
                    placeholder="What makes this unique?"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition h-24"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Scope</label>
                  <textarea
                    name="scope"
                    value={formData.scope}
                    onChange={handleChange}
                    placeholder="Define the boundaries and limitations of the project..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition h-24"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Logistics */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
                <Calendar className="w-5 h-5 text-amber-500" /> Logistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 mb-4">
                  <TeamMemberSelect selectedIds={teamMembers} onChange={setTeamMembers} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Estimated Timeline
                  </label>
                  <textarea
                    name="timeline"
                    value={formData.timeline}
                    onChange={handleChange}
                    placeholder="e.g., Week 1-2: Design, Week 3-6: Dev..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition h-24"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t flex justify-end">
              <button
                onClick={checkSimilarity}
                disabled={!formData.name || !formData.problemStatement || loading}
                className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Analyzing...' : 'Continue to Review'} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Review & Submit */}
        {step === 2 && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-8 duration-300">
            {similarity && (
              <div
                className={`p-6 rounded-xl border ${similarity.similarityPercentage > 70 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}
              >
                <h4
                  className={`flex items-center gap-2 text-lg font-bold ${similarity.similarityPercentage > 70 ? 'text-red-800' : 'text-green-800'} mb-2`}
                >
                  {similarity.similarityPercentage > 70 ? (
                    <AlertCircle className="w-6 h-6" />
                  ) : (
                    <CheckCircle className="w-6 h-6" />
                  )}
                  AI Similarity Report: {similarity.similarityPercentage}% Match
                </h4>
                <p
                  className={`text-sm ${similarity.similarityPercentage > 70 ? 'text-red-700' : 'text-green-700'} mb-4 font-medium`}
                >
                  {similarity.recommendations}
                </p>

                {similarity.matchingProjects?.length > 0 && (
                  <div className="bg-white/60 p-4 rounded-lg text-sm border border-white/40">
                    <span className="font-bold block mb-2 text-gray-900">
                      Similar Existing Projects:
                    </span>
                    <ul className="list-disc pl-5 space-y-1 text-gray-700">
                      {similarity.matchingProjects.map((p: any) => (
                        <li key={p.id}>{p.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">Final Review</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6 text-sm">
                <div className="md:col-span-2">
                  <dt className="text-gray-500 font-medium mb-1">Title</dt>
                  <dd className="font-bold text-gray-900 text-lg">{formData.name}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-gray-500 font-medium mb-1">Problem Statement</dt>
                  <dd className="text-gray-800 bg-white p-3 rounded-lg border border-gray-100">
                    {formData.problemStatement}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium mb-1">Domain</dt>
                  <dd className="text-gray-800 font-semibold">{formData.domain}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium mb-1">Technologies</dt>
                  <dd className="text-gray-800 font-semibold">{formData.technologies}</dd>
                </div>
              </dl>
            </div>

            <div className="pt-6 border-t flex justify-between items-center">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition"
              >
                Go Back & Edit
              </button>
              <button
                onClick={submitProject}
                disabled={loading}
                className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition shadow-sm flex items-center gap-2"
              >
                {loading ? 'Submitting...' : 'Submit Final Proposal'}{' '}
                <CheckCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
