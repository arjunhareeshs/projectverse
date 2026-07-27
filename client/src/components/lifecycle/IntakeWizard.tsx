import React, { useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { ProjectCategory } from '../../types/projectLog';
import { MemberPicker } from './MemberPicker';
import { DurationStep } from './DurationStep';
import { TechnologiesStep } from './TechnologiesStep';
import { lifecycleService } from '../../services/lifecycle.service';

interface IntakeWizardProps {
  projectId: string;
  category?: ProjectCategory;
  onComplete: (fallback?: boolean) => void;
  onClose?: () => void;
}

export const IntakeWizard: React.FC<IntakeWizardProps> = ({
  projectId,
  category = 'MINI',
  onComplete,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [members, setMembers] = useState<string[]>([]);
  const [durationData, setDurationData] = useState<{ months: number; startDate: string }>({
    months: 6,
    startDate: new Date().toISOString().split('T')[0],
  });
  const [technologies, setTechnologies] = useState<string[]>([]);

  const [savingStep, setSavingStep] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStageMessage, setGenStageMessage] = useState('');
  const [genError, setGenError] = useState<string | null>(null);

  const saveCurrentStep = async (nextStep?: 1 | 2 | 3) => {
    setSavingStep(true);
    try {
      if (currentStep === 1) {
        await lifecycleService.saveIntake(projectId, { step: 'members', memberUserIds: members, members });
      } else if (currentStep === 2) {
        await lifecycleService.saveIntake(projectId, {
          step: 'duration',
          months: durationData.months,
          startDate: durationData.startDate,
        });
      } else if (currentStep === 3) {
        await lifecycleService.saveIntake(projectId, { step: 'technologies', technologies });
      }

      if (nextStep) {
        setCurrentStep(nextStep);
      } else {
        // All steps done -> run document generation
        await runDocumentGeneration();
      }
    } catch (err) {
      console.error('Failed to save intake step', err);
    } finally {
      setSavingStep(false);
    }
  };

  const runDocumentGeneration = async () => {
    setGenerating(true);
    setGenError(null);

    const stages = [
      'Analyzing project requirements and category...',
      'Synthesizing deliverables and work breakdown packages...',
      'Applying uniqueness engine against existing catalog projects...',
      'Mapping required skills and generating learning resources...',
      'Finalizing official execution document...',
    ];

    let i = 0;
    setGenStageMessage(stages[0]);
    const interval = setInterval(() => {
      i++;
      if (i < stages.length) {
        setGenStageMessage(stages[i]);
      }
    }, 1200);

    try {
      const res = await lifecycleService.generateDocument(projectId);
      clearInterval(interval);
      onComplete(res?.fallback);
    } catch (err: any) {
      clearInterval(interval);
      console.error('Document generation failed', err);
      setGenError(err?.response?.data?.message || 'Failed to generate document. Please retry.');
    } finally {
      setGenerating(false);
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      saveCurrentStep((currentStep + 1) as 1 | 2 | 3);
    } else {
      saveCurrentStep();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">
                Project Intake & Execution Setup
              </h2>
              <p className="text-xs text-gray-500">
                Configure your project to generate the official execution document.
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md"
            >
              Close
            </button>
          )}
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {currentStep > 1 ? <Check className="w-3.5 h-3.5" /> : 1}
            </span>
            <span className={`text-xs font-bold ${currentStep === 1 ? 'text-indigo-900' : 'text-gray-500'}`}>
              Team Members
            </span>
          </div>
          <div className="h-0.5 flex-1 mx-3 bg-gray-200" />
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {currentStep > 2 ? <Check className="w-3.5 h-3.5" /> : 2}
            </span>
            <span className={`text-xs font-bold ${currentStep === 2 ? 'text-indigo-900' : 'text-gray-500'}`}>
              Duration
            </span>
          </div>
          <div className="h-0.5 flex-1 mx-3 bg-gray-200" />
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep >= 3 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              3
            </span>
            <span className={`text-xs font-bold ${currentStep === 3 ? 'text-indigo-900' : 'text-gray-500'}`}>
              Technologies
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {generating ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                <Sparkles className="w-6 h-6 text-indigo-600 absolute inset-0 m-auto" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Generating Execution Document</h3>
                <p className="text-xs text-indigo-600 font-semibold mt-1 animate-pulse">
                  {genStageMessage}
                </p>
              </div>
            </div>
          ) : genError ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-sm font-bold text-gray-900">Generation Encountered an Error</h3>
                <p className="text-xs text-rose-600">{genError}</p>
              </div>
              <button
                type="button"
                onClick={runDocumentGeneration}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Generation
              </button>
            </div>
          ) : (
            <>
              {currentStep === 1 && (
                <MemberPicker
                  projectId={projectId}
                  selectedMemberIds={members}
                  onChange={setMembers}
                />
              )}
              {currentStep === 2 && (
                <DurationStep
                  projectId={projectId}
                  category={category}
                  months={durationData.months}
                  startDate={durationData.startDate}
                  onChange={setDurationData}
                />
              )}
              {currentStep === 3 && (
                <TechnologiesStep
                  technologies={technologies}
                  onChange={setTechnologies}
                  onSkip={() => handleNext()}
                />
              )}
            </>
          )}
        </div>

        {/* Footer Navigation */}
        {!generating && !genError && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1 || savingStep}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-white hover:text-gray-900 transition disabled:opacity-30"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={savingStep}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-xs disabled:opacity-50"
            >
              {savingStep
                ? 'Saving...'
                : currentStep === 3
                ? 'Generate Execution Document →'
                : 'Next Step'}
              {currentStep < 3 && !savingStep && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
