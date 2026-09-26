# Lesson-plan data API

Import from `src/features/lessonPlans/index.js`.

`createPlan({ preferences, schoolData, scheduledLesson, teacherId, now })` creates a complete draft with `id: null`. It is pure for the same inputs. Call `repository.savePlan(plan)` to assign an ID and persist it. The plan shape uses `classLabel`, numeric `grade`, `section`, `subject`, `curricularArea`, `curriculumStage`, `areaManual`, `stageManual`, and the lesson document fields. See `plan.js` for every initialized field.

Autofill order for class and subject is **scheduled lesson → explicit teacher default → school default → last used if enabled**. Date comes from the schedule or today's date in the school time zone. Teacher and school information is snapshot data on the plan so later preference changes do not rewrite saved plans. Outcomes and lesson prose start empty; this module never invents curriculum content.

`parseClassLabel('VI/2')` returns `{ grade: 6, gradeLabel: 'VI', section: '2', classLabel: 'VI/2' }`. `stageForClass(label, { schoolStages })` uses the general Kosovo grade mapping, with validated school stage records overriding it. `getSubjectArea(subject, { schoolSubjects, classLabel })` uses validated school subject records before the built-in catalog. `listSubjects({ query, classLabel, schoolSubjects })` searches a merged list and applies school grade/class restrictions when supplied.

`changePlanSubject(plan, subject, { schoolSubjects, forceArea })` and `changePlanClass(plan, classLabel, { schoolStages, schoolSubjects, forceStage })` recompute derived fields while preserving all written content. If the teacher directly edits an area or stage, use `setPlanField(plan, 'curricularArea' | 'curriculumStage', value)` to mark it manual. `resetDerivedField` restores automatic calculation. `applyTopic(plan, topic, { confirmReplace })` returns `{ plan, needsConfirmation }`; it asks before replacing nonempty authored topic outcome text. `duplicatePlan(plan, { now, timeZone, date, teacherId })` creates an unsaved draft dated today (or the supplied date) and clears the previous reflection.

`getDateRange(preset, { today, now, timeZone, startDate, endDate })` returns inclusive `{ startDate, endDate }` strings. Presets are `today`, `yesterday`, `thisWeek`, `lastWeek`, `thisMonth`, `lastMonth`, `last7Days`, and `custom`. Weeks start Monday; the last seven days include today.

`createLessonPlanRepository(teacherId, { storage, schoolId, now })` exposes:

- Plans: `listPlans`, `getPlan(id)`, `savePlan(plan)`, `deletePlan(id)`, `setPlanStatus(id, status)`, `archivePlan(id)`, `restorePlan(id)`.
- Teacher preferences: `getPreferences`, `savePreferences(patch)`.
- Personal templates: `listTemplates`, `saveTemplate({ name, plan })`, `deleteTemplate(id)`.
- Personal suggestions: `listReusableEntries(kind?)`, `saveReusableEntry({ kind, value })`, `deleteReusableEntry(id)`. The UI's `{ type, text }` aliases are also accepted and returned.
- Two-month topics: `listTopics({ subject, classLabel, query, includeSchool })`, `saveTopic(topic, { scope, isAdmin })`, `deleteTopic(id, { scope, isAdmin })`. A topic stores `title`, `subject`, optionally `classLabel`, and `learningOutcome` (or the UI's `outcome` alias).
- Shared school records: `listSubjectMappings`, `saveSubjectMapping(mapping, { isAdmin: true })`, `deleteSubjectMapping(id, { isAdmin: true })`, plus equivalent stage mapping methods. Subject mapping fields are `name`, `area`, optional `grades`/`classes`/`aliases`.
- Storage health: `getStorageStatus()` reports parse/version/read errors. Writes refuse to overwrite damaged or newer-version data.

All saves return the saved record. Plan saves preserve `createdAt` on updates. A repository requires a stable teacher identity; the UI must provide it. Teacher records use a teacher-specific key; school mappings and shared topics use a school-specific key. The administrator flag is an interface guard only. This application currently has **no backend or verified login**, so browser localStorage cannot provide real authorization, cross-device persistence, or reliable backup. Data survives reopening the same browser/profile while storage remains intact; clearing storage or changing devices loses access. Connect this API to an authenticated database before promising school-wide or cross-device durability.
