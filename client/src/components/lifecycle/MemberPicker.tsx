import React, { useState, useEffect } from 'react';
import { Sparkles, Search, UserPlus, Check, X, User } from 'lucide-react';
import { teamService } from '../../services/team.service';
import { lifecycleService } from '../../services/lifecycle.service';

interface StudentCandidate {
  id: string;
  fullName: string;
  department?: string;
  year?: string;
  userSkills?: Array<{ skillName: string }>;
}

interface MemberPickerProps {
  projectId: string;
  selectedMemberIds: string[];
  onChange: (memberIds: string[]) => void;
}

export const MemberPicker: React.FC<MemberPickerProps> = ({
  projectId,
  selectedMemberIds,
  onChange,
}) => {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<StudentCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<{ userId: string; name: string; reason: string; skills?: string[] }>
  >([]);
  const [aiAvailable, setAiAvailable] = useState(true);

  useEffect(() => {
    const fetchCandidates = async () => {
      setLoading(true);
      try {
        const data = await teamService.searchCandidates(query);
        setCandidates(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load candidates', err);
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(fetchCandidates, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const res = await lifecycleService.suggestMembers(projectId);
      if (res && res.available === false) {
        setAiAvailable(false);
      } else if (res && Array.isArray(res.suggestions)) {
        setSuggestions(res.suggestions);
      }
    } catch (err) {
      console.error('Failed to get member suggestions', err);
      setAiAvailable(false);
    } finally {
      setSuggesting(false);
    }
  };

  const toggleMember = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      onChange(selectedMemberIds.filter((mId) => mId !== id));
    } else {
      onChange([...selectedMemberIds, id]);
    }
  };

  const addSuggestedMember = (userId: string) => {
    if (!selectedMemberIds.includes(userId)) {
      onChange([...selectedMemberIds, userId]);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">Select Team Members</h3>
          <p className="text-xs text-gray-500">Pick team members who will work on this project.</p>
        </div>
        {aiAvailable && (
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            {suggesting ? 'Analyzing skills...' : 'Suggest Members (AI)'}
          </button>
        )}
      </div>

      {/* AI Suggestions Box */}
      {suggestions.length > 0 && (
        <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> AI Member Recommendations
            </span>
            <button
              onClick={() => setSuggestions([])}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestions.map((sug) => {
              const isSelected = selectedMemberIds.includes(sug.userId);
              return (
                <div
                  key={sug.userId}
                  className="p-3 rounded-lg bg-white border border-indigo-100 flex items-start justify-between gap-2 shadow-2xs"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{sug.name}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">{sug.reason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addSuggestedMember(sug.userId)}
                    disabled={isSelected}
                    className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isSelected ? 'Added' : '+ Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students by name or skill..."
          className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
        />
      </div>

      {/* Selected Members Chips */}
      {selectedMemberIds.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selectedMemberIds.map((mId) => {
            const cand = candidates.find((c) => c.id === mId);
            return (
              <span
                key={mId}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-semibold shadow-2xs"
              >
                <User className="w-3 h-3" />
                {cand?.fullName || mId}
                <button
                  type="button"
                  onClick={() => toggleMember(mId)}
                  className="hover:text-red-200 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Candidate List */}
      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
        {loading && <p className="text-xs text-gray-400 py-2">Searching candidates...</p>}
        {!loading && candidates.length === 0 && (
          <p className="text-xs text-gray-500 py-2">No student candidates found.</p>
        )}
        {candidates.map((cand) => {
          const isSelected = selectedMemberIds.includes(cand.id);
          const skills = cand.userSkills?.map((s) => s.skillName).join(', ');

          return (
            <div
              key={cand.id}
              onClick={() => toggleMember(cand.id)}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50/50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                  {cand.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">{cand.fullName}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {cand.department || 'Student'} • {cand.year || 'I'} Year
                    {skills ? ` • Skills: ${skills}` : ''}
                  </p>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                  isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'
                }`}
              >
                {isSelected && <Check className="w-3 h-3" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
