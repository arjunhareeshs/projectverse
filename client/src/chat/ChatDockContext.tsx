import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/** Layout constants (px) shared across the sidebar, navbar and content. */
export const SIDEBAR_FULL = 256; // w-64 — expanded sidebar with labels
export const SIDEBAR_MINI = 72; // icon-only rail shown while chat is open
export const CHAT_NORMAL = 384; // default chat dock width
export const CHAT_EXPANDED = 640; // expanded chat dock width

interface ChatDockValue {
  isOpen: boolean;
  isExpanded: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  toggleExpand: () => void;
  /** Current width of the chat dock (0 when closed). Docked on the right edge. */
  chatWidth: number;
  /** Current width of the primary sidebar (docked on the left edge). */
  sidebarWidth: number;
  /** Whether the primary sidebar should render in icon-only mode. */
  sidebarCollapsed: boolean;
  /** Left offset (px) where the main content + navbar should begin. */
  contentLeft: number;
  /** Right offset (px) where the main content + navbar should end. */
  contentRight: number;
}

const ChatDockContext = createContext<ChatDockValue | null>(null);

export const ChatDockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const toggleExpand = useCallback(() => setIsExpanded((v) => !v), []);

  const value = useMemo<ChatDockValue>(() => {
    const chatWidth = isOpen ? (isExpanded ? CHAT_EXPANDED : CHAT_NORMAL) : 0;
    const sidebarCollapsed = isOpen;
    const sidebarWidth = sidebarCollapsed ? SIDEBAR_MINI : SIDEBAR_FULL;
    return {
      isOpen,
      isExpanded,
      open,
      close,
      toggle,
      toggleExpand,
      chatWidth,
      sidebarWidth,
      sidebarCollapsed,
      contentLeft: sidebarWidth,
      contentRight: chatWidth,
    };
  }, [isOpen, isExpanded, open, close, toggle, toggleExpand]);

  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>;
};

export function useChatDock(): ChatDockValue {
  const ctx = useContext(ChatDockContext);
  if (!ctx) throw new Error('useChatDock must be used within a ChatDockProvider');
  return ctx;
}
