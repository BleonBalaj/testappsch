# LumiSchool Design System & UI Architecture Manual

> **Purpose**: This document serves as the absolute single source of truth for all UI design patterns, styling standards, layout rules, color systems, modal architectures, form controls, and component interactions in **LumiSchool**. Follow these exact specifications to guarantee visual consistency and prevent UI bugs across all pages, modals, drawers, and interactive components.

---

## 1. Color System & Theme Tokens

LumiSchool supports **Dark Theme** (default) and **Light Theme** via `[data-theme='light']` with CSS variables in HSL format (`H S% L%`).

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
<div className="modal-overlay" onClick={onClose}>
  <motion.div 
    className="modal-content"
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
* **Modal Dimming Rule**: When ANY modal (`.modal-overlay`) or Search overlay (`.search-overlay.open`) is active, the sidebar MUST remain fixed in place, dimmed, and blurred without shifting or sliding off-screen:
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

*Authored for the LumiSchool Design & Engineering Team. Keep this file updated as new components are added.*
