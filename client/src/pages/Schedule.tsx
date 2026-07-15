import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Clock,
  MapPin,
  Tag,
  CheckCircle,
  HelpCircle,
  Trash2,
  Calendar as CalendarIcon
} from 'lucide-react';
import { scheduleService, CalendarEventBackend } from '../services/schedule.service';
import { cn } from '../utils/cn';
import { useChatDock } from '../chat/ChatDockContext';

// Types
type CalView = 'day' | 'week' | 'month';
type BeamView = 'day' | 'week' | 'month';

interface CalendarEvent {
  id?: string;
  hour: number;
  dur: number;
  title: string;
  color: string;
  room: string;
  time: string;
}

const CATEGORY_COLORS = [
  { name: 'Lecture', color: '#7C3AED', bg: 'bg-[#7C3AED]', text: 'text-white' },
  { name: 'Lab', color: '#3B82F6', bg: 'bg-[#3B82F6]', text: 'text-white' },
  { name: 'Hackathon', color: '#EF4444', bg: 'bg-[#EF4444]', text: 'text-white' },
  { name: 'Workshop', color: '#10B981', bg: 'bg-[#10B981]', text: 'text-white' },
  { name: 'Personal', color: '#EC4899', bg: 'bg-[#EC4899]', text: 'text-white' },
];

const SEED_EVENTS = [
  { title: "Eng. Math", date: "2026-07-13", timeString: "08:00 AM - 09:30 AM", hour: 8.0, duration: 1.5, room: "Room 302", color: "#7C3AED" },
  { title: "DSA + Lab", date: "2026-07-13", timeString: "10:00 AM - 12:00 PM", hour: 10.0, duration: 2.0, room: "Lab 4", color: "#3B82F6" },
  { title: "Project Review", date: "2026-07-13", timeString: "01:00 PM - 02:00 PM", hour: 13.0, duration: 1.0, room: "Room 402", color: "#F97316" }, // Live/Orange
  { title: "Machine Learning", date: "2026-07-13", timeString: "03:00 PM - 04:30 PM", hour: 15.0, duration: 1.5, room: "Auditorium 1", color: "#10B981" },
  { title: "Study Group", date: "2026-07-13", timeString: "05:00 PM - 06:00 PM", hour: 17.0, duration: 1.0, room: "Library", color: "#EC4899" },
  { title: "Hackathon Day 1", date: "2026-07-15", timeString: "09:00 AM - 06:00 PM", hour: 9.0, duration: 8.0, room: "Main Hall", color: "#EF4444" },
  { title: "Hackathon Day 2", date: "2026-07-16", timeString: "09:00 AM - 06:00 PM", hour: 9.0, duration: 8.0, room: "Main Hall", color: "#EF4444" },
  { title: "Hackathon Day 3", date: "2026-07-17", timeString: "09:00 AM - 06:00 PM", hour: 9.0, duration: 8.0, room: "Main Hall", color: "#EF4444" },
];

export const Schedule: React.FC = () => {
  const { isOpen: chatOpen } = useChatDock();
  // Calendar offsets (relative to reference date Monday, July 13, 2026)
  const referenceDate = new Date(2026, 6, 13); // July 13, 2026 (0-indexed month)
  const [calView, setCalView] = useState<CalView>('month');
  const [beamView, setBeamView] = useState<BeamView>('day');
  const [currentOffset, setCurrentOffset] = useState(0); // Offset in months, weeks, or days

  const [dbEvents, setDbEvents] = useState<CalendarEventBackend[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for adding events
  const [modalOpen, setModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('2026-07-13');
  const [formTime, setFormTime] = useState('10:00 AM - 11:30 AM');
  const [formHour, setFormHour] = useState(10);
  const [formDur, setFormDur] = useState(1.5);
  const [formRoom, setFormRoom] = useState('Room 402');
  const [formColor, setFormColor] = useState('#7C3AED');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live Clock states
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await scheduleService.getEvents();
      if (data.length === 0) {
        // Auto-seed if database is empty
        for (const seed of SEED_EVENTS) {
          await scheduleService.createEvent(seed);
        }
        const seededData = await scheduleService.getEvents();
        setDbEvents(seededData);
      } else {
        setDbEvents(data);
      }
    } catch (err) {
      console.error('Failed to fetch schedule events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === 'schedule') {
        fetchEvents();
      }
    };
    window.addEventListener('pv:refresh', handleRefresh);
    return () => window.removeEventListener('pv:refresh', handleRefresh);
  }, [fetchEvents]);

  // Map dbEvents to events map grouped by date string YYYY-MM-DD
  const eventsMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    dbEvents.forEach((e) => {
      const d = e.date;
      if (!map[d]) map[d] = [];
      map[d].push({
        id: e.id,
        hour: e.hour,
        dur: e.duration,
        title: e.title,
        color: e.color,
        room: e.room,
        time: e.timeString,
      });
    });
    // Sort events inside each day by start hour
    Object.keys(map).forEach((date) => {
      map[date].sort((a, b) => a.hour - b.hour);
    });
    return map;
  }, [dbEvents]);

  // Compute Active Date / Window
  const activeDate = useMemo(() => {
    const d = new Date(referenceDate);
    if (calView === 'month') {
      d.setMonth(d.getMonth() + currentOffset);
    } else if (calView === 'week') {
      d.setDate(d.getDate() + currentOffset * 7);
    } else {
      d.setDate(d.getDate() + currentOffset);
    }
    return d;
  }, [calView, currentOffset]);

  const activePeriodTitle = useMemo(() => {
    if (calView === 'month') {
      return activeDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (calView === 'week') {
      const startOfWeek = new Date(activeDate);
      const dayOfWeek = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday start
      startOfWeek.setDate(diff);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const m1 = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const m2 = endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${m1} – ${m2}`;
    } else {
      return activeDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  }, [calView, activeDate]);

  // Clock computation
  const digitalTime = useMemo(() => {
    let hours = time.getHours();
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // hour 0 is 12
    return {
      hours: hours.toString().padStart(2, '0'),
      minutes,
      ampm,
    };
  }, [time]);

  const clockHands = useMemo(() => {
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();

    const hrAngle = ((hours % 12) * 30) + (minutes * 0.5);
    const mnAngle = (minutes * 6) + (seconds * 0.1);

    const radHr = (hrAngle - 90) * Math.PI / 180;
    const radMn = (mnAngle - 90) * Math.PI / 180;

    // Center is (64, 64)
    // Hour hand length: 30
    // Minute hand length: 44
    return {
      hrX: 64 + 30 * Math.cos(radHr),
      hrY: 64 + 30 * Math.sin(radHr),
      mnX: 64 + 44 * Math.cos(radMn),
      mnY: 64 + 44 * Math.sin(radMn),
    };
  }, [time]);

  // Today at College concentric ring data (Static references or from July 13, 2026 events)
  const collegeEvents = [
    { title: "Eng. Math", time: "08:00 AM - 09:30 AM", room: "Room 302", color: "#7C3AED", status: "done" },
    { title: "DSA + Lab", time: "10:00 AM - 12:00 PM", room: "Lab 4", color: "#3B82F6", status: "done" },
    { title: "Project Review", time: "01:00 PM - 02:00 PM", room: "Room 402", color: "#F97316", status: "live" },
    { title: "Machine Learning", time: "03:00 PM - 04:30 PM", room: "Auditorium 1", color: "#10B981", status: "future" },
    { title: "Study Group", time: "05:00 PM - 06:00 PM", room: "Library", color: "#EC4899", status: "future" },
  ];

  // Beams progress items
  const dayBeams = [
    { label: 'Eng. Math', status: 'done', progress: 100 },
    { label: 'DSA + Lab', status: 'done', progress: 100 },
    { label: 'DBMS', status: 'progress', progress: 55 },
    { label: 'Machine Learning', status: 'pending', progress: 0 },
    { label: 'Project', status: 'missed', progress: 0 },
  ];

  const weekBeams = [
    { label: 'MON', status: 'done', progress: 100, detail: '5/5 complete' },
    { label: 'TUE', status: 'done', progress: 100, detail: '4/4 complete' },
    { label: 'WED', status: 'progress', progress: 40, detail: '2/5 active' },
    { label: 'THU', status: 'pending', progress: 0, detail: '—' },
    { label: 'FRI', status: 'pending', progress: 0, detail: '—' },
    { label: 'SAT', status: 'pending', progress: 0, detail: '—' },
    { label: 'SUN', status: 'pending', progress: 0, detail: '—' },
  ];

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!formTitle.trim()) {
      setErrorMsg('Event Title is required');
      return;
    }
    setSubmitting(true);
    try {
      await scheduleService.createEvent({
        title: formTitle,
        date: formDate,
        timeString: formTime,
        hour: Number(formHour),
        duration: Number(formDur),
        room: formRoom,
        color: formColor,
      });
      setModalOpen(false);
      setFormTitle('');
      fetchEvents();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to add event');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering grid cell clicks
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await scheduleService.deleteEvent(eventId);
      fetchEvents();
    } catch (err) {
      console.error(err);
      alert('Failed to delete event');
    }
  };

  // ── Render Views Helpers ────────────────────────────────────────────────────

  // Month View Calculator
  const monthDays = useMemo(() => {
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // DOW of first day (0 = Sun, 1 = Mon ...). Shift to Mon = 0
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6; // Sunday becomes 6

    const days = [];

    // Empty lead cells
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    // Days of month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const curDateObj = new Date(year, month, d);
      const isToday = curDateObj.toDateString() === new Date().toDateString();
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({
        dayNum: d,
        dateString: dateStr,
        isToday,
        isWeekend: curDateObj.getDay() === 0 || curDateObj.getDay() === 6,
        events: eventsMap[dateStr] || [],
      });
    }

    // Padded end cells to multiples of 7
    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  }, [activeDate, eventsMap]);

  // Week View Calculator (7 columns, 8 AM - 6 PM)
  const weekDays = useMemo(() => {
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();
    const day = activeDate.getDate();
    const currentDayOfWeek = activeDate.getDay();
    const startOfWeek = new Date(activeDate);
    const diff = day - currentDayOfWeek + (currentDayOfWeek === 0 ? -6 : 1); // Mon-start
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(startOfWeek);
      cur.setDate(startOfWeek.getDate() + i);
      const dateStr = `${cur.getFullYear()}-${(cur.getMonth() + 1).toString().padStart(2, '0')}-${cur.getDate().toString().padStart(2, '0')}`;
      days.push({
        label: cur.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dayNum: cur.getDate(),
        dateString: dateStr,
        isToday: cur.toDateString() === new Date().toDateString(),
        isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
        events: eventsMap[dateStr] || [],
      });
    }
    return days;
  }, [activeDate, eventsMap]);

  const hoursList = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]; // 8 AM to 6 PM

  return (
    <div className="min-h-screen bg-[#FCFCFF] flex flex-col font-sans text-[#1A1740]">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b border-[#EEEDF8] bg-white">
        <div className="flex flex-col">
          <h1 className="text-base font-extrabold text-[#1A1740] tracking-tight">Calendar</h1>
          <span className="text-[10px] font-semibold text-[#A0A0B8] mt-0.5">
            {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* Stats chips */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#FFF7ED] text-[#C2410C]">
            🔥 18 streak
          </div>
          <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#F0EBFF] text-[#7C3AED]">
            +450 XP
          </div>
          <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#ECFDF5] text-[#059669]">
            2/6 tasks
          </div>
          <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#EEF2FF] text-[#4338CA]">
            58% curriculum
          </div>
        </div>

        <button
          onClick={() => {
            setFormDate(time.toISOString().split('T')[0]);
            setModalOpen(true);
          }}
          className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-all shadow-[0_3px_10px_rgba(124,58,237,0.28)]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add event
        </button>
      </header>

      {/* ── Main Layout (Two Columns) ── */}
      <div className={cn(
        'flex-1 max-w-7xl mx-auto w-full p-6 grid gap-6 items-start transition-all duration-300',
        chatOpen
          ? 'grid-cols-1'
          : 'grid-cols-1 lg:grid-cols-[1fr_244px]'
      )}>
        {/* Left Column: Calendar views */}
        <div className="flex flex-col gap-4">
          {/* Nav & View selectors */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#EEEDF8] p-3 rounded-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentOffset((o) => o - 1)}
                className="h-8 w-8 flex items-center justify-center border border-[#EEEDF8] hover:bg-muted/40 rounded-lg text-[#1A1740] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-bold min-w-[120px] text-center">
                {activePeriodTitle}
              </span>
              <button
                onClick={() => setCurrentOffset((o) => o + 1)}
                className="h-8 w-8 flex items-center justify-center border border-[#EEEDF8] hover:bg-muted/40 rounded-lg text-[#1A1740] transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => setCurrentOffset(0)}
                className="text-xs font-semibold text-[#7C3AED] hover:bg-[#F0EBFF] px-2.5 py-1.5 rounded-lg border border-transparent transition-colors"
              >
                Today
              </button>
            </div>

            {/* Day / Week / Month tab control */}
            <div className="flex rounded-lg bg-[#F5F4FC] p-1 self-start">
              {(['day', 'week', 'month'] as CalView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setCalView(v);
                    setCurrentOffset(0);
                  }}
                  className={cn(
                    'px-3.5 py-1.5 text-xs font-bold rounded-md capitalize transition-all',
                    calView === v
                      ? 'bg-white text-[#7C3AED] shadow-sm'
                      : 'text-[#8B8BA8] hover:text-[#1A1740]'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Views Grid Panels */}
          <div className="bg-white border border-[#EEEDF8] rounded-2xl overflow-hidden min-h-[450px]">
            {/* MONTH VIEW */}
            {calView === 'month' && (
              <div className="flex flex-col h-full">
                {/* Header row */}
                <div className="grid grid-cols-7 border-b border-[#EEEDF8] bg-[#FAFAFF]">
                  {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((dow, idx) => (
                    <div
                      key={dow}
                      className={cn(
                        'text-center py-2 text-[9px] font-extrabold tracking-wider',
                        idx >= 5 ? 'text-[#C0C0D4]' : 'text-[#A0A0B8]'
                      )}
                    >
                      {dow}
                    </div>
                  ))}
                </div>

                {/* Grid cells */}
                <div className="grid grid-cols-7 flex-1 min-h-[400px]">
                  {monthDays.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="border-r border-b border-[#EEEDF8]/60 bg-[#FAFAFF]/30" />;
                    }

                    return (
                      <div
                        key={day.dateString}
                        onClick={() => {
                          setFormDate(day.dateString);
                          setModalOpen(true);
                        }}
                        className={cn(
                          'min-h-[75px] border-r border-b border-[#EEEDF8] p-1.5 hover:bg-muted/10 cursor-pointer flex flex-col gap-1.5 transition-colors relative group'
                        )}
                      >
                        {/* Day number disc */}
                        <span
                          className={cn(
                            'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold',
                            day.isToday
                              ? 'bg-[#7C3AED] text-white'
                              : day.isWeekend
                              ? 'text-[#B0B0C4]'
                              : 'text-[#1A1740]'
                          )}
                        >
                          {day.dayNum}
                        </span>

                        {/* Events list */}
                        <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                          {day.events.slice(0, 2).map((ev) => (
                            <div
                              key={ev.id}
                              style={{ backgroundColor: ev.color }}
                              className="text-[8px] font-extrabold text-white px-1.5 py-0.5 rounded truncate flex items-center justify-between"
                            >
                              <span className="truncate">{ev.title}</span>
                              <button
                                onClick={(e) => handleDeleteEvent(ev.id!, e)}
                                className="opacity-0 group-hover:opacity-100 hover:text-white/80 p-0.5 ml-1 transition-opacity"
                              >
                                <Trash2 className="h-2 w-2" />
                              </button>
                            </div>
                          ))}
                          {day.events.length > 2 && (
                            <span className="text-[8px] font-bold text-[#A0A0B8] ml-1">
                              +{day.events.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WEEK VIEW */}
            {calView === 'week' && (
              <div className="flex flex-col overflow-x-auto">
                <div className="min-w-[600px]">
                  {/* Header Row */}
                  <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[#EEEDF8] bg-[#FAFAFF]">
                    <div className="border-r border-[#EEEDF8] bg-[#FCFCFF]" />
                    {weekDays.map((day) => (
                      <div
                        key={day.dateString}
                        className={cn(
                          'py-2 flex flex-col items-center gap-1 border-r border-[#EEEDF8]',
                          day.isToday && 'bg-[#FDFCFF]'
                        )}
                      >
                        <span className="text-[8px] font-bold text-[#A0A0B8] tracking-widest">{day.label}</span>
                        <span
                          className={cn(
                            'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold',
                            day.isToday ? 'bg-[#7C3AED] text-white' : 'text-[#1A1740]'
                          )}
                        >
                          {day.dayNum}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Hours Rows */}
                  <div className="flex flex-col">
                    {hoursList.map((hour) => (
                      <div key={hour} className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[#EEEDF8]/50 min-h-[50px]">
                        {/* Hour marker */}
                        <div className="border-r border-[#EEEDF8] text-[9px] font-bold text-[#A0A0B8] text-right pr-2 pt-1 bg-[#FCFCFF]">
                          {hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`}
                        </div>

                        {/* Days column blocks */}
                        {weekDays.map((day) => {
                          // Find any event starting in this hour bucket (floored)
                          const hourlyEvents = day.events.filter(
                            (e) => Math.floor(e.hour) === hour
                          );

                          return (
                            <div
                              key={day.dateString}
                              onClick={() => {
                                setFormDate(day.dateString);
                                setFormHour(hour);
                                setModalOpen(true);
                              }}
                              className={cn(
                                'border-r border-[#EEEDF8] p-1 relative hover:bg-muted/10 cursor-pointer transition-colors',
                                day.isToday && 'bg-[#FDFCFF]'
                              )}
                            >
                              {hourlyEvents.map((ev) => (
                                <div
                                  key={ev.id}
                                  style={{ backgroundColor: ev.color }}
                                  className="absolute inset-x-1 z-10 p-1.5 rounded-lg text-white shadow-sm flex flex-col group"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold truncate leading-tight">{ev.title}</span>
                                    <button
                                      onClick={(e) => handleDeleteEvent(ev.id!, e)}
                                      className="opacity-0 group-hover:opacity-100 hover:text-white/80 p-0.5 ml-1 transition-opacity"
                                    >
                                      <Trash2 className="h-2 w-2" />
                                    </button>
                                  </div>
                                  <span className="text-[7.5px] text-white/80 font-semibold mt-0.5">{ev.time}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* DAY VIEW */}
            {calView === 'day' && (
              <div className="flex flex-col">
                <div className="border-b border-[#EEEDF8] bg-[#FAFAFF] px-4 py-3 flex items-center justify-between">
                  <div className="flex flex-col">
                    <h3 className="text-sm font-bold text-[#1A1740]">
                      {activeDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                    <span className="text-[10px] text-[#A0A0B8]">
                      {(eventsMap[activeDate.toISOString().split('T')[0]] || []).length} events scheduled
                    </span>
                  </div>
                  <span className="px-2.5 py-1 text-[9px] font-bold rounded-full bg-[#F0EBFF] text-[#7C3AED] uppercase tracking-wider">
                    College day
                  </span>
                </div>

                <div className="flex flex-col">
                  {hoursList.map((hour) => {
                    const dateStr = activeDate.toISOString().split('T')[0];
                    const dayEvents = eventsMap[dateStr] || [];
                    const hourlyEvents = dayEvents.filter((e) => Math.floor(e.hour) === hour);

                    return (
                      <div key={hour} className="grid grid-cols-[72px_1fr] border-b border-[#EEEDF8]/50 min-h-[56px] items-center">
                        <div className="text-[9px] font-extrabold text-[#A0A0B8] text-right pr-3 bg-[#FCFCFF] h-full flex items-center justify-end">
                          {hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`}
                        </div>

                        <div
                          onClick={() => {
                            setFormDate(dateStr);
                            setFormHour(hour);
                            setModalOpen(true);
                          }}
                          className="p-2 h-full hover:bg-muted/10 transition-colors cursor-pointer flex flex-col gap-1.5 justify-center"
                        >
                          {hourlyEvents.length === 0 ? (
                            <span className="text-[9px] text-[#C0C0D4] italic">Free slot</span>
                          ) : (
                            hourlyEvents.map((ev) => (
                              <div
                                key={ev.id}
                                style={{ borderLeftColor: ev.color }}
                                className="border-l-4 bg-muted/40 p-2 rounded-r-lg flex items-center justify-between group"
                              >
                                <div>
                                  <h4 className="text-xs font-bold text-[#1A1740]">{ev.title}</h4>
                                  <p className="text-[9px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                    <MapPin className="h-3 w-3" /> {ev.room} · {ev.time}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold text-muted-foreground px-2 py-0.5 rounded-full border border-border bg-background shrink-0">
                                    {ev.dur}h
                                  </span>
                                  <button
                                    onClick={(e) => handleDeleteEvent(ev.id!, e)}
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-1 text-muted-foreground transition-opacity"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Today at College: Inline Card below the calendar ── */}
          {calView === 'month' && (
            <div className="bg-white border border-[#EEEDF8] rounded-2xl shadow-sm p-4 flex gap-4 overflow-hidden mt-2">
              {/* Left: Concentric SVG rings */}
              <div className="w-[140px] h-[140px] flex items-center justify-center shrink-0 relative">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="70" cy="70" r="60" fill="none" stroke="#F5F4FC" strokeWidth="8" />
                  <circle cx="70" cy="70" r="45" fill="none" stroke="#F5F4FC" strokeWidth="8" />
                  {/* Outer arcs */}
                  <circle cx="70" cy="70" r="60" fill="none" stroke="#7C3AED" strokeWidth="8"
                    strokeDasharray="120 377" strokeDashoffset="0" strokeLinecap="round" />
                  <circle cx="70" cy="70" r="60" fill="none" stroke="#3B82F6" strokeWidth="8"
                    strokeDasharray="80 377" strokeDashoffset="-130" strokeLinecap="round" />
                  <circle cx="70" cy="70" r="60" fill="none" stroke="#F97316" strokeWidth="8"
                    strokeDasharray="55 377" strokeDashoffset="-220" strokeLinecap="round" />
                  {/* Inner arcs */}
                  <circle cx="70" cy="70" r="45" fill="none" stroke="#10B981" strokeWidth="8"
                    strokeDasharray="100 283" strokeDashoffset="0" strokeLinecap="round" />
                  <circle cx="70" cy="70" r="45" fill="none" stroke="#EC4899" strokeWidth="8"
                    strokeDasharray="70 283" strokeDashoffset="-115" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-[#1A1740]">7</span>
                  <span className="text-[7px] font-bold text-[#A0A0B8] uppercase tracking-widest">events today</span>
                </div>
              </div>

              {/* Right: Mini timetable */}
              <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
                <span className="text-[8px] font-black text-[#A0A0B8] uppercase tracking-wider block mb-1">Today at College</span>
                {collegeEvents.map((item, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center gap-2 p-1.5 rounded-lg border border-transparent transition-all',
                      item.status === 'live' ? 'bg-[#FFF7ED] border-[#FDBA74]/30' : 'bg-[#FCFCFF]'
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-extrabold text-[#1A1740] truncate leading-tight">{item.title}</p>
                      <p className="text-[7px] text-[#A0A0B8] truncate leading-tight mt-0.5">{item.time} · {item.room}</p>
                    </div>
                    {item.status === 'done' && <span className="text-emerald-500 text-[9px] font-bold">✓</span>}
                    {item.status === 'live' && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-500 text-white text-[6px] font-black uppercase tracking-wider animate-pulse">Live</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sidebar Panels — hidden when chat is open */}
        {!chatOpen && <div className="flex flex-col gap-6 w-full shrink-0 lg:w-[224px]">
          {/* Card 1: SELECT TIME (Live clock) */}
          <div className="rounded-2xl border border-[#EEEDF8] bg-white p-4 flex flex-col items-center">
            <span className="text-[8px] font-black text-[#C0C0D0] tracking-widest uppercase mb-3">SELECT TIME</span>

            {/* Readout tiles */}
            <div className="flex items-center gap-1.5 mb-3">
              <div className="h-[54px] w-[50px] rounded-xl bg-[#F0EBFF] flex items-center justify-center shadow-sm">
                <span className="text-[32px] font-black text-[#7C3AED] leading-none">{digitalTime.hours}</span>
              </div>
              <span className="text-xl font-bold text-[#C4B5FD] leading-none">:</span>
              <div className="h-[54px] w-[50px] rounded-xl bg-[#F5F4FC] flex items-center justify-center shadow-sm">
                <span className="text-[32px] font-black text-[#1A1740] leading-none">{digitalTime.minutes}</span>
              </div>

              {/* AM/PM toggle stack */}
              <div className="flex flex-col gap-0.5 ml-1">
                <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded', digitalTime.ampm === 'AM' ? 'bg-[#7C3AED] text-white' : 'bg-muted text-muted-foreground')}>
                  AM
                </span>
                <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded', digitalTime.ampm === 'PM' ? 'bg-[#7C3AED] text-white' : 'bg-muted text-muted-foreground')}>
                  PM
                </span>
              </div>
            </div>

            {/* SVG Analog Clock */}
            <div className="w-[128px] h-[128px] relative">
              <svg className="w-full h-full">
                <circle cx="64" cy="64" r="60" fill="none" stroke="#F5F4FC" strokeWidth="2.5" />
                {/* 12-3-6-9 dial markers */}
                <text x="64" y="14" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#A0A0B8">12</text>
                <text x="114" y="67" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#A0A0B8">3</text>
                <text x="64" y="120" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#A0A0B8">6</text>
                <text x="14" y="67" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#A0A0B8">9</text>

                {/* Minute hand */}
                <line x1="64" y1="64" x2={clockHands.mnX} y2={clockHands.mnY} stroke="#1A1740" strokeWidth="2" strokeLinecap="round" />
                {/* Hour hand */}
                <line x1="64" y1="64" x2={clockHands.hrX} y2={clockHands.hrY} stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" />

                {/* Hour hand tip purple disc */}
                <circle cx={clockHands.hrX} cy={clockHands.hrY} r="4.5" fill="#7C3AED" />

                {/* Center pin */}
                <circle cx="64" cy="64" r="3.5" fill="#1A1740" />
              </svg>
            </div>
          </div>

          {/* Card 2: Work Progress (Beam system) */}
          <div className="rounded-2xl border border-[#EEEDF8] bg-white p-4 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-black text-[#1A1740]">Work Progress</h3>
              {/* D W M Chips */}
              <div className="flex bg-[#F5F4FC] rounded p-0.5">
                {(['day', 'week', 'month'] as BeamView[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setBeamView(v)}
                    className={cn(
                      'text-[9px] font-black px-1.5 py-0.5 rounded capitalize transition-all',
                      beamView === v ? 'bg-[#7C3AED] text-white' : 'text-[#8B8BA8]'
                    )}
                  >
                    {v[0].toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[8.5px] text-[#A0A0B8] mb-3">
              {beamView === 'day' && 'Today · 2/5 complete'}
              {beamView === 'week' && 'This week · 2/7 days'}
              {beamView === 'month' && 'July · 2 done · 2 missed'}
            </span>

            {/* Beams rows list */}
            <div className="flex flex-col gap-2">
              {beamView === 'day' &&
                dayBeams.map((beam) => (
                  <div key={beam.label} className="flex items-center gap-2">
                    <span className="text-[9px] font-extrabold text-[#1A1740] w-14 truncate shrink-0">{beam.label}</span>
                    <div className="flex-1 h-2 rounded bg-[#F5F4FC] overflow-hidden relative">
                      <div
                        className={cn(
                          'h-full rounded transition-all',
                          beam.status === 'done'
                            ? 'bg-gradient-to-r from-[#10B981] to-[#34D399]'
                            : beam.status === 'progress'
                            ? 'bg-[#7C3AED]'
                            : 'bg-transparent'
                        )}
                        style={{ width: `${beam.progress}%` }}
                      />
                      {beam.status === 'missed' && (
                        <div className="absolute inset-0 border border-rose-300 bg-rose-50/40" />
                      )}
                    </div>
                    {/* Status icons */}
                    <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                      {beam.status === 'done' && <span className="text-emerald-500 text-[10px] font-bold">✓</span>}
                      {beam.status === 'progress' && <span className="text-violet-500 text-[10px] font-bold">↻</span>}
                      {beam.status === 'missed' && <span className="text-red-500 text-[9px] font-bold">✕</span>}
                      {beam.status === 'pending' && <span className="text-gray-300 text-[12px]">·</span>}
                    </span>
                  </div>
                ))}

              {beamView === 'week' &&
                weekBeams.map((beam) => (
                  <div key={beam.label} className="flex items-center gap-2">
                    <span className="text-[9px] font-extrabold text-[#1A1740] w-8 shrink-0">{beam.label}</span>
                    <div className="flex-1 h-2 rounded bg-[#F5F4FC] overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded transition-all',
                          beam.status === 'done'
                            ? 'bg-gradient-to-r from-[#10B981] to-[#34D399]'
                            : beam.status === 'progress'
                            ? 'bg-[#7C3AED]'
                            : 'bg-transparent'
                        )}
                        style={{ width: `${beam.progress}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-bold text-[#A0A0B8] shrink-0 w-16 text-right">
                      {beam.detail}
                    </span>
                  </div>
                ))}

              {beamView === 'month' && (
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 31 }).map((_, i) => {
                    const isDone = i % 5 === 0;
                    const isMissed = i % 7 === 3;
                    return (
                      <div key={i} className="flex flex-col items-center border border-[#EEEDF8] p-0.5 rounded bg-muted/10">
                        <span className="text-[7px] text-[#A0A0B8]">{i + 1}</span>
                        <div
                          className={cn(
                            'h-1 w-full rounded mt-0.5',
                            isDone ? 'bg-emerald-400' : isMissed ? 'bg-rose-400' : 'bg-gray-100'
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer legend */}
            <div className="border-t border-[#EEEDF8] mt-3 pt-3 flex items-center justify-between text-[8px] font-bold text-[#A0A0B8]">
              <div className="flex gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Done
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Missed
                </span>
              </div>
              <span className="text-[#7C3AED] text-[10px]">40%</span>
            </div>
          </div>

          {/* Card 3: Today's Plan (Circular) */}
          <div className="rounded-2xl border border-[#EEEDF8] bg-white p-4 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-black text-[#1A1740]">Today's Plan</h3>
              <span className="px-1.5 py-0.5 text-[7px] font-black text-orange-500 bg-[#FFF7ED] uppercase tracking-wider rounded">
                Ongoing
              </span>
            </div>
            <span className="text-[8.5px] text-[#A0A0B8] mb-3">5 sessions · College</span>

            {/* SVG Donut */}
            <div className="w-[120px] h-[120px] self-center relative flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="60" cy="60" r="42" fill="none" stroke="#F0EFFC" strokeWidth="8" />
                {/* Dash array = 2 * PI * r = 263.8 */}
                <circle
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke="#7C3AED"
                  strokeWidth="8"
                  strokeDasharray="90 263.8"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="8"
                  strokeDasharray="60 263.8"
                  strokeDashoffset="-100"
                  strokeLinecap="round"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="8"
                  strokeDasharray="50 263.8"
                  strokeDashoffset="-170"
                  strokeLinecap="round"
                />
              </svg>
              {/* Inner text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center mt-1">
                <span className="text-sm font-black text-[#1A1740]">58%</span>
                <span className="text-[6.5px] font-bold text-[#A0A0B8] uppercase">done today</span>
              </div>
            </div>

            {/* Timetable plan list rows */}
            <div className="flex flex-col gap-2 mt-4">
              {collegeEvents.map((item, idx) => (
                <div key={idx} className={cn("flex items-center justify-between text-[9px] font-bold", item.status === 'future' && 'opacity-35')}>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[#1A1740] truncate">{item.title}</span>
                  </div>
                  <span className="text-[#A0A0B8] shrink-0 font-medium ml-2">{item.time.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>}
      </div>

      {/* ── Add Event Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1740]/45 backdrop-blur-[4px] p-4">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] bg-white rounded-2xl border border-[#EEEDF8] shadow-[0_24px_64px_rgba(26,23,64,0.22)] overflow-hidden flex flex-col p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#EEEDF8]">
              <h2 className="font-extrabold text-sm text-[#1A1740] flex items-center gap-2">
                <span>📅</span> Add Calendar Event
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="flex flex-col gap-4">
              {errorMsg && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-50/40 p-3 flex items-start gap-2 text-rose-500 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. React Native Workshop"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">
                    Timing Display Text
                  </label>
                  <input
                    type="text"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    placeholder="e.g. 10:00 AM - 11:30 AM"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">
                    Start Hour (8–18)
                  </label>
                  <select
                    value={formHour}
                    onChange={(e) => setFormHour(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  >
                    {hoursList.map((h) => (
                      <option key={h} value={h}>
                        {h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">
                    Duration (hours)
                  </label>
                  <input
                    type="number"
                    value={formDur}
                    onChange={(e) => setFormDur(Number(e.target.value))}
                    step={0.5}
                    min={0.5}
                    max={8}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">
                  Room Location
                </label>
                <input
                  type="text"
                  value={formRoom}
                  onChange={(e) => setFormRoom(e.target.value)}
                  placeholder="e.g. Room 402"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">
                  Category / Color
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setFormColor(c.color)}
                      style={{ backgroundColor: c.color }}
                      className={cn(
                        'h-8 rounded-lg flex items-center justify-center text-[8px] font-bold text-white transition-all',
                        formColor === c.color ? 'ring-2 ring-offset-2 ring-[#7C3AED]' : 'opacity-80 hover:opacity-100'
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#EEEDF8] pt-4 mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold border border-[#EEEDF8] rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors"
                >
                  {submitting ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Schedule;
