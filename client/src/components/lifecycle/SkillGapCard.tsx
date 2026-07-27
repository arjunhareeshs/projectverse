import React from 'react';
import { BookOpen, ExternalLink, Lightbulb, User } from 'lucide-react';

interface SkillGapCardProps {
  gaps: Array<{ skill: string; missingFor: string[] }>;
  learningResources: Array<{ topic: string; resource: string; url?: string }>;
  memberNames?: Record<string, string>;
}

export const SkillGapCard: React.FC<SkillGapCardProps> = ({
  gaps,
  learningResources,
  memberNames = {},
}) => {
  if (!gaps || gaps.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3">
        <Lightbulb className="w-5 h-5 text-emerald-600 shrink-0" />
        <p className="text-xs text-emerald-800 font-medium">
          No skill gaps identified! The team currently has all required skill sets covered for this project.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gaps.map((gap, idx) => {
        const matchingResource = learningResources.find(
          (r) => r.topic.toLowerCase().includes(gap.skill.toLowerCase()) || gap.skill.toLowerCase().includes(r.topic.toLowerCase())
        ) || learningResources[idx % (learningResources.length || 1)];

        return (
          <div key={idx} className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-indigo-950 px-2.5 py-0.5 rounded-md bg-indigo-100/70 border border-indigo-200">
                  {gap.skill}
                </span>
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-semibold">
                  Missing Skill Gap
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>Needed by:</span>
                <span className="font-medium text-gray-800">
                  {gap.missingFor.map((id) => memberNames[id] || id).join(', ')}
                </span>
              </div>
            </div>

            {matchingResource && (
              <div className="p-3 rounded-lg bg-white border border-indigo-100/80 shadow-2xs md:max-w-xs shrink-0 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Direction to Learn</span>
                </div>
                <p className="text-xs text-gray-700 font-medium">{matchingResource.resource}</p>
                {matchingResource.url && (
                  <a
                    href={matchingResource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    View Resource <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
