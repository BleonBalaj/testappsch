# Project instructions

Read `.agents/agents.md` before changing this app. It is the project's cumulative design and engineering manual. Its section 12 documents the Nature theme, dropdowns, modal layering and regression boundaries; `docs/nature-theme.md` provides the source map and renderer details.

## Required working rules

- Work in this primary checkout on `main`. Leave changes unstaged and uncommitted for GitHub Desktop. Do not create a branch/worktree or commit/push unless the owner requests it.
- Honor the owner's explicit request not to run browser testing. Use meaningful code, unit, integration/emulator, lint, build and deployment checks as appropriate; state the remaining visual verification boundary.
- Nature is an independent theme. Theme-only changes belong under `html.theme-nature`, within screen media. Do not modify other themes or lesson-plan preview/print/PDF surfaces.
- New filter menus must use `src/components/FilterSelect.jsx`, not native `<select>` menus when custom seasonal popup styling is required. Style the popup, selected/active/hover/focus states and night palette, not only the closed trigger.
- Full-screen dialogs and history drawers must use `src/components/DialogPortal.jsx` so their backdrop covers the sidebar and header and escapes page/card stacking contexts. Background scrolling/interaction, floating launchers, fades and Nature animation must be handled while open. Never try to fix an ancestor stacking context by only increasing a child's z-index.
- Preserve the owner's explicit action order: sharing is last in personal-plan list actions; in the editor it is immediately before the completion action, which stays last.
- Display consecutive shared-plan edits by the same actor/lifecycle as 30-minute sessions. Preserve individual immutable snapshots and keep sharing, unsharing, admin actions and system reopening events distinct.
- `public/version.json` is the release authority. Bump once after completing the change set, build/deploy manifest and assets together, wait for deployment completion, then verify the live release. A deployment does not authorize a Git commit.
