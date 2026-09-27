// Browser-local copy of lesson data; Firestore synchronization is handled by the page.
export const LESSON_PLAN_STORAGE_VERSION = 1;
export const DEFAULT_PREFERENCES = Object.freeze({
  defaultClass: '',
  defaultSubject: '',
  teacherName: '',
  schoolName: '',
  schoolLogo: '',
  academicYear: '',
  assignedClasses: [],
  duration: '',
  rememberLastUsed: false,
  lastUsedClass: '',
  lastUsedSubject: '',
});

const copy = (value) => JSON.parse(JSON.stringify(value));
const compact = (value) => String(value ?? '').trim();
const id = () => globalThis.crypto?.randomUUID?.() ?? `lp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    if (globalThis.localStorage) return globalThis.localStorage;
  } catch {
    // Browser storage can be disabled by privacy settings.
  }
  throw new Error('Browser localStorage is unavailable. Lesson plans cannot be persisted here.');
}

function readEnvelope(storage, key, initial, collections, strict = false) {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { data: copy(initial), error: null };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.version !== LESSON_PLAN_STORAGE_VERSION) {
      throw new Error('Unsupported or damaged lesson-plan storage version');
    }
    if ((initial.teacherId && parsed.teacherId !== initial.teacherId) || (initial.schoolId && parsed.schoolId !== initial.schoolId)) {
      throw new Error('Lesson-plan storage identity does not match this repository');
    }
    for (const collection of collections) {
      if (!Array.isArray(parsed[collection])) throw new Error(`Damaged ${collection} collection`);
    }
    if (own(initial, 'preferences') && (!parsed.preferences || typeof parsed.preferences !== 'object' || Array.isArray(parsed.preferences))) {
      throw new Error('Damaged teacher preferences');
    }
    return { data: parsed, error: null };
  } catch (error) {
    if (strict) throw new Error(`Cannot safely write ${key}: ${error.message}`, { cause: error });
    return { data: copy(initial), error: error.message };
  }
}

function writeEnvelope(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}

function saveInCollection(storage, key, initial, collections, collection, item, owner, clock) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('A record object is required');
  const data = readEnvelope(storage, key, initial, collections, true).data;
  const recordId = compact(item.id) || id();
  const index = data[collection].findIndex((entry) => entry.id === recordId);
  const previous = index >= 0 ? data[collection][index] : null;
  const stamp = clock();
  const saved = { ...copy(item), id: recordId, ...owner, createdAt: previous?.createdAt ?? item.createdAt ?? stamp, updatedAt: stamp };
  if (index >= 0) data[collection][index] = saved;
  else data[collection].push(saved);
  writeEnvelope(storage, key, data);
  return copy(saved);
}

function removeFromCollection(storage, key, initial, collections, collection, recordId) {
  const data = readEnvelope(storage, key, initial, collections, true).data;
  const before = data[collection].length;
  data[collection] = data[collection].filter((entry) => entry.id !== recordId);
  if (data[collection].length === before) return false;
  writeEnvelope(storage, key, data);
  return true;
}

export function createLessonPlanRepository(teacherId, { storage, schoolId = 'default', now = () => new Date() } = {}) {
  const teacher = compact(teacherId);
  if (!teacher) throw new TypeError('A stable teacherId is required');
  const school = compact(schoolId) || 'default';
  const store = resolveStorage(storage);
  const personalKey = `lumi-lesson-plans:v1:teacher:${encodeURIComponent(teacher)}:school:${encodeURIComponent(school)}`;
  const schoolKey = `lumi-lesson-plans:v1:school:${encodeURIComponent(school)}`;
  const initialPersonal = { version: LESSON_PLAN_STORAGE_VERSION, teacherId: teacher, plans: [], preferences: copy(DEFAULT_PREFERENCES), templates: [], reusableEntries: [], topics: [] };
  const initialSchool = { version: LESSON_PLAN_STORAGE_VERSION, schoolId: school, subjectMappings: [], stageMappings: [], topics: [] };
  const personalCollections = ['plans', 'templates', 'reusableEntries', 'topics'];
  const schoolCollections = ['subjectMappings', 'stageMappings', 'topics'];
  const readPersonal = (strict = false) => readEnvelope(store, personalKey, initialPersonal, personalCollections, strict);
  const readSchool = (strict = false) => readEnvelope(store, schoolKey, initialSchool, schoolCollections, strict);
  const stamp = () => new Date(now()).toISOString();
  const byUpdated = (a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''));
  const requireAdmin = (isAdmin) => { if (isAdmin !== true) throw new Error('Administrator access is required for school-wide records'); };
  const subjectKey = (value) => compact(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const api = {
    storageKeys: Object.freeze({ personal: personalKey, school: schoolKey }),
    getStorageStatus() {
      const personal = readPersonal();
      const shared = readSchool();
      return { personal: { ok: !personal.error, error: personal.error }, school: { ok: !shared.error, error: shared.error } };
    },
    listPlans() { return copy(readPersonal().data.plans).sort(byUpdated); },
    getPlan(planId) { return copy(readPersonal().data.plans.find((plan) => plan.id === planId) ?? null); },
    savePlan(plan) {
      if (plan?.teacherId && String(plan.teacherId) !== teacher) throw new Error('Cannot save another teacher’s plan');
      if (!['draft', 'completed', 'archived'].includes(plan?.status)) throw new TypeError('Plan status must be draft, completed, or archived');
      return saveInCollection(store, personalKey, initialPersonal, personalCollections, 'plans', plan, { teacherId: teacher }, stamp);
    },
    mergeCloudPlan(plan) {
      if (!plan?.id || !['draft', 'completed', 'archived'].includes(plan.status)) return false;
      if (plan.teacherId && String(plan.teacherId) !== teacher) return false;
      const data = readPersonal(true).data;
      const index = data.plans.findIndex((entry) => entry.id === plan.id);
      const local = index >= 0 ? data.plans[index] : null;
      if (local && String(local.updatedAt ?? '') >= String(plan.updatedAt ?? '')) return false;
      const merged = { ...copy(plan), teacherId: teacher };
      if (index >= 0) data.plans[index] = merged;
      else data.plans.push(merged);
      writeEnvelope(store, personalKey, data);
      return true;
    },
    deletePlan(planId) { return removeFromCollection(store, personalKey, initialPersonal, personalCollections, 'plans', planId); },
    setPlanStatus(planId, status) {
      if (!['draft', 'completed', 'archived'].includes(status)) throw new TypeError('Invalid plan status');
      const plan = api.getPlan(planId);
      if (!plan) return null;
      return api.savePlan({ ...plan, status, archivedFromStatus: status === 'archived' ? (plan.status === 'archived' ? plan.archivedFromStatus : plan.status) : undefined });
    },
    archivePlan(planId) { return api.setPlanStatus(planId, 'archived'); },
    restorePlan(planId) {
      const plan = api.getPlan(planId);
      if (!plan) return null;
      return api.savePlan({ ...plan, status: plan.archivedFromStatus === 'completed' ? 'completed' : 'draft', archivedFromStatus: undefined });
    },
    getPreferences() { return { ...copy(DEFAULT_PREFERENCES), ...copy(readPersonal().data.preferences) }; },
    savePreferences(patch) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Preference object is required');
      const data = readPersonal(true).data;
      data.preferences = { ...copy(DEFAULT_PREFERENCES), ...data.preferences, ...copy(patch) };
      if (!Array.isArray(data.preferences.assignedClasses)) data.preferences.assignedClasses = [];
      writeEnvelope(store, personalKey, data);
      return copy(data.preferences);
    },
    listTemplates() { return copy(readPersonal().data.templates).sort(byUpdated); },
    saveTemplate(template) {
      if (!compact(template?.name)) throw new TypeError('Template name is required');
      // Templates are personal records. Clear reflection if the caller provides a full plan.
      const safe = { ...template, plan: template?.plan ? { ...template.plan, reflection: '' } : template?.plan };
      return saveInCollection(store, personalKey, initialPersonal, personalCollections, 'templates', safe, { teacherId: teacher }, stamp);
    },
    deleteTemplate(templateId) { return removeFromCollection(store, personalKey, initialPersonal, personalCollections, 'templates', templateId); },
    listReusableEntries(kind) { return copy(readPersonal().data.reusableEntries.filter((entry) => !kind || (entry.kind ?? entry.type) === kind)).sort(byUpdated); },
    saveReusableEntry(entry) {
      const kind = compact(entry?.kind ?? entry?.type);
      const value = compact(entry?.value ?? entry?.text);
      if (!kind || !value) throw new TypeError('Reusable entry kind and value are required');
      return saveInCollection(store, personalKey, initialPersonal, personalCollections, 'reusableEntries', { ...entry, kind, value, type: kind, text: value }, { teacherId: teacher }, stamp);
    },
    deleteReusableEntry(entryId) { return removeFromCollection(store, personalKey, initialPersonal, personalCollections, 'reusableEntries', entryId); },
    listTopics({ subject = '', classLabel = '', query = '', includeSchool = true } = {}) {
      const topics = [...readPersonal().data.topics, ...(includeSchool ? readSchool().data.topics : [])];
      const subjectNeedle = subjectKey(subject);
      const classNeedle = subjectKey(classLabel);
      const queryNeedle = subjectKey(query);
      return copy(topics.filter((topic) => {
        if (subjectNeedle && subjectKey(topic.subject) !== subjectNeedle) return false;
        if (classNeedle && topic.classLabel && subjectKey(topic.classLabel) !== classNeedle) return false;
        if (queryNeedle && !subjectKey(`${topic.title ?? topic.topic ?? ''} ${topic.learningOutcome ?? topic.topicLearningOutcome ?? topic.outcome ?? ''}`).includes(queryNeedle)) return false;
        return true;
      })).sort(byUpdated);
    },
    saveTopic(topic, { scope = 'teacher', isAdmin = false } = {}) {
      if (!compact(topic?.title ?? topic?.topic) || !compact(topic?.subject)) throw new TypeError('Topic title and subject are required');
      const outcome = compact(topic.learningOutcome ?? topic.topicLearningOutcome ?? topic.outcome);
      const normalized = { ...topic, learningOutcome: outcome, outcome };
      if (scope === 'school') {
        requireAdmin(isAdmin);
        return saveInCollection(store, schoolKey, initialSchool, schoolCollections, 'topics', normalized, { schoolId: school, scope: 'school' }, stamp);
      }
      if (scope !== 'teacher') throw new TypeError('Unknown topic scope');
      return saveInCollection(store, personalKey, initialPersonal, personalCollections, 'topics', normalized, { teacherId: teacher, scope: 'teacher' }, stamp);
    },
    deleteTopic(topicId, { scope = 'teacher', isAdmin = false } = {}) {
      if (scope === 'school') {
        requireAdmin(isAdmin);
        return removeFromCollection(store, schoolKey, initialSchool, schoolCollections, 'topics', topicId);
      }
      return removeFromCollection(store, personalKey, initialPersonal, personalCollections, 'topics', topicId);
    },
    listSubjectMappings() { return copy(readSchool().data.subjectMappings); },
    saveSubjectMapping(mapping, { isAdmin = false } = {}) {
      requireAdmin(isAdmin);
      if (!compact(mapping?.name ?? mapping?.subject) || !compact(mapping?.area ?? mapping?.curricularArea)) throw new TypeError('Subject name and curricular area are required');
      return saveInCollection(store, schoolKey, initialSchool, schoolCollections, 'subjectMappings', { ...mapping, validated: true }, { schoolId: school }, stamp);
    },
    deleteSubjectMapping(mappingId, { isAdmin = false } = {}) {
      requireAdmin(isAdmin);
      return removeFromCollection(store, schoolKey, initialSchool, schoolCollections, 'subjectMappings', mappingId);
    },
    listStageMappings() { return copy(readSchool().data.stageMappings); },
    saveStageMapping(mapping, { isAdmin = false } = {}) {
      requireAdmin(isAdmin);
      if (!compact(mapping?.stage) || (!compact(mapping?.classLabel) && !compact(mapping?.grade) && !(Array.isArray(mapping?.grades) && mapping.grades.length))) {
        throw new TypeError('Stage and class or grade are required');
      }
      return saveInCollection(store, schoolKey, initialSchool, schoolCollections, 'stageMappings', { ...mapping, validated: true }, { schoolId: school }, stamp);
    },
    deleteStageMapping(mappingId, { isAdmin = false } = {}) {
      requireAdmin(isAdmin);
      return removeFromCollection(store, schoolKey, initialSchool, schoolCollections, 'stageMappings', mappingId);
    },
  };
  return api;
}
