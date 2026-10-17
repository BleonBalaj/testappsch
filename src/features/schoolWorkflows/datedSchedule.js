// Dated exceptions decorate the weekly timetable without mutating it. A
// cancelled absence restores the weekly lesson; a cancelled lesson stays visible.
export function applyDatedCoverage(weekly, covers, dateByDay) {
  return Object.fromEntries(Object.entries(weekly).map(([day, lessons]) => {
    const dated = covers.filter(cover => cover.date === dateByDay[day] && !cover.restoredWeekly);
    const seen = new Set();
    const result = lessons.map(lesson => {
      const cover = dated.find(cover => cover.slotId === lesson.id);
      if (!cover || lesson.isEvent) return lesson;
      seen.add(cover.id);
      return { ...lesson, coverage: cover, time: cover.startTime && cover.endTime ? `${cover.startTime}–${cover.endTime}` : lesson.time };
    });
    for (const cover of dated.filter(cover => !seen.has(cover.id))) result.push({
      id: `coverage:${cover.id}`, source: 'coverage', courseId: cover.courseId,
      classGroupId: cover.classGroupId, classLabel: cover.classLabel,
      subject: cover.subject, teacher: cover.teacherName, teacherId: cover.teacherUid,
      room: cover.room, day, time: cover.startTime && cover.endTime ? `${cover.startTime}–${cover.endTime}` : cover.time,
      coverage: cover, color: '--primary', isEvent: false,
    });
    return [day, result];
  }));
}
