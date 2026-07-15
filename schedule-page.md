# Schedule / Timetable Page — Full Specification

> File reference: `client/src/pages/Schedule.tsx`
> URL: `/schedule`
> Layout: 2-column (Calendar grid 1fr + Right side panel 244px)

The Schedule page is a hybrid calendar + day-planner + progress-tracker. It mirrors a college timetable and overlays a personal progress beam system on top.

---

## 1. Page Overview

- **Purpose:** A personal academic calendar with month / week / day views, an in-place "Today at College" circular ring dashboard, a live analog clock, a work-progress beam (day/week/month), and a "Today's Plan" circular tracker.
- **Top Bar:** Shows page title `Calendar`, the current date string (`Sunday, July 13, 2026`), and four stat pills (Streak, XP, Tasks, Curriculum). Right side has a primary `Add event` button (purple).
- **Main Grid:** Two columns. Left = the active calendar view. Right = a sidebar stack of three cards (Select Time clock, Work Progress beams, Today's Plan).
- **Floating Overlay:** A `Today at College` card sits absolute-positioned over the calendar grid (left: 31, top: 497, 413×224).

---

## 2. Top Bar

- **Background:** White, bottom border `#EEEDF8`, sticky, `padding: 10px 22px`.
- **Left Block:** Page title `Calendar` (16px / 800 / `#1A1740`, tight tracking) with date string below in `#A0A0B8` 10px.
- **Center Pills (4 chips):**
  1. `🔥 18 streak` — orange pill, bg `#FFF7ED`, text `#C2410C`.
  2. `+450 XP` — purple pill, bg `#F0EBFF`, text `#7C3AED`.
  3. `2/6 tasks` — green pill, bg `#ECFDF5`, text `#059669`.
  4. `58% curriculum` — indigo pill, bg `#EEF2FF`, text `#4338CA`.
- **Right Block:** Primary `Add event` button — purple `#7C3AED` fill, white text, plus-icon (two crossing lines) on the left, soft purple shadow `0 3px 10px rgba(124,58,237,0.28)`, border-radius 9.

---

## 3. Left Column — Calendar Grid

### 3.1 Nav Row
- **Left group:** Chevron buttons `‹` / `›` and centered period title (15px / 700 / `#1A1740`).
  - Month → `July 2026`
  - Week → `Jul 13 – Jul 19, 2026`
  - Day → `Monday, July 13`
- **Right group:** `Today` button (nav-btn style) + view toggle (Day / Week / Month pills, 3-tab segmented control).
  - Tab group: bg `#F5F4FC`, radius 8, active tab text purple.

### 3.2 Month View
- 7-column grid (`repeat(7, 1fr)`) with Mon-first week.
- **Header row:** DOW labels `MON TUE WED THU FRI SAT SUN`. Weekend labels in `#C0C0D4`; others in `#A0A0B8`. Bg `#FAFAFF`.
- **Cell layout:**
  - Day number in a 20px circle. Today → purple fill `#7C3AED` + white bold text.
  - Weekend days in light gray (`#B0B0C4`).
  - Up to 2 event chips (colored blocks, 2px padding, 3 radius) with white bold title, ellipsis on overflow.
  - `+N more` link in `#A0A0B8` 8px when more than 2 events exist.
- **Empty padding cells** (before the 1st and after last day) for visual grid completeness.
- **Cell click** → opens the Add Event modal pre-filled with that date.

### 3.3 Week View
- Grid with a 56px left time gutter + 7 day columns.
- **Header row:** DOW label (9px / 700) and date in a 22px circle; today uses `#7C3AED` fill; weekend day labels in `#C0C0D4`.
- **Hour rows:** 11 rows from 8 AM to 6 PM.
  - Left gutter shows the hour label (right-aligned, `#A0A0B8`, 9px, bg `#FCFCFF`).
  - Each day cell: white background (today → `#FDFCFF`); event blocks are colored cards with title (9px / 700) and time string (8px / white-85%).

### 3.4 Day View
- Single-column timeline. Header strip:
  - Left: full day title (e.g. `Monday, July 13`) + `N events scheduled`.
  - Right: `College day` purple pill.
- **Hour rows:** 11 rows 8 AM – 6 PM, 52px min height each.
  - Left gutter 72px wide, shows `H:00 AM/PM` label.
  - Event block: rounded 6, colored, with title, room under it, and right-aligned time + duration (e.g. `1h`).

### 3.5 Today at College — Floating Card
- **Size:** 413×224, white, radius 12, soft purple shadow `0 1px 14px rgba(100,82,246,0.09)`, padding 13.
- **Layout:** Two columns — left = circular ring chart (168×168 SVG), right = event list (5 rows).
- **Ring chart (SVG):**
  - Two concentric circles (r=72 outer track, r=56 inner track).
  - 6 arc segments using the event colors (orange, purple, green, purple, blue, indigo) with strokeWidth 9, round caps.
  - Center disc (r=36) with big number `7` and `events today` label.
  - "Now" dot on the outer ring (white fill, orange stroke) at the current time.
- **Event list rows:** Each row is a soft-tinted pill with:
  - 7×7 color square.
  - Title (9px / 700) + meta (8px gray: time · room).
  - Right icon: green `✓` for done, orange `Live` for current, none for future (faded with opacity 0.6–0.7).
- **Rows shown (in order):** Eng. Math, DSA + Lab, Project Review (Live), Machine Learning, Study Group.

---

## 4. Right Column — Side Panel

### 4.1 Card 1 — Select Time (Live Clock)
- Header label `SELECT TIME` in 8px / 700 / `#C0C0D0`, tracked uppercase, centered.
- **Digital readout:** Two big tiles (50×54, radius 10):
  - Hour tile bg `#F0EBFF`, purple `#7C3AED` 32px bold digits.
  - Minute tile bg `#F5F4FC`, dark `#1A1740` 32px bold digits.
  - Colon between them in `#C4B5FD` 28px.
- **AM/PM toggle:** Two stacked pills; active one purple bg + white text, inactive light bg + gray text.
- **Analog clock:** 128×128 SVG with hour ticks 12-3-6-9, hour and minute hands drawn dynamically from the current time. Hour tip uses a 8.5-radius purple disc.
- **Update mechanism:** `useEffect` ticks every 1s (`setTick`), recomputing angles and `hrX/hrY/mnX/mnY` for the SVG hand endpoints.

### 4.2 Card 2 — Work Progress (Beam System)
- Header `Work Progress` (11px / 800) and a status line that updates per view: `Today · 2/5 complete` / `This week · 2/7 days` / `July · 2 done · 2 missed`.
- **Toggle:** 3 small chips `D W M` (day / week / month), active = purple bg.
- **Day view:** 5 horizontal beam rows.
  - Each row = label (66px wide) + bar + status icon.
  - Beams represent the day task list: `Eng. Math`, `DSA + Lab`, `ML`, `DBMS`, `Project`.
  - Bar visuals per status:
    - `done` → green gradient `#10B981 → #34D399` solid, `✓` icon.
    - `progress` → purple gradient `#7C3AED` for 55% width, rest light `#EDE9FE`, `↻` icon.
    - `missed` → light bg `#F5F4FC`, red 1px border `#FCA5A5`, red `✕` overlay.
    - `pending` → light bg, dashed border `#E5E3F0`, gray `·` icon.
- **Week view:** 7 rows (MON–SUN), each with day label (36px) + bar + completion count (e.g. `5/5`, `2/5`, `—`).
- **Month view:** 7×N grid of small day cells (each cell = day number + thin bar).
- **Footer legend:** Two pills — green "Done", dashed "Missed". Right side shows the overall rate in bold purple (e.g. `40%`).

### 4.3 Card 3 — Today's Plan (Circular)
- Header `Today's Plan` (11px / 800) + meta `5 sessions · College` and a `Ongoing` orange pill.
- **Donut chart** (120×120 SVG):
  - Track circle r=42 stroke `#F0EFFC`.
  - 5 colored arcs (orange, purple, green, blue, pink) using `strokeDasharray` for proportional lengths.
  - Faint background arcs at 15% opacity, then solid arcs on top.
  - Center text: `58%` big, `done today` small.
- **Task list:** 5 rows with color dot + name + start time + status icon (`✓`, `↻`, `—`).
  - Pending rows are dimmed (gray text + faded dot at opacity 0.35).
  - List order: Eng. Math, DSA + Lab, Machine Learning, DBMS, Project Work.

---

## 5. Add Event Modal

- Triggered by top-right `Add event` button or by clicking a month cell.
- **Backdrop:** `rgba(26,23,64,0.45)` + 4px backdrop blur, fixed inset 0, z-index 200.
- **Card:** White, radius 20, max-width 400, padding 24/28, soft shadow `0 24px 64px rgba(26,23,64,0.22)`.
- **Header:** Calendar emoji + `Add Calendar Event` 16/800 + `×` close button.
- **Form fields (top to bottom):**
  1. **Task / Event Title** — text input, placeholder `e.g. React Native Workshop`.
  2. **Date (YYYY-MM-DD)** — date input, defaults to today.
  3. **Timing (Display text)** — text input, default `10:00 AM - 11:30 AM`.
  4. **Start Hour (8–18)** — select dropdown rendered as `8 AM, 9 AM, … 6 PM`.
  5. **Duration (hours)** — number input, step 0.5, min 0.5, max 8.
  6. **Room Location** — text input, default `Room 402`.
  7. **Category / Color** — select with five fixed color options: Lecture (Purple `#7C3AED`), Lab (Blue `#3B82F6`), Hackathon (Red `#EF4444`), Workshop (Green `#10B981`), Personal (Pink `#EC4899`).
- **Footer:** Two buttons side-by-side — primary `Create Event` (purple) and secondary `Cancel` (white with light border).
- **Submit behavior:** Validates title and date, builds a `CalendarEvent` object (`hour`, `dur`, `title`, `color`, `room`, `time`), appends to the events map under the chosen date, resets the form, closes the modal, and shows an `alert` confirmation.

---

## 6. Data Model

- **CalendarEvent** — `hour: number`, `dur: number`, `title: string`, `color: string`, `room: string`, `time: string`.
- **Events map** — `Record<string, CalendarEvent[]>` keyed by `YYYY-MM-DD`.
- **Static seed:** Hard-coded events across June 29 – July 30, 2026 (lectures, labs, exams, a 3-day Hackathon on Jul 15–17 with `All day`/`6:00 PM` markers, etc.).
- **Calendar view state** — `monthOffset`, `weekOffset`, `dayOffset` integers for nav; `calView = 'day' | 'week' | 'month'`.
- **Beam view state** — `beamView = 'day' | 'week' | 'month'`.

## 7. Derived Logic

- **Week start:** Monday-based (`(wDow + 6) % 7` offset).
- **Month grid:** Leading empty cells + day cells, padded to a multiple of 7.
- **Today detection:** Day cell receives purple background, white text, bold weight 800.
- **Weekend detection:** Day-of-week 0 or 6 → muted gray labels and text.
- **Beam color resolver:** `getBeamStyle(status)` returns `{ bg, border, xDisplay, statusColor, statusIcon }` per status. Used uniformly for day, week, month bars.
- **Summary & rate:** Computed from `done` count and total — e.g. `Today · 2/5 complete`, `40%`.

## 8. Frontend / Style Notes

- **Typography:** Plus Jakarta Sans (inherited globally). Sizes range from 7px (axis labels) to 32px (digital clock).
- **Color tokens:** Purple `#7C3AED` primary, white `#fff` panels, panel bg `#FCFCFF`, border `#EEEDF8` / `#F0EFF8`, text primary `#1A1740`, text secondary `#8B8BA8` / `#A0A0B8` / `#C0C0D0`, success green `#10B981` / `#34D399`, warning orange `#F97316` / `#D97706`, danger red `#EF4444` / `#FCA5A5`.
- **Shapes:** Pill chips everywhere (radius 99), rounded buttons (radius 7–10), dashed borders for empty/pending cells.
- **Icons:** Inline SVGs only — no icon library. Icons are stroke-based with `strokeWidth 2–2.4`, `strokeLinecap="round"`.
- **Shadows:** Soft, color-tinted shadows on colored buttons; flat on cards.
- **State management:** All in-component with `useState`/`useEffect`. No global store.
- **Live clock:** `setInterval(..., 1000)` re-renders the analog + digital display.
- **Modal:** Click-outside-to-close, click-inside-to-keep-open (`stopPropagation`).

## 9. Interactions Recap

- Click `Add event` (top right or month cell) → open Add Event modal → submit → event appears in the right day/week/month view.
- Click `‹` / `›` in nav row → step the active view backward/forward.
- Click `Today` → reset all offsets to 0.
- Toggle Day/Week/Month tab → swap the left grid + update period title.
- Toggle `D W M` in the Work Progress card → swap beam rows/grid and recompute summary + rate.
- Sidebar clocks tick every second without user input.
- All chips and stat pills are visual only (no click handler).
