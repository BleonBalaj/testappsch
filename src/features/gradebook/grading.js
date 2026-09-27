export const INITIAL_WEIGHTS = Object.freeze({ Homework: 20, Engagement: 15, Quiz: 20, Exam: 30, Project: 15 });
export const DEFAULT_GRADING_SETTINGS = Object.freeze({
  homeworkMinusValue: 1,
  engagementPlusValue: 1,
  engagementMinusValue: 1,
});

const DEFAULT_NAMES = {
  Homework: ['Homework', 'Detyrat e Shtëpisë'],
  Engagement: ['Class Engagement', 'Angazhimi në Klasë'],
  Quiz: ['Quiz', 'Kuize'],
  Exam: ['Exam', 'Provime'],
  Project: ['Project', 'Projekte'],
};

export function getCategoryDisplayName(category, isAlbanian = false, labels = {}) {
  return String(labels?.[category] || '').trim() || DEFAULT_NAMES[category]?.[isAlbanian ? 1 : 0] || category;
}

export function validateCategoryWeights(weights, labels = {}, assignments = []) {
  const keys = Object.keys(weights || {});
  if (!keys.includes('Homework') || !keys.includes('Engagement')) return 'The Homework and Engagement tracking categories are required.';
  if (keys.some((key) => !Number.isFinite(Number(weights[key])) || Number(weights[key]) < 0 || Number(weights[key]) > 100)) return 'Each weight must be between 0 and 100.';
  if (Math.abs(keys.reduce((total, key) => total + Number(weights[key]), 0) - 100) > 0.001) return 'Category weights must total exactly 100%.';
  if (assignments.some((assignment) => !keys.includes(assignment.category))) return 'A category with assignments cannot be removed.';
  const names = keys.map((key) => getCategoryDisplayName(key, false, labels).trim().toLocaleLowerCase());
  if (names.some((name) => !name) || new Set(names).size !== names.length) return 'Category names must be unique and nonempty.';
  if (keys.some((key) => key.startsWith('custom_') && !String(labels[key] || '').trim())) return 'Name each new category.';
  return null;
}

const scoredAssignments = (studentId, assignments, grades) => {
  const totals = {};
  for (const assignment of assignments) {
    const score = grades?.[studentId]?.[assignment.id];
    const max = Number(assignment.totalPoints);
    if (score === '' || score === null || score === undefined || !Number.isFinite(Number(score)) || !Number.isFinite(max) || max <= 0) continue;
    const category = assignment.category;
    if (!totals[category]) totals[category] = { earned: 0, total: 0 };
    totals[category].earned += Math.min(max, Math.max(0, Number(score)));
    totals[category].total += max;
  }
  return totals;
};

export function calcStudentGradeData(studentId, assignments = [], grades = {}, weights = INITIAL_WEIGHTS, studentTracking = {}, gradingSettings = DEFAULT_GRADING_SETTINGS) {
  const track = studentTracking?.[studentId] || {};
  const scores = scoredAssignments(studentId, assignments, grades);
  const missingHw = Math.max(0, Number(track.missingHomework) || 0);
  const engPluses = Math.max(0, Number(track.engagementPluses) || 0);
  const engMinuses = Math.max(0, Number(track.engagementMinuses) || 0);
  const homeworkWeight = Number(weights.Homework) || 0;
  const engagementWeight = Number(weights.Engagement) || 0;
  const homeworkHasData = Boolean(scores.Homework?.total) || missingHw > 0;
  const engagementHasData = Boolean(scores.Engagement?.total) || engPluses > 0 || engMinuses > 0;
  const homeworkBase = scores.Homework?.total ? (scores.Homework.earned / scores.Homework.total) * homeworkWeight : homeworkWeight;
  const hwEarnedWeightPts = Math.max(0, homeworkBase - missingHw * Number(gradingSettings.homeworkMinusValue ?? 1));
  const engagementBase = scores.Engagement?.total ? (scores.Engagement.earned / scores.Engagement.total) * engagementWeight : 0;
  const engEarnedWeightPts = Math.min(engagementWeight, Math.max(0,
    engagementBase + engPluses * Number(gradingSettings.engagementPlusValue ?? 1) - engMinuses * Number(gradingSettings.engagementMinusValue ?? 1)
  ));
  const hwPct = homeworkHasData && homeworkWeight > 0 ? Math.round(hwEarnedWeightPts / homeworkWeight * 100) : null;
  const engPct = engagementHasData && engagementWeight > 0 ? Math.round(engEarnedWeightPts / engagementWeight * 100) : null;
  const catScores = {
    Homework: { earnedWeightPts: hwEarnedWeightPts, maxWeight: homeworkWeight, pct: hwPct, hasData: homeworkHasData },
    Engagement: { earnedWeightPts: engEarnedWeightPts, maxWeight: engagementWeight, pct: engPct, hasData: engagementHasData },
  };
  for (const [category, rawWeight] of Object.entries(weights)) {
    if (category === 'Homework' || category === 'Engagement') continue;
    const weight = Number(rawWeight) || 0;
    const total = scores[category]?.total || 0;
    const pct = total > 0 ? Math.round(scores[category].earned / total * 100) : null;
    catScores[category] = { earnedWeightPts: pct === null ? 0 : pct / 100 * weight, maxWeight: weight, pct, hasData: total > 0 };
  }
  let earned = 0;
  let activeWeight = 0;
  for (const category of Object.values(catScores)) {
    if (category.hasData && category.maxWeight > 0) {
      earned += category.earnedWeightPts;
      activeWeight += category.maxWeight;
    }
  }
  const calculatedPct = activeWeight > 0 ? Math.round(earned / activeWeight * 100) : null;
  const isOverridden = track.manualOverridePct !== undefined && track.manualOverridePct !== null && track.manualOverridePct !== '';
  const finalPct = isOverridden ? Math.min(100, Math.max(0, Number(track.manualOverridePct))) : calculatedPct;
  return {
    catScores, calculatedPct, finalPct, isOverridden, manualOverridePct: track.manualOverridePct,
    missingHw, engPluses, engMinuses, hwEarnedWeightPts, engEarnedWeightPts,
  };
}
