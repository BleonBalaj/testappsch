# LumiSchool Design System & UI Architecture Manual

> **Purpose**: This document serves as the absolute single source of truth for all UI design patterns, styling standards, layout rules, color systems, modal architectures, form controls, and component interactions in **LumiSchool**. Follow these exact specifications to guarantee visual consistency and prevent UI bugs across all pages, modals, drawers, and interactive components.

---

## 1. Color System & Theme Tokens

The app supports **System** (first-visit default), **Dark**, **Light**, and the independent **Nature** theme. Light uses `[data-theme='light']`; Nature uses `html.theme-nature` plus season/phase attributes. CSS variables use HSL components (`H S% L%`). See section 12 before changing theme behavior.

### 1.1 Palette Matrix

| Token | Dark Theme HSL | Light Theme HSL | Usage |
| :--- | :--- | :--- | :--- |
| `--background` | `270 35% 13.5%` | `270 30% 93%` | Page viewport background & recessed input surfaces |
| `--card` | `270 38% 10.5%` | `0 0% 100%` | Primary container, card & modal box surface |
| `--card-foreground` | `0 0% 98%` | `270 35% 20%` | Card body typography |
| `--primary` | `335 70% 70%` (Pink-Magenta) | `270 35% 42%` (Deep Plum) | Brand color, main CTAs, active highlights |
| `--primary-foreground` | `270 45% 10%` | `0 0% 100%` | Text on top of primary fills |
| `--accent` | `320 55% 78%` (Soft Rose) | `270 35% 42%` | Badges, gradient accents, secondary highlights |
| `--secondary` | `270 25% 20%` | `270 20% 90%` | Subdued pill buttons, neutral tags |
| `--muted-foreground` | `270 15% 65%` | `270 15% 45%` | Subtitles, field labels, timestamps, placeholders |
| `--border` | `270 35% 19%` | `transparent` (Invisible on main cards in Light) | Standard card, input, and separator borders |
| `--mood-happy` | `150 60% 60%` | `150 60% 40%` | Emerald green (success, happy mood, online) |
| `--mood-neutral` | `45 80% 65%` | `45 80% 45%` | Amber/Gold (warnings, stars, neutral vibe) |
| `--mood-sad` | `210 70% 70%` | `210 70% 50%` | Indigo/Sky Blue (info, reflective mood, overdue) |
| `--destructive` | `0 75% 65%` | `0 75% 50%` | Red (delete actions, remove member, end call) |

### 1.2 Theme Persistence & Border Rules
* Theme preference **MUST** always persist in `localStorage` under key `lumi-theme`.
* Border in Light mode is `transparent` on standard top-level cards, while keeping Dark theme borders crisp (`hsla(var(--border), 0.7)`).
* Inside modals and inputs, borders in Light mode use hairline `hsla(270, 25%, 75%, 1)` to maintain crisp container definitions.

---

## 2. Card Anatomy, Corner Radius & Spacing

### 2.1 Standard Radius Hierarchy

```
┌──────────────────────────────────────────────────────────┐
│  24px (1.5rem)  - Top-Level Cards, Modals, Windows       │
│  ┌────────────────────────────────────────────────────┐  │
│  │  16px (1rem) - Sub-cards, List Rows, Previews      │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  12-14px - Form Inputs, Date Pill, Badges   │  │  │
│  │  │  ┌────────────────────────────────────────┐  │  │  │
│  │  │  │  8-10px - Tooltips, Tags, Sub-Pills    │  │  │  │
│  │  │  └────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Card Borders & Border Colors Architecture Matrix

| Card Level | Dark Theme Border | Light Theme Border | Hover State Transition |
| :--- | :--- | :--- | :--- |
| **Top-Level Main Cards** (`.dashboard-card`, `.staff-card`, `.class-card`, `.event-card-large`) | `1px solid hsla(var(--border), 0.75)` | `1px solid transparent` (or hairline `hsla(270, 20%, 88%, 1)`) | `border-color: hsl(var(--primary));` with elevation |
| **Nested / Child Cards** (`.directory-user-card`, `.schedule-item`, `.attendance-student-row`, `.task-card`) | `1px solid hsla(var(--border), 0.55)` | `1px solid hsla(270, 20%, 85%, 1)` | `border-color: hsla(var(--primary), 0.4);` |
| **Modal Dialogs & Drawers** (`.modal-content`, `.new-chat-dialog-modal`, `.channel-drawer`) | `1px solid hsl(var(--border))` | `1px solid hsla(270, 20%, 82%, 1)` | Fixed boundary, zero overflow |
| **Form Inputs & Recessed Surfaces** (`input`, `select`, `textarea`, `.custom-form-select`) | `1px solid hsl(var(--border))` | `1px solid hsla(270, 25%, 75%, 1)` | `border-color: hsl(var(--primary)); box-shadow: 0 0 0 2px hsl(var(--primary) / 0.25);` |
| **Header Date Display & Bell Action** (`.date-display`, `.notification-btn`) | `1px solid hsl(var(--border))` | `1px solid hsla(270, 20%, 85%, 1)` | `box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);` |
| **Active / Selected Items** (`.selected`, `.active`) | `1.5px solid hsl(var(--primary))` | `1.5px solid hsl(var(--primary))` | Sustained glow `0 0 0 3px hsla(var(--primary), 0.25)` |

---

## 3. The Zero-Transparency Rule for Text & Interactive Areas

> [!IMPORTANT]
> **CRITICAL RULE**: Never make text containers, message areas, modal dialogs, or drawer panes transparent glass (`opacity < 0.9`) when positioned over starry background canvases!
> Background stars and particles bleeding through text makes text unreadable and breaks visual immersion.

1. **Messages Page & Chat Area**:
   * `.chat-window` & `.messages-sidebar`: Must be `background: hsl(var(--card)) !important;` (solid opaque).
   * `.chat-messages-area`: Must use a solid dark surface `hsla(270, 42%, 7.5%, 0.95)` in dark theme, `#f8f6fc` in light theme.
   * `.message-bubble.them`: Must use solid surface `hsla(270, 36%, 16%, 1)` with `1px solid hsla(var(--border), 0.85)`.
2. **Modals & Drawers**:
   * `.modal-content` & `.channel-drawer`: Must use `background: hsl(var(--card)) !important;` with heavy elevation shadow `box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);`.
   * Form inputs inside modals must use the recessed `background: hsl(var(--background))` in dark theme, `#ffffff` in light theme, with `border: 1px solid hsl(var(--border))` so input boxes never blend into the modal background!

---

## 4. Modal Dialogs & Modern UI Architecture

### 4.1 Strict Single-Scroll Surface Rule
* **NEVER** nest multiple scrollable containers inside a dialog or modal (e.g. a scrollable list inside a scrollable form).
* The outer modal container (`.modal-content`) must have `max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; padding: 1.5rem; gap: 1rem; border-radius: 1.5rem;`.
* The form/content pane (`.modal-form` or `.modal-body`) must be the **ONLY** scrollable surface (`flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 0;`).
* Inner list grids (like directory users or member cards) must have `overflow: visible; max-height: none;` so the entire dialog scrolls as one clean, natural surface with **strictly one scrollbar**.

### 4.2 Standard Dialog Layout Hierarchy (Tasks Dialog Exact Standard)
Every creation or editing dialog must follow the standard structure:
```jsx
import DialogPortal from '../components/DialogPortal'; // adjust the relative import

<DialogPortal>
<div className="modal-overlay" onClick={onClose}>
  <motion.div 
    className="modal-content"
    role="dialog"
    aria-modal="true"
    aria-label="Modal Title"
    initial={{ opacity: 0, scale: 0.96, y: 8 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.96, y: 8 }}
    transition={{ duration: 0.15, ease: "easeOut" }}
    onClick={e => e.stopPropagation()}
  >
    {/* Tier 1: Fixed Clean Header with Absolute Close */}
    <div className="modal-header">
      <h3>Modal Title</h3>
      <p className="modal-subtitle">Concise explanatory subtitle explaining the action.</p>
      <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
    </div>

    {/* Tier 2: Single Scrollable Form Body */}
    <form onSubmit={handleSubmit} className="modal-form">
      <div className="form-grid-2">
        <div className="input-group">
          <label>Field Name</label>
          <input type="text" required placeholder="e.g. Placeholder" value={val} onChange={...} />
        </div>
        <div className="input-group">
          <label>Category</label>
          <select className="custom-form-select" value={cat} onChange={...}>...</select>
        </div>
      </div>
      
      {/* Tier 3: Fixed Footer Actions inside Form */}
      <div className="modal-footer-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary">Confirm Action</button>
      </div>
    </form>
  </motion.div>
</div>
</DialogPortal>
```

### 4.3 Zero Horizontal Scroll Standard (Strictly Mandatory)
> [!CRITICAL]
> **NEVER** allow horizontal scrollbars or side-scrolling inside modals, dialogs, drawers, or floating cards under any circumstances!
>
> 1. **Container Containment**: `.modal-content`, `.modal-body`, `.modal-form`, and all form containers must have `box-sizing: border-box !important; max-width: 100% !important; overflow-x: hidden !important;`.
> 2. **Responsive Grid Restraints**: Form grids inside modals must strictly use 2-column layouts (`.form-grid-2` with `grid-template-columns: 1fr 1fr`) or auto-fitting grids, and collapse to `1fr` on screens below 540px. **Never hardcode 3-column fixed grids (`1fr 1fr 1fr`) inside modals**.
> 3. **Input Containment**: All `<input>`, `<select>`, and `<textarea>` elements must have `width: 100% !important; max-width: 100% !important; box-sizing: border-box !important;`.
> 4. **No Horizontal Tag Spills**: Category pill bars or swatch pickers must wrap cleanly (`flex-wrap: wrap`) or clip gracefully without forcing parent containers to scroll horizontally.

---

## 5. Form Controls, Inputs & Recessed Surfaces Standard

### 5.1 Input & Dialog Box Surfaces Matrix

| Property | Dark Theme | Light Theme |
| :--- | :--- | :--- |
| **Modal Overlay Backdrop** | `rgba(0, 0, 0, 0.55)` with `backdrop-filter: blur(4px)` | `rgba(0, 0, 0, 0.35)` with `backdrop-filter: blur(4px)` |
| **Modal Box Background** | `hsl(var(--card)) !important;` (Solid dark card) | `#ffffff !important;` (Crisp white) |
| **Input Surface Background** | `hsl(var(--background)) !important;` (Recessed obsidian) | `#ffffff !important;` (Crisp white) |
| **Input / Select Border** | `1px solid hsl(var(--border)) !important;` | `1px solid hsla(270, 25%, 75%, 1) !important;` |
| **Height & Sizing** | `height: 2.5rem (40px); padding: 0 0.85rem; font-size: 0.875rem; border-radius: 0.75rem;` | `height: 2.5rem (40px); padding: 0 0.85rem; font-size: 0.875rem; border-radius: 0.75rem;` |
| **Typography** | `color: hsl(var(--foreground)) !important;` | `color: hsl(270, 30%, 15%) !important;` |
| **Labels Styling** | `color: hsl(var(--muted-foreground)); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;` | `color: hsl(var(--muted-foreground)); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;` |
| **Focus Highlight** | `border-color: hsl(var(--primary)) !important; box-shadow: 0 0 0 2px hsl(var(--primary) / 0.25) !important;` | `border-color: hsl(var(--primary)) !important; box-shadow: 0 0 0 2px hsl(var(--primary) / 0.25) !important;` |

---

## 6. Viewport, Header, Sidebar & Immersion Architecture

### 6.1 Sidebar Navigation Architecture & Modal Dimming Rules
* **Sidebar Containment**: The sidebar is fixed and left-pinned with quick collapse/expand toggle.
* **Modal Dimming Rule**: When any covering modal or search overlay is active, the sidebar MUST remain fixed, dimmed, blurred and noninteractive. New full-screen dialogs use `DialogPortal` so the full viewport backdrop covers it directly. The following is the legacy fallback for nested standard/search overlays; do not add a second sidebar filter to portalled dialogs:
  ```css
  .app-container:has(.modal-overlay) .sidebar,
  .app-container:has(.search-overlay.open) .sidebar {
    filter: blur(8px) brightness(0.6);
    pointer-events: none;
  }
  ```
* **Active Route Indicator**: Highlighted with active primary fill, pill background, and luminous indicator bar.

### 6.2 Global Top Navigation Header & Action Badges
* **Main Header (`.main-header`)**: Visible across all standard views (`currentPath !== 'messages'`) with search and action pills.
* **Global Search Box (`.header-search`)**: Pill surface with `20px` radius, opening the modal Search overlay on click.
* **Date Display Pill (`.date-display`)**:
  * Solid container: `background: hsl(var(--card))` (dark) / `#ffffff` (light), `border: 1px solid hsl(var(--border))`.
  * Generous padding: `padding: 0.7rem 1.35rem; border-radius: 20px;`.
  * Integrated primary calendar icon: `<Calendar size={15} className="date-icon" />` with `color: hsl(var(--primary));`.
  * Typography: `font-size: 0.88rem; font-weight: 600; color: hsl(var(--foreground)); white-space: nowrap;`.
  * Never render raw unpadded outlines or squished date borders.
* **Notification Bell (`.notification-btn`)**:
  * Solid container: `width: 42px; height: 42px; border-radius: 12px; font-size: 1.15rem;`.
  * `background: hsl(var(--card))` (dark) / `#ffffff` (light) with `border: 1px solid hsl(var(--border))`.

### 6.3 Viewport Bottom Fadeout Bar (`.main-content::after`)
* **Standard Fadeout**: Provides a smooth gradient overlay at the bottom of the page viewport so scrolling content fades out cleanly:
  ```css
  .main-content::after {
    content: '';
    position: fixed;
    bottom: 0;
    right: 0;
    width: calc(100% - var(--sidebar-width, 250px));
    height: 70px;
    background: linear-gradient(to bottom, transparent, hsl(var(--background) / 0.95));
    pointer-events: none;
    z-index: 1000;
    transition: width 0.3s ease;
  }
  ```
* **Sidebar Collapsed Adjustment**: `width: calc(100% - 80px);`.
* **Full-Immersion Exception (Messages)**:
  * MUST be strictly disabled on Messages page (`display: none !important;`) so the message composer, attachment menu, and send button are never dimmed or obscured.

### 6.4 Quick Action Floating Action Button (FAB)
* Fixed floating `+` button in bottom-right corner for rapid resource creation.
* **Hidden on Messages**: Must automatically hide on Messages page (`currentPath === 'messages'`) to prevent overlapping the chat send button.

### 6.5 Route Navigation Scroll-Reset Standard
* Every page navigation must reset scroll position to top `(0, 0)` immediately via `useEffect` tracking `currentPath`:
  ```javascript
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentPath]);
  ```

---

## 7. Typography & Header Standards

### 7.1 Hierarchy
* **Page Title**: `font-size: 1.8rem - 2.2rem; font-weight: 800;` with class `.gradient-text` (`linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))`).
* **Section Title**: `font-size: 1.25rem - 1.4rem; font-weight: 700; color: hsl(var(--foreground));`.
* **Card Subtitles**: `font-size: 0.85rem - 0.9rem; color: hsl(var(--muted-foreground)); font-weight: 500;`.
* **Badges / Count Pills**: `font-size: 0.72rem - 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;`.

### 7.2 Header Alignment Pattern
```jsx
<header className="page-header">
  <div className="header-left">
    <div className="title-group">
      <h1 className="gradient-text">Page Title 🏷️</h1>
      <span className="count-pill glass">{count} Total</span>
    </div>
    <p>Descriptive subtitle explaining the purpose of this section.</p>
  </div>
  <div className="header-actions">
    <button className="btn-secondary glass">Secondary Action</button>
    <button className="btn-primary">Primary CTA</button>
  </div>
</header>
```

---

## 8. Buttons & Interactive Controls

### 8.1 Button Class Standards

| Button Class | Purpose | Key Styling |
| :--- | :--- | :--- |
| `.btn-primary` | Primary action on the view | Gradient background, `hsl(var(--primary-foreground))` text, `border-radius: 14px`, `white-space: nowrap; flex-shrink: 0;` |
| `.btn-secondary` | Alternative actions, filters, exports | `hsla(var(--card), 0.7)`, border `1px solid hsl(var(--border))`, `white-space: nowrap;` |
| `.icon-btn` | Compact icon-only trigger | `36px - 44px` square, `border-radius: 12px`, centered icon |
| `.bouncy` | Micro-animation on interaction | `transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);` with `:hover { transform: scale(1.05); }` |

> [!WARNING]
> **Text Wrapping Rule**: Buttons must ALWAYS include `white-space: nowrap; flex-shrink: 0;` to prevent text breaking across multiple lines or spilling over button borders.

---

## 9. Role Permissions & Guardrails

* **Admin Role**:
  * Can add/edit/delete staff, students, courses, tasks, and events.
  * Can create custom roles and assign swatches.
  * Can moderate messages, pin announcements, and mute/unmute channel participants.
* **Teacher / Faculty Role**:
  * Read-only access to staff administrative controls with explicit lock badge.
  * Full access to student attendance roll call, gradebook, class notes, and class communication channels.
* **Student Role**:
  * Access to personal overview, assignments, class discussions, and teacher messaging.

---

## 10. UI Bugs Prevention Checklist

Before completing any UI change or new screen, verify the following checklist:

- [ ] **No Star Background Bleed**: Are text containers, cards, date pills, and message lists completely opaque over the background stars?
- [ ] **No Double Scrollbars**: Are modals built with a single scrollable pane and unconstrained inner lists?
- [ ] **No Horizontal Scroll in Dialogs**: Are modal dialogs, inputs, and form grids constrained with `overflow-x: hidden !important; box-sizing: border-box;`?
- [ ] **Date Display Integrity**: Does the top navigation date pill have solid background, `14px` radius, `0.6rem 1.15rem` padding, and calendar icon?
- [ ] **Modal Box Colors**: Are dialog containers styled with `hsl(var(--card))` and input boxes with recessed `hsl(var(--background))`?
- [ ] **No Shadow Clipping**: Do active day buttons, floating pills, and cards have sufficient container padding (`overflow-y: visible`) so shadows are not cut off?
- [ ] **Button Text Integrity**: Are buttons styled with `white-space: nowrap;` so text never spills or wraps awkwardly?
- [ ] **No FAB / Chat Input Collisions**: Are floating action buttons hidden on Messages page to avoid overlapping the chat send button?
- [ ] **Bottom Fadeout Disabling on Messages**: Is `.main-content::after` disabled on Messages view so chat inputs are never obscured?
- [ ] **Theme Persistence**: Does switching themes persist correctly across page refreshes via `localStorage`?
- [ ] **Sidebar Stability**: When modals or search drawers are open, does the sidebar remain fixed in place (blurred and disabled) without sliding off-screen?

---

## 11. Rules for AI Agents Working on This Repo (Cloud Sessions Included)

> [!IMPORTANT]
> **The owner must never have to find bugs.** Every change handed over has to work on the live Firebase project the first time. Do not hand over work that relies on the owner testing it. If something cannot be verified, say so up front, before the owner deploys.

### 11.1 How this app runs in production
* **Frontend**: Vite + React, served by **Firebase Hosting** from `dist/` (SPA rewrite `** → /index.html`). Each page has its own URL (`src/features/navigation/pageRoutes.js`).
* **Backend**: **Cloud Functions (2nd gen) callables** in `us-central1` (`functions/`). There is **no Express/`/api` server**. Hosting never served one, so never add client calls to `/api/...`.
* **Data**: Firestore with `firestore.rules`, and Firebase Auth (email/password).
* **The owner deploys from Windows with exactly**: `cmd.exe /c "npx firebase-tools deploy"` (everything: hosting, functions, rules).
* `firebase.json` runs `npm run build` before every hosting deploy (`predeploy`). Never remove it: `firebase deploy` does not rebuild by itself, and an old `dist/` was once deployed by mistake.
* Platform admin: `admin@bleon.com` is hardcoded in `functions/platformAdmin.js` (authoritative) and `src/features/platformAdmin/access.js` (UI only). Firestore rules give it no extra client access.

### 11.2 Emulator ≠ production: check these for every change
Passing emulator tests is **not** proof. These differences already broke production once:
* **Admin SDK init**: in production, `firebase-functions` verifies callable ID tokens with its own named app (`__FIREBASE_FUNCTIONS_SDK__`); the emulator skips this. Always call `ensureDefaultApp()` from `functions/adminApp.js`. **Never** use `if (!getApps().length) initializeApp()`: it breaks every function with `app/no-app`.
* **Firestore indexes** are not enforced by the emulator. Avoid collection-group and composite queries unless the index is added to `firestore.indexes.json` in the same change.
* **Auth metadata** differs: the emulator records a sign-in at creation time for Admin-created users; production leaves `lastSignInTime` empty until the first sign-in.
* **Secrets/IAM** (e.g. `GEMINI_API_KEY`) exist only in production; the emulator uses `functions/.secret.local`, which must never be committed.
* **Browser caching**: Hosting serves pages with `no-cache` and hashed `/assets` as immutable (see `firebase.json` headers). Keep it that way.

### 11.3 Data model and scale rules
* **Courses vs classes**: `schools/{id}/classes` holds **courses** (subjects on the timetable, with a teacher and schedule). `schools/{id}/classGroups` holds **classes** (homeroom groups such as 10A: grade level 0–12, section, homeroom teacher; no timetable). Only school admins manage classes.
* A course may link to one class (`classGroupId`); every student of that class is then enrolled automatically (`isStudentEnrolledInCourse`). Stored `assignedClasses` hold only the other courses (`explicitCourseAssignments`).
* A student's class is `classGroupId`; `grade` keeps the class label in step (server provisioning and `updateStudent` set it). Show labels with `studentClassLabel`.
* **Never load the whole `students` collection** in the browser. A school can have tens of thousands. Use `src/features/students/studentData.js`: `useStudentDirectory` (paged / roster / search), `useCourseRoster`, `useClassRoster`, `useStudentRecord`, `useStudentSearch`, and `useStudentCounts` (server-side counts). The signed-in student's own record is `myStudentRecord` in `SchoolDataContext`.
* Student search uses `searchTokens`/`nameLower`, written by `functions/provisionSchoolUser.js`, `updateStudent`, the self-rename in `AuthContext`, and the one-time `prepareSchoolDirectory` upgrade. `functions/studentSearch.js` and `src/features/students/studentSearch.js` must stay identical (a unit test enforces it). Queries rely on the indexes in `firestore.indexes.json`.
* Small collections (staff, courses, classes, events) stay as live listeners in `SchoolDataContext`.
* **CSS is one global bundle**: page stylesheets must scope their selectors. `.page-header`, `.header-left`, `.title-group` and `.count-pill` are defined once in `src/index.css`; never redefine them in a page file.

### 11.4 Before handing anything over
1. Run everything that applies: `npm test`, `npm run lint`, `npm run build`, `cd functions && npm test`, `npm run test:rules` (Firestore emulator).
2. Exercise changed data/security flows against the appropriate emulators. If the owner has requested no browser testing, honor that instruction: use code, meaningful unit/integration tests and endpoint/deployment checks, and explicitly state that browser visuals/interactions remain unverified. Do not run browser tooling in that case.
3. Walk through §11.2 for the change and fix any production-only risk before handing over.
4. Never break existing flows. In particular:
   * School admins create teachers and students **with a manually set password**; teachers create students. This must keep working.
   * Sign-up stays hidden (`SHOW_SIGNUP = false` in `src/pages/Login.jsx`) until the owner says otherwise.
   * Keep existing page architecture; add, don't restructure, unless asked.
5. Unexpected server errors must reach the UI with their real message (`functions/callableErrors.js`), never a bare `INTERNAL`.

### 11.5 Handing over
* Give the steps actually needed for the current checkout. If deployment is authorized, run `cmd.exe /c "npx firebase-tools deploy"`, wait for completion and verify the live release. Mention dependency installation only when dependencies changed, and PR merge/pull steps only when the owner requested a PR workflow. Do not invent those steps for primary-checkout edits.
* Tell the owner how to confirm the new version is live, e.g. `.firebase/hosting.ZGlzdA.cache` lists the new `assets/` files, or the changed page shows the change.
* The owner's live Firebase project and logs are not reachable from cloud sandboxes. State plainly what could not be verified, and add safeguards (clear error messages, logging) for it.
* Owner's review workflow: work in this primary checkout on `main` and leave edits uncommitted so they appear in GitHub Desktop's Changes list for review/discard. Do not automatically commit, push, or create another branch/worktree. A requested deployment does not authorize a Git commit or push.

### 11.6 Theme and release maintenance
* Nature is independent: its palette/material rules belong under `html.theme-nature` in `src/features/theme/nature-reference.css` and `nature.css`, in screen media only. Preserve other themes and all lesson-paper/print styles. See `docs/nature-theme.md` for the MomentumHorizon00 source provenance and renderer workflow.
* The lesson-plan side-preview paper and native Print/Save as PDF must keep their existing white background, blue headings, fonts, contents, and geometry in every app theme. Do not retheme `.lesson-document` or replace its export implementation.
* `public/version.json` is the release authority, embedded by Vite and read by the update checker. Run `npm run version:patch` once per completed runtime change set, then build and deploy the manifest/assets together. Do not bump on build/deploy retries.
* Preserve explicit update confirmation and cloud-save acknowledgement before refresh. Do not force reload a user who is editing or whose pending saves failed.

---

## 12. Nature, filter menus, dialogs and lesson review: required details

These rules supplement the earlier design standards. The owner's current instructions take priority. Nature's established appearance must be preserved when fixing behavior; never redesign its cards as a side effect of a loading, stacking or animation repair.

### 12.1 Theme identity, preferences and source map

| Responsibility | Source of truth |
| --- | --- |
| Selected mode, resolved light/dark state, device tracking | `src/features/theme/themeStore.js` |
| Theme controls and account preference sync | `src/components/theme/ThemePicker.jsx`, `AuthContext.jsx` |
| Nature season, phase, pause preferences and events | `src/features/theme/nature-phase.js` |
| Horizon palette, original materials, fades and type | `src/features/theme/nature-reference.css` |
| Noesis component-specific overrides | `src/features/theme/nature.css` |
| Scene mounting, trusted messaging, pause/occlusion | `src/components/theme/NatureBackground.jsx` |
| Real outer reading surfaces | `src/features/theme/surfaces.js` |
| Motion entrance compositing | `src/features/theme/nature-glass-entry.js` |
| Covering dialog detection | `src/features/theme/dialog-overlays.js` |
| Scene source/build | `scripts/nature/prototype.html`, `scripts/build-nature-scene.cjs`, `scripts/nature-*.cjs` |

- A fresh visit selects **System**, even when the device resolves to dark. The selected mode is `lumi-theme-mode`; the legacy `lumi-theme` value remains compatible. Never substitute the resolved dark/light appearance for an explicit selected mode. An explicit saved Dark/Light/Nature choice stays selected.
- Nature is a separate mode, not a tinted default theme. Root attributes are `data-theme="nature"`, `data-theme-style="light|dark"`, `data-nature-season` and `data-nature-phase`. Changing away must remove Nature-only attributes, observers and entrance mirrors.
- Seasons are Summer (also representing spring), Autumn and Winter. Auto uses local calendar months: December–February Winter, September–November Autumn, other months Summer. Phase names are `morning`, `golden`, `night`; Auto uses 06:00–16:59, 17:00–19:59, and 20:00–05:59 respectively. Check the helper/tests before changing those boundaries.
- Device preferences are `natureThemeSeason`, `natureThemePhase`, and `natureBackgroundPaused`; use their exported read/write helpers and events. Do not replace a user's explicit season or phase with Auto.
- Scene assets are local and generated. Edit source helpers, run `npm run nature:build`, and retain the vendored Three.js license. Do not hand-edit generated `public/nature/scene.html` or replace the scene with external/CDN media.

### 12.2 Palette and material contracts

- Every Nature adaptation must start with `html.theme-nature` and live within screen media in the Nature sheets. The existing nine season/phase combinations all matter, including night; do not hardcode an Autumn daylight brown as a global Nature foreground.
- Outer reading cards use `--nature-card-glass`, `--nature-card-blur`, `--nature-glass-border`, `--nature-glass-shadow` and `--nature-glass-highlight`. Preserve established radius, spacing, geometry and elevation. Update `surfaces.js` and adapter card selectors together if adding a genuine outer reading surface.
- Nested panels reuse the parent's frost. Dialogs and small inset profile sections use `--nature-dialog-surface`, `--nature-dialog-tint`, `--nature-dialog-border`; avoid multiplying page-card shadows inside a clipped scrolling pane.
- General app controls use `--nature-control-surface`, `--nature-control-opacity`, `--nature-control-foreground`, `--nature-control-border`, and `--nature-control-hover`. Primary/selected controls use `--nature-action-surface` / `--nature-action-hover` and `--primary-foreground`.
- Header search, school switcher, bell and date have their own neutral opal material: `--nature-chrome-fill`, `--nature-chrome-hover`, `--nature-chrome-border`, `--nature-chrome-ink`, `--nature-chrome-muted`. Do not reuse tan general-control paint for them. Header search inputs stay transparent; decorative emoji bells are replaced by the Nature icon.
- Autumn Golden alone uses the lighter honey/peach control overrides and slightly deeper copper/rose title gradient. Current title stops are `18 73% 30%` and `351 45% 32%`. Preserve that scope and every other palette.
- Page-title totals have a stable tinted reading surface and foreground ink. Lesson draft/completed/archived badges have explicit daytime/nighttime ink/fill tokens. Course stat pills retain metric hues through `--co-stat-color`, mixed with readable foreground/dialog tint; never apply their Nature contrast override to normal themes.
- Editor subbar actions require their own subtle seasonal fill, clear border, foreground ink, hover and focus outline because they sit over detailed grass. Do not place low-contrast bare labels over the scene or introduce grey default-theme buttons.

### 12.3 Filter dropdowns: the open menu is part of the component

- Use `src/components/FilterSelect.jsx` for styled page-filter menus. Shared-plan user/subject/status/date-basis/date-preset controls use it. Native `<option>` menus are OS-painted and cannot reliably supply the app's rounded shape, seasonal selected color or popup geometry. Styling just `<select>` is insufficient.
- Closed trigger, popup surface, selected option, keyboard-active option, hover, focus, disabled state and night contrast must all be covered. Nature overrides live in `nature.css`; general geometry lives in `FilterSelect.css`.
- Popups are portalled to `document.body`, fixed to the trigger, clamped to viewport edges, able to open upward, and have bounded vertical scrolling without horizontal overflow. A portal retains React context but loses ancestor CSS selectors: use component classes and root theme tokens, never depend on `.lesson-page` as its DOM ancestor.
- Retain keyboard arrows, Home/End, Enter/Space, Escape, Tab dismissal, type-to-find, outside-click dismissal and accessible combobox/listbox/option state. Keep selected text readable, long labels contained and the scrollbar usable.
- Search wrappers own their material. Their inner `<input>` must be transparent with inherited ink and no second rectangle. Existing fixes cover header, lesson planner, Tasks, Materials (`.res-search`) and course gradebook search. Check actual component selectors before adding CSS.

### 12.4 Full-screen dialogs, sidebar blur and stacking

- Use `src/components/DialogPortal.jsx` for new full-screen dialogs and drawers. Current custom consumers include Share, History, save-template, topic-outcome confirmation, curriculum-delete confirmation and Tasks. It mounts under `document.body`, beyond page/card stacking and backdrop roots; it retains React context.
- Keep the whole viewport backdrop above the sidebar, header and floating launcher. Increasing a nested child's z-index cannot escape `.main-content`'s stacking context or an ancestor's transform/backdrop filter. Never solve it by changing page-card materials or clipping the sidebar.
- The portal locks document scrolling, preserves the gutter where needed, disables background app interaction with `inert`, and restores prior state/focus on close. Multiple open portals must not unlock the background until the last closes.
- `dialog-background.js` locks root overflow and uses **body `overflow: clip`**, not body `overflow: hidden`. A body scroll container changes the sticky sidebar's ancestor during Nature document scrolling and can make it vanish when opening history deep in the plan list. Preserve inline overflow longhands/priorities and the original document position; focus the drawer with `preventScroll: true`. Do not fix this by hiding/rebuilding/translating the sidebar or changing its glass material.
- Older `.modal-overlay` / search dialogs use the existing sidebar blur/disable rule. Portalled dialogs blur/dim the sidebar through their real backdrop; do not add a second filter over that sidebar. `App.css` hides the floating quick-action launcher for modal/alertdialog states, including custom overlay classes, so it cannot appear on top of history.
- Cover every custom overlay in both `dialog-overlays.js` (Nature pause) and the Nature fade-hide selector. This includes `.modal-backdrop`, `.lesson-sharing-overlay`, `.lesson-modal-overlay`, `.lp-admin-confirm-backdrop`, modal/alertdialog ARIA roles and the existing standard/search overlays. Do not classify ordinary filter popups as modal dialogs.
- Follow the single-scrollport structure: fixed header, one padded body with `min-height: 0`, fixed actions as appropriate. Avoid nested broad shadows, clipped rectangular shadow slabs, horizontal overflow and double scrollbars. Focus must enter the dialog, remain within the modal flow, allow Escape where appropriate, and restore without scrolling the page.
- Dialog portals and filter popups are excluded from printing. A dialog fix must not alter the lesson document or PDF/print path.

### 12.5 Fades, scrolling, scene lifetime and entrance animation

- Nature's top veil is 3.5rem high, full viewport width, uses exactly `--nature-header-background` / `--nature-header-opacity` and `linear-gradient(to bottom, #000, rgba(0, 0, 0, 0.8) 40%, transparent)` as its mask. The bottom uses Horizon's original `--nature-fade-color` / `--nature-fade-opacity`, `min(14vh, 140px)` height and `linear-gradient(to bottom, transparent, #000)` mask. Summer Golden keeps its source exception of `32 24% 83%` / `0.60`. Do not invent replacements or flatten the other seasonal tokens.
- Both veils continue behind the sidebar with no sidebar-width inset, cutoff or width animation. Hide them during covering dialogs, Messages and printing. Do not substitute `--background`, darken moving cards, or filter/mask card contents to simulate a screen-edge fade.
- Nature normally uses document scrolling so frosted cards are not clipped inside a second viewport-sized scroll container. Messages retains its dedicated bounded internal layout. Navigation resets both document and main scroll owners once; typing/autosave must not reset position.
- Entrance protection multiplies inherited typed numeric opacity factors following the original Motion timing. Never clone overlapping `opacity` animations onto a card: they replace each other and create the loading glitch. Preserve the finished factor until Motion acknowledges its endpoint, reuse factor slots and fully clean up on leaving Nature.
- `NatureBackground.jsx` validates same-origin iframe messages and their source window, mirrors season/phase preferences, forwards exposed-meadow pointer movement and pauses behind covering dialogs. Preserve frozen-frame pause/resume, hidden-tab handling, seasonal assets, cat motion, slow-device behavior and reduced-motion behavior. Do not restart/rebuild the scene on normal page navigation.

### 12.6 Lesson-paper and review-history boundaries

- Nature must never retheme `.lesson-document` or its descendants. The side preview, recorded-version paper, native Print and Save as PDF retain existing white paper, blue headings, fonts, data and geometry. Preserve the export implementation and school-name/logo preference.
- Lesson dates are optional. New plans, templates and duplicates start blank; preserve existing saved dates and an explicitly chosen dated timetable lesson. `OptionalLessonDate` opens a small nonmodal body-portal popover with Today, calendar, Apply and Clear actions. Today uses the app's Europe/Belgrade calendar day. Opening or dismissing the popover must not set a date, blur/lock the application or pause Nature. Theme its trigger, popup, input, hover/focus and night states. When blank, omit the entire date label/value from the canonical document, preview, recorded version, Print and PDF; never substitute today's date or a dash in the date metadata.
- Personal-plan action order: sharing/unsharing is last. Editor order: sharing/unsharing immediately precedes Complete/Return to draft, which remains last. History/template/duplicate controls must not accidentally move completion away from the end.
- Separate editor metadata (plan state, date/class, reviewer and sharing badge) from its action row. Comments is the prominent conversation action, History is outlined, template/duplicate are quieter tools, sharing is outlined and completion uses the success treatment. Return to draft is subdued. Preserve these distinctions in Nature with `--nature-action-*`, `--nature-review-active-*`, `--nature-control-*` and `--nature-status-completed-*` tokens, including readable night inks. Do not paint every action as an identical pill or turn metadata badges into button-like controls.
- Admin lesson planning has two top-level navigation tabs: **My plans / Planet e mia** and **Shared plans / Planet e ndara**. Personal list/template/planning-settings controls belong only in My plans; hide them, personal totals and personal New plan/Settings actions throughout Shared plans, including an open shared plan. Keep selected, hover and keyboard focus states themed. This replaces the earlier separate top-action Shared plans button placement.
- Audit records stay immutable and retain exact saved versions. The visible log groups consecutive `update` events from the same actor and sharing lifecycle into 30-minute windows anchored at the newest event; it must not chain a whole day into one session.
- A session shows one combined changed-field list, original/final values and access to intermediate field changes and saved versions. Reverted fields are still listed. Keep share, unshare, reshare, admin-review and automatic system-reopening events distinct. Pagination must disclose an incomplete session and extend it when earlier history loads.
- The shared `LessonPlanHistory` controls serve both authors and admins. Use `FilterSelect` for person/action/review-state/date filters and the themed search wrapper for text. Date filters refer to audit-event dates in the app's Europe/Belgrade timezone, not the lesson's date. Group before filtering; all criteria must match the same saved event, and show its whole session with the original baseline and intermediate versions intact.
- History searches must include earlier records, not silently stop at the first 100. `historyReader.js` uses cursor pages plus one lookahead record and a live query anchored at the initial oldest snapshot. Active filters automatically load earlier pages; show progress, result scope and a retryable incomplete-search message on failure. Dispose listeners and ignore stale requests on school/plan changes; clear retained records if access is denied.
- Keep stored review states `pending`, `reviewing`, `archived` unchanged. Singular badges and plural filter options have separate translation keys. Albanian actions use **Fillo kontrollin**, **Arkivo nga lista**, **Rikthe në pritje të kontrollit**; badges use **Në pritje të kontrollit**, **Në kontroll**, **I arkivuar**. Explain the inbox-only meaning of archiving alongside these actions.
- Review badges carry `data-review-status` for subtle amber (pending), teal (reviewing), and slate (archived) treatment. Nature uses stable tinted surfaces and separate day/night inks under `@media screen`; neutral sharing/resharing badges stay neutral. Never apply these attributes or colors to lesson paper or change the author's personal plan status.
- Comments are a plain conversation: newest messages first, named sender/role/time, one labelled composer and Send comment. Do not put outcome selectors, approval choices, resubmission controls, stale-feedback instructions or archive actions in the comments dialog. `feedbackComment` allows the author and assigned admin reviewer to send a message while shared, including an archived review, and must preserve review status, assignment and author content. Review management remains in the shared-plan view. Keep legacy feedback/reply/resubmission records and RPC compatibility; new comments still create immutable history, red dots and bell notices.
- History defaults to the actual timeline with one short introduction, visible search and expandable Filters/About history. Keep global matching and 30-minute edit sessions. Show a person once, a plain-language action, time, exact comment text, and expandable readable before/after changes. Localize field labels/status values and describe automatic/manual flags in words instead of raw booleans. The Comments filter includes older feedback/reply entries.
- Review status/assignment events and system actions use compact distinct timeline entries (`data-event-kind`), readable icons and a restrained tinted/dashed boundary. Show an actual old-to-new status transition when it changed; do not repeat the same reviewer as current and previous. Only `share`, `reshare`, `update` and `resubmit` content snapshots offer View saved plan. Administrative actions, comments, unsharing and automatic reopening must not show version buttons even if their immutable legacy record contains a plan snapshot. Never delete stored snapshots to simplify the presentation.
- Provider billing failures are separate from each user's daily AI allowance. Map upstream HTTP 402 to the explicit `lesson-ai-billing` callable detail, retain failed-reservation release and show a persistent localized explanation with the Google AI Studio link as well as a toast. Do not expose upstream credentials or claim generation is repaired while external service credits remain depleted. Keep error state scoped to the current account, school, plan and language.
- Clicking a saved version must open a new top-level DialogPortal viewer at its own scroll origin, with actor/time and Back to history. Never append a plan preview below the timeline or resize the shared-plan page into a narrow history/paper split. History itself opens consistently as a portalled drawer from both lists and detail views. Closing the viewer restores the prior history position/focus. Hidden filter controls must be excluded from keyboard focus trapping. Keep generic dialog heading selectors out of the lesson paper.
- Admin review archiving affects only the shared inbox; it never changes the author's plan status. Resharing returns the plan to Needs review, and reopening an archived review has a separate system log. Preserve server ownership/read-only enforcement and the sharing confirmation's history-retention explanation.

### 12.7 Verification and handover boundary

- Check source selectors and stacking ancestry, not just palette tokens. A successful build does not prove browser blur, focus, popup placement or contrast. Honor the owner's no-browser-testing instruction and state that boundary honestly.
- Run meaningful grouping/history tests when changing aggregation; run Firestore emulator tests when changing transactions, roles or security rules. Run app tests, lint and a production build for a runtime release. Do not expand unrelated testing without a concrete risk.
- Confirm requested visual changes are Nature-only; preserve other themes, established cards, preview and export. Update this guide when introducing a reusable control or dialog primitive.
- Bump `public/version.json` once after the change set is complete, deploy the manifest and assets together, wait for `Deploy complete!`, verify the live version and file hashes, and leave source edits unstaged/uncommitted on `main` for GitHub Desktop.

### 12.8 School workflows and platform administration

- School Requests combines supply/furniture requests and repairs. Students must be excluded by navigation, route guards, callable authorization and Firestore rules, regardless of saved module settings or old participant links. Recheck the current active membership for every command. Never infer authority from editable staff profiles or school links.
- `functions/schoolWorkflows.js` is the authoritative writer for requests, protected photos, absence/coverage records and lesson feedback. Retain command IDs for retries, payload hashes, expected revisions, transactional conflict checks, immutable audit snapshots and tenant-scoped notifications. Clients may only mark their own notifications as read.
- Supplied quantities determine supply completion; repair completion and cancellation require an explanation. Archive only completed/cancelled requests. Teachers can request for their taught/homeroom classes; admins manage fulfilment. Photos are resized and restricted to three protected JPEG/PNG/WebP records, with no public download URLs.
- Absences create dated exceptions over the real weekly timetable. Never guess missing times, identify teachers by fuzzy names or rewrite the weekly schedule. Require explicit intervals before assigning a substitute, and check their absences, own lessons and other assignments inside the transaction. Cancellation restores unfinished weekly lessons while preserving completed coverage. Private absence notes stay out of public timetable records.
- Shared-plan feedback records the exact shared revision and remains separate from lesson paper and personal status. Only admins review; authors reply and resubmit. Admins cannot edit another author's plan. Preserve subsequent autosave, unshare/reshare, review history and separate system reopening events.
- New workflow pages use `.workflow-card` as their outer Nature reading surface; add it to both `surfaces.js` and the three adapter selector groups. Nested rows/history/inputs use stable seasonal dialog/control tints without another frost layer. Status inks have separate day/night palettes. `WorkflowDialog` uses `DialogPortal`, one body scrollport, fixed header/footer and keyboard containment.
- Platform admin Overview, Accounts and Schools share the same Nature source map. Outer `.padm-card` and `.padm-stat` surfaces use the established glass; chart/health/status inks must follow seasonal day/night tokens. Keep tables, identity/fact insets, search, sort, tooltips and selected/hover/focus states legible. The admin sidebar uses seasonal glass; do not retain an opaque full-page background or duplicate inset screen fades.
- Platform account/school dialogs use `DialogPortal`; sort menus use `FilterSelect`. A portalled filter popup computes a layer above its triggering dialog's ancestors, including high workflow overlays. Never style only its closed trigger or leave it behind the backdrop. Geometry remains in component CSS; Nature paint stays screen-scoped in `nature.css`.
- Workflow lists use server cursor pages. Search and filters cover the entire authorized collection, including older records, before result pagination. Never limit filters to loaded rows or treat a disclosure of that restriction as a fix. See §12.9 and `docs/school-workflows.md`.
- Shared lesson reviews require a canonical assignment in `lessonPlanReviews`; only that assigned school admin can change review status or submit an outcome. Claims/takeovers/releases are transactional and audited. Takeover requires an explicit reason. Authors see the reviewer; admins can filter by reviewer. A reviewing/archived item must not offer Start review; archived reviews offer Restore. A Reviewed feedback outcome archives only the admin inbox item, never the author's plan.
- Every feedback/reply/resubmission records the named actor, exact message, shared lifecycle and immutable revision in review history. `lessonPlanActivityCreated` consumes all history actions durably and idempotently, including author autosaves and system reopening. Keep incoming history/comments read cursors independent per user; do not mark unseen entries read on dialog mount or overwrite a newer event with an older delivery. Bell notices and top toasts supplement, rather than replace, the two unread dots. Notification navigation opens the relevant record.

### 12.9 Global filters, indexes and cached pagination

- Authorization and tenant scope come first; matching second; pagination of matches third. A text/status/class/type/date filter must find a record beyond the first page without asking the user to manually load unrelated records. Apply the same rule to dropdown option sources and joined reviewer fields.
- For School Requests and Coverage use `useWorkflowSearch` → the authenticated `workflowSearch` callable. `functions/workflowSearch.js` pushes an indexed selector and ownership/date constraints into Firestore, then evaluates all remaining predicates before returning matches. Full text uses normalized accent-insensitive words across the advertised fields. Firestore does not supply arbitrary substring search merely because a field has an index.
- Searches scan in bounded server batches (200 records, at most 800 per call); the client follows continuation automatically until it has 40 matches plus one lookahead or reaches the true end. A batch with zero matches and a continuation is NOT an empty result. Never silently truncate a search, expose unmatched/private source documents, or fetch an entire student/request collection into the browser as a shortcut.
- Add the required composite indexes to `firestore.indexes.json` with the query change, including teacher participant/owner variants and live invalidation queries. The emulator does not enforce indexes: deploy them and check production READY state before declaring the release ready. Query shape, ordering, inequality fields and document-ID direction must match the deployed index.
- Use exact field-plus-document-ID cursors, preserving timestamp nanoseconds. Test identical timestamps, first/last-page boundaries, empty intermediate scans and matches beyond both the first page and a scan batch. Test combined filters and cross-user/student/cross-school denial against the real callable, not only a local array predicate.
- Cache identity includes account, school, authoritative role/permissions and the complete normalized query. Keep verified results on return visits while revalidating; stop listeners on unmount, cancel stale responses, clear denied/revoked data and bound retained card data. Changing filters resets result paging; changing a record refreshes the ordered result from page one. Never display old-query rows under new filter controls.
- Shared-plan summaries currently cover the full collection before filtering. History filters must automatically continue through older history pages, keep sessions intact and label ongoing scans/errors; never claim a final empty result while older events remain. Existing complete small-collection views may filter before slicing their result pages; do not introduce a pre-filter limit when adding pagination.

### 12.10 Account scope, failed reads and acknowledged saves

- Include the authenticated UID, school, authoritative role/readiness and relevant permissions in data/cache scope. School links and cached documents are display seeds, never authority. Clear page selections, dialogs and provider data synchronously on an identity/tenant/role change. Old async work must not publish into the replacement scope. `useScopedState` rejects setters captured by a previous scope; `SchoolSession` remounts page/provider state at the authority boundary.
- A read error is not an empty successful dataset. Clear denied records, surface a visible error, and avoid presenting incomplete academic totals as reliable. Track independent subscription failures separately so a successful stream does not hide another failed stream. Metadata-sensitive initialization must subscribe with `includeMetadataChanges: true`; a cache snapshot alone must never create defaults, backfill accounts or decide data is missing.
- Keep task queries and rules consistent: students query only `role == student`, cannot read/change/delete staff-board tasks or rewrite task authorship. Validate legitimate updates in the emulator as well as denial cases; duplicated authorization functions can exceed the Firestore rule expression limit.
- Personal templates, reusable entries and personal topics require immutable `ownerUid`; query them by owner. School curriculum/topic sharing is explicit. Reconcile acknowledged cloud snapshots without restamping `updatedAt` or reviving known deletions. Unsent local drafts remain distinct. Teachers load school subject/stage mappings directly, without requiring an admin to visit settings first.
- Await cloud acknowledgement before closing a successful form, clearing a draft, caching a profile photo, or reporting success. Failed operations keep editable inputs and visible errors. Use a busy guard and retain an operation/record ID across an ambiguous retry. Commit related writes atomically where they represent one user action.
- The student directory and student pickers use the authenticated `workflowSearch` student path for combined full-scope matching. Include the class/name and assigned-course/name composite indexes. Follow sparse continuations automatically and page only matched results. Cache return visits start on page one with verified content retained during refresh. A newest-document listener cannot detect deletion of an older visible record; watch visible student IDs in bounded groups and explicitly refresh after local mutations.
- Preserve IDs as strings (including task IDs such as `tsk_...`). Date-only deadlines expire after their local calendar day, not at midnight UTC or at the start of that day. Never seed synthetic staff/profile records into a display to disguise a failed write, and never rename unrelated administrators during snapshot handling.
- App-wide QA is evidence-layered: unit/backend tests, real rule/callable emulator tests, lint/build, production index READY checks, isolated production query-plan probes, and cache-busted release/asset verification. Respect the owner's no-browser-testing instruction and identify the remaining interactive/visual boundary honestly.

### 12.11 Visible loading and verified return-visit caches

- Every async list/document must represent **not loaded, loading, verified data/empty, refreshing, and error** explicitly. Initial state is loading before the first render; `[]`/`null` alone is never evidence of emptiness, missing access, an unassigned reviewer, zero totals, or disabled sharing. Do not flash No comments/No history/No records, a create-first-record prompt, or a missing-document message before the relevant authorized server result arrives.
- Use `ReadStatus` for visible localized text plus an accessible status indicator during cold initial loads, offline reconnection, or unpopulated states. Warm verified content stays visible and updates silently in real time without flashing extra loading/refreshing indicators over cached data. A previously verified empty cache must show pending revalidation when reopened, not a final empty message. Use `emptyReadReady` for final empty/missing states, and also wait for related authority/directory streams. A search with more source batches/pages is still incomplete. Error states need a working retry that actually restarts the failed read; resetting unchanged filters is not a retry.
- Firestore listeners that use metadata must set `includeMetadataChanges: true`. `fromCache` and `hasPendingWrites` snapshots cannot establish complete results or overwrite acknowledged server data. Never promote partial disk cache to verified truth because four seconds elapsed or the browser went offline. Retain known verified content and explain offline/reconnecting status; otherwise keep a truthful pending state. Server-confirmed empty results/deletions must clear obsolete content.
- Use the scoped external stores in `features/schoolWorkflows/cloud.js` and `features/liveResource.js` for workflow collections/documents/directories, comments, and lesson history. Cache identity includes account, school, role/readiness/permissions and complete query/plan path. Return visits reuse verified results, reconnect/revalidate, and stop listeners on the last unsubscribe. Cache-only persistence must never grant access or hide permission errors. Transient failures preserve verified content with an error; denied/revoked access clears it immediately and invalidates all pending requests. A new school/account must never see old cached rows, selections, or callbacks.
- `historyReader.js` retains immutable loaded pages, exact timestamp/document-ID cursors and its anchored listener on return visits. Reopening must catch events written while closed without refetching the first page. Retain at most 500 events plus the baseline/lookahead while inactive, repair the paging cursor after trimming, and preserve older-record search/session behavior. Individual snapshots and administrative events must never be dropped from server history. The cache is bounded session memory; a full reload still performs a truthful first load.
- Bound inactive query caches without evicting active subscribers or the store just created for the current render. Prevent duplicate concurrent reads, ignore completions after unsubscribe/scope replacement, preserve timestamp nanoseconds, and prevent delayed page reads from reviving records already deleted or superseded by the live listener. Caching cannot change full-collection filter semantics from §12.9.
- Verify behavior with meaningful lifecycle tests: cold load, cache-only empty/partial, acknowledged empty, warm nonempty/empty reopening, updates while closed, old-page cursors, failed retry, transient failure, access revocation during an in-flight read, scope disposal, and bounded eviction. Render-check visible first-load/refresh/error states without a browser. Check both authors and admins for history/comments. Apply the same state rules to notices, request/coverage lists/details/photos/directories, materials/bookmarks, staff, classes/events, tasks, student directory/rosters, gradebook records/rankings, and timetable data. Gradebook (`useCourseRecords`) and roster lookups (`useStudentsByIds`) must preserve in-memory cached results across unmounts so Leaderboard and Course views render verified results immediately without blanking out or flashing loaders. Result footers must never show confusing batch limit numbers ("deri në 40 për faqe") that users mistake for total pages; single-page views show total count directly (`2 rezultate`) and hide pagination triggers. Blank person avatar silhouettes must be centered horizontally and vertically inside their container boxes with centered SVG margins. At scale (50,000+ students), never query or load the whole student directory into client state; school-wide aggregations like Leaderboard compute candidate ranks in memory (`calculateCandidateRanks`) and load only top student profiles (e.g. top 50 plus authenticated student) via `useStudentsByIds`, preserving true school-wide ranks. Student directory search and export must stream page-by-page with composite indexes and incremental progress tracking. Preserve existing layout and theme semantics; Nature status paint remains screen-scoped and the lesson paper is unchanged.


*Authored for the LumiSchool Design & Engineering Team. Keep this file updated as new components are added.*
