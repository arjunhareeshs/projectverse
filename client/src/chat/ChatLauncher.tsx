import React from 'react';
import { cn } from '../utils/cn';
import { AuroraIcon } from '../components/AuroraIcon';
import { useChatDock } from './ChatDockContext';

/**
 * Floating aurora button, fixed to the bottom-right corner, available on every page.
 * Tap to open the AI chat dock; while the dock is open the launcher hides and the
 * aurora icon inside the dock header becomes the toggle.
 */
export const ChatLauncher: React.FC = () => {
  const { isOpen, toggle } = useChatDock();

  return (
    <button
      onClick={toggle}
      aria-label="Open AI assistant"
      aria-expanded={isOpen}
      title="Ask ProjectVerse AI"
      className={cn(
        'fixed bottom-6 right-6 z-40 rounded-full transition-all duration-300',
        'hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'shadow-lg shadow-black/10',
        isOpen ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'
      )}
    >
      <AuroraIcon size={56} />
    </button>
  );
};
