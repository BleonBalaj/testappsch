import { enrolledCoursesForStudent } from '../enrollment.js';
import { calcStudentGradeData, INITIAL_WEIGHTS } from './grading.js';

export function courseResult(studentId, course, record) {
  if (!record || !Array.isArray(record.assignments) || !Array.isArray(record.grades) || !Array.isArray(record.studentTracking)) return null;
  const scores = {};
  for (const grade of record.grades) {
    if (grade.scores?.[studentId] !== undefined) scores[grade.id] = grade.scores[studentId];
  }
  const tracking = record.studentTracking.find(item => String(item.id) === String(studentId));
  const result = calcStudentGradeData(studentId, record.assignments, { [studentId]: scores }, course.weights || INITIAL_WEIGHTS, { [studentId]: tracking }, course.gradingSettings);
  return Number.isFinite(result.finalPct) ? result.finalPct : null;
}

export function buildSchoolRankings(students, courses, records, filter = 'overall') {
  const rankings = [];
  for (const student of students) {
    if (student.status === 'archived') continue;
    if (filter.startsWith('cohort:') && String(student.grade || '').trim() !== filter.slice(7)) continue;
    const enrolled = enrolledCoursesForStudent(student, courses);
    const relevant = filter.startsWith('course:') ? enrolled.filter(course => String(course.id) === filter.slice(7)) : enrolled;
    const grades = relevant.map(course => courseResult(student.id, course, records[String(course.id)])).filter(Number.isFinite);
    if (grades.length === 0) continue;
    const average = Math.round((grades.reduce((sum, pct) => sum + pct, 0) / grades.length) * 10) / 10;
    rankings.push({ id: student.id, name: student.name, grade: student.grade || '', average, gradedCourses: grades.length });
  }
  rankings.sort((a, b) => b.average - a.average || b.gradedCourses - a.gradedCourses || a.name.localeCompare(b.name));
  return rankings.map((item, index) => ({ ...item, rank: index > 0 && item.average === rankings[index - 1].average ? rankings.findIndex(row => row.average === item.average) + 1 : index + 1 }));
}

/**
 * Computes candidate overall rankings directly from course records and student IDs
 * without needing full student profile documents. Useful for 50,000+ student scale
 * so only top students need their documents fetched from Firestore.
 */
export function calculateCandidateRanks(studentIds, courses, records) {
  const list = [];
  const coursesById = new Map((courses || []).map(c => [String(c.id), c]));
  for (const studentId of studentIds) {
    const grades = [];
    for (const [courseId, course] of coursesById.entries()) {
      const record = records[courseId];
      if (!record) continue;
      const pct = courseResult(studentId, course, record);
      if (Number.isFinite(pct)) grades.push(pct);
    }
    if (grades.length === 0) continue;
    const average = Math.round((grades.reduce((sum, pct) => sum + pct, 0) / grades.length) * 10) / 10;
    list.push({ id: String(studentId), average, gradedCourses: grades.length });
  }
  list.sort((a, b) => b.average - a.average || b.gradedCourses - a.gradedCourses || String(a.id).localeCompare(String(b.id)));
  return list.map((item, index) => ({
    ...item,
    rank: index > 0 && item.average === list[index - 1].average ? list.findIndex(row => row.average === item.average) + 1 : index + 1,
  }));
}

