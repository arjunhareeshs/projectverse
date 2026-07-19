import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TeamManagement: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/admin/all-teams', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTeams(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading teams...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">All Teams</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage and view all teams.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team: any) => (
          <div
            key={team.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-indigo-300 transition group"
            onClick={() => navigate(`/teams/${team.id}`)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded uppercase">
                {team.groupCode || 'Team'}
              </span>
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">{team.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{team.domain || 'General'}</p>

            <div className="flex items-center justify-between text-sm pt-4 border-t border-gray-100">
              <span className="text-gray-600 font-medium">{team.users?.length || 0} Members</span>
              <div className="flex items-center text-indigo-600 font-semibold group-hover:translate-x-1 transition-transform">
                View Details <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
