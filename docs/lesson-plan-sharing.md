# Lesson-plan sharing and review

Sharing is scoped to the selected school. Teachers, department heads, and admins can share their own plans with that school's admins. Other teachers and students cannot read them. Admins have read-only access to another author's currently shared plan.

Admins open the school inbox through **Shared plans / Planet e ndara** in the top action row, immediately after New plan. Personal plans, templates and planning settings retain their separate tab group. History drawers use the full-viewport `DialogPortal`; its scroll lock clips body overflow without creating a new body scroll container, so the sticky sidebar stays in place behind the backdrop when opening history from a scrolled plan list.

## Records

- `schools/{schoolId}/lessonPlans/{planId}`: the author's canonical content, identified by immutable Firebase Auth `ownerUid`. The local repository remains an offline working copy; cloud saves are acknowledged before sharing.
- `lessonPlanShares/{planId}`: the current sharing relationship, including author identity, server sharing timestamp, lifecycle token, revision ID, and sharing cycle number. Deleted on unshare.
- `lessonPlanInbox/{planId}`: searchable metadata and admin review status (`pending`, `reviewing`, `archived`). Deleted on unshare. The active inbox subscribes only to pending/reviewing records. Content is fetched only when opened.
- `lessonPlanReviewHistory/{planId}`: persistent history directory and latest metadata. It retains the last admin review status across unsharing so resharing can explain an automatic reopening.
- `lessonPlanReviewHistory/{planId}/events/{eventId}`: immutable audit records containing the actor's UID/email/name, action, server timestamp, prior review state, sharing token, revision, and exact plan snapshot.

## Atomic saves and history

The history UI combines consecutive edits by the same actor and sharing lifecycle into windows of at most 30 minutes, anchored at the newest edit. One session shows the combined changed-field list, before/final values, reverted/intermediate changes, and access to each recorded version. Share, unshare, reshare, review and automatic reopening remain separate events. History fetches bounded pages and flags a session that continues in earlier history; loading earlier entries extends that session. This presentation does not rewrite or discard immutable audit records.

Authors and admins use the same searchable history component. Filters combine person (including automatic system actions), action, review status at the time, and action-date presets or an inclusive custom date range. Search ignores accents and covers actor identity, translated action/status names, plan titles/subjects and changed field names/values, including intermediate and reverted changes. All criteria must match the same event; the complete session is displayed when that event matches. Event dates use the app's Europe/Belgrade timezone, matching other lesson-plan date filters.

The reader loads cursor pages of 100 events with a lookahead for correct baselines. A live query is anchored at the first page's oldest document, so new activity cannot slide older records out of a limited listener and create gaps. Active filters automatically scan earlier pages, with progress and an explicit incomplete-search/retry state if a page fails. Clearing filters preserves already loaded records. Access errors clear retained history, and disposal ignores requests from a previously selected school or plan. This uses only the existing single-field timestamp index.

The shared-plan writer updates canonical content, sharing revision, pending inbox entry, history directory, and immutable history snapshot in one Firestore transaction. A transaction retries if another device unshares or an admin reviews concurrently. Private edits after unsharing do not enter history. Share/unshare/review transactions also write their log entries atomically.

An edit to an archived shared plan or a reshare after an archived review returns it to pending. An additional system event explicitly records the automatic reopening. A reshare increments the cycle and changes the lifecycle token; old review actions cannot archive this new lifecycle. Repeated share calls while already shared are idempotent and do not reset a review.

Rules enforce actor identity, server timestamps, snapshot equality with canonical content, immutable event documents, and the required matching transaction records. Authors cannot set admin review statuses or impersonate admins. System entries are only permitted alongside their matching automatic reopening transaction. An admin review transaction rejects stale sharing tokens or revisions. The UI also waits for matching content and inbox timestamps before exposing review actions.

## Meaning of archiving

Archiving a review affects only the school's shared-plan inbox. It never changes the author's plan status or removes the plan from My plans. This distinction appears in both the admin review guidance and the author's history panel.

The stored states remain `pending`, `reviewing`, and `archived`. Albanian labels are “Në pritje të kontrollit”, “Në kontroll”, and “I arkivuar”; actions are “Fillo kontrollin”, “Arkivo nga lista”, and “Rikthe në pritje të kontrollit”. Filter labels use the plural separately. Small amber, teal and slate badge tints distinguish these states in the inbox, open review and history, with specific readable Nature day/night inks. Color is supplementary to the written status.

Unsharing closes access to the current plan. Previously shared snapshots and audit history remain available to the author and school admins, including in the admin inbox's All shared-plan history filter. The sharing confirmation explains this before the user shares. History starts when a plan is first shared; private changes before sharing or between sharing periods are not logged.

## Existing plans and school switching

The lazy callable `prepareLessonPlanOwnership` upgrades legacy email-owned plans only for the authenticated account's authoritative email and an active authorized school membership (or school creator). It never replaces an existing owner UID. A per-account/school completion marker avoids repeating the scan. Client queries then filter on the permanent owner UID. School changes dispose of listeners and clear open plans/history.

## Checks

`npm run test:rules` runs the actual browser sharing-store transactions against the Firestore emulator. It covers private ownership, teacher/admin sharing, read-only admin access, immutable history, archived reshares, system log entries, stale reviews, concurrent autosave/unshare, cross-school denial, and plan-ID takeover prevention.

The Firestore emulator needs Java 21. On this Windows installation, Java is under `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`. If its Unix socket loopback fails, set `JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true -Djdk.net.unixdomain.tmpdir=C:\Windows\Temp` for the test process only.
