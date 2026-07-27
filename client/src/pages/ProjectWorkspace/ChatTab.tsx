import React, { useEffect, useState, useRef } from 'react';
import { Send, Users, MessageSquare } from 'lucide-react';
import { teamService } from '../../services/team.service';
import { useAppSelector } from '../../app/hooks';
import { useNotifications } from '../../contexts/NotificationContext';

interface ChatTabProps {
  teamId?: string;
}

interface MessageItem {
  id: string;
  userId: string;
  message: string;
  createdAt: string;
  user?: { fullName: string };
}

export const ChatTab: React.FC<ChatTabProps> = ({ teamId }) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const { socket } = useNotifications();

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!teamId) return;
    const fetchMsgs = async () => {
      setLoading(true);
      try {
        const data = await teamService.getMessages(teamId);
        setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load team messages', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMsgs();
  }, [teamId]);

  // Reuses the single app-wide socket connection (NotificationContext) — the server
  // already puts every connected user in a `user:<id>` room, so no separate
  // room-join event is needed here; just filter incoming messages by teamId.
  useEffect(() => {
    if (!teamId || !socket) return;

    const handleTeamMessage = (payload: { teamId: string; message: MessageItem }) => {
      if (payload.teamId !== teamId) return;
      setMessages((prev) =>
        prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message],
      );
    };

    socket.on('teamMessage', handleTeamMessage);

    return () => {
      socket.off('teamMessage', handleTeamMessage);
    };
  }, [teamId, socket]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !teamId || sending) return;

    const text = input.trim();
    setInput('');
    setSending(true);

    try {
      const created = await teamService.sendMessage(teamId, text);
      setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, created]));
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSending(false);
    }
  };

  if (!teamId) {
    return (
      <div className="py-12 text-center text-xs text-gray-500 bg-gray-50 rounded-2xl border border-gray-100">
        No team assigned to this project yet for team chat.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs flex flex-col h-[600px] max-w-4xl mx-auto overflow-hidden">
      {/* Room Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Project Team Room</h3>
            <p className="text-xs text-gray-500">Real-time team chat & collaboration</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full font-semibold border border-indigo-100">
          <Users className="w-3.5 h-3.5" /> Active Channel
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            No messages yet. Start the conversation with your team!
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.userId === currentUser?.id;
            const senderName = m.user?.fullName || m.userId;

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] font-bold text-gray-400 mb-1 px-1">
                  {senderName} • {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-xs max-w-[80%] leading-relaxed ${
                    isMine
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-gray-100 text-gray-800 rounded-tl-xs'
                  }`}
                >
                  {m.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Footer */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message to your team..."
          className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
