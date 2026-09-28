import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, BookOpen, Calendar, Edit3, GraduationCap, MapPin, Plus, Search, Trash2, Users, X,
} from 'lucide-react';
import { useSchoolData } from '../../context/SchoolDataContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { gradeLevelName, homeroomTeacherInfo as teacherLabel } from '../../features/classGroups';
import { useStudentCounts } from '../../features/students/studentData';
import ClassGroupDetail from './ClassGroupDetail';
import './ClassGroups.css';

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const ClassGroupsView = ({ userRole, canEditMembership, onOpenCourse, onOpenSchedule, onRequestCreate, onRequestEdit, addNotification }) => {
  const { classGroups = [], classGroupsLoaded, classGroupsError, classesList = [], staffList = [], studentsVersion, deleteClassGroup } = useSchoolData();
  const { activeSchoolId, currentUser } = useAuth();
  const { isAlbanian } = useLanguage();
  const isAdmin = userRole === 'admin';
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [keepCourses, setKeepCourses] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const countSpecs = useMemo(() => classGroups.map(group => ({ kind: 'class', value: group.id })), [classGroups]);
  const counts = useStudentCounts(activeSchoolId, countSpecs, studentsVersion);
  const coursesByGroup = useMemo(() => {
    const map = new Map();
    for (const course of classesList) {
      if (!course.classGroupId) continue;
      const key = String(course.classGroupId);
      map.set(key, [...(map.get(key) || []), course]);
    }
    return map;
  }, [classesList]);

  const myHomerooms = classGroups.filter(group => group.homeroomTeacherId && String(group.homeroomTeacherId) === String(currentUser?.uid));
  const gradeLevels = [...new Set(classGroups.map(group => Number(group.gradeLevel)))].sort((a, b) => a - b);
  const needle = search.trim().toLocaleLowerCase();
  const visible = classGroups.filter(group => {
    if (mineOnly && String(group.homeroomTeacherId) !== String(currentUser?.uid)) return false;
    if (gradeFilter !== 'all' && Number(group.gradeLevel) !== Number(gradeFilter)) return false;
    if (!needle) return true;
    const teacher = teacherLabel(group, staffList, isAlbanian).name;
    return [group.label, teacher, group.room].some(value => String(value || '').toLocaleLowerCase().includes(needle));
  });
  const detailGroup = detailId ? classGroups.find(group => group.id === detailId) : null;

  const confirmDelete = async () => {
    if (!groupToDelete) return;
    setDeleting(true);
    try {
      const result = await deleteClassGroup(groupToDelete.id, { keepCourseEnrollment: keepCourses });
      addNotification?.('success', isAlbanian
        ? `Klasa ${groupToDelete.label} u fshi. ${result.students} nxënës tani janë pa klasë.`
        : `Class ${groupToDelete.label} was deleted. ${result.students} student${result.students === 1 ? '' : 's'} now have no class.`);
      setGroupToDelete(null);
    } catch (error) {
      addNotification?.('error', error.message || (isAlbanian ? 'Klasa nuk u fshi.' : 'The class could not be deleted.'));
    } finally {
      setDeleting(false);
    }
  };

  const deleteStudentCount = groupToDelete ? counts.get({ kind: 'class', value: groupToDelete.id }) : undefined;
  const deleteCourseCount = groupToDelete ? (coursesByGroup.get(String(groupToDelete.id)) || []).length : 0;

  return (
    <div className="class-groups-view">
      <div className="classes-controls-bar">
        <div className="classes-search-box">
          <Search size={17} className="search-icon" />
          <input
            type="text"
            placeholder={isAlbanian ? 'Kërko klasën, kujdestarin ose sallën…' : 'Search class, homeroom teacher or room…'}
            value={search}
            onChange={event => setSearch(event.target.value)}
            aria-label={isAlbanian ? 'Kërko klasat' : 'Search classes'}
          />
          {search && <button type="button" className="clear-btn" onClick={() => setSearch('')} aria-label={isAlbanian ? 'Pastro' : 'Clear'}><X size={15} /></button>}
        </div>
        <div className="classes-filter-pills">
          {myHomerooms.length > 0 && (
            <button type="button" className={`dept-pill ${mineOnly ? 'active' : ''}`} onClick={() => setMineOnly(value => !value)}>
              {isAlbanian ? 'Klasat e mia kujdestare' : 'My homeroom classes'}
            </button>
          )}
          <select className="custom-form-select cg-grade-filter" value={gradeFilter} onChange={event => setGradeFilter(event.target.value)} aria-label={isAlbanian ? 'Filtro sipas nivelit' : 'Filter by grade'}>
            <option value="all">{isAlbanian ? 'Të gjitha nivelet' : 'All grades'}</option>
            {gradeLevels.map(level => <option key={level} value={level}>{gradeLevelName(level, isAlbanian)}</option>)}
          </select>
        </div>
      </div>

      {classGroupsError && (
        <div className="cg-notice is-error" role="alert">
          {isAlbanian ? 'Klasat nuk mund të ngarkohen. Rifreskoni faqen.' : 'Classes could not be loaded. Refresh the page.'}
        </div>
      )}

      <div className="classes-grid">
        {!classGroupsLoaded ? (
          <div className="empty-classes-card"><p>{isAlbanian ? 'Po ngarkohen klasat…' : 'Loading classes…'}</p></div>
        ) : visible.length === 0 ? (
          <div className="empty-classes-card">
            <div className="empty-icon-wrap"><GraduationCap size={40} className="muted" /></div>
            <h3>{classGroups.length ? (isAlbanian ? 'Asnjë klasë nuk përputhet' : 'No classes match') : (isAlbanian ? 'Ende nuk ka klasa' : 'No classes yet')}</h3>
            <p>
              {classGroups.length
                ? (isAlbanian ? 'Provoni një kërkim ose nivel tjetër.' : 'Try another search or grade.')
                : (isAlbanian
                  ? 'Klasat grupojnë nxënësit (p.sh. 10A) me një mësimdhënës kujdestar. Lëndët janë orët në orar dhe mund të lidhen me një klasë.'
                  : 'Classes group students (for example 10A) under a homeroom teacher. Courses are the subjects on the timetable and can be linked to a class.')}
            </p>
            {classGroups.length > 0 ? (
              <button type="button" className="btn-secondary btn-sm" onClick={() => { setSearch(''); setGradeFilter('all'); setMineOnly(false); }}>
                {isAlbanian ? 'Pastro filtrat' : 'Clear filters'}
              </button>
            ) : isAdmin && (
              <button type="button" className="btn-primary" onClick={onRequestCreate}>
                <Plus size={16} /> {isAlbanian ? 'Krijo klasën e parë' : 'Create the first class'}
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {visible.map(group => {
              const teacher = teacherLabel(group, staffList, isAlbanian);
              const studentCount = counts.get({ kind: 'class', value: group.id });
              const courseCount = (coursesByGroup.get(String(group.id)) || []).length;
              const isMine = String(group.homeroomTeacherId) === String(currentUser?.uid);
              return (
                <motion.div
                  key={group.id}
                  layout
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                  className="class-card cg-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailId(group.id)}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetailId(group.id); } }}
                  aria-label={`${isAlbanian ? 'Klasa' : 'Class'} ${group.label}`}
                >
                  <div className="class-card-header">
                    <div className="cg-label-badge" aria-hidden="true">{group.label}</div>
                    <div className="class-title">
                      <div className="class-title-top">
                        <h3>{isAlbanian ? 'Klasa' : 'Class'} {group.label}</h3>
                        {isMine && <span className="class-enroll-badge instructor">{isAlbanian ? 'Kujdestari im' : 'My homeroom'}</span>}
                      </div>
                      <p>{gradeLevelName(group.gradeLevel, isAlbanian)}</p>
                    </div>
                    {isAdmin && (
                      <div className="class-card-actions" onClick={event => event.stopPropagation()}>
                        <button type="button" className="class-card-action-btn edit" onClick={() => onRequestEdit?.(group)}
                          title={isAlbanian ? 'Ndrysho klasën' : 'Edit class'} aria-label={isAlbanian ? 'Ndrysho klasën' : 'Edit class'}>
                          <Edit3 size={15} />
                        </button>
                        <button type="button" className="class-card-action-btn delete" onClick={() => { setKeepCourses(true); setGroupToDelete(group); }}
                          title={isAlbanian ? 'Fshij klasën' : 'Delete class'} aria-label={isAlbanian ? 'Fshij klasën' : 'Delete class'}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={`cg-teacher ${teacher.missing ? 'is-missing' : ''}`}>
                    <GraduationCap size={15} />
                    <span><span className="cg-teacher-role">{isAlbanian ? 'Kujdestari:' : 'Homeroom:'}</span> {teacher.name}</span>
                  </div>
                  {group.room && <div className="class-meta-row"><span className="class-room-badge"><MapPin size={12} /> {group.room}</span></div>}
                  <div className="class-card-stats">
                    <div className="stat"><Users size={16} /><span>{studentCount === undefined ? '…' : studentCount} {isAlbanian ? 'nxënës' : studentCount === 1 ? 'student' : 'students'}</span></div>
                    <div className="stat"><BookOpen size={16} /><span>{courseCount} {isAlbanian ? 'lëndë' : courseCount === 1 ? 'course' : 'courses'}</span></div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {detailGroup && (
          <ClassGroupDetail
            group={detailGroup}
            courses={coursesByGroup.get(String(detailGroup.id)) || []}
            canEditMembership={canEditMembership}
            onClose={() => setDetailId(null)}
            onOpenCourse={course => { setDetailId(null); onOpenCourse?.(course); }}
            onOpenSchedule={onOpenSchedule ? () => { setDetailId(null); onOpenSchedule({ classGroupId: detailGroup.id }); } : null}
            addNotification={addNotification}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {groupToDelete && (
          <div className="modal-overlay" onClick={() => !deleting && setGroupToDelete(null)}>
            <motion.div
              className="modal-content delete-class-modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={event => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cg-delete-title"
            >
              <div className="modal-header">
                <h3 id="cg-delete-title" className="cg-danger-title"><AlertTriangle size={20} /> {isAlbanian ? `Fshij klasën ${groupToDelete.label}` : `Delete class ${groupToDelete.label}`}</h3>
                <p className="modal-subtitle">{isAlbanian ? 'Llogaritë e nxënësve nuk fshihen.' : 'Student accounts are not deleted.'}</p>
                <button type="button" className="icon-btn-close" onClick={() => !deleting && setGroupToDelete(null)} aria-label={isAlbanian ? 'Mbyll' : 'Close'}><X size={16} /></button>
              </div>
              <div className="modal-form">
                <div className="delete-warning-banner">
                  <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>{isAlbanian ? 'Çfarë ndodh' : 'What happens'}</strong>
                    <ul className="cg-effects">
                      <li>{isAlbanian
                        ? `${deleteStudentCount ?? '…'} nxënës aktivë mbesin pa klasë derisa t'u caktoni një tjetër.`
                        : `${deleteStudentCount ?? '…'} active student${deleteStudentCount === 1 ? '' : 's'} will have no class until you assign another.`}</li>
                      {deleteCourseCount > 0 && <li>{isAlbanian
                        ? `${deleteCourseCount} lëndë të lidhura me këtë klasë bëhen lëndë të hapura.`
                        : `${deleteCourseCount} linked course${deleteCourseCount === 1 ? '' : 's'} become open courses.`}</li>}
                    </ul>
                  </div>
                </div>
                {deleteCourseCount > 0 && (
                  <label className="cg-checkbox-row">
                    <input type="checkbox" checked={keepCourses} onChange={event => setKeepCourses(event.target.checked)} />
                    <span>{isAlbanian ? 'Mbaji nxënësit të regjistruar në këto lëndë' : 'Keep these students enrolled in those courses'}</span>
                  </label>
                )}
                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setGroupToDelete(null)} disabled={deleting}>{isAlbanian ? 'Anulo' : 'Cancel'}</button>
                  <button type="button" className="btn-destructive" onClick={confirmDelete} disabled={deleting}>
                    <Trash2 size={16} /> {deleting ? (isAlbanian ? 'Duke fshirë…' : 'Deleting…') : (isAlbanian ? 'Fshij klasën' : 'Delete class')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isAdmin && classGroups.length > 0 && (
        <p className="cg-footnote"><Calendar size={13} /> {isAlbanian
          ? 'Klasat nuk kanë orar. Lidhni lëndët me një klasë për ta parë orarin e saj.'
          : 'Classes have no timetable of their own. Link courses to a class to build its timetable.'}</p>
      )}
    </div>
  );
};

export default ClassGroupsView;
