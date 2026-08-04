import React from 'react';
import { Activity, ArrowRight, Cpu, Layers, HardDrive, Shield } from 'lucide-react';

export interface ProjectCardData {
  id: string;
  name: string;
  shortName?: string;
  soul?: string;
  problemStatement?: string;
  description?: string;
  type?: string;
  domain?: string;
  sector?: string;
  difficultyLevel?: string;
  technologies?: string[];
  slotsLeft?: number;
  maxTeams?: number;
  status?: string;
  childProjectsCount?: number;
}

interface ProjectCardProps {
  project: ProjectCardData;
  onViewDetails: (project: ProjectCardData) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onViewDetails }) => {
  const maxCap = project.maxTeams ?? 3;
  const slotsLeft = project.slotsLeft ?? maxCap;
  const claimedCount = maxCap - slotsLeft;

  const difficultyNum = parseInt(project.difficultyLevel || '2', 10);
  const difficultyLabel = difficultyNum <= 1 ? 'Easy' : difficultyNum <= 3 ? 'Medium' : 'Hard';
  const difficultyColor =
    difficultyNum <= 1
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : difficultyNum <= 3
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-rose-600 bg-rose-50 border-rose-200';

  const typeUpper = (project.type || 'SOFTWARE').toUpperCase();
  const typeIcon =
    typeUpper.includes('HARDWARE') ? Cpu : typeUpper.includes('IOT') ? HardDrive : typeUpper.includes('HYBRID') ? Shield : Activity;
  const IconComp = typeIcon;

  return (
    <div
      onClick={() => onViewDetails(project)}
      className="group cursor-pointer rounded-2xl bg-white p-5 border border-slate-200/90 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200 flex flex-col justify-between"
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between mb-4">
          <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold tracking-wider uppercase border border-blue-100">
            {project.type || 'Software'}
          </span>

          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border ${
              slotsLeft === 0
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : slotsLeft <= 1
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                slotsLeft === 0 ? 'bg-rose-500' : slotsLeft <= 1 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            {claimedCount} / {maxCap} Teams
          </span>
        </div>

        {/* Title and Icon */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
            {project.name || project.shortName}
          </h3>
          <div className="p-2 rounded-xl bg-blue-50/80 text-blue-600 border border-blue-100 shrink-0">
            <IconComp className="h-4 w-4" />
          </div>
        </div>

        {/* Soul / Short Description */}
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-4">
          {project.soul || project.problemStatement || project.description || 'No description available.'}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {project.domain && (
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
              {project.domain}
            </span>
          )}
          {project.sector && (
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
              {project.sector}
            </span>
          )}
        </div>
      </div>

      {/* Bottom Footer Row */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold flex items-center gap-1.5 ${difficultyColor}`}>
          <span className="h-1.5 w-1.5 rounded-full fill-current" />
          {difficultyLabel}
        </div>

        <button className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
          View Details
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
