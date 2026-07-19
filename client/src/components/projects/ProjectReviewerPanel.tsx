import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Star, CheckCircle, AlertCircle, FileText, Send } from 'lucide-react';

interface ProjectReviewerPanelProps {
  projectId: string;
}

export const ProjectReviewerPanel: React.FC<ProjectReviewerPanelProps> = ({ projectId }) => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newReview, setNewReview] = useState({
    status: 'Approved',
    comments: '',
    score: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [projectId]);

  const fetchReviews = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/projects/${projectId}/reviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReviews(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newReview.comments) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/projects/${projectId}/reviews`, newReview, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNewReview({ status: 'Approved', comments: '', score: 0 });
      fetchReviews();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mt-6">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 text-yellow-500" /> Project Reviews
      </h3>

      {/* Existing Reviews */}
      <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="text-sm text-gray-500">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="text-sm text-gray-500 italic">No reviews yet for this project.</div>
        ) : (
          reviews.map((r: any) => (
            <div key={r.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800">
                  {r.reviewer?.fullName || 'Reviewer'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    r.status === 'Approved'
                      ? 'bg-green-100 text-green-700'
                      : r.status === 'Rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <p className="text-gray-600 mb-2">{r.comments}</p>
              {r.score && (
                <div className="text-xs font-bold text-indigo-600">Score: {r.score}/100</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add New Review */}
      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">Add Your Evaluation</h4>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={newReview.status}
              onChange={(e) => setNewReview({ ...newReview, status: e.target.value })}
            >
              <option value="Approved">Approved</option>
              <option value="Needs Revision">Needs Revision</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Score (0-100)</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={newReview.score}
              onChange={(e) => setNewReview({ ...newReview, score: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Comments</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm h-20"
            placeholder="Provide feedback on scope, uniqueness, and tech stack..."
            value={newReview.comments}
            onChange={(e) => setNewReview({ ...newReview, comments: e.target.value })}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || !newReview.comments}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2"
        >
          {submitting ? 'Submitting...' : 'Submit Review'} <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
