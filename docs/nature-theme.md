# Nature and application releases

## Origin and scope

Nature was ported from the owner's `MomentumHorizon00` checkout on October 15, 2026 (its release file read 2.5.150). The generated meadow, private MarchingCubes implementation, and vendored Three.js modules are copied exactly. `public/nature/vendor/three/LICENSE` is retained. No CDN or external scene dependencies are needed.

The editable scene sources live in `scripts/nature/prototype.html`, `scripts/build-nature-scene.cjs`, and the `scripts/nature-*.cjs` helpers. Run `npm run nature:build` after modifying those sources. Do not hand-edit the generated `public/nature/scene.html` or vendored Three.js files.

Reference scene SHA-256: `1406e065acfa9934c29f8778503e618cfdd98b1105af73f898b616e78a0524b5`.

## App integration

- `nature-reference.css` contains Horizon's seasonal palettes, glass materials, fades, and type treatments. The two broad heading/transition rules exclude lesson documents.
- `nature.css` adapts those materials to Noesis's named reading surfaces. It preserves existing dimensions, padding, corners, and layout. Both sheets apply only on screen and under `html.theme-nature`.
- Header controls use their own neutral opal-glass tokens scoped to `.main-header`, with charcoal daylight ink and pale night ink. Do not reuse the tan general-control fills for the header. Saved lesson entries retain the shared rounded radius, spacing between boxes, and independent day/night status-badge ink.
- Noesis enables Horizon's top veil on private app pages too. Both veils keep Horizon's exact color variables, alpha, mask stops and full viewport width: the top uses `--nature-header-background` / `--nature-header-opacity`, 3.5rem height and its 40% mask stop; the bottom is inherited directly from `nature-reference.css`, using `--nature-fade-color` / `--nature-fade-opacity` and `min(14vh, 140px)`. This retains all seasonal/time palettes and the Summer Golden bottom-opacity exception. There is no sidebar inset or sidebar-width animation: the veils continue behind its glass. Messages, covering dialogs, and printing hide them. Do not substitute `--background`, or darken/filter/mask cards to create the edge fade.
- Regular Nature pages use document scrolling, like Horizon, instead of clipping backdrop-filtered cards inside a second viewport-height scroll container. Messages keep their existing bounded layout and internal scroll; navigation already resets both document and main scroll positions. The sidebar remains sticky.
- Lesson navigation tabs, language switches, list search, date inputs and filter selects use Nature glass/control tokens, including active/hover/focus and night states. The search input stays transparent within its colored field; native option menus use the dialog palette. These rules do not select lesson documents.
- Saved lesson boxes use a stretched native title button for their full-card open target. Individual action buttons remain above it, so Preview, Print, Duplicate and Archive retain their separate actions. Entering an editor resets document and main scroll once per plan/view change, and focuses its heading without scrolling; the lesson-unit input must not autofocus. Autosave updates to the same plan must not reset position.
- `surfaces.js` lists actual app reading surfaces for the entrance-animation and paused-layer helpers. Keep its list aligned with the card selectors in `nature.css` when introducing a new card type. Nested cards reuse their parent's frost.
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
