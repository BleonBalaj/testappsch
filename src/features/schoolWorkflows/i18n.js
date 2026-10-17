export const words = (language, english, albanian) => language === 'sq' ? albanian : english;
const statuses = {
  plan_assignment:['Lesson-plan reviewer assigned','U caktua kontrolluesi i planit'],plan_review:['Lesson-plan review status updated','U përditësua statusi i kontrollit'],
  plan_feedback:['New lesson-plan feedback','Komente të reja për planin'],plan_reply:['New lesson-plan reply','Përgjigje e re për planin'],
  plan_update:['Shared lesson plan updated','U përditësua plani i ndarë'],plan_share:['Lesson plan shared for review','U nda plani për kontroll'],
  plan_unshare:['Lesson-plan sharing stopped','U ndal ndarja e planit'],plan_resubmit:['Lesson plan resubmitted','U ridërgua plani për kontroll'],

  needed: ['Needed', 'E nevojshme'], in_progress: ['In progress', 'Në proces'], partial: ['Partially supplied', 'Pjesërisht e plotësuar'],
  completed: ['Completed', 'E përfunduar'], cancelled: ['Cancelled', 'E anuluar'],
  needs_cover: ['Needs cover', 'Pa zëvendësues'], assigned: ['Cover assigned', 'Zëvendësues i caktuar'], covered: ['Lesson covered', 'Ora u mbajt'],
  active: ['Active', 'Aktive'], supply: ['Supplies & furniture', 'Pajisje dhe mobilie'], repair: ['Repair', 'Riparim'],
  low: ['Low', 'I ulët'], normal: ['Normal', 'Normal'], urgent: ['Urgent', 'Urgjent'],
  feedback_provided: ['Feedback provided', 'Komente të dërguara'], changes_requested: ['Changes requested', 'Kërkohen ndryshime'],
  reviewed: ['Reviewed', 'I kontrolluar'], resubmitted: ['Resubmitted for review', 'Ridërguar për kontroll'],
  create: ['Created', 'U krijua'], update: ['Updated', 'U përditësua'], comment: ['Comment', 'Koment'],
  photo: ['Photo added', 'U shtua një fotografi'], archive: ['Archived', 'U arkivua'], restore: ['Restored', 'U rikthye'],
  cancel: ['Absence cancelled', 'Mungesa u anulua'], absence_cancelled: ['Absence cancelled', 'Mungesa u anulua'],
  feedback: ['Lesson-plan feedback', 'Komente për planin mësimor'], reply: ['Reply', 'Përgjigje'], resubmit: ['Resubmitted', 'U ridërgua'],
  request: ['School request updated', 'Kërkesa e shkollës u përditësua'], absence: ['Teacher absence recorded', 'U regjistrua mungesa e mësimdhënësit'],
  coverage: ['Lesson coverage updated', 'Zëvendësimi i orës u përditësua'],
};
export const workflowLabel = (language, key) => statuses[key]?.[language === 'sq' ? 1 : 0] || key;
const errors = {
  reviewAssigned: ['Another administrator is assigned. Use Take over and explain why to change the reviewer.', 'Është caktuar një administrator tjetër. Për ta ndryshuar, merreni përsipër kontrollin dhe shënoni arsyen.'],
  reviewerOnly: ['Assign this review to yourself before changing its status or sending a review outcome.', 'Merreni përsipër kontrollin para ndryshimit të statusit ose dërgimit të rezultatit.'],
  reviewChanged: ['The reviewer changed. Wait for the latest reviewer details and try again.', 'Kontrolluesi ka ndryshuar. Prisni të dhënat e fundit dhe provoni sërish.'],
  reviewArchived: ['This review is archived. Restore it before making another review decision.', 'Ky kontroll është arkivuar. Rikthejeni para një vendimi tjetër.'],
  reviewTransition: ['Start the review before archiving it. A completed review must be restored first.', 'Filloni kontrollin para arkivimit. Një kontroll i përfunduar duhet së pari të rikthehet.'],
  access: ['Your current school role does not permit this action.', 'Roli juaj në shkollë nuk e lejon këtë veprim.'],
  invalid: ['Check the required fields and try again.', 'Kontrolloni fushat e detyrueshme dhe provoni sërish.'],
  changed: ['This record changed while you were working. Close and reopen it to use the latest version.', 'Ky regjistrim ka ndryshuar ndërkohë. Mbylleni dhe hapeni sërish për versionin e fundit.'],
  date: ['Enter a valid date.', 'Shënoni një datë të vlefshme.'], dateRange: ['Choose an ordered date range of at most 31 days.', 'Zgjidhni një periudhë të rregullt deri në 31 ditë.'],
  items: ['Add between 1 and 25 items with unique lines.', 'Shtoni nga 1 deri në 25 artikuj në rreshta të veçantë.'],
  quantities: ['Use whole quantities: needed must be positive, and supplied must be between zero and needed.', 'Përdorni numra të plotë: sasia e nevojshme duhet të jetë pozitive, ndërsa ajo e siguruar nga zero deri te sasia e nevojshme.'],
  notFulfilled: ['Every item must be fully supplied before this request is completed.', 'Çdo artikull duhet të sigurohet plotësisht para përfundimit të kërkesës.'],
  resolution: ['Describe the repair or resolution before marking it completed.', 'Përshkruani riparimin ose zgjidhjen para se ta shënoni si të përfunduar.'],
  cancellationReason: ['Enter a cancellation reason in the resolution or instructions field.', 'Shënoni arsyen e anulimit në fushën e zgjidhjes ose të udhëzimeve.'],
  deliveredItem: ['Keep delivered items in the request so their supply history is preserved.', 'Mbani në kërkesë artikujt që janë siguruar, që të ruhet historiku i tyre.'],
  classMissing: ['The selected class no longer exists. Choose another class.', 'Klasa e zgjedhur nuk ekziston më. Zgjidhni një klasë tjetër.'],
  classAccess: ['Choose a class you teach or supervise as homeroom teacher.', 'Zgjidhni një klasë ku jepni mësim ose jeni kujdestar/e.'],
  assignee: ['Choose an active staff member.', 'Zgjidhni një anëtar aktiv të stafit.'],
  teacherUnavailable: ['The selected teacher is no longer an active teaching member.', 'Mësimdhënësi i zgjedhur nuk është më anëtar aktiv i stafit mësimor.'],
  archive: ['Only completed or cancelled requests can be archived by an administrator.', 'Administratori mund të arkivojë vetëm kërkesat e përfunduara ose të anuluara.'],
  archived: ['Restore this archived request before editing it.', 'Rikthejeni kërkesën e arkivuar para redaktimit.'],
  managed: ['An administrator is managing this request. Add a comment to request a change.', 'Këtë kërkesë po e menaxhon administratori. Shtoni një koment për të kërkuar ndryshim.'],
  photoLimit: ['Up to three photos may be attached to an active request.', 'Një kërkese aktive mund t’i bashkëngjiten deri në tri fotografi.'],
  photo: ['Choose a valid JPEG, PNG or WebP photo. The app resizes it before upload.', 'Zgjidhni një fotografi JPEG, PNG ose WebP. Aplikacioni e zvogëlon para ngarkimit.'],
  times: ['Enter explicit start and end times; end must be after start.', 'Shënoni orën e fillimit dhe të mbarimit; mbarimi duhet të jetë pas fillimit.'],
  sameTeacher: ['Choose a substitute other than the absent teacher.', 'Zgjidhni një zëvendësues tjetër nga mësimdhënësi që mungon.'],
  substituteAbsent: ['This substitute has a recorded absence during the lesson.', 'Zëvendësuesi ka mungesë të regjistruar gjatë kësaj ore.'],
  coverConflict: ['This substitute already covers another overlapping lesson.', 'Zëvendësuesi është caktuar në një orë tjetër që përkon në kohë.'],
  timetableConflict: ['This substitute already teaches during this time.', 'Zëvendësuesi ka mësim gjatë kësaj kohe.'],
  ambiguousSchedule: ['This teacher has timetable entries without clear start/end times. Correct those entries in Schedule before assigning cover.', 'Ky mësimdhënës ka orë pa fillim dhe mbarim të qartë. Plotësoni orarin para caktimit të zëvendësimit.'],
  absenceOverlap: ['An overlapping absence or lesson-coverage record already exists.', 'Ekziston tashmë një mungesë ose zëvendësim që përkon me këtë periudhë.'],
  absenceCancelled: ['This absence was cancelled. Reopen the list to see the latest records.', 'Kjo mungesë është anuluar. Rihapni listën për regjistrimet e fundit.'],
  tooManyLessons: ['This absence affects more than 200 lessons. Use shorter date ranges.', 'Kjo mungesë prek më shumë se 200 orë. Përdorni periudha më të shkurtra.'],
  planUnavailable: ['The absent teacher must share this plan with admins before it can be linked or viewed for cover.', 'Mësimdhënësi që mungon duhet ta ndajë këtë plan me administratorët para lidhjes ose shikimit për zëvendësim.'],
  notShared: ['This plan is no longer shared. Share it again to send feedback or replies.', 'Ky plan nuk është më i ndarë. Ndajeni sërish për të dërguar komente ose përgjigje.'],
  feedbackMissing: ['An administrator must provide feedback first.', 'Administratori duhet së pari të dërgojë komente.'],
  missing: ['This record is no longer available.', 'Ky regjistrim nuk është më i disponueshëm.'],
  retryMismatch: ['Start this action again with the current values.', 'Niseni sërish këtë veprim me vlerat aktuale.'],
  futureCompletion: ['A lesson can be marked covered after its scheduled end time.', 'Ora mund të shënohet si e mbajtur pas kohës së planifikuar të mbarimit.'],
};
export function workflowError(language, error) {
  return errors[error?.details?.key || error?.key]?.[language === 'sq' ? 1 : 0]
    || (error?.message && !['internal','INTERNAL','unknown','UNKNOWN'].includes(error.message) ? error.message : null)
    || words(language, 'The action could not be completed. Check your connection and school access, then try again.', 'Veprimi nuk u përfundua. Kontrolloni lidhjen dhe qasjen në shkollë, pastaj provoni sërish.');
}
export const workflowTime = (language, value) => {
  const date = value?.toDate?.() || new Date(value || 0);
  return date.getTime() ? new Intl.DateTimeFormat(language === 'sq' ? 'sq-AL' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', hourCycle:'h23', timeZone: 'Europe/Belgrade' }).format(date) : '';
};
export const schoolToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
