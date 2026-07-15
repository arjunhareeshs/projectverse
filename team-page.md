# Team Pages — Full Specification

> Files referenced:
> - `client/src/pages/Teams.tsx` — Teams directory/listing
> - `client/src/pages/TeamDetail.tsx` — Per-team workspace (7 tabs)
> - `client/src/pages/TeamMembers.tsx` — Standalone Member Manager
> Routes: `/teams`, `/teams/:teamId`, `/teams/:teamId/members` (via `TeamDetail` tab + standalone).

The Teams surface spans three pages. The directory lists all teams to discover/join or to create new ones. The team detail page is a tabbed workspace with seven sub-sections covering overview, members, tasks, projects, progress, activity, and chat. A standalone Member Manager gives a richer table view dedicated to roster management.

---

## 1. Teams Directory (`Teams.tsx`)

### 1.1 Layout
- `Sidebar` on the left, `TopBar` at the top (search "Search for teams, projects, members..."), then a 2-column main area (`minmax(0,1fr) 260px`).
- **Heading:** `Teams` (26px / 800) + subtitle `Collaborate, build and achieve together`.
- **Auto-redirect:** If `localStorage.student_team_state === 'Tech Innovators'`, the user is bounced to `/teams/1` on mount (treated as already part of a team).

### 1.2 Action Banner (2 cards)
- **Discover Teams** — light purple bg `#F1EEFF` with `#E1DBFF` border. Icon tile 36×36 in `#6D5CE0` with two-people SVG. Title + subtitle "Explore verified teams and request to join". Clicking smooth-scrolls to `#verified-teams-section`.
- **Create Team** — light green bg `#E9F9EF` with `#CDEFDB` border. Icon tile in `#1FA855`. Title + subtitle "Create your own team and invite members". Clicking opens the Create Team modal.

### 1.3 Filters Row
- Search input (with magnifier icon, "Search teams...") + three pill dropdowns: `Domain`, `Members`, `Status`. A `Reset` link in purple clears the search.
- Search matches `name` or `domain` (case-insensitive substring).

### 1.4 Verified Teams Section
- Header row with verified-checkmark SVG, title `Verified Teams`, subtitle "Join verified teams and work on impactful projects", and a `View all` link in purple.
- **Card grid:** `repeat(auto-fill, minmax(200px, 1fr))` of team cards. Each card shows:
  - **Header:** Colored 36×36 icon tile (uses `team.color`, fallback to team initials) with a soft tinted shadow `0 3px 8px ${color}55`, then team name + verified checkmark, with the `domain` below.
  - **Bookmark icon** in the top-right.
  - **Description** paragraph (`team.description || team.desc`), min-height 33 for visual consistency.
  - **Members/Status row:** `N / M Members` left, and a pill on the right — green `Recruiting` if room remains, orange `Full` if filled.
  - **Progress bar** with label "Progress" and a percent number; bar uses the team color.
  - **Leader row:** 28px gradient avatar + leader name + `Team Leader` sub-label.
  - **Primary button** `View Team` (full-width, light purple bg) → navigates to `/teams/:id`.
- **Show more teams** link at the bottom (centered, purple, with a down-chevron).

### 1.5 Right Sidebar (260px)
- **Your Team Status card:** Icon + title. Body text switches between:
  - `You are active in Tech Innovators.` (when joined), or
  - `You are not part of any team yet. Join a team or create your own to get started.`
  - `Create Team` primary button (full-width, purple).
- **Team Activity card:** Lists the latest four team events — colored square icon (32×32) + team name + action (`New member joined`, `Completed a milestone`, `Uploaded a new project`, `Won 1st in Hackathon`) + relative time. Footer link `View all activity`.
- **Popular Domains card:** Five rows (Full Stack 12, AI/ML 8, Web Dev 10, Cyber Security 6, IoT 4) — colored square + domain name + team count.

### 1.6 Create Team Modal
- Backdrop blur, white card 460 max-width, radius 20.
- Header: people emoji + `Create New Team` + `×`.
- Form fields:
  1. **Team Name** — text input, placeholder `e.g. Code Warriors`.
  2. **Description** — textarea, height 70, `What is your team building? Describe your goals...`.
  3. **Domain** — select: Full Stack Development, Web Development, AI/ML, Cyber Security, IoT.
  4. **Team Leader Name** — read-only text input prefilled with `Kishore K` (gray bg `#FAF9FF`).
- Submit button: `Create Team & Initialize` (full-width, purple, soft purple shadow).
- **Submit logic:** POST `/api/teams/create` with `{name, description, domain, leader_name}`. On success: persist `student_team_state = 'Tech Innovators'` in `localStorage`, close modal, navigate to `/teams/:id`. On failure: show alert with the error message.

### 1.7 Data
- **Static fallback (6 teams):** Code Warriors (Full Stack, Rahul N, 4/6, 68%, Recruiting), Dev Titans (Web Dev, Priya S, 5/6, 82%), Byte Builders (AI/ML, Arun K, 3/5, 45%), Tech Masters (Cyber Security, Karthik R, 4/6, 60%), InnovateX (IoT, Meena T, 2/4, 30%), Algo Squad (DSA/Tools, Siddharth M, 5/5, 90%, Full). Each team carries a custom inline SVG icon.
- **Activity (4 entries):** Code Warriors / Dev Titans / Byte Builders / Tech Masters with actions and `2h / 5h / 1d / 2d ago` timestamps.
- **Domains (5):** Full Stack 12, AI/ML 8, Web Dev 10, Cyber Security 6, IoT 4.
- **Fetch:** `useEffect` calls `GET /api/teams`; if array non-empty it overrides the static list, otherwise static data renders.

---

## 2. Team Detail — Hero & Tabs (`TeamDetail.tsx`)

### 2.1 Top Bar
- Left: `← Back to Teams` purple link → navigates to `/teams`.
- Right: Notification bell (32×32 circle bg `#EEF0FF` with a red 7×7 dot at top-right) + user chip (purple/pink gradient avatar `KK`, name `Kishore K`, sub `CSE · 3rd Year`).

### 2.2 Team Hero Banner
- White card with 1px border `#ECEBF6`, radius 16, padding 22/26, soft purple shadow.
- **Identity row:** 50×50 color tile with team initials + name + `Public Team` green pill + verified SVG checkmark. Description underneath.
- **Action buttons (right):** Conditional on `isMember`:
  - Member: `Edit Team` (white outline) + `Invite Members` (purple).
  - Non-member: `Request to Join Team` (purple).
- **Quick Metrics Grid (5 tiles, equal width):**
  1. `Domain` — team.domain.
  2. `Project` — team.current_project or `None`.
  3. `Team Type` — `Project Based`.
  4. `Members` — `${members.length} / ${team.max_members || 6}`.
  5. `Duration` — `6 – 12 Months`.
  Each tile pairs an emoji icon with a label/value stack.

### 2.3 Tab Navigation
- 7 tabs across the top: `overview`, `members`, `tasks`, `projects`, `progress`, `activity`, `chat`.
- For non-members, the `activity` and `chat` tabs are hidden (filtered out).
- Active tab is purple, weight 800, with a 3px purple underline. Inactive tabs are gray (`#8B8BA8`), weight 600.

---

## 3. Tab 1 — Overview

Two-column layout (`minmax(0,1fr) 280px`).

### 3.1 Left Column
- **Project Progress radial card:** SVG ring (90×90, r=40, track `#EEF2FF`, purple progress arc with `strokeDashoffset=80` on `strokeDasharray=251.3`, rounded caps). Center shows `68%` / `Overall`. Right side: title + 3 mini stat blocks (`34 / 50` Tasks Completed, `2 / 4` Milestones, `Yes` On Track in green). "View Progress →" link switches to the progress tab.
- **Sprints & Active Projects** (2-up grid):
  - **Sprint Card:** `In Progress` orange pill, `Sprint 2: Core Development`, start/end dates, `13 / 20 Completed` 65% with gradient progress bar.
  - **Active Projects Card:** `View All` link, list of 2 projects (Smart Campus System 72%, Mobile Companion App 30%) with emoji tiles and percentages.
- **Upcoming Deadlines & Recent Activity** (2-up; Activity hidden for non-members):
  - **Deadlines:** 2 colored rows (red border for "Tomorrow" high-priority, amber for medium).
  - **Recent Activity:** 2 entries with circular initial avatar, action copy, and relative time.

### 3.2 Right Column
- **Team Quick Actions (members only):** 2×2 grid of colored tiles with emoji + label — `Add Members` (green) → routes to `/portfolio/search`, `Create Project` (indigo) → opens create-project modal, `Create Task` (amber) → opens create-task modal, `Team Chat` (pink) → switches to chat tab.
- **Team Members list:** Title + `View All` link, then a vertical list of members with initial avatar (bordered in member color at 33% alpha) + name (with `(You)` suffix for the current user) + role.

---

## 4. Tab 2 — Members

Two-column layout (`minmax(0,1fr) 300px`).

### 4.1 Left Column
- **Stats row (4 cards):** Total Members `N / 6`, Active Members, Pending Invites count, Open Slots (capacity remaining). Each has a colored icon tile bg + value/label/sub-label stack.
- **Inline filter tabs:** `All Members (N)`, `Pending Invites (N)`, `Removed Members (0)`. Active = purple text + 2.5px purple underline. For non-members, only the `All` tab is visible. `Member Roles Guide` outline button on the right.
- **Search row:** Wide text input `Search members by name or role...` + a `Filters` outline button.
- **All Members table:** Header row `Member / Role / Skills / Joined On / Status`. Each row: 34×34 colored avatar (initial letters) + name + email, role pill (uses member color/bg), 3 skill chips (rounded, `#F3F2F8`), joined date, and a green `● Active` status. `(You)` is appended to the current user.
- **Pending Invitations table:** `Invited Candidate / Proposed Role / Skills / Action`. Each row shows a name + email, role pill in indigo bg, skill chips, and two action buttons: `Accept` (green) / `Decline` (red).
  - Accepting promotes the pending entry into the members list with `joined: 'Today'` and a default avatar color set, then removes them from pending.
  - Declining just removes the entry.

### 4.2 Right Column
- **Role Distribution card:** A custom SVG ring chart (120×120) with four arcs in different colors. Below, a 2-col grid legend listing `Leader (1)`, `Frontend (1)`, `UI/UX (1)`, `Backend (1)` with color dots.
- **Invite New Members (members only):** Form with:
  1. Email (required).
  2. Role select: Frontend Developer, Backend Developer, UI/UX Designer, DevOps Engineer, Full Stack Developer.
  3. Personal message (optional textarea).
  4. `Send Invitation` purple button.
  - On submit, the email's local-part is capitalized and used as a display name; a new pending entry is added with skills `['HTML', 'CSS', 'JavaScript']` and `invited: 'Today'`. An alert confirms.

---

## 5. Tab 3 — Tasks (Kanban)

- 4-column grid: `TO DO`, `IN PROGRESS`, `IN REVIEW`, `DONE`.
- **Column header:** Card name + count in parens; color-coded (gray, amber, blue, green).
- **Column body:** Dashed light-purple border. Each task card is white with 1px border, 12px padding, 8 radius. Shows title (11.5/700), description (9.5/gray), footer row with timeline + `Assignee #N`.
- **Done column** cards are dimmed (opacity 0.7) with line-through title text.

---

## 6. Tab 4 — Projects

- 2-column grid of project cards.
- **Card layout:**
  - Top row: stack/skill pill (default `MERN Stack`) + project type pill in purple.
  - Project name (15/800).
  - Description (12/600, gray).
  - Timeline label + progress percent; gradient purple progress bar fills to `p.progress%`.
- **Fallback seed (when DB empty):** Smart Campus Management System (MERN, Primary 72%, Apr–Oct 2024) + Mobile Companion Application (React Native + Firebase, Secondary 30%, Jun–Dec 2024).

---

## 7. Tab 5 — Progress

- Single card with title `Team Velocity Burn-down Chart`.
- A flex row of 10 vertical bars (Wk 1 – Wk 10) with heights 34%, 45%, 60%, 68%, 70%, 78%, 85%, 90%, 95%, 100% (each `flex: 1`).
- Bars are gradient purple (`#7C3AED → #A78BFA`), radius 3, with the week label below in 8.5px gray.
- Bottom border 2.5px `#E4E2F1`.

---

## 8. Tab 6 — Activity

- Card titled `Activity Log`. List of 4 hard-coded entries (`Rahul Verma` completed task, `Arun Kumar` uploaded ER Diagram.pdf, `Priya Sharma` updated UI mockups, `Karthik M` joined as DevOps). Each row: 28×28 lavender initial avatar + name + action + relative time.

---

## 9. Tab 7 — Chat

- Full-height card (450px) titled `💬 Team Chat Room` with a green `● Online` status indicator.
- **Message list:** Scrollable area. When `messages` is empty, a centered placeholder `No messages yet. Say hello!` shows. Each message: sender name + timestamp on top, then a colored bubble — purple `#7C3AED` for the current user (right-aligned, top-right corner radius 2) and light `#F5F4FC` for others (left-aligned, top-left corner radius 2). Max-width 75%.
- **Composer:** Pill-shaped text input + purple `Send` button. On submit, POSTs `{sender_name: 'Kishore K', message}` to `/api/teams/:id/messages`, then refreshes the list and clears the input. Empty messages are ignored.

---

## 10. Modals (TeamDetail)

All three modals share the same shell: backdrop blur `#1A1740` 45%, white card radius 20, soft purple shadow, padding 24/28, header with emoji + title + `×` close, click-outside-to-close, click-inside-to-keep-open.

- **Edit Team Info:** Name, Description (textarea 80px), Currently Going Project. Submits `PUT /api/teams/:id/edit` and refetches.
- **Create New Project:** Name, Description (60px), Timeline, Domain, Required Skills, Assign Members (read-only chips of current members).
- **Create New Task:** Title, Description (60px), Timeline / Due Date, Assign To Member (select populated from current members). Submits `POST /api/teams/:id/tasks` with `assignee_id`; the success path switches the active tab to `tasks`.

---

## 11. Data Model

- **Team** — `id`, `name`, `description`, `domain`, `current_project`, `color`, `leader_name`, `progress`, `max_members`.
- **Member** — `id`, `name`, `email`, `role`, `skills[]`, `joined`, `status`, `color`, `bg`, optional `isYou`.
- **Project** — `name`, `description`, `domain`/`type`, `skills`/`stack`, `timeline`, `progress`.
- **Task** — `title`, `description`, `timeline`, `assignee_id`, `status` (`todo` / `progress` / `review` / `done`).
- **Message** — `sender_name`, `message`, `sent_at`.
- **PendingInvite** — `id`, `name`, `email`, `role`, `skills[]`, `invited`.
- **Local state** — All team state lives in `TeamDetail` `useState` hooks; `localStorage.student_team_state` is the only cross-page persistence. Backend is the source of truth via REST (`/api/teams/:id`, `…/edit`, `…/projects`, `…/tasks`, `…/messages`).

---

## 12. Frontend / Style Notes

- **Typography:** Plus Jakarta Sans globally. Hero titles 20–22px / 800, body 11–13px, micro labels 8–10px.
- **Color tokens:** Primary purple `#7C3AED` / `#6D5CE0` (action buttons, active tab, focus rings), panel borders `#ECEBF6` / `#EEEDF8`, text primary `#1A1740`, secondary `#8B8BA8` / `#A0A0B8`, success green `#10B981` / `#22C55E` / `#1FA855`, warning orange `#F97316` / `#D97706`, danger red `#EF4444` / `#DC2626`, info indigo `#4F46E5` / `#6366F1`, accent pink `#DB2777` / `#E94F94`.
- **Per-team color palette:** Code Warriors `#7C5CFC`, Dev Titans `#2F6FED`, Byte Builders `#1E2A45`, Tech Masters `#F0653B`, InnovateX `#F5B400`, Algo Squad `#E94F94`. Each team tile's avatar uses its color with a soft drop shadow tinted at ~33% alpha.
- **Role color map (TeamMembers):** Leader `#7C3AED / #F0EBFF`, Co-Lead `#4338CA / #EEF2FF`, Developer `#059669 / #ECFDF5`, Designer `#DC2626 / #FEF2F2`, Researcher `#D97706 / #FFF7ED`.
- **Shapes:** Pills everywhere (radius 99 for chips, 6–14 for cards). Dashed borders on empty kanban columns.
- **Shadows:** Color-tinted soft shadows on primary buttons and avatars; flat 1-px borders on cards.
- **Icons:** Inline SVGs only. Two main motifs: people (members), gear/cog (settings), bell (notifications), check-seal (verified).
- **Layout patterns:** Two-column with right sidebar (260–300px) for filters/quick actions. Tab navigation uses a single 1.5px bottom border with 3px purple underline for the active tab.
- **Tables:** Striped header (`#FAF9FF`), 1px `#F2F1F9` row dividers, 12–14px vertical padding.

## 13. Standalone TeamMembers Page (`TeamMembers.tsx`)

A separate, dedicated member-management view at `/teams/:teamId/members` (linked from the TeamDetail members tab). Differences from the in-team members tab:
- Top heading `Team Members` 22px with subtitle `Manage your team members, roles, and permissions.` Plus a `← Back to Team` link.
- Four stat cards with inline SVG icons (people SVG in 4 color tints: purple, green, orange, purple).
- The same three tab filters (All / Pending / Removed) plus a `Member Roles Guide` button on the right.
- A richer search row — `Search by name, skills, or email...` plus three filter chips (`Role`, `Skills`, `Status`).
- A wider table with columns: Member, Role, Skills, **XP** (right-aligned, purple), **Contributions** (right-aligned), Joined, and a kebab/3-dot action menu (or Accept/Decline for Pending).
- Skills show the first 2 chips and a `+N` overflow chip.
- **Right sidebar (300px):**
  1. **Invite Member card** — Email/username input, Role select (using the same `ROLE_COLOR` map), purple `Send Invite` button.
  2. **Top Contributors** — top 4 members ranked by contributions, with a gold/silver/bronze/gray rank prefix (#1 gold), gradient avatar, name, commit count, and XP shown in `k XP` format.
  3. **Role Distribution** — vertical list of all 5 roles, each row showing a colored dot, name, and member count.

## 14. Interactions Recap

- Search/filter teams by name or domain.
- Click a team card → navigate to its detail page.
- Create Team modal → POST to backend → set localStorage → redirect to new team.
- Edit team info, create project, create task — all submit to backend and refetch.
- Members tab: switch All/Pending/Removed, accept/decline invites, send new invites by email.
- Tasks tab: 4-column kanban grouped by status.
- Progress tab: 10-week velocity bar chart.
- Activity tab: log of recent member actions.
- Chat tab: send messages, see bubbles styled by sender.
- Standalone `TeamMembers` page: same list, with XP/Contribution columns and a richer right rail.
