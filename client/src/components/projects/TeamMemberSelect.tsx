import React, { useState, useEffect, useRef } from 'react';
import { Search, X, UserPlus, CheckCircle, Shield } from 'lucide-react';
import { api } from '../../services/api';
import { useAppSelector } from '../../app/hooks';

interface Candidate {
  id: string;
  fullName: string;
  email: string;
  regNo: string | null;
  teamId: string | null;
}

interface TeamMemberSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  maxMembers?: number; // Defaults to 3 (so 4 total with the leader)
}

export const TeamMemberSelect: React.FC<TeamMemberSelectProps> = ({
  selectedIds,
  onChange,
  maxMembers = 3,
}) => {
  const currentUser = useAppSelector((s) => s.auth.user);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Debounced Search
  useEffect(() => {
    if (query.trim().length < 2) {
      setCandidates([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/teams/candidates?q=${encodeURIComponent(query)}`);
        setCandidates(res.data);
      } catch (err) {
        console.error('Failed to search candidates', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (candidate: Candidate) => {
    if (selectedIds.includes(candidate.id)) return;
    if (selectedIds.length >= maxMembers) {
      alert(`You can only select up to ${maxMembers} additional members.`);
      return;
    }
    const newSelected = [...selectedCandidates, candidate];
    setSelectedCandidates(newSelected);
    onChange([...selectedIds, candidate.id]);
    setQuery('');
    setShowDropdown(false);
  };

  const handleRemove = (id: string) => {
    const newSelected = selectedCandidates.filter((c) => c.id !== id);
    setSelectedCandidates(newSelected);
    onChange(selectedIds.filter((selId) => selId !== id));
  };

  return (
    <div className="w-full" ref={containerRef}>
      <label className="block text-sm font-bold text-gray-700 mb-2">
        Build Your Team ({selectedIds.length + 1}/{maxMembers + 1} max)
      </label>

      {/* Selected Members List */}
      <div className="flex flex-col gap-2 mb-4">
        {/* The Leader (Current User) */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-indigo-100 bg-indigo-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
              {currentUser?.fullName?.substring(0, 2).toUpperCase() || 'ME'}
            </div>
            <div>
              <div className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
                {currentUser?.fullName} <Shield className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="text-xs text-indigo-600/80">Team Leader</div>
            </div>
          </div>
        </div>

        {/* Added Members */}
        {selectedCandidates.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs">
                {c.fullName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{c.fullName}</div>
                <div className="text-xs text-gray-500">{c.regNo || c.email}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(c.id)}
              className="text-gray-400 hover:text-red-500 p-1.5 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      {selectedIds.length < maxMembers && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition text-sm"
            placeholder="Search students by name, email, or roll no..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              if (query.trim().length >= 2) setShowDropdown(true);
            }}
          />

          {showDropdown && query.trim().length >= 2 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
              ) : candidates.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">No students found.</div>
              ) : (
                <ul className="py-2">
                  {candidates.map((candidate) => {
                    const isSelected =
                      selectedIds.includes(candidate.id) || candidate.id === currentUser?.id;
                    const isSameGroup =
                      currentUser?.teamId && candidate.teamId === currentUser.teamId;

                    return (
                      <li
                        key={candidate.id}
                        onClick={() => !isSelected && handleSelect(candidate)}
                        className={`px-4 py-2.5 flex items-center justify-between transition ${
                          isSelected
                            ? 'opacity-50 cursor-not-allowed bg-gray-50'
                            : 'cursor-pointer hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isSameGroup ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'}`}
                          >
                            {candidate.fullName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              {candidate.fullName}
                              {isSameGroup && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                                  Same Group
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {candidate.regNo
                                ? `${candidate.regNo} • ${candidate.email}`
                                : candidate.email}
                            </div>
                          </div>
                        </div>
                        {isSelected ? (
                          <CheckCircle className="w-5 h-5 text-gray-400" />
                        ) : (
                          <UserPlus className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
