import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Calendar, Check, GraduationCap, MapPin, Search, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { Avatar } from '../Avatar';
import { useSchoolData } from '../../context/SchoolDataContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { classGroupsById, gradeLevelName, homeroomTeacherInfo } from '../../features/classGroups';
import { useClassRoster, useStudentSearch } from '../../features/students/studentData';
import { matchesStudentSearch } from '../../features/students/studentSearch';

const ClassGroupDetail = ({ group, courses, canEditMembership, onClose, onOpenCourse, onOpenSchedule, addNotification }) => {
  const { classGroups = [], staffList = [], setStudentsClassGroup } = useSchoolData();
  const { activeSchoolId } = useAuth();
  const { isAlbanian } = useLanguage();
  const roster = useClassRoster(activeSchoolId, group.id);
  const [rosterFilter, setRosterFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [pickerTerm, setPickerTerm] = useState('');
  const [selected, setSelected] = useState(() => new Map());
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [busy, setBusy] = useState(false);
  const search = useStudentSearch(activeSchoolId, pickerTerm, { max: 25, enabled: adding });
  const groupsById = useMemo(() => classGroupsById(classGroups), [classGroups]);
  const teacher = homeroomTeacherInfo(group, staffList, isAlbanian);
  const visibleRoster = roster.students.filter(student => matchesStudentSearch(student, rosterFilter));
  const pickable = search.results.filter(student => student.status !== 'archived');

  const toggle = student => setSelected(previous => {
    const next = new Map(previous);
    if (next.has(student.id)) next.delete(student.id); else next.set(student.id, student);
    return next;
  });

  const addSelected = async () => {
    if (!selected.size) return;
    setBusy(true);
    try {
      await setStudentsClassGroup([...selected.values()], group.id);
      addNotification?.('success', isAlbanian
        ? `${selected.size} nxënës u shtuan në ${group.label}.`
        : `${selected.size} student${selected.size === 1 ? '' : 's'} added to ${group.label}.`);
      setSelected(new Map());
      setPickerTerm('');
      setAdding(false);
    } catch (error) {
      addNotification?.('error', error.message || (isAlbanian ? 'Nxënësit nuk u shtuan.' : 'Students could not be added.'));
    } finally {
      setBusy(false);
    }
  };

  const removeStudent = async student => {
    setBusy(true);
    try {
      await setStudentsClassGroup([student], '');
      addNotification?.('info', isAlbanian ? `${student.name} u hoq nga ${group.label}.` : `${student.name} was removed from ${group.label}.`);
      setConfirmRemoveId(null);
    } catch (error) {
      addNotification?.('error', error.message || (isAlbanian ? 'Nxënësi nuk u hoq.' : 'The student could not be removed.'));
    } finally {
      setBusy(false);
    }
  };

  const currentClassText = student => {
    if (String(student.classGroupId || '') === String(group.id)) return isAlbanian ? 'Tashmë në këtë klasë' : 'Already in this class';
    const current = student.classGroupId ? groupsById.get(String(student.classGroupId)) : null;
    if (current) return isAlbanian ? `Do të kalojë nga ${current.label}` : `Moves from ${current.label}`;
    return isAlbanian ? 'Pa klasë' : 'No class yet';
  };

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <motion.div
        className="modal-content cg-detail"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cg-detail-title"
      >
        <div className="modal-header">
          <h3 id="cg-detail-title">{isAlbanian ? 'Klasa' : 'Class'} {group.label}</h3>
          <p className="modal-subtitle">{gradeLevelName(group.gradeLevel, isAlbanian)}{group.room ? ` · ${group.room}` : ''}</p>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label={isAlbanian ? 'Mbyll' : 'Close'} disabled={busy}><X size={16} /></button>
        </div>
        <div className="modal-form">
          <div className="cg-facts">
            <div className={`cg-fact ${teacher.missing ? 'is-missing' : ''}`}><GraduationCap size={16} /><div><span>{isAlbanian ? 'Kujdestari' : 'Homeroom teacher'}</span><strong>{teacher.name}</strong></div></div>
            <div className="cg-fact"><Users size={16} /><div><span>{isAlbanian ? 'Nxënës aktivë' : 'Active students'}</span><strong>{roster.loading ? '…' : roster.students.length}</strong></div></div>
            <div className="cg-fact"><BookOpen size={16} /><div><span>{isAlbanian ? 'Lëndë të lidhura' : 'Linked courses'}</span><strong>{courses.length}</strong></div></div>
            {group.room && <div className="cg-fact"><MapPin size={16} /><div><span>{isAlbanian ? 'Salla' : 'Room'}</span><strong>{group.room}</strong></div></div>}
          </div>

          <section className="cg-section" aria-labelledby="cg-students-title">
            <div className="cg-section-head">
              <h4 id="cg-students-title">{isAlbanian ? 'Nxënësit' : 'Students'}</h4>
              {canEditMembership && !adding && (
                <button type="button" className="btn-secondary btn-sm" onClick={() => setAdding(true)}><UserPlus size={15} /> {isAlbanian ? 'Shto nxënës' : 'Add students'}</button>
              )}
            </div>

            {adding && (
              <div className="cg-picker">
                <div className="cg-picker-search">
                  <Search size={15} />
                  <input autoFocus type="text" value={pickerTerm} onChange={event => setPickerTerm(event.target.value)}
                    placeholder={isAlbanian ? 'Kërko nxënës sipas emrit, email-it ose ID-së…' : 'Search students by name, email or ID…'}
                    aria-label={isAlbanian ? "Kërko nxënës për t'i shtuar" : 'Search students to add'} />
                </div>
                {!search.active ? (
                  <p className="cg-hint">{isAlbanian ? 'Shkruani të paktën një shkronjë për të kërkuar.' : 'Type at least one letter to search.'}</p>
                ) : search.loading ? (
                  <p className="cg-hint">{isAlbanian ? 'Duke kërkuar…' : 'Searching…'}</p>
                ) : search.error ? (
                  <p className="cg-hint is-error">{isAlbanian ? 'Kërkimi dështoi. Provoni përsëri.' : 'Search failed. Try again.'}</p>
                ) : pickable.length === 0 ? (
                  <p className="cg-hint">{isAlbanian ? 'Asnjë nxënës aktiv nuk u gjet.' : 'No active students found.'}</p>
                ) : (
                  <ul className="cg-list">
                    {pickable.map(student => {
                      const inGroup = String(student.classGroupId || '') === String(group.id);
                      const checked = selected.has(student.id);
                      return (
                        <li key={student.id}>
                          <label className={`cg-row cg-row-pick ${inGroup ? 'is-disabled' : ''} ${checked ? 'is-selected' : ''}`}>
                            <input type="checkbox" checked={checked} disabled={inGroup} onChange={() => toggle(student)} />
                            <Avatar name={student.name} size={30} />
                            <span className="cg-row-text"><strong>{student.name}</strong><small>{[student.studentId, student.email].filter(Boolean).join(' · ')}</small></span>
                            <span className={`cg-row-note ${student.classGroupId && !inGroup ? 'is-warning' : ''}`}>{currentClassText(student)}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {search.capped && <p className="cg-hint">{isAlbanian ? "Po shfaqen rezultatet e para. Shkruani më shumë për t'i ngushtuar." : 'Showing the first matches. Type more to narrow them down.'}</p>}
                <div className="cg-picker-actions">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => { setAdding(false); setSelected(new Map()); setPickerTerm(''); }} disabled={busy}>{isAlbanian ? 'Anulo' : 'Cancel'}</button>
                  <button type="button" className="btn-primary btn-sm" onClick={addSelected} disabled={busy || !selected.size}>
                    <Check size={15} /> {isAlbanian ? `Shto ${selected.size} në ${group.label}` : `Add ${selected.size} to ${group.label}`}
                  </button>
                </div>
              </div>
            )}

            {roster.students.length > 8 && (
              <div className="cg-picker-search cg-roster-filter">
                <Search size={15} />
                <input type="text" value={rosterFilter} onChange={event => setRosterFilter(event.target.value)}
                  placeholder={isAlbanian ? 'Filtro nxënësit e klasës…' : 'Filter this class…'} aria-label={isAlbanian ? 'Filtro nxënësit' : 'Filter students'} />
              </div>
            )}
            {roster.loading ? (
              <p className="cg-hint">{isAlbanian ? 'Po ngarkohen nxënësit…' : 'Loading students…'}</p>
            ) : roster.error ? (
              <p className="cg-hint is-error">{isAlbanian ? 'Nxënësit nuk mund të ngarkohen.' : 'Students could not be loaded.'}</p>
            ) : roster.students.length === 0 ? (
              <p className="cg-hint">{isAlbanian ? 'Ende nuk ka nxënës në këtë klasë.' : 'No students in this class yet.'}</p>
            ) : (
              <ul className="cg-list">
                {visibleRoster.map(student => (
                  <li key={student.id} className="cg-row">
                    <Avatar name={student.name} size={30} />
                    <span className="cg-row-text"><strong>{student.name}</strong><small>{[student.studentId, student.email].filter(Boolean).join(' · ')}</small></span>
                    {canEditMembership && (confirmRemoveId === student.id ? (
                      <span className="cg-confirm">
                        <button type="button" className="btn-secondary btn-sm" onClick={() => setConfirmRemoveId(null)} disabled={busy}>{isAlbanian ? 'Anulo' : 'Cancel'}</button>
                        <button type="button" className="btn-destructive btn-sm" onClick={() => removeStudent(student)} disabled={busy}>{isAlbanian ? 'Hiq' : 'Remove'}</button>
                      </span>
                    ) : (
                      <button type="button" className="icon-btn-destructive" onClick={() => setConfirmRemoveId(student.id)}
                        title={isAlbanian ? 'Hiq nga klasa' : 'Remove from class'} aria-label={isAlbanian ? `Hiq ${student.name} nga klasa` : `Remove ${student.name} from class`}>
                        <UserMinus size={15} />
                      </button>
                    ))}
                  </li>
                ))}
                {visibleRoster.length === 0 && <li className="cg-hint">{isAlbanian ? 'Asnjë nxënës nuk përputhet.' : 'No students match.'}</li>}
              </ul>
            )}
            {roster.capped && <p className="cg-hint">{isAlbanian ? 'Klasa ka shumë nxënës; po shfaqen të parët.' : 'This class is very large; showing the first students.'}</p>}
          </section>

          <section className="cg-section" aria-labelledby="cg-courses-title">
            <div className="cg-section-head">
              <h4 id="cg-courses-title">{isAlbanian ? 'Lëndët e klasës' : 'Courses for this class'}</h4>
              {onOpenSchedule && <button type="button" className="btn-secondary btn-sm" onClick={onOpenSchedule}><Calendar size={15} /> {isAlbanian ? 'Shiko orarin' : 'View timetable'}</button>}
            </div>
            {courses.length === 0 ? (
              <p className="cg-hint">{isAlbanian
                ? 'Asnjë lëndë nuk është lidhur ende. Hapni një lëndë dhe zgjidhni këtë klasë te "Klasa".'
                : 'No courses are linked yet. Edit a course and choose this class under "Class".'}</p>
            ) : (
              <ul className="cg-list">
                {courses.map(course => (
                  <li key={course.id}>
                    <button type="button" className="cg-row cg-row-link" onClick={() => onOpenCourse(course)}>
                      <BookOpen size={16} />
                      <span className="cg-row-text"><strong>{course.name}</strong><small>{[course.code, course.teacher, course.schedule].filter(Boolean).join(' · ')}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="modal-footer-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>{isAlbanian ? 'Mbyll' : 'Close'}</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ClassGroupDetail;
