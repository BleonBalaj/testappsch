import { reviewCommand } from './lessonReview.js';
import { searchWorkflow } from './workflowSearch.js';
import { createHash } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { WorkflowError, fail, id, text, validDate, datesBetween, requestFields, interval, clock, explicitInterval, matchesTeacher, absenceCovers, assertCoverAvailable } from './schoolWorkflowCore.js';
import { mergeCourseSchedule } from './workflowSchedule.js';

const rows = snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
const digest = value => createHash('sha256').update(value).digest('hex');
const teaching = member => member?.status === 'active' && ['teacher', 'dept_head', 'admin'].includes(member.role);
const dayName = date => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${date}T12:00Z`).getUTCDay()];
const shifted = (date, days) => new Date(Date.parse(`${date}T12:00Z`) + days * 86400000).toISOString().slice(0, 10);
function checkRevision(current, expected) { if (!current || current.revision !== expected) fail('changed'); }
function classAllowed(group, actor, courses, staff) {
  const self = staff.find(person => person.id === actor.uid) || actor;
  return group.homeroomTeacherId === actor.uid || courses.some(course => course.classGroupId === group.id && matchesTeacher(course, self));
}
function teacherFor(uid, members, staff, school) {
  const member = members.find(member => member.id === uid);
  if (!teaching(member) && school.creatorUid !== uid) fail('teacherUnavailable');
  return { ...member, ...staff.find(person => person.id === uid), id: uid, uid };
}
function recordEvent(tx, ref, commandId, actor, action, at, before, after, note = '') {
  tx.set(ref.collection('events').doc(commandId), { actorUid: actor.uid, actorName: actor.name, action, at, before: before || null, after: after || null, note });
}
function notice(tx, school, commandId, at, recipientUids, kind, title, target, recordId) {
  const recipients = [...new Set(recipientUids.filter(Boolean))];
  if (recipients.length) tx.set(school.collection('workflowNotices').doc(commandId), { recipientUids: recipients, kind, title, target, recordId, at, readBy: {} });
}

// Exported dependency injection is used by real Firestore transaction integration
// tests. Production always supplies the trusted Admin SDK database and identity.
export async function executeSchoolWorkflow(db, request, account, timestamp) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (account.disabled) fail('access');
  const data = request.data || {};
  const schoolId = id(data.schoolId), action = text(data.action, 60, true);
  const school = db.doc(`schools/${schoolId}`);
  const actor = { uid, email: String(account.email || '').toLowerCase(), name: String(account.displayName || account.name || account.email || uid).slice(0, 200) };
  const moduleId = ['workflowDirectory','workflowSearch'].includes(action) ? data.module : action.startsWith('request') ? 'school-requests' : (action.startsWith('feedback') || action.startsWith('review')) ? 'lesson-plans' : 'coverage';
  if (!['school-requests', 'lesson-plans', 'coverage','students'].includes(moduleId) || (moduleId==='students'&&(action!=='workflowSearch'||data.kind!=='students'))) fail('invalid');
  const readOnly = ['coveragePlan', 'workflowDirectory', 'workflowSearch'].includes(action);
  const commandId = readOnly ? '' : id(data.commandId);
  if (!readOnly && !/^[0-9a-f-]{36}$/i.test(commandId)) fail('invalid');
  const hash = digest(JSON.stringify({ ...data, commandId: undefined }));
  return db.runTransaction(async tx => {
    const [schoolSnap, memberSnap, command] = await Promise.all([
      tx.get(school), tx.get(school.collection('members').doc(uid)),
      readOnly ? null : tx.get(school.collection('workflowCommands').doc(`${uid}_${commandId}`)),
    ]);
    const schoolData = schoolSnap.data(), member = memberSnap.data();
    const admin = Boolean(schoolData && (schoolData.creatorUid === uid || (member?.status === 'active' && member.role === 'admin')));
    const directoryRead=moduleId==='students'&&member?.status==='active'&&['students','classes','messages','leaderboard'].some(name=>(schoolData?.rolePermissions?.[member.role==='student'?'student':'teacher']?.[name]??(name!=='students'||member.role!=='student'))===true);
    if (!schoolData || (!admin && !directoryRead && (member?.status !== 'active' || member.role === 'student'
      || schoolData.rolePermissions?.teacher?.[moduleId] === false
      || (moduleId !== 'school-requests' && !teaching(member))))) fail('access');
    if (command?.exists) {
      if (command.data().hash !== hash) fail('retryMismatch');
      return command.data().result;
    }
    const at = timestamp();
    let result;
    if (action === 'workflowSearch') return searchWorkflow(tx, school, data, actor, admin);
    if (action === 'workflowDirectory') {
      const [memberSnap, staffSnap, groupSnap, courseSnap] = await Promise.all([
        tx.get(school.collection('members')), tx.get(school.collection('staff')), tx.get(school.collection('classGroups')), tx.get(school.collection('classes')),
      ]);
      const members = rows(memberSnap), staff = rows(staffSnap), courses = rows(courseSnap);
      return {
        staff: admin || moduleId === 'coverage' ? members.filter(person => person.status === 'active' && person.role !== 'student').map(person => ({
          id: person.id, name: staff.find(entry => entry.id === person.id)?.name || person.name || person.id, role: person.role,
        })) : [],
        classes: rows(groupSnap).filter(group => admin || classAllowed(group, actor, courses, staff)).map(group => ({ id: group.id, label: group.label, room: group.room || '' })),
        filterClasses: moduleId === 'school-requests' ? rows(groupSnap).map(group => ({ id: group.id, label: group.label })) : [],
        courses: admin && moduleId === 'coverage' ? courses.map(course => ({ id: course.id, name: course.name, teacherId: course.teacherId || '', classGroupId: course.classGroupId || '' })) : [],
      };
    }
    if (action.startsWith('request')) {
      const requestId = id(data.recordId || commandId), ref = school.collection('schoolRequests').doc(requestId);
      const current = (await tx.get(ref)).data();
      if (action === 'requestCreate' ? current : !current) fail(action === 'requestCreate' ? 'exists' : 'missing');
      if (current && !admin && !current.participantUids.includes(uid)) fail('access');
      if (current) checkRevision(current, data.expectedRevision);
      const input = data.input || {};
      if (action === 'requestPhoto') {
        if (!admin && current.createdByUid !== uid) fail('access');
        if (current.archived || current.photoCount >= 3) fail('photoLimit');
        const photo = input.photo;
        if (!photo || !/^image\/(jpeg|png|webp)$/.test(photo.type) || typeof photo.base64 !== 'string' || photo.base64.length > 550000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo.base64)) fail('photo');
        const bytes = Buffer.from(photo.base64, 'base64');
        const valid = photo.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : photo.type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
            : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
        if (!valid || bytes.length > 400000 || bytes.length < 12) fail('photo');
        tx.set(ref.collection('photos').doc(commandId), { type: photo.type, base64: photo.base64, name: text(photo.name || 'Photo', 180), actorUid: uid, at });
        tx.update(ref, { photoCount: (current.photoCount || 0) + 1, revision: current.revision + 1, updatedAt: at });
        recordEvent(tx, ref, commandId, actor, 'photo', at, null, null, photo.name || 'Photo');
      } else if (action === 'requestComment') {
        const note = text(input.note, 4000, true);
        const members = rows(await tx.get(school.collection('members')));
        recordEvent(tx, ref, commandId, actor, 'comment', at, null, null, note);
        tx.update(ref, { revision: current.revision + 1, updatedAt: at });
        notice(tx, school, commandId, at, [schoolData.creatorUid, ...members.filter(person => person.status === 'active' && person.role === 'admin').map(person => person.id), ...current.participantUids].filter(person => person !== uid), 'request', current.title, 'school-requests', requestId);
      } else if (action === 'requestArchive') {
        if (!admin || !['completed', 'cancelled'].includes(current.status)) fail('archive');
        const archived = input.archived === true;
        tx.update(ref, { archived, revision: current.revision + 1, updatedAt: at });
        recordEvent(tx, ref, commandId, actor, archived ? 'archive' : 'restore', at, null, null);
      } else if (['requestCreate', 'requestUpdate'].includes(action)) {
        if (current?.archived) fail('archived');
        if (!admin && current && (current.createdByUid !== uid || current.status !== 'needed')) fail('managed');
        const fields = requestFields(input, current);
        if (fields.status === 'cancelled' && !fields.resolution) fail('cancellationReason');
        if (!admin && (fields.assigneeUid || fields.items.some(item => item.provided) || !['needed', 'cancelled'].includes(fields.status))) fail('access');
        if (current?.items.some(item => item.provided > 0 && !fields.items.some(next => next.id === item.id))) fail('deliveredItem');
        const [groupSnapshot, staffSnapshot, membersSnapshot, coursesSnapshot] = await Promise.all([
          fields.classGroupId ? tx.get(school.collection('classGroups').doc(fields.classGroupId)) : null,
          tx.get(school.collection('staff')), tx.get(school.collection('members')), tx.get(school.collection('classes')),
        ]);
        const staff = rows(staffSnapshot), members = rows(membersSnapshot), courses = rows(coursesSnapshot);
        const group = groupSnapshot?.exists ? { ...groupSnapshot.data(), id: groupSnapshot.id } : null;
        if (fields.classGroupId && !group) fail('classMissing');
        if (!admin && (!group || !classAllowed(group, actor, courses, staff))) fail('classAccess');
        if (fields.assigneeUid && !members.some(person => person.id === fields.assigneeUid && person.status === 'active' && person.role !== 'student')) fail('assignee');
        const saved = { ...fields, id: requestId, classLabel: group?.label || '', assigneeName: staff.find(person => person.id === fields.assigneeUid)?.name || members.find(person => person.id === fields.assigneeUid)?.name || '',
          createdByUid: current?.createdByUid || uid, createdByName: current?.createdByName || actor.name, createdAt: current?.createdAt || at,
          participantUids: [...new Set([current?.createdByUid || uid, fields.assigneeUid].filter(Boolean))],
          revision: (current?.revision || 0) + 1, photoCount: current?.photoCount || 0, archived: false, updatedAt: at };
        tx.set(ref, saved); recordEvent(tx, ref, commandId, actor, current ? 'update' : 'create', at, current, saved);
        const admins = members.filter(person => person.status === 'active' && person.role === 'admin').map(person => person.id);
        notice(tx, school, commandId, at, [schoolData.creatorUid, ...admins, saved.createdByUid, saved.assigneeUid].filter(person => person !== uid), 'request', saved.title, 'school-requests', requestId);
      } else fail('invalid');
      result = { id: requestId };
    } else if (action.startsWith('review')) {
      result=await reviewCommand(tx,school,data,actor,admin,at,commandId);
    } else if (action.startsWith('feedback')) {
      const planId = id(data.planId), planRef = school.collection('lessonPlans').doc(planId), historyRef = school.collection('lessonPlanReviewHistory').doc(planId);
      const [planSnap, shareSnap, inboxSnap, summarySnap, historySnap, reviewSnap] = await Promise.all([
        tx.get(planRef), tx.get(school.collection('lessonPlanShares').doc(planId)), tx.get(school.collection('lessonPlanInbox').doc(planId)),
        tx.get(school.collection('lessonPlanFeedback').doc(planId)), tx.get(historyRef), tx.get(school.collection('lessonPlanReviews').doc(planId)),
      ]);
      const plan = planSnap.data(), share = shareSnap.data(), inbox = inboxSnap.data(), summary = summarySnap.data(), history = historySnap.data();
      const ownerUid = history?.ownerUid || plan?.ownerUid;
      if (!ownerUid || (!admin && ownerUid !== uid)) fail('access');
      if (!plan || !share || !inbox) fail('notShared');
      if (share.revisionId !== data.revisionId || share.shareToken !== data.shareToken) fail('changed');
      const message = text(data.message || '', 6000, action !== 'feedbackResubmit');
      let outcome = summary?.outcome || '', eventAction;
      if (action === 'feedbackComment') {
        if(ownerUid!==uid&&reviewSnap.data()?.reviewerUid!==uid)fail('reviewerOnly');
        eventAction='comment';outcome='comment';
      } else if (action === 'feedbackReview') {
        if (reviewSnap.data()?.reviewerUid !== uid) fail('reviewerOnly');
        if (!admin || !['feedback_provided', 'changes_requested', 'reviewed'].includes(data.outcome)) fail('access');
        outcome = data.outcome; eventAction = 'feedback';
      } else if (action === 'feedbackReply') {
        if (ownerUid !== uid && reviewSnap.data()?.reviewerUid !== uid) fail('reviewerOnly');
        if (!summary) fail('feedbackMissing'); eventAction = 'reply';
      } else if (action === 'feedbackResubmit') {
        if (ownerUid !== uid || !summary) fail('access'); outcome = 'resubmitted'; eventAction = 'resubmit';
      } else fail('invalid');
      if (eventAction === 'feedback' && inbox.reviewStatus === 'archived') fail('reviewArchived');
      const reviewStatus = eventAction === 'resubmit' ? 'pending' : eventAction === 'feedback' ? (outcome === 'reviewed' ? 'archived' : 'reviewing') : inbox.reviewStatus;
      const entry = { actorUid: uid, actorName: actor.name, actorEmail: actor.email, at, message, action: eventAction, outcome,
        revisionId: share.revisionId, shareToken: share.shareToken };
      const summaryRef = school.collection('lessonPlanFeedback').doc(planId);
      tx.set(summaryRef.collection('messages').doc(commandId), entry);
      tx.set(summaryRef, { ownerUid, outcome:eventAction==='comment'?(summary?.outcome||'comment'):outcome, revisionId: ['reply','comment'].includes(eventAction) ? (summary?.revisionId||share.revisionId) : share.revisionId, shareToken: share.shareToken, updatedAt: at });
      tx.update(school.collection('lessonPlanInbox').doc(planId), { reviewStatus, lastEventId: commandId,
        ...(eventAction === 'feedback' ? { reviewedByUid:uid, reviewedAt:at } : {}),
        ...(eventAction === 'resubmit' ? { reviewedByUid: '', reviewedAt: null } : {}) });
      tx.set(school.collection('lessonPlanReviews').doc(planId),{ownerUid,reviewStatus,historyAt:at,historyEventId:commandId},{merge:true});
      tx.set(historyRef.collection('events').doc(commandId), { planId, ownerUid, actorUid: uid, actorName: actor.name, actorEmail: actor.email,
        action: eventAction, at, shareToken: share.shareToken, revisionId: share.revisionId, reviewStatus, previousReviewStatus: inbox.reviewStatus, plan,
        feedback: { message, outcome } });
      tx.update(historyRef, { lastEventId: commandId, lastEventAt: at, lastAction: eventAction, lastReviewStatus: reviewStatus });
      if (eventAction === 'resubmit' && inbox.reviewStatus === 'archived') tx.set(historyRef.collection('events').doc(`${commandId}-reopen`), {
        planId, ownerUid, actorUid: 'system', actorName: 'System', actorEmail: '', action: 'auto_reopen', at,
        shareToken: share.shareToken, revisionId: share.revisionId, reviewStatus: 'pending', previousReviewStatus: 'archived', plan,
      });
      // Durable history-event delivery produces notifications and unread cursors.
      result = { id: planId };
    } else {
      if (action === 'coveragePlan') {
        const cover = (await tx.get(school.collection('lessonCoverage').doc(id(data.recordId)))).data();
        if (!cover || (!admin && (cover.substituteUid !== uid || !['assigned', 'covered'].includes(cover.status)))) fail('access');
        if (!cover.planId) fail('planUnavailable');
        const [plan, share] = await Promise.all([tx.get(school.collection('lessonPlans').doc(cover.planId)), tx.get(school.collection('lessonPlanShares').doc(cover.planId))]);
        if (!plan.exists || !share.exists || plan.data().ownerUid !== cover.teacherUid) fail('planUnavailable');
        return { plan: plan.data() };
      }
      if (!admin) fail('access');
      const absenceId = id(data.absenceId || commandId), absenceRef = school.collection('teacherAbsences').doc(absenceId);
      const absence = (await tx.get(absenceRef)).data();
      const input = data.input || {};
      const rangeFrom = action === 'absenceCreate' ? validDate(input.from) : absence?.from;
      const rangeTo = action === 'absenceCreate' ? validDate(input.to) : absence?.to;
      if (!rangeFrom || !rangeTo) fail('missing');
      const [membersSnap, staffSnap, coursesSnap, entriesSnap, absencesSnap, coversSnap] = await Promise.all([
        tx.get(school.collection('members')), tx.get(school.collection('staff')), tx.get(school.collection('classes')), tx.get(school.collection('scheduleEntries')),
        tx.get(school.collection('teacherAbsences').where('from', '>=', shifted(rangeFrom, -31)).where('from', '<=', rangeTo)),
        tx.get(school.collection('lessonCoverage').where('date', '>=', rangeFrom).where('date', '<=', rangeTo)),
      ]);
      const members = rows(membersSnap), staff = rows(staffSnap), courses = rows(coursesSnap), absences = rows(absencesSnap), covers = rows(coversSnap);
      const weekly = mergeCourseSchedule(courses, rows(entriesSnap));
      const admins = [schoolData.creatorUid, ...members.filter(person => person.role === 'admin' && person.status === 'active').map(person => person.id)];
      if (action === 'absenceCreate') {
        if (absence) fail('exists');
        const teacher = teacherFor(id(input.teacherUid), members, staff, schoolData), dates = datesBetween(rangeFrom, rangeTo);
        if (Boolean(input.startTime) !== Boolean(input.endTime)) fail('times');
        const times = input.startTime ? explicitInterval(input.startTime, input.endTime) : null;
        const draft = { id: absenceId, teacherUid: teacher.id, teacherName: teacher.name || teacher.email || teacher.id,
          from: rangeFrom, to: rangeTo, startTime: times ? input.startTime : '', endTime: times ? input.endTime : '',
          reason: text(input.reason || '', 2000), status: 'active', revision: 1, createdAt: at, updatedAt: at, createdByUid: uid };
        if (absences.some(other => other.teacherUid === teacher.id && dates.some(date => absenceCovers(other, date, times || { start: 0, end: 1440 })))) fail('absenceOverlap');
        const affected = dates.flatMap(date => (weekly[dayName(date)] || []).filter(lesson => !lesson.isEvent && matchesTeacher(lesson, teacher, courses)
          && absenceCovers(draft, date, interval(lesson.time))).map(lesson => ({ ...lesson, date })));
        if (affected.length > 200) fail('tooManyLessons');
        for (const lesson of affected) {
          const coverId = digest(`${lesson.date}:${lesson.id}`).slice(0, 40);
          if (covers.some(cover => cover.id === coverId && cover.status !== 'cancelled')) fail('absenceOverlap');
          const cover = { id: coverId, absenceId, date: lesson.date, slotId: lesson.id, courseId: lesson.courseId || '', classGroupId: lesson.classGroupId || '',
            classLabel: lesson.classLabel || '', subject: lesson.subject || '', room: lesson.room || '', time: lesson.time || '', teacherUid: teacher.id, teacherName: draft.teacherName,
            startTime: interval(lesson.time).start !== null ? `${String(Math.floor(interval(lesson.time).start / 60)).padStart(2,'0')}:${String(interval(lesson.time).start % 60).padStart(2,'0')}` : '',
            endTime: interval(lesson.time).end !== null ? `${String(Math.floor(interval(lesson.time).end / 60)).padStart(2,'0')}:${String(interval(lesson.time).end % 60).padStart(2,'0')}` : '',
            substituteUid: '', substituteName: '', status: 'needs_cover', planId: '', participantUids: [teacher.id], revision: 1, createdAt: at, updatedAt: at };
          const ref = school.collection('lessonCoverage').doc(coverId);
          tx.set(ref, cover); recordEvent(tx, ref, commandId, actor, 'create', at, null, cover);
        }
        tx.set(absenceRef, { ...draft, lessonCount: affected.length });
        recordEvent(tx, absenceRef, commandId, actor, 'create', at, null, { ...draft, lessonCount: affected.length });
        notice(tx, school, commandId, at, [teacher.id, ...admins].filter(person => person !== uid), 'absence', draft.teacherName, 'coverage', absenceId);
        result = { id: absenceId, lessonCount: affected.length };
      } else if (action === 'coverageAdd') {
        checkRevision(absence, data.expectedRevision);
        if (absence.status !== 'active') fail('absenceCancelled');
        const date = validDate(input.date), times = explicitInterval(input.startTime, input.endTime);
        if (date < absence.from || date > absence.to || !absenceCovers(absence, date, times)) fail('dateRange');
        const course = courses.find(course => course.id === input.courseId);
        const teacher = teacherFor(absence.teacherUid, members, staff, schoolData);
        if (!course || !matchesTeacher(course, teacher)) fail('classAccess');
        if (covers.some(cover => cover.date === date && cover.courseId === course.id && cover.startTime === input.startTime && cover.status !== 'cancelled')) fail('absenceOverlap');
        const coverId = digest(`${date}:manual:${course.id}:${input.startTime}`).slice(0,40);
        const cover = { id:coverId, absenceId, date, slotId:`manual:${course.id}:${input.startTime}`, courseId:course.id,
          classGroupId:course.classGroupId || '', classLabel:course.classLabel || '', subject:course.name || '', room:course.room || '',
          time:`${input.startTime}–${input.endTime}`, startTime:input.startTime, endTime:input.endTime,
          teacherUid:absence.teacherUid, teacherName:absence.teacherName, substituteUid:'', substituteName:'', status:'needs_cover',
          planId:'', participantUids:[absence.teacherUid], revision:1, createdAt:at, updatedAt:at };
        const ref = school.collection('lessonCoverage').doc(coverId);
        tx.set(ref,cover); recordEvent(tx,ref,commandId,actor,'create',at,null,cover);
        tx.update(absenceRef,{ lessonCount:(absence.lessonCount || 0)+1, revision:absence.revision+1, updatedAt:at });
        recordEvent(tx,absenceRef,commandId,actor,'update',at,absence,{ ...absence,lessonCount:(absence.lessonCount || 0)+1 });
        notice(tx,school,commandId,at,[absence.teacherUid].filter(person => person !== uid),'coverage',cover.subject,'coverage',coverId);
        result = { id:coverId };
      } else if (action === 'absenceCancel') {
        checkRevision(absence, data.expectedRevision);
        if (absence.status !== 'active') fail('changed');
        text(input.note, 2000, true);
        const affected = covers.filter(cover => cover.absenceId === absenceId && ['needs_cover', 'assigned'].includes(cover.status));
        for (const cover of affected) {
          const ref = school.collection('lessonCoverage').doc(cover.id);
          tx.update(ref, { status: 'cancelled', restoredWeekly: true, substituteUid: '', substituteName: '', participantUids: [cover.teacherUid], revision: cover.revision + 1, updatedAt: at });
          recordEvent(tx, ref, commandId, actor, 'absence_cancelled', at, cover, null, text(input.note || '', 2000));
        }
        tx.update(absenceRef, { status: 'cancelled', revision: absence.revision + 1, updatedAt: at });
        recordEvent(tx, absenceRef, commandId, actor, 'cancel', at, absence, null, text(input.note || '', 2000));
        notice(tx, school, commandId, at, [...affected.map(cover => cover.substituteUid), absence.teacherUid].filter(person => person !== uid), 'absence_cancelled', absence.teacherName, 'coverage', absenceId);
        result = { id: absenceId };
      } else if (action === 'coverageUpdate') {
        const cover = covers.find(cover => cover.id === data.recordId && cover.absenceId === absenceId);
        checkRevision(cover, data.expectedRevision);
        if (absence.status !== 'active') fail('absenceCancelled');
        if (!['needs_cover', 'assigned', 'cancelled', 'covered'].includes(input.status)) fail('invalid');
        if (input.status === 'cancelled' && !text(input.note || '', 2000)) fail('cancellationReason');
        const assigned = ['assigned', 'covered'].includes(input.status);
        const substitute = assigned ? teacherFor(id(input.substituteUid), members, staff, schoolData) : null;
        const times = assigned ? explicitInterval(input.startTime, input.endTime) : null;
        if (input.status === 'covered') {
          const now = new Date(), date = new Intl.DateTimeFormat('en-CA',{ timeZone:'Europe/Belgrade',year:'numeric',month:'2-digit',day:'2-digit' }).format(now);
          const minutes = new Intl.DateTimeFormat('en-GB',{ timeZone:'Europe/Belgrade',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).format(now);
          if (cover.date > date || (cover.date === date && clock(minutes) < times.end)) fail('futureCompletion');
        }
        if (assigned) assertCoverAvailable({ substituteUid: substitute.id, teacherUid: cover.teacherUid, date: cover.date, slot: times, absences, covers,
          ownLessons: (weekly[dayName(cover.date)] || []).filter(lesson => !lesson.isEvent && matchesTeacher(lesson, substitute, courses)), ignoreId: cover.id });
        if (input.planId) {
          const [plan, share] = await Promise.all([tx.get(school.collection('lessonPlans').doc(id(input.planId))), tx.get(school.collection('lessonPlanShares').doc(input.planId))]);
          if (!plan.exists || !share.exists || plan.data().ownerUid !== cover.teacherUid) fail('planUnavailable');
        }
        const changed = { status: input.status, restoredWeekly: false, substituteUid: substitute?.id || '', substituteName: substitute?.name || substitute?.email || '',
          startTime: times ? input.startTime : cover.startTime, endTime: times ? input.endTime : cover.endTime, planId: input.planId ? id(input.planId) : '',
          note: text(input.note || '', 2000), participantUids: [...new Set([cover.teacherUid, substitute?.id].filter(Boolean))], revision: cover.revision + 1, updatedAt: at };
        const ref = school.collection('lessonCoverage').doc(cover.id);
        tx.update(ref, changed); recordEvent(tx, ref, commandId, actor, 'update', at, cover, { ...cover, ...changed });
        notice(tx, school, commandId, at, [cover.teacherUid, cover.substituteUid, substitute?.id].filter(person => person !== uid), 'coverage', cover.subject, 'coverage', cover.id);
        result = { id: cover.id };
      } else fail('invalid');
    }
    tx.set(school.collection('workflowCommands').doc(`${uid}_${commandId}`), { uid, hash, result, at });
    return result;
  });
}

export async function schoolWorkflow(request) {
  try {
    const [{ ensureDefaultApp }, { getFirestore, FieldValue }, { getAuth }] = await Promise.all([import('./adminApp.js'), import('firebase-admin/firestore'), import('firebase-admin/auth')]);
    ensureDefaultApp();
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const account = await getAuth().getUser(request.auth.uid);
    return await executeSchoolWorkflow(getFirestore(), request, account, () => FieldValue.serverTimestamp());
  } catch (error) {
    if (error instanceof WorkflowError) throw new HttpsError('failed-precondition', error.key, { key: error.key });
    throw error;
  }
}
