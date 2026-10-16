import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { inboxRecord } from './sharing.js';

const refs = (db, schoolId, planId) => ({
  plan: doc(db, 'schools', schoolId, 'lessonPlans', String(planId)),
  share: doc(db, 'schools', schoolId, 'lessonPlanShares', String(planId)),
  inbox: doc(db, 'schools', schoolId, 'lessonPlanInbox', String(planId)),
  history: doc(db, 'schools', schoolId, 'lessonPlanReviewHistory', String(planId)),
});
const token = () => crypto.randomUUID();
async function authorTransaction(db, update) {
  // A simultaneous shared save/unshare can change a document used by getAfter
  // rules before Firestore reports a read-version conflict. Re-read the whole
  // transaction once in that case. Authorization still runs on both attempts;
  // a permanent denial is returned and never treated as a successful save.
  try { return await runTransaction(db, update); }
  catch (error) {
    if (error.code !== 'permission-denied') throw error;
    return runTransaction(db, update);
  }
}
function recordHistory(transaction, paths, plan, share, identity, action, reviewStatus, eventId, previousReviewStatus = '') {
  const at = serverTimestamp();
  transaction.set(doc(paths.history, 'events', eventId), {
    planId: String(plan.id), ownerUid: share.ownerUid, actorUid: identity.uid,
    actorEmail: identity.email.toLowerCase(), actorName: String(identity.name || identity.email).slice(0, 200),
    action, at, shareToken: share.shareToken, revisionId: share.revisionId, reviewStatus, previousReviewStatus, plan,
  });
  transaction.set(paths.history, {
    planId: String(plan.id), ownerUid: share.ownerUid, ownerName: share.ownerName, ownerEmail: share.ownerEmail,
    lessonUnit: plan.lessonUnit || '', subject: plan.subject || '', topic: plan.topic || '', classLabel: plan.classLabel || '',
    lessonDate: plan.date || '', sharedAt: share.sharedAt, lastEventId: eventId, lastEventAt: at, lastAction: action,
    shareCycle: share.shareCycle, lastReviewStatus: action === 'unshare' ? previousReviewStatus : reviewStatus,
  });
  if (previousReviewStatus === 'archived' && ['reshare', 'update'].includes(action)) {
    transaction.set(doc(paths.history, 'events', `${eventId}-reopen`), {
      planId: String(plan.id), ownerUid: share.ownerUid, actorUid: 'system', actorEmail: '', actorName: 'System',
      action: 'auto_reopen', at, shareToken: share.shareToken, revisionId: share.revisionId,
      reviewStatus: 'pending', previousReviewStatus, plan,
    });
  }
}

export function writeOwnedLessonPlan(db, plan, schoolId, identity) {
  if (!identity?.uid || plan.ownerUid !== identity.uid) return Promise.reject(new Error('sharing.notOwner'));
  const paths = refs(db, schoolId, plan.id);
  const saved = { ...plan, ownerUid: identity.uid };
  return authorTransaction(db, async transaction => {
    const [existing, history] = await Promise.all([transaction.get(paths.share), transaction.get(paths.history)]);
    transaction.set(paths.plan, saved);
    if (existing.exists()) {
      const share = { ...existing.data(), revisionId: token() };
      transaction.update(paths.share, { revisionId: share.revisionId });
      transaction.set(paths.inbox, inboxRecord(saved, share));
      recordHistory(transaction, paths, saved, share, identity, 'update', 'pending', share.revisionId, history.data()?.lastReviewStatus || '');
    }
  });
}

export function setPlanShared(db, schoolId, planId, identity, shared) {
  const paths = refs(db, schoolId, planId);
  return authorTransaction(db, async transaction => {
    const [planSnapshot, shareSnapshot, history] = await Promise.all([transaction.get(paths.plan), transaction.get(paths.share), transaction.get(paths.history)]);
    if (!planSnapshot.exists() || planSnapshot.data().ownerUid !== identity.uid) throw new Error('sharing.notOwner');
    if (!shared) {
      if (shareSnapshot.exists()) {
        recordHistory(transaction, paths, planSnapshot.data(), shareSnapshot.data(), identity, 'unshare', 'unshared', token(), history.data()?.lastReviewStatus || '');
        transaction.delete(paths.share); transaction.delete(paths.inbox);
      }
      return;
    }
    if (shareSnapshot.exists()) return; // An accidental double click must not reset a review.
    const share = {
      planId: String(planId), ownerUid: identity.uid, ownerName: String(identity.name || identity.email).slice(0, 200),
      ownerEmail: identity.email.toLowerCase(), sharedAt: serverTimestamp(), shareToken: token(), revisionId: token(),
      shareCycle: (history.data()?.shareCycle || 0) + 1,
    };
    transaction.set(paths.share, share);
    transaction.set(paths.inbox, inboxRecord(planSnapshot.data(), share));
    recordHistory(transaction, paths, planSnapshot.data(), share, identity, share.shareCycle > 1 ? 'reshare' : 'share', 'pending', share.revisionId, history.data()?.lastReviewStatus || '');
  });
}

export function reviewSharedPlan(db, schoolId, record, identity, reviewStatus) {
  const paths = refs(db, schoolId, record.planId);
  return runTransaction(db, async transaction => {
    const [share, inbox, plan] = await Promise.all([transaction.get(paths.share), transaction.get(paths.inbox), transaction.get(paths.plan)]);
    if (!share.exists() || !inbox.exists()) throw new Error('sharing.unavailable');
    if (share.data().shareToken !== record.shareToken || share.data().revisionId !== record.revisionId) throw new Error('sharing.changed');
    const eventId = token();
    transaction.update(paths.inbox, { reviewStatus, reviewedByUid: identity.uid, reviewedAt: serverTimestamp(), lastEventId: eventId });
    recordHistory(transaction, paths, plan.data(), share.data(), identity, 'review', reviewStatus, eventId, inbox.data().reviewStatus);
  });
}
