import { parseClassLabel } from './lessonPlans/catalog.js';

// A class (homeroom group such as 10A) is a grade level plus an optional
// section. It has a homeroom teacher but no timetable; courses carry the
// timetable and may be linked to one class.

export const MIN_GRADE_LEVEL = 0; // 0 = Përgatitore (preparatory)
export const MAX_GRADE_LEVEL = 12;
export const GRADE_LEVELS = Object.freeze(Array.from({ length: MAX_GRADE_LEVEL + 1 }, (_, index) => index));
export const MAX_SECTION_LENGTH = 10;

const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sq-AL').trim();

export function cleanSection(value) {
  return String(value ?? '').replace(/[^\p{L}\p{N}]/gu, '').toLocaleUpperCase('sq-AL').slice(0, MAX_SECTION_LENGTH);
}

export function isValidGradeLevel(value) {
  return Number.isInteger(value) && value >= MIN_GRADE_LEVEL && value <= MAX_GRADE_LEVEL;
}

/** "10A", "10/1", "5", "Përgatitore/B": always readable by parseClassLabel. */
export function classGroupLabel({ gradeLevel, section } = {}) {
  const grade = Number(gradeLevel);
  if (!isValidGradeLevel(grade)) return '';
  const cleaned = cleanSection(section);
  if (grade === 0) return cleaned ? `Përgatitore/${cleaned}` : 'Përgatitore';
  if (!cleaned) return String(grade);
  // Only a single A-Z letter is written attached (10A); anything else uses a slash (10/1, 12/Ë).
  return /^[A-Z]$/.test(cleaned) ? `${grade}${cleaned}` : `${grade}/${cleaned}`;
}

export function gradeLevelName(level, isAlbanian) {
  if (Number(level) === 0) return isAlbanian ? 'Përgatitore' : 'Preparatory';
  return isAlbanian ? `Klasa ${level}` : `Grade ${level}`;
}

export function compareClassGroups(a, b) {
  return (Number(a?.gradeLevel) - Number(b?.gradeLevel)) ||
    String(a?.section || '').localeCompare(String(b?.section || ''), 'sq', { numeric: true, sensitivity: 'base' }) ||
    String(a?.id || '').localeCompare(String(b?.id || ''));
}

export function sortClassGroups(groups = []) {
  return [...groups].sort(compareClassGroups);
}

const sameSection = (a, b) => fold(cleanSection(a)) === fold(cleanSection(b));

/** The class a free-text label such as "10A", "X/A" or "Klasa 10-a" refers to. */
export function findClassGroupByLabel(groups = [], label) {
  if (!label) return null;
  const parsed = parseClassLabel(String(label));
  if (!parsed) return groups.find(group => fold(group.label) === fold(label)) || null;
  return groups.find(group => Number(group.gradeLevel) === parsed.grade && sameSection(group.section, parsed.section)) || null;
}

/** Returns an error code, or '' when the draft can be saved. */
export function validateClassGroupDraft(draft, existing = [], editingId = '') {
  const grade = Number(draft?.gradeLevel);
  if (draft?.gradeLevel === '' || draft?.gradeLevel == null || !isValidGradeLevel(grade)) return 'grade';
  if (String(draft?.section ?? '').trim() && !cleanSection(draft.section)) return 'section';
  if (!String(draft?.homeroomTeacherId || '').trim()) return 'teacher';
  const duplicate = existing.some(group => String(group.id) !== String(editingId) &&
    Number(group.gradeLevel) === grade && sameSection(group.section, draft.section));
  return duplicate ? 'duplicate' : '';
}

export const classGroupsById = (groups = []) => new Map(groups.map(group => [String(group.id), group]));

/** The label shown for a student: their linked class, else the older free-text value. */
export function studentClassLabel(student, groupsById) {
  if (!student) return '';
  const group = student.classGroupId ? groupsById?.get(String(student.classGroupId)) : null;
  return group?.label || String(student.grade || '').trim();
}

/** True when the student is linked to a class that still exists. */
export function hasValidClass(student, groupsById) {
  return Boolean(student?.classGroupId && groupsById?.has(String(student.classGroupId)));
}

/** The class a schedule slot or course belongs to: its link, else a matching label. */
export function classGroupForItem(item, groups = [], groupsById = classGroupsById(groups)) {
  if (!item) return null;
  if (item.classGroupId && groupsById.has(String(item.classGroupId))) return groupsById.get(String(item.classGroupId));
  return findClassGroupByLabel(groups, item.classLabel);
}

/** The homeroom teacher's current name, flagged when unassigned or no longer on staff. */
export function homeroomTeacherInfo(group, staffList = [], isAlbanian = false) {
  if (!group?.homeroomTeacherId) return { name: isAlbanian ? 'Pa kujdestar' : 'No homeroom teacher', missing: true };
  const member = staffList.find(staff => String(staff.id) === String(group.homeroomTeacherId));
  if (member) return { name: member.name || group.homeroomTeacherName || '—', missing: false, member };
  return { name: `${group.homeroomTeacherName || '—'} ${isAlbanian ? '(nuk është më në staf)' : '(no longer on staff)'}`, missing: true };
}
