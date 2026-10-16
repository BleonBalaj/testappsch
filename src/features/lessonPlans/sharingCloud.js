import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import * as store from './sharingStore.js';
export const prepareLessonPlanOwnership = (schoolId, teacherId) => httpsCallable(functions, 'prepareLessonPlanOwnership')({ schoolId, teacherId });
export const writeOwnedLessonPlan = (plan, schoolId, identity) => store.writeOwnedLessonPlan(db, plan, schoolId, identity);
export const setPlanShared = (schoolId, planId, identity, shared) => store.setPlanShared(db, schoolId, planId, identity, shared);
export const reviewSharedPlan = (schoolId, record, identity, reviewStatus) => store.reviewSharedPlan(db, schoolId, record, identity, reviewStatus);
