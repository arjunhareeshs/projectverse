import React, { useState } from 'react';
import { Github, Star, GitFork, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';

interface GitHubAnalyticsPanelProps {
  username?: string;
  repo?: string;
}

export const GitHubAnalyticsPanel: React.FC<GitHubAnalyticsPanelProps> = ({ username, repo }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const [inputUser, setInputUser] = useState(username || '');
  const [inputRepo, setInputRepo] = useState(repo || '');

  const handleFetch = async () => {
    if (!inputUser) return;

    setLoading(true);
    setError('');
    try {
      if (inputRepo) {
        // Fetch Repo
        const res = await axios.post('/api/github/repo', { owner: inputUser, repo: inputRepo });
        setData(res.data);
      } else {
        // Fetch Profile
        const res = await axios.post('/api/github/profile', { username: inputUser });
        setData(res.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch GitHub analytics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Github className="w-5 h-5 text-gray-700" />
        <h3 className="font-bold text-gray-900">GitHub Analytics</h3>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Username"
          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
          value={inputUser}
          onChange={(e) => setInputUser(e.target.value)}
        />
        <input
          type="text"
          placeholder="Repo (optional)"
          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
          value={inputRepo}
          onChange={(e) => setInputRepo(e.target.value)}
        />
        <button
          onClick={handleFetch}
          disabled={loading}
          className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Fetch'}
        </button>
      </div>

      {error && (
        <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {data && !inputRepo && data.totalContributions !== undefined && (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <h4 className="font-semibold text-gray-800 mb-2">Profile: {data.username}</h4>
          <p className="text-sm text-gray-600">
            Total Contributions (1 year):{' '}
            <span className="font-bold text-green-600">{data.totalContributions}</span>
          </p>
        </div>
      )}

      {data && inputRepo && data.repoName && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
            <Star className="w-5 h-5 text-yellow-500 mb-1" />
            <span className="text-xl font-bold text-gray-900">{data.stars}</span>
            <span className="text-xs text-gray-500 uppercase font-semibold">Stars</span>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
            <GitFork className="w-5 h-5 text-blue-500 mb-1" />
            <span className="text-xl font-bold text-gray-900">{data.forks}</span>
            <span className="text-xs text-gray-500 uppercase font-semibold">Forks</span>
          </div>
          <div className="col-span-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-sm text-gray-600">
              Open Issues: <span className="font-bold text-gray-900">{data.openIssues}</span>
            </p>
            <p className="text-sm text-gray-600">
              Primary Language:{' '}
              <span className="font-bold text-gray-900">{data.language || 'N/A'}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
