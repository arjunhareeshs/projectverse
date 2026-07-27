import React, { useState } from 'react';
import { Cpu, Plus, X } from 'lucide-react';

interface TechnologiesStepProps {
  technologies: string[];
  onChange: (techs: string[]) => void;
  onSkip?: () => void;
}

export const TechnologiesStep: React.FC<TechnologiesStepProps> = ({
  technologies,
  onChange,
  onSkip,
}) => {
  const [input, setInput] = useState('');

  const addTech = () => {
    const trimmed = input.trim();
    if (trimmed && !technologies.includes(trimmed)) {
      onChange([...technologies, trimmed]);
      setInput('');
    }
  };

  const removeTech = (tech: string) => {
    onChange(technologies.filter((t) => t !== tech));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTech();
    }
  };

  const suggestedPills = [
    'React',
    'Node.js',
    'TypeScript',
    'Python',
    'TensorFlow',
    'PostgreSQL',
    'Docker',
    'Arduino',
    'ESP32',
    'FastAPI',
    'TailwindCSS',
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">Decided Technologies (Optional)</h3>
          <p className="text-xs text-gray-500">
            Add any tools, frameworks, hardware, or stack choices your team has already decided on.
          </p>
        </div>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition"
          >
            Skip for now →
          </button>
        )}
      </div>

      {/* Input box */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Cpu className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. React, PostgreSQL, PyTorch... (press Enter)"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>
          <button
            type="button"
            onClick={addTech}
            disabled={!input.trim()}
            className="px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-sm hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {/* Current Tech Badges */}
        {technologies.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {technologies.map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-bold shadow-2xs"
              >
                {tech}
                <button
                  type="button"
                  onClick={() => removeTech(tech)}
                  className="hover:text-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Suggested Quick Add Pills */}
      <div className="space-y-2 pt-2 border-t border-gray-100">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          Quick add common tech:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {suggestedPills.map((pill) => {
            const added = technologies.includes(pill);
            return (
              <button
                key={pill}
                type="button"
                onClick={() => {
                  if (added) removeTech(pill);
                  else onChange([...technologies, pill]);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                  added
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {added ? '✓ ' : '+ '}
                {pill}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
