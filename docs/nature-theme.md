# Nature and application releases

## Origin and scope

Nature was ported from the owner's `MomentumHorizon00` checkout on October 15, 2026 (its release file read 2.5.150). The generated meadow, private MarchingCubes implementation, and vendored Three.js modules are copied exactly. `public/nature/vendor/three/LICENSE` is retained. No CDN or external scene dependencies are needed.

The editable scene sources live in `scripts/nature/prototype.html`, `scripts/build-nature-scene.cjs`, and the `scripts/nature-*.cjs` helpers. Run `npm run nature:build` after modifying those sources. Do not hand-edit the generated `public/nature/scene.html` or vendored Three.js files.

Reference scene SHA-256: `1406e065acfa9934c29f8778503e618cfdd98b1105af73f898b616e78a0524b5`.

## App integration

- `nature-reference.css` contains Horizon's seasonal palettes, glass materials, fades, and type treatments. The two broad heading/transition rules exclude lesson documents.
- `nature.css` adapts those materials to Noesis's named reading surfaces. It preserves existing dimensions, padding, corners, and layout. Both sheets apply only on screen and under `html.theme-nature`.
- Header controls use their own neutral opal-glass tokens scoped to `.main-header`, with charcoal daylight ink and pale night ink. Do not reuse the tan general-control fills for the header. Saved lesson entries retain the shared rounded radius, spacing between boxes, and independent day/night status-badge ink.
- Autumn Golden uses a lighter honey/peach secondary-control palette and page-title gradient stops four lightness points deeper than its original copper/rose. These overrides are local to that exact season and phase and do not change Horizon's fade tokens. Page-title count badges use a stable tinted surface and foreground ink across all Nature palettes. Course stat pills retain their original metric hue via `--co-stat-color`, mixing it into the readable foreground and dialog tint; the existing inline chart styling still applies in other themes.
- Staff profile panels are inset dialog surfaces: keep their shadows contained and reuse the dialog tint, rather than page-card elevation or nested frost. The profile has one padded, rounded scrollport, with header and actions outside it; do not allow broad shadows to accumulate into a clipped rectangular slab inside the scrollport.
- Noesis enables Horizon's top veil on private app pages too. Both veils keep Horizon's exact color variables, alpha, mask stops and full viewport width: the top uses `--nature-header-background` / `--nature-header-opacity`, 3.5rem height and its 40% mask stop; the bottom is inherited directly from `nature-reference.css`, using `--nature-fade-color` / `--nature-fade-opacity` and `min(14vh, 140px)`. This retains all seasonal/time palettes and the Summer Golden bottom-opacity exception. There is no sidebar inset or sidebar-width animation: the veils continue behind its glass. Messages, covering dialogs, and printing hide them. Do not substitute `--background`, or darken/filter/mask cards to create the edge fade.
- Regular Nature pages use document scrolling, like Horizon, instead of clipping backdrop-filtered cards inside a second viewport-height scroll container. Messages keep their existing bounded layout and internal scroll; navigation already resets both document and main scroll positions. The sidebar remains sticky.
- Lesson navigation tabs, language switches, list search, date inputs and filter triggers use Nature glass/control tokens, including active/hover/focus and night states. The search input stays transparent within its colored field. Shared-plan filters use `FilterSelect.jsx` with a portalled, rounded, solid seasonal popup and themed selected/keyboard-active states; native OS option menus cannot reliably provide that appearance. These rules do not select lesson documents.
- The editor's small subbar actions get a stable seasonal tint and foreground so labels remain readable over grass. Share/Unshare is the last personal-list action and the editor's penultimate action; completion stays last.
- `DialogPortal.jsx` mounts custom full-screen dialogs under `document.body`, outside page/card stacking and backdrop roots. Share, History, template/outcome confirmations, curriculum removal and Tasks use it. It locks background scroll, keeps the sidebar in place, makes the app background inert, restores focus/state and excludes its content from printing. `App.css` hides the floating launcher during any covering dialog. Standard nested `.modal-overlay` dialogs retain the existing manual sidebar blur; portalled dialogs blur it through their full viewport backdrop, without another sidebar filter.
- Nature's dialog observer and fade-hide selectors include custom overlay classes and both modal/alertdialog ARIA roles. The same scene pause/fade behavior applies to covering dialogs in any app section. Ordinary filter listboxes do not pause or dim the whole app.
- Shared-plan history displays consecutive updates from one actor and lifecycle in 30-minute sessions. The combined field list retains reverted/intermediate changes and access to every immutable saved version. Sharing/unsharing/admin/system actions stay distinct; an incomplete paginated session is identified and extended when more history loads. Raw audit documents are not rewritten by display grouping.
- Saved lesson boxes use a stretched native title button for their full-card open target. Individual action buttons remain above it, so Preview, Print, Duplicate and Archive retain their separate actions. Entering an editor resets document and main scroll once per plan/view change, and focuses its heading without scrolling; the lesson-unit input must not autofocus. Autosave updates to the same plan must not reset position.
- `surfaces.js` lists actual app reading surfaces for the entrance-animation and paused-layer helpers. Keep its list aligned with the card selectors in `nature.css` when introducing a new card type. Nested cards reuse their parent's frost.
- Entry fades mirror native Motion timing into distinct inherited, typed numeric factors and multiply those factors on each outer glass surface. Never clone multiple `opacity` animations onto a card: they replace each other and its own stagger. Keep the finished keyframe value until Motion acknowledges it inline, in both moving and paused scenery. Registered factor slots are reused between routes; leaving Nature removes all mirrors, markers and observers while retaining Motion's original animations. This only changes animation compositing, not card material or geometry.
- `NatureBackground.jsx` owns the same-origin iframe and validates both the source window and origin of incoming messages. It mirrors season/time changes, forwards exposed-meadow pointer movement, and pauses the renderer behind covering dialogs. Hidden-tab handling, the exact frozen frame, cat animation, seasonal scenery, and slow-device detection remain in the original renderer.
- The scene mounts only in Nature and is lazy-loaded. Reduced motion, disabled animations, save-data, and very slow connections use the seasonal CSS backdrop. Leaving Nature removes its iframe, observers, timers, and root attributes.
- Login and Settings share `ThemePicker`. Theme, season, and time-of-day preferences sync to `users/{uid}/preferences/app`; movement pause remains a per-device preference. Auto uses local date/time. The original Summer meadow also represents spring.

## Lesson-document boundary

`LessonPlanDocument.jsx` and `LessonPlans.css` remain the source of truth for the side preview and native Print/Save as PDF. Nature can tint the editor and preview panel around the white paper; it must not alter the paper, its blue headings, content, font sizes, or print layout. No Nature stylesheet applies in print media. Do not replace the established export path.

## Release version and update notices

`public/version.json` is the release authority. Vite embeds that version into the compiled app, so an old open tab can compare its actual running version against the deployed file. Checks bypass caches, run every ten minutes while visible, and also run on focus, visibility return, and reconnect. Malformed responses, offline states, and older CDN versions never trigger reload loops.

Settings shows the running version and a manual check button. A newer version produces one persistent update notice. Refresh is explicit and waits for all lesson autosave writes, including edits queued during an earlier write, plus other pending Firestore writes. A failure/timeout leaves the current app open. `requiresReload` is release metadata; this app intentionally does not force a reload while a user may be editing.

For a later completed change set, run `npm run version:patch` once, then test, build, and deploy the manifest and assets together. Do not bump the version on every build or deploy retry.

## Review and deployment

Work in this checkout on `main` and leave edits uncommitted for the owner to review/discard in GitHub Desktop. Do not automatically commit or push. Deployment does not require a Git commit. Deploy when requested with `cmd.exe /c "npx firebase-tools deploy"`; confirm completion and compare the live version file/assets with the build.

Verification for this port uses source inspection, unit tests, generator checks, production builds, and HTTP asset readback. The owner explicitly requested no browser testing; rendered appearance and browser transitions are not claimed as verified by those checks.
