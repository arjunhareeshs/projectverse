# ProjectVerse — Frontend UI Redesign & Motion Architecture Brief

**For:** Antigravity (implementing agent)  
**Repo root:** `projectverse/`  
**Stack:** React 18/19 + TypeScript + Vite + Tailwind CSS + Framer Motion + React Router v6 + Redux Toolkit + lucide-react  
**Scope:** Frontend only (`client/`). Do not touch `server/`, `database/`, Prisma, or any API contract.  

---

## 0. Non-Negotiable Rules

1. **Do not change behaviour, data, or API calls.** Every `lifecycleService.*`, `teamService.*`, `projectService.*` call must keep the exact same arguments, same call sites, same order, and same side effects. This is a visual, layout, and interaction refactor.
2. **Do not invent content.** Do not add new stats, cards, charts, or copy that isn't already rendered. Where this brief says "delete", delete. Where it says "move", move the existing node.
3. **Do not fix backend/data bugs in this pass.** Hardcoded fake values are catalogued in §9 — leave them rendering as-is unless this brief explicitly says to delete the element.
4. **TypeScript must stay strictly clean.** After *every* phase run `cd client && npx tsc --noEmit -p tsconfig.app.json` and it must exit 0. Do not proceed to the next phase while it is red.
5. **No new unapproved dependencies.** Leverage the existing stack (`lucide-react`, `tailwindcss`, `framer-motion`, `clsx`, `tailwind-merge`, `class-variance-authority`). Do not install new icon sets or bulky UI libraries.
6. **Zero Layout Thrashing & Zero CLS (Cumulative Layout Shift = 0).** Content must never jump or reflow during interactions (e.g. sidebar expansions must overlay, never resize the main layout container).
7. **60–120 FPS Guaranteed Zero-Lag Motion.** All animations and interactive transitions must be composite-only (`transform` and `opacity`). Never animate `left`, `top`, `width`, `height`, `margin`, or `padding` on elements in the document flow during continuous interactions.
8. **Preserve all React fundamentals.** Keep all `key` props, all `useEffect` dependency arrays, and all conditional-render guards intact. When moving JSX between files, preserve logic verbatim.
9. **Execute in strict ordered phases (§2 → §3 → §4).** Each phase must be independently testable, shippable, and verified before moving forward.

---

## 1. Verified Repo Facts

### Routing
`client/src/App.tsx` — single `<BrowserRouter>`, all routes inline.

| Route | Component |
|---|---|
| `/projects` | `pages/AllProjects.tsx` — sidebar's **"My Projects"** |
| `/projects/:id` | `pages/ProjectDetailPage.tsx` — **the workspace sub-page being redesigned** |
| `/projects/:id/execution-doc` | `pages/ProjectExecutionTemplatePage.tsx` |
| `/execution-doc/:id` | `pages/ProjectExecutionTemplatePage.tsx` (duplicate route, same component) |

### The Project Workspace Tree

```
ProjectDetailPage.tsx  (240 lines)
├─ header row:  <h1>{title}</h1> + [Switch Project v] [All Projects] [Withdraw Project]
├─ tab pill bar: Daily Log | Team & Features Allocation | Phase Execution Plan & Reviews
├─ tab === 'log'            -> ProjectWorkspace/DailyLogTab.tsx            (~480 lines)
├─ tab === 'team-features'  -> components/projects/ProjectExecutionTemplate.tsx  initialTab="team-features"
├─ tab === 'execution-plan' -> components/projects/ProjectExecutionTemplate.tsx  initialTab="execution-plan"
├─ ProjectReviewerPanel     (only when user.role is REVIEWER or ADMIN)
├─ IntakeWizard             (modal)
└─ WithdrawProjectModal     (modal)
```

`ProjectExecutionTemplate.tsx` is **1,967 lines** and acts as its own two-tab page, remote-controlled from outside via `initialTab` / `hideHeader` / `hideTabs`. Key line numbers:

| Lines | Block |
|---|---|
| 53 | `DEFAULT_MEMBERS` seed array |
| 648–696 | full header bar (rendered when `hideHeader` is false) |
| 697–721 | **compact bar** — `Export PDF` + `Save Changes` (rendered when `hideHeader` is true) |
| 724–753 | internal 2-tab nav (hidden when `hideTabs`) |
| 755–776 | notification toast |
| 778–853 | **duplicated project header card** + amber "Total Project Reward" card — renders on **both** tabs |
| 855–1151 | Tab 1 body: Features table (left) + Team & share allocation table (right) |
| 1152–1411 | Tab 2 body: phase summary card + phase review cards |
| 1412–1460 | Submit-phase modal |
| 1462–1791 | Tab 1 continued: Summary of Allocations + nested 6-tab Execution Document editor + "How Reward Points Work" |
| 1793–1818 | **bottom action bar** — `Back`, `Save as Draft`, `Proceed to Execution Plan` — renders on **both** tabs |
| 1820–1886 | Add-feature modal |
| 1887–1953 | Search/add-member-by-regno modal |
| 1954+ | Withdraw modal |

### Layout Shell

- `layout/MainLayout.tsx` — renders `<Sidebar/>`, `<Navbar/>`, content wrapper with **hardcoded `style={{ paddingLeft: 256 }}`**.
- `layout/Sidebar.tsx` (341 lines) — `<aside className="fixed left-0 top-0 z-40 h-screen ...">` with **hardcoded `style={{ width: 256 }}`**.
  - **Critical:** the file already contains a complete collapsed/icon-rail rendering path behind a local `const mini = false;` (line 46). `mini` is a **dead constant** — never set, never toggled. All the `mini ? ... : ...` branches are already written and correct.
- `layout/Navbar.tsx` — `<header className="fixed top-0 z-30 ...">` with **hardcoded `style={{ left: 256, right: 0 }}`**.

### Theming & Styling Baseline

- `client/src/styles/tokens.css` — CSS custom properties as raw HSL triplets (`--primary: 221 83% 53%`).
- `client/tailwind.config.ts` — maps tokens: `primary: 'hsl(var(--primary))'`, `background`, `foreground`, `card`, `muted`, `border`, `secondary`, `success`, `warning`, `danger`, `info`.
- **Legacy Issue:** 1,500+ hardcoded Tailwind color classes (`bg-indigo-600`, `text-emerald-700`, `border-rose-200`, `bg-amber-50`, `text-slate-500`) and 200+ raw hexes (`bg-[#4F46E5]`, `text-[#0F172A]`) must be migrated to semantic tokens to unlock unified theming and sleek contrast.

---

## 2. PHASE 1 — Design Tokens, Alpine Palette & Motion Physics

### 2.1 Target Alpine Palette & Semantic Colors

Combines the modern Alpine palette with near-black `#2B2C34` on crisp white `#FFFFFE` for exceptional legibility and luxury-tier aesthetic.

| Role | Hex | HSL Triplet | Usage |
|---|---|---|---|
| Brand / Primary | `#0B3EC8` | `224 89% 41%` | Primary buttons, active indicators, brand badges |
| Primary Hover / Pressed | `#0A32A3` | `224 89% 33%` | Hover & active states on primary controls |
| Primary Light / Glow | `#3D6BEB` | `224 83% 58%` | Focus rings, subtle glows, active outlines |
| Accent (Coral) | `#F8577F` | `345 92% 66%` | Special highlights, destructive badges, alerts |
| Accent Soft (Pale Pink) | `#FBD0DA` | `346 84% 90%` | Accent background tints |
| Surface Subtle (Pale Blue) | `#E6EDF5` | `212 43% 93%` | Table hover fills, secondary button backgrounds |
| Border / Steel | `#C5D2E0` | `211 30% 83%` | Hairline card & container borders |
| Text — Headline & Body | `#2B2C34` | `233 9% 19%` | Primary headings, titles, high-contrast body copy |
| Text — Muted | `#6B6C78` | `235 6% 45%` | Subtitles, helper text, inactive tabs, timestamps |
| Background / Ground | `#F7F9FC` | `216 33% 98%` | Page ground canvas |
| Card / Container | `#FFFFFE` | `0 0% 100%` | Elevated card surfaces |
| Success | `#0E9F6E` | `160 84% 34%` | Verified checkpoints, approved status, positive metrics |
| Warning | `#B45309` | `26 90% 37%` | Pending review checkpoints, alert states |
| Danger | `#F8577F` | `345 92% 66%` | Destructive actions (Withdraw), error banners |

---

### 2.2 Motion Tokens & Physics Curves (Zero-Lag Specification)

Transitions must feel instant yet organic—avoid sluggish 500ms easing or linear robotic movements. Use custom cubic-bezier spring curves.

```css
/* Motion Timing Tokens */
--ease-spring-snappy: cubic-bezier(0.16, 1, 0.3, 1);  /* Fast out, gentle settle for hover/modals */
--ease-in-out-smooth: cubic-bezier(0.4, 0, 0.2, 1);    /* Standard transition curve */
--duration-fast: 150ms;                                 /* Micro-interactions (clicks, chips, hovers) */
--duration-normal: 250ms;                               /* Sidebar expand, drawer, tab slider */
--duration-smooth: 350ms;                               /* Modals, overlay backdrops */
```

---

### 2.3 Rewrite `client/src/styles/tokens.css`

Replace `client/src/styles/tokens.css` with the complete token set:

```css
/* ─── Light Mode ─────────────────────────────────────────────────────────────── */
:root {
  /* Brand Colors (Alpine Swatch) */
  --primary:            224 89% 41%;   /* #0B3EC8 */
  --primary-hover:      224 89% 33%;   /* #0A32A3 */
  --primary-light:      224 83% 58%;   /* #3D6BEB */
  --primary-foreground: 0 0% 100%;

  --secondary:          212 43% 93%;   /* #E6EDF5 */
  --secondary-foreground: 233 9% 19%;

  --accent:             345 92% 66%;   /* #F8577F */
  --accent-foreground:  0 0% 100%;
  --accent-soft:        346 84% 90%;   /* #FBD0DA */

  --surface-subtle:     212 43% 93%;   /* #E6EDF5 */

  /* Backgrounds & Canvas */
  --background:         216 33% 98%;   /* #F7F9FC */
  --foreground:         233 9% 19%;    /* #2B2C34 */

  /* Card */
  --card:               0 0% 100%;     /* #FFFFFE */
  --card-foreground:    233 9% 19%;

  /* Border */
  --border:             211 30% 83%;   /* #C5D2E0 */

  /* Muted Text / Accents */
  --muted:              216 20% 94%;
  --muted-foreground:   235 6% 45%;    /* #6B6C78 */

  /* Semantics */
  --success:            160 84% 34%;   /* #0E9F6E */
  --warning:            26 90% 37%;    /* #B45309 */
  --danger:             345 92% 66%;   /* #F8577F */
  --info:               224 89% 41%;

  /* Border radius */
  --radius-card:  14px;
  --radius-btn:   10px;
  --radius-input: 10px;
  --radius-tag:   999px;

  /* Shadows (Multi-layer ambient elevation) */
  --shadow-sm: 0 1px 2px 0 rgba(16, 24, 40, 0.05);
  --shadow-card: 0 4px 20px -2px rgba(16, 24, 40, 0.04), 0 2px 6px -1px rgba(16, 24, 40, 0.02);
  --shadow-hover: 0 12px 32px -4px rgba(16, 24, 40, 0.08), 0 4px 12px -2px rgba(16, 24, 40, 0.03);
  --shadow-floating: 0 20px 48px -6px rgba(16, 24, 40, 0.12), 0 8px 16px -4px rgba(16, 24, 40, 0.04);
}

/* ─── Dark Mode Safe Fallback ────────────────────────────────────────────────── */
.dark {
  --primary:            224 89% 62%;
  --primary-hover:      224 89% 52%;
  --primary-light:      224 83% 70%;
  --primary-foreground: 0 0% 100%;

  --secondary:          233 9% 22%;
  --secondary-foreground: 212 43% 93%;

  --accent:             345 92% 66%;
  --accent-foreground:  0 0% 100%;
  --accent-soft:        345 50% 25%;

  --surface-subtle:     233 9% 20%;

  --background:         233 9% 12%;
  --foreground:         212 43% 93%;

  --card:               233 9% 16%;
  --card-foreground:    212 43% 93%;

  --border:             233 9% 26%;

  --muted:              233 9% 20%;
  --muted-foreground:   216 15% 68%;

  --success:            160 84% 42%;
  --warning:            26 90% 48%;
  --danger:             345 92% 66%;
  --info:               224 89% 62%;
}
```

---

### 2.4 Update `client/tailwind.config.ts`

Ensure `tailwind.config.ts` extends the full semantic token set and motion utilities:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      borderRadius: {
        card: 'var(--radius-card)',
        btn: 'var(--radius-btn)',
        input: 'var(--radius-input)',
        tag: 'var(--radius-tag)',
      },
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          light: 'hsl(var(--primary-light))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          soft: 'hsl(var(--accent-soft))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        'surface-subtle': 'hsl(var(--surface-subtle))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
        info: 'hsl(var(--info))',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        card: 'var(--shadow-card)',
        hover: 'var(--shadow-hover)',
        floating: 'var(--shadow-floating)',
      },
      transitionTimingFunction: {
        'spring-snappy': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

---

### 2.5 Hardware-Accelerated Interactive Utilities (`client/src/styles/globals.css`)

Add these GPU-optimized micro-interaction rules to `client/src/styles/globals.css`:

```css
@layer utilities {
  /* GPU Layer Promotion for zero-jank micro-interactions */
  .gpu-layer {
    transform: translateZ(0);
    backface-visibility: hidden;
    perspective: 1000px;
  }

  /* Tactile button & clickable element tap physics */
  .interactive-tap {
    transition: transform 120ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 120ms ease;
  }
  .interactive-tap:active {
    transform: scale(0.975);
  }

  /* Smooth lift for cards and elevated rows */
  .hover-lift {
    transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease, border-color 200ms ease;
  }
  .hover-lift:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-hover);
    border-color: hsl(var(--primary) / 0.35);
  }

  /* Glassmorphism panel with crisp hairline border */
  .glass-panel {
    background: hsl(var(--card) / 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid hsl(var(--border) / 0.8);
  }

  /* Zero-lag skeleton shimmer sweep */
  @keyframes shimmer-sweep {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .skeleton-shimmer {
    position: relative;
    overflow: hidden;
    background: hsl(var(--muted));
  }
  .skeleton-shimmer::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    animation: shimmer-sweep 1.6s infinite cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* Reduced Motion Override for Accessibility */
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .hover-lift:hover { transform: none !important; }
  .interactive-tap:active { transform: none !important; }
  .skeleton-shimmer::after { animation: none !important; }
}
```

---

### 2.6 Mechanical Token Migration Map

Perform a clean file-by-file replacement of all legacy color classes:

| Legacy Class Pattern | Semantic Replacement |
|---|---|
| `indigo-500/600/700`, `violet-*`, `purple-*`, `[#4F46E5]`, `[#7C3AED]`, `[#6D28D9]`, `[#A78BFA]` (fills/text) | `primary` |
| `indigo-50`, `[#EEF2FF]`, `[#F3E8FF]`, `[#EEEDF8]`, `[#F0EFFC]` (tint backgrounds) | `primary/10` |
| `indigo-100`, `indigo-200` (tint borders) | `primary/20` |
| `slate-900`, `gray-900`, `[#0F172A]`, `[#1A1740]` | `foreground` |
| `gray-500`, `gray-400`, `slate-500`, `[#64748B]`, `[#A0A0B8]`, `[#B0B0C4]` | `muted-foreground` |
| `gray-200`, `gray-100`, `slate-200`, general borders | `border` |
| `bg-white`, `[#FCFCFF]`, `[#F8F8FF]`, `[#FAFAFF]` | `card` |
| `bg-gray-50`, `[#FAFAFC]`, `[#F7F8FA]` | `background` |
| `emerald-*`, `green-*` | `success` (and `success/10`, `success/20`) |
| `amber-*`, `yellow-*`, `orange-*` | `warning` (and `warning/10`, `warning/20`) |
| `rose-*`, `red-*` | `danger` (and `danger/10`, `danger/20`) |
| `[#FFE4E6]`, `[#F43F5E]` | `accent-soft` / `accent` |

**Migration Priority Order:**
1. `pages/ProjectDetailPage.tsx`
2. `pages/ProjectWorkspace/DailyLogTab.tsx`
3. `components/projects/ProjectExecutionTemplate.tsx`
4. `pages/AllProjects.tsx`
5. `layout/Sidebar.tsx`, `layout/Navbar.tsx`, `layout/MainLayout.tsx`

---

## 3. PHASE 2 — High-Performance Hover-Expand Sidebar

### 3.1 Architecture (Zero Reflow Guarantee)

The sidebar starts as a permanent, slim **icon rail (72px)**. On pointer hover or focus, it smoothly expands into an overlay drawer (256px) displaying labels and section dividers.

**Critical Zero-Reflow Rule:** The main content wrapper and top navbar remain permanently anchored at `72px`. The expanded sidebar floats above the content with `position: fixed`, `z-50`, and a soft multi-layer ambient shadow (`shadow-floating`). **The page content must NEVER shift or reflow on hover.**

```
Collapsed Rail (72px)                 Hovered Overlay (256px, Floating z-50)
+----+                               +------------------+
| [=]|  Content Canvas               | [=] ProjectVerse |  Content Canvas (Unshifted)
| () |  (padding-left: 72px static)  | ()  Dashboard    |  (padding-left: 72px static)
| [] |                               | []  My Projects  |
+----+                               +------------------+
 72px                                 256px (Floating, shadow-floating)
```

---

### 3.2 Implementation Details — `layout/Sidebar.tsx`

1. Replace the inert `const mini = false;` (line 46) with:
   ```tsx
   const [hovered, setHovered] = useState(false);
   const mini = !hovered;
   ```
2. Attach pointer events to the `<aside>` container:
   ```tsx
   onMouseEnter={() => setHovered(true)}
   onMouseLeave={() => setHovered(false)}
   onFocusCapture={() => setHovered(true)}
   onBlurCapture={(e) => {
     if (!e.currentTarget.contains(e.relatedTarget as Node)) {
       setHovered(false);
     }
   }}
   ```
3. Set the width styling to:
   ```tsx
   style={{ width: hovered ? 256 : 72 }}
   className={clsx(
     "fixed left-0 top-0 z-50 h-screen overflow-hidden bg-card border-r border-border",
     "transition-[width,box-shadow] duration-250 ease-spring-snappy gpu-layer",
     hovered ? "shadow-floating" : "shadow-none"
   )}
   ```
4. **Nav Item Tactile Hover & Active Indicator:**
   - Active route: `bg-primary/10 text-primary font-medium border-l-2 border-primary` with a gentle fade-in transition.
   - Hovered item: `hover:bg-surface-subtle hover:text-foreground text-muted-foreground transition-colors duration-150`.
   - In collapsed state (`mini === true`), icons are centered with `justify-center` and retain tooltips via `title={item.label}` and the active notification indicator badge (`-right-1.5 -top-1.5`).

---

### 3.3 Static Alignment — `layout/MainLayout.tsx` & `layout/Navbar.tsx`

- `MainLayout.tsx`: Lock content container permanently to `style={{ paddingLeft: 72 }}`. Never bind this to sidebar hover.
- `Navbar.tsx`: Lock navbar header permanently to `style={{ left: 72, right: 0 }}`. Never bind this to sidebar hover.

---

### 3.4 Text & Chrome Cleanup

- **`Sidebar.tsx` line 183:** Delete `{user?.organizationId ? 'Consulting Group' : 'Personal Workspace'}` and the adjacent decorative `<ChevronDown>` (line 185). Logo area renders only the app icon + "ProjectVerse" text.
- **`Navbar.tsx` line 72:** Delete the hardcoded string `· 3 approvals waiting on you`. Render `{dateStr}` cleanly.

---

## 4. PHASE 3 — Project Workspace Redesign (`/projects/:id`)

### 4.1 Diagnosis of Existing Architectural Issues

1. **Title Duplication:** `ProjectDetailPage` renders `<h1>{logState.title}</h1>`, then `ProjectExecutionTemplate` renders *another* project-name input box directly underneath.
2. **Scattered Save Buttons:** Save controls exist in 3 distinct places (`Export PDF` + `Save Changes` at top, and `Save as Draft` + `Proceed to Execution Plan` at bottom).
3. **Repeated Header & Reward Cards:** Duplicated header banner + amber points card render identically across both tabs (lines 778–853).
4. **3-Level Tab Clutter:** Page level tabs → Template internal tabs → Nested 6-tab document editor.
5. **Full Remount Flashing:** Switching between Tab 2 and Tab 3 destroys and remounts `ProjectExecutionTemplate` (1,967 lines), refetching all network endpoints on every tab click.
6. **Missing Visual States:** Loading flag is never rendered into a skeleton, and API failure leads to an unhandled broken screen.

---

### 4.2 Target 3-Row Layout Architecture

```
+-----------------------------------------------------------------------------------+
| <  EcoTrack Waste Platform  [In Progress]          [Switch v]  [Save Changes] [...] |  <- Row 1: Sticky 56px glassmorphism header
+-----------------------------------------------------------------------------------+
| AI/ML · Computer Vision · Proposed 12 Aug 2025               Reward: 1,240 / 2,000 |  <- Row 2: Meta Strip (36px)
|                                                              [============------] |
+-----------------------------------------------------------------------------------+
|  [Daily Log]      [Team & Features Allocation]      [Phase Execution Plan]        |  <- Row 3: Underline Navigation Tabs
+-----------------------------------------------------------------------------------+
|                                                                                   |
|   Tab Body Content Canvas (Mounted Once · Smooth Tab Cross-Fade Transitions)     |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

#### Row 1 — Single Consolidated Action Header (Sticky `top-16 z-20 glass-panel`)
- **Left:** Back button to `/projects` (`interactive-tap p-2 rounded-btn hover:bg-surface-subtle`), inline-editable project title with subtle hover edit indicator, and dynamic status badge.
- **Right:**
  - `[Switch Project v]` switcher dropdown.
  - **Smart Dirty-State Save Button:** Shows muted `All changes saved` with a checkmark icon when clean; morphs into a glowing, high-contrast `Save Changes` button (`bg-primary text-primary-foreground shadow-sm interactive-tap`) when changes are pending.
  - `[...]` Overflow Action Menu (Radix/custom dropdown with slide & fade entrance):
    1. `All Projects`
    2. `Export PDF`
    3. `Open Execution Doc`
    4. *Divider line (`border-border`)*
    5. `Withdraw Project` (styled with `text-danger hover:bg-danger/10`).

#### Row 2 — Compact Meta Strip (36px)
- **Left:** Domain, subdomain, and proposed date rendered as crisp, bullet-separated metadata (`text-xs text-muted-foreground font-medium`).
- **Right:** Total reward counter (`tabular-nums font-semibold text-foreground`) accompanied by a sleek 3px micro progress bar with animated fill width (`transition-[width] duration-500 ease-spring-snappy`).

#### Row 3 — Underline Tab Navigation
- Clean horizontal underline tab set with 2px active indicator bar (using Framer Motion `layoutId="activeWorkspaceTab"` or CSS hardware-accelerated slider).
- Shortened, punchy labels: `Daily Log` · `Team & Features` · `Execution Plan`.
- URL sync via `?tab=` remains fully intact.

---

### 4.3 Workspace File Split Architecture

Decompose the monolithic `ProjectExecutionTemplate.tsx` into modular, single-responsibility components:

```
components/projects/workspace/
├── WorkspaceHeader.tsx        # Sticky header (Row 1) + Meta strip (Row 2)
├── WorkspaceTabs.tsx          # Underline navigation tabs (Row 3)
├── TeamFeaturesTab.tsx        # Features table (left) + Team & shares (right) + Allocation summary
├── ExecutionPlanTab.tsx       # Phase timeline + review cards
├── ExecutionDocEditor.tsx     # 6-tab document editor (Overview/Objectives/Tech/Milestones/Risks/Resources)
├── useProjectWorkspace.ts     # Hoisted workspace data hook (fetches once, shares state)
└── modals/
    ├── AddFeatureModal.tsx    # Modal dialog with spring entrance & backdrop blur
    ├── AddMemberModal.tsx     # Student search & allocation modal
    └── SubmitPhaseModal.tsx   # Evidence submission modal
```

#### Shared State Hoisting (`useProjectWorkspace.ts`)
Hoist `features`, `teamMembers`, `phases`, `doc`, `isDirty`, `saveDoc`, and loading states into `useProjectWorkspace(projectId)`.

#### Mount Once, Zero Flash Rendering
In `ProjectDetailPage.tsx`:
```tsx
const ws = useProjectWorkspace(projectId);

// Renders the workspace chrome once:
<WorkspaceHeader ws={ws} />
<WorkspaceTabs activeTab={activeTab} onChangeTab={setTab} />

<main className="mt-6">
  {activeTab === 'log' && <DailyLogTab projectId={projectId} />}
  {activeTab === 'team-features' && <TeamFeaturesTab ws={ws} />}
  {activeTab === 'execution-plan' && <ExecutionPlanTab ws={ws} />}
</main>
```
*Switching tabs no longer refetches endpoints or flashes white screens.*

---

### 4.4 Chrome & Text Deletions Table

| Element to Delete | Original Location | Rationale |
|---|---|---|
| Duplicated project header card + amber reward gradient card | `ProjectExecutionTemplate.tsx:778–853` | Replaced by Row 2 Meta Strip |
| Bottom action bar (`Back`, `Save as Draft`, `Proceed to Execution Plan`) | `ProjectExecutionTemplate.tsx:1793–1818` | Redundant save triggers; proceed button invalid on tab 3 |
| Compact top bar (`Export PDF`, `Save Changes`) | `ProjectExecutionTemplate.tsx:697–721` | Hoisted into Row 1 Header & `...` menu |
| Internal 2-tab pill nav | `ProjectExecutionTemplate.tsx:724–753` | Replaced by Row 3 Underline Tabs |
| Full header banner (when `hideHeader === false`) | `ProjectExecutionTemplate.tsx:648–696` | Redundant title and container chrome |
| `"Consulting Group"` / `"Personal Workspace"` text & chevron | `Sidebar.tsx:183–185` | Unwanted decorative element |
| `"· 3 approvals waiting on you"` | `Navbar.tsx:72` | Hardcoded literal |
| `"Last updated: Just now"` | `ProjectExecutionTemplate.tsx:1531` | Hardcoded mock string |
| Hardcoded description sentence | `ProjectExecutionTemplate.tsx:797` | Demo text leaking across all projects |
| `"Smart Waste Management System"` fallback | `ProjectExecutionTemplate.tsx:791` | Demo placeholder; use `placeholder="Untitled project"` |
| Hardcoded `Proposed` status chip | `ProjectExecutionTemplate.tsx:803` | Read actual status from `logState` |

---

### 4.5 Required Interactive States (Loading, Error, Empty)

1. **Skeleton Shimmer Loading State:**
   - In `ProjectDetailPage.tsx` and `DailyLogTab.tsx`: Render `.skeleton-shimmer` placeholders for the header, meta strip, and 4 metric cards during cold load instead of rendering zeroes or an unstyled blank canvas.
2. **Error State with Retry:**
   - On network fetch failure, render a centered card: *"Unable to load project workspace"* with a distinct, tactile `Retry` button calling the reload handler.
3. **Invalid ID Guard:**
   - Replace `const projectId = id || '1'` with a strict route validation check. If `!id`, display the error state.

---

## 5. Motion, Interactive Transitions & Physics Specification

To deliver an ultra-responsive, state-of-the-art SaaS feel without UI lag, adhere to these interaction standards:

### 5.1 Tactile Buttons & Interactive Controls
- **Hover:** Fast 150ms brightness and border highlight (`hover:border-primary/40`).
- **Tap / Active:** Subtle physical press feedback via `.interactive-tap` (`transform: scale(0.975)`).
- **Focus Rings:** Accessible, non-distracting 2px rings (`focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2`).

### 5.2 Hover-Lift Cards & Data Rows
- Feature and Review checkpoint cards use `.hover-lift` (`hover:-translate-y-0.5 hover:shadow-hover`).
- Table rows: Soft background transition on pointer hover (`hover:bg-surface-subtle transition-colors duration-150`).

### 5.3 Modals & Dialog Entrances
- **Backdrop:** Smooth fade-in with lightweight backdrop blur (`backdrop-blur-sm bg-foreground/20 transition-opacity duration-250`).
- **Dialog Container:** Snappy scale and opacity transition (`initial: { opacity: 0, scale: 0.96 }`, `animate: { opacity: 1, scale: 1 }` with `transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] }`).

### 5.4 Dropdown Menus & Popovers
- Render with origin anchoring: scale from `0.95 -> 1.0` and opacity `0 -> 1` over `150ms`.

### 5.5 Collapsible Details ("How Reward Points Work")
- Turn verbose explanatory cards into an interactive, accordion-style `<details>` disclosure component with a rotating chevron indicator (`transition-transform duration-200`).

---

## 6. Premium Visual Language & Aesthetics Guide

- **Typography:** Set `Inter` as base sans-serif. Drop all `font-extrabold` classes across labels and headings. Headings use `font-semibold text-foreground tracking-tight`. Body text uses `text-sm text-foreground/90`. Metadata uses `text-xs text-muted-foreground font-medium`.
- **Numbers & Metrics:** Use `tabular-nums` on all point values, streak counters, timestamps, and percentages to eliminate visual jitter.
- **Hairline Borders:** Use thin, clean borders (`border border-border`) with subtle card rounding (`rounded-card`).
- **Spacing Rhythm:** Maintain a clean 24px (`gap-6`, `p-6`) layout cadence between major layout cards, with 16px (`gap-4`) spacing within card sections.
- **Color Contrast:** All body text on `bg-card` and `bg-background` strictly exceeds WCAG AA contrast (4.5:1 ratio). Primary button text uses `text-primary-foreground`.

---

## 7. Zero-Lag Performance & GPU Optimization Architecture

To ensure 60–120 FPS performance on all devices:

1. **Composite-Only Animations:** Only animate `transform` and `opacity`. Never trigger Layout (Reflow) or Paint loops inside animation frames.
2. **GPU Layer Isolation:** Critical animated elements (e.g. sidebar overlay, modal drawers, tooltip tags) use `.gpu-layer` (`transform: translateZ(0)`).
3. **No Layout Shifts:** Overlaying elements must use `position: fixed` or `position: absolute` with explicit container bounds.
4. **Restrained Blur Filters:** Apply `backdrop-filter: blur()` only on fixed headers, navigation strips, and modal backdrops. Never nest heavy blur filters inside continuously scrolling list items.
5. **Optimized React Renders:**
   - Memoize tab views (`React.memo`) where appropriate.
   - Use `useCallback` for event handlers passed down to feature/phase lists to avoid cascading re-renders.
   - Zero duplicate network requests when navigating between sub-tabs.

---

## 8. Verification & Performance Profiling Protocol

### Automated Verification

Execute and verify all of the following commands:

```bash
# 1. TypeScript compilation (MUST exit 0 after every phase)
cd client && npx tsc --noEmit -p tsconfig.app.json

# 2. Production Vite build (MUST succeed with zero bundling errors)
cd client && npm run build

# 3. ESLint check (No new errors vs baseline)
cd client && npx eslint src --ext .ts,.tsx
```

---

### Interactive & Visual Checklist

- [ ] `/projects` renders cleanly; clicking a project row opens `/projects/:id`.
- [ ] Sidebar starts collapsed at 72px rail; expands smoothly on hover/focus to 256px overlay.
- [ ] **Content does not shift or jump during sidebar expansion** (CLS = 0).
- [ ] Notification badge is clearly visible in the collapsed 72px sidebar rail.
- [ ] `"Consulting Group"` and hardcoded `"· 3 approvals waiting on you"` are completely removed.
- [ ] Project workspace renders exactly **one** consolidated title and header row.
- [ ] Project title can be edited inline, showing hover edit affordance.
- [ ] Meta strip renders domain, subdomain, date, and animated reward progress bar accurately.
- [ ] Save button appears as muted `All changes saved` when clean, morphing into high-contrast `Save Changes` when dirty.
- [ ] Overflow menu (`...`) contains `All Projects`, `Export PDF`, `Open Execution Doc`, and `Withdraw Project` (in red).
- [ ] Switching between `Daily Log`, `Team & Features`, and `Execution Plan` occurs smoothly without network re-fetching or white flashing.
- [ ] Add Feature, Add Member, and Submit Phase modals open with smooth spring backdrop animation, submit properly, and close cleanly.
- [ ] Loading skeleton shimmer renders cleanly during cold fetch.
- [ ] Error state with working `Retry` button displays if the API request fails.
- [ ] No raw hex color classes remain in the redesigned priority files.
- [ ] Reviewer/Admin `ProjectReviewerPanel` continues to render for authorized roles only.
- [ ] `/projects/:id/execution-doc` and `/execution-doc/:id` render properly through the wrapper component.

---

## 9. Known Fake Data Reference (Preserve As-Is)

Catalogued so these mock fields are not accidentally modified or over-engineered:

| Value | File Location |
|---|---|
| `Current Streak — 7 Days` | `DailyLogTab.tsx:222` |
| `Log Consistency — 92% / Excellent` | `DailyLogTab.tsx:232` |
| `Total Points Earned = logs.length * 20 + 120` | `DailyLogTab.tsx:163` |
| `Points Available +20 pts` | `DailyLogTab.tsx:196` |
| `/ 2,000` Reward Denominator | `ProjectExecutionTemplate.tsx:846` |
| `DEFAULT_MEMBERS` seed array (500 pts lead) | `ProjectExecutionTemplate.tsx:53` |

---

## 10. Out of Scope Boundaries

- Backend code (`server/`), database schemas, Prisma migrations, and REST/WebSocket API endpoints.
- Orphaned non-mounted components: `pages/ProjectWorkspace/ChatTab.tsx`, `DocumentTab.tsx`, `EvaluationsTab.tsx`, `EvaluationReportView.tsx`, `MentorPanel.tsx`, `components/projects/AiEvaluationPanel.tsx`.
- Adding backend log history persistence or live streak calculation algorithms.

---

## 11. Deliverable Report

Upon completion, provide a concise summary containing:
1. List of files added, modified, and deleted.
2. Verified phase execution order.
3. Actual terminal output of `tsc`, `build`, and `eslint`.
4. Full completed interactive checklist results.
5. Notes on any edge cases discovered during implementation.
