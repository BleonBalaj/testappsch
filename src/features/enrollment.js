const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const referenceText = reference => {
  if (typeof reference === 'string' || typeof reference === 'number') return String(reference);
  if (reference && typeof reference === 'object') return reference.id || reference.code || reference.name || '';
  return '';
};

export function courseMatchesReference(course, reference) {
  if (!course || !reference) return false;
  if (reference && typeof reference === 'object') {
    return [reference.id, reference.code, reference.name].filter(Boolean)
      .some(value => courseMatchesReference(course, String(value)));
  }
  const value = clean(referenceText(reference));
  if (!value) return false;
  const id = clean(course.id);
  const code = clean(course.code);
  const name = clean(course.name);
  if (value === id || (code && value === code) || (name && value === name)) return true;

  // Older student forms stored "Course Name (CODE)" instead of a stable ID.
  // Match the code in that exact format so a later course rename still works.
  const legacy = value.match(/^.+\s\(([^()]+)\)$/);
  return Boolean(legacy && code && clean(legacy[1]) === code);
}

/** A course linked to a class includes every student of that class. */
export function isEnrolledThroughClass(student, course) {
  return Boolean(student?.classGroupId && course?.classGroupId && String(student.classGroupId) === String(course.classGroupId));
}

export function isStudentEnrolledInCourse(student, course) {
  if (!student || !course) return false;
  if (isEnrolledThroughClass(student, course)) return true;
  // The student directory is the current source of truth. Class-side IDs are
  // only a fallback for older records that have no assignedClasses field.
  if (Array.isArray(student.assignedClasses) || typeof student.assignedClasses === 'string') {
    const references = Array.isArray(student.assignedClasses) ? student.assignedClasses : [student.assignedClasses];
    return references.some(reference => courseMatchesReference(course, reference));
  }
  const studentIds = [student.id, student.uid, student.studentId].filter(Boolean).map(clean);
  return Array.isArray(course.enrolledStudentIds) && course.enrolledStudentIds.some(id => studentIds.includes(clean(id)));
}

export function enrolledCoursesForStudent(student, courses = []) {
  return courses.filter(course => isStudentEnrolledInCourse(student, course));
}

export function displayCourse(course) {
  return [course?.name, course?.code && `(${course.code})`].filter(Boolean).join(' ') || String(course?.id || '');
}

export function normalizeAssignedCourseIds(references = [], courses = []) {
  const entries = Array.isArray(references) ? references : references ? [references] : [];
  return [...new Set(entries.map(reference => {
    const course = courses.find(item => courseMatchesReference(item, reference));
    return course ? String(course.id) : referenceText(reference).trim();
  }).filter(Boolean))];
}

/**
 * Course IDs to store on a student. Courses linked to the student's class are
 * included automatically, so they are not stored; courses linked to a class the
 * student is leaving are dropped with that class.
 */
export function explicitCourseAssignments(references, courses = [], classGroupId = '', previousClassGroupId = '') {
  const byId = new Map(courses.map(course => [String(course.id), course]));
  const next = String(classGroupId || '');
  const previous = String(previousClassGroupId || '');
  return normalizeAssignedCourseIds(references, courses).filter(id => {
    const linked = String(byId.get(id)?.classGroupId || '');
    if (!linked) return true;
    if (next && linked === next) return false;
    return !(previous && previous !== next && linked === previous);
  });
}
