import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAppSelector } from '../app/hooks';
import {
  Lightbulb,
  Code,
  Target,
  Cpu,
  CheckCircle,
  ArrowRight,
  Users,
  Sparkles,
  X,
} from 'lucide-react';
import { TeamMemberSelect } from '../components/projects/TeamMemberSelect';

export const ProjectRecommendationWizard: React.FC = () => {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);

  const [formData, setFormData] = useState({
    domain: '',
    technicalInterests: '',
    careerGoals: '',
    preferredTechnologies: '',
    projectType: 'Software',
    difficultyLevel: 'Intermediate',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/projects/recommend-catalog', {
        domain: formData.domain,
        technicalInterests: formData.technicalInterests.split(',').map((s) => s.trim()),
        careerGoals: formData.careerGoals,
        preferredTechnologies: formData.preferredTechnologies.split(',').map((s) => s.trim()),
        projectType: formData.projectType,
        difficultyLevel: formData.difficultyLevel,
      });
      setRecommendations(res.data.recommendations || []);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = async (id: string) => {
    if (!user?.teamId) {
      alert('You must be part of a team to select a project.');
      return;
    }
    setSelecting(true);
    try {
      const res = await api.post(`/projects/catalog/${id}/select`, {
        teamMembers,
      });
      alert('Project selected successfully and is pending approval.');
      navigate('/dashboard');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to select project');
      setSelecting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto my-8 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary" />
          Project Recommendation Wizard
        </h1>
        <p className="text-gray-500 mt-2">
          Answer a few questions and we'll match you with the best problem statements.
        </p>
      </div>

      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Domain of Interest
              </label>
              <select
                name="domain"
                value={formData.domain}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select Domain</option>
                <option value="Web Development">Web Development</option>
                <option value="AI & Machine Learning">AI & Machine Learning</option>
                <option value="Mobile Development">Mobile Development</option>
                <option value="Cybersecurity">Cybersecurity</option>
                <option value="IoT">Internet of Things</option>
                <option value="Data Science">Data Science</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Project Type</label>
              <select
                name="projectType"
                value={formData.projectType}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20"
              >
                <option value="Software">Software</option>
                <option value="Hardware">Hardware</option>
                <option value="Combination">Combination (Hardware + Software)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Difficulty Level
              </label>
              <select
                name="difficultyLevel"
                value={formData.difficultyLevel}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Technical Interests
              </label>
              <input
                type="text"
                name="technicalInterests"
                value={formData.technicalInterests}
                onChange={handleChange}
                placeholder="e.g. UI/UX, Backend, Robotics"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Preferred Technologies
              </label>
              <input
                type="text"
                name="preferredTechnologies"
                value={formData.preferredTechnologies}
                onChange={handleChange}
                placeholder="e.g. React, Python, Arduino (comma separated)"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Career Goals</label>
              <textarea
                name="careerGoals"
                value={formData.careerGoals}
                onChange={handleChange}
                placeholder="What do you want to achieve through this project?"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 h-24"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="pt-6 border-t flex justify-between items-center">
            <button
              onClick={() => navigate('/projects/propose')}
              className="text-gray-500 hover:text-gray-800 font-semibold text-sm underline underline-offset-4"
            >
              I have my own idea
            </button>
            <button
              onClick={getRecommendations}
              disabled={loading || !formData.domain}
              className="bg-primary text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Finding Matches...' : 'Find My Project'}{' '}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-in fade-in slide-in-from-right-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recommended for You</h2>
            <button
              onClick={() => setStep(1)}
              className="text-sm font-semibold text-gray-500 hover:text-gray-800"
            >
              Change Answers
            </button>
          </div>

          {recommendations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">No exact matches found</h3>
              <p className="text-gray-500 mb-6">
                We couldn't find a template that perfectly matches your criteria.
              </p>
              <button
                onClick={() => navigate('/projects/propose')}
                className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-primary/90"
              >
                Propose Your Own Idea
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {recommendations.map((project) => {
                const isFull = project._count?.childProjects >= 4;
                return (
                  <div
                    key={project.id}
                    className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col md:flex-row gap-6 hover:shadow-md hover:border-primary/30 transition-all group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                          {project.domain}
                        </span>
                        <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                          {project.type || 'Software'}
                        </span>
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                          {project.matchScore}% Match
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{project.name}</h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {project.problemStatement}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {(project.technologies || []).slice(0, 4).map((tech: string) => (
                          <span
                            key={tech}
                            className="bg-indigo-50/50 text-indigo-600 text-[10px] font-medium px-2 py-1 rounded border border-indigo-100"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="md:w-48 flex flex-col items-end justify-between border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 shrink-0">
                      <div
                        className={`text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1.5 mb-4 ${isFull ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
                      >
                        <Users className="w-3.5 h-3.5" /> {project._count?.childProjects || 0} / 4
                        Teams
                      </div>

                      <button
                        onClick={() => setSelectedProjectId(project.id)}
                        disabled={isFull}
                        className={`w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                          isFull
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                        }`}
                      >
                        {isFull ? 'Full' : 'Select Project'}
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="mt-8 text-center bg-gray-50 border border-gray-200 rounded-2xl p-8">
                <h4 className="font-bold text-gray-800 mb-2">
                  Didn't find what you're looking for?
                </h4>
                <p className="text-gray-500 text-sm mb-4">
                  You can always propose a completely new idea for admin approval.
                </p>
                <button
                  onClick={() => navigate('/projects/propose')}
                  className="bg-white border border-gray-300 text-gray-700 px-6 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition shadow-sm"
                >
                  Propose New Project
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
            <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Setup Your Team</h2>
              <button
                onClick={() => {
                  setSelectedProjectId(null);
                  setTeamMembers([]);
                }}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              <p className="text-gray-500 mb-6">
                You will automatically be assigned as the Team Leader. Build your team below before
                finalizing your project selection.
              </p>
              <TeamMemberSelect selectedIds={teamMembers} onChange={setTeamMembers} />
            </div>

            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedProjectId(null);
                  setTeamMembers([]);
                }}
                className="px-6 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSelectProject(selectedProjectId)}
                disabled={selecting}
                className="px-8 py-2.5 rounded-xl font-semibold bg-primary text-white hover:bg-primary/90 hover:shadow-md transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {selecting ? (
                  'Selecting...'
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" /> Confirm Selection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
