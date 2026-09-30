import React, { useMemo, useState } from 'react';
import { Building2, GraduationCap, Printer, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSchoolData } from '../context/SchoolDataContext';
import { useLanguage } from '../context/LanguageContext';
import { enrolledCoursesForStudent } from '../features/enrollment';
import { classGroupsById, studentClassLabel } from '../features/classGroups';
import { courseResult } from '../features/gradebook/schoolResults';
import { useCourseRecords } from '../features/gradebook/useCourseRecords';
import './Transcript.css';

const Transcript = ({ userRole = 'student' }) => {
  const { currentUser, activeSchool, activeSchoolId } = useAuth();
  const { myStudentRecord: student, classesList, classesLoaded, classGroups = [] } = useSchoolData();
  const { isAlbanian } = useLanguage();
  const [search, setSearch] = useState('');
  const groupsById = useMemo(() => classGroupsById(classGroups), [classGroups]);
  const courses = useMemo(() => enrolledCoursesForStudent(student, classesList), [student, classesList]);
  const { records, loading, error } = useCourseRecords(activeSchoolId, courses);
  const allRows = useMemo(() => courses.map(course => ({
    id: course.id,
    name: course.name,
    code: course.code || '—',
    teacher: course.teacher || '—',
    grade: courseResult(student?.id, course, records[String(course.id)]),
  })), [courses, records, student?.id]);
  const rows = useMemo(() => allRows.filter(row => `${row.name} ${row.code} ${row.teacher}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [allRows, search]);
  const graded = allRows.filter(row => row.grade !== null);
  const average = graded.length ? Math.round(graded.reduce((sum, row) => sum + row.grade, 0) / graded.length * 10) / 10 : null;

  if (userRole !== 'student') return (
    <div className="transcript-page student-only-notice glass">
      <GraduationCap size={48} className="text-primary" />
      <h2>{isAlbanian ? 'Raporti i notave të nxënësit' : 'Student grade report'}</h2>
      <p>{isAlbanian ? 'Ky raport është i disponueshëm për nxënësin përkatës.' : 'This report is available to the student whose grades it contains.'}</p>
    </div>
  );

  return (
    <div className="transcript-page">
      <header className="page-header no-print">
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              {isAlbanian ? 'Raporti i Notave' : 'Grade Report'} <GraduationCap size={32} />
            </h1>
            <span className="count-pill glass">{isAlbanian ? 'Notat aktuale' : 'Current grades'}</span>
          </div>
          <p>{isAlbanian ? 'Notat e lëndëve ku jeni regjistruar. Ato mund të ndryshojnë kur shtohen vlerësime.' : 'Grades in your enrolled courses. These can change as new assessments are recorded.'}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-primary" onClick={() => window.print()} disabled={loading || Boolean(error)}>
            <Printer size={17} /> {isAlbanian ? 'Printo / Ruaj PDF' : 'Print / Save PDF'}
          </button>
        </div>
      </header>

      <div className="official-transcript-sheet glass transcript-info-card">
        <div className="transcript-doc-header">
          <div className="school-brand-block">
            <div className="school-crest-badge"><Building2 size={36} /></div>
            <div className="school-text-meta">
              <h2 className="school-name">{activeSchool?.name || '—'}</h2>
              <div className="school-sub">{isAlbanian ? 'Raport i notave aktuale' : 'Current course grade report'}</div>
            </div>
          </div>
        </div>
        <div className="student-credentials-grid">
          <div className="cred-field"><span className="cred-label">{isAlbanian ? 'Nxënësi' : 'Student'}</span><span className="cred-val highlight">{student?.name || currentUser?.displayName || '—'}</span></div>
          <div className="cred-field"><span className="cred-label">{isAlbanian ? 'Klasa' : 'Class'}</span><span className="cred-val">{studentClassLabel(student, groupsById) || '—'}</span></div>
          <div className="cred-field"><span className="cred-label">{isAlbanian ? 'Lëndë me nota' : 'Graded courses'}</span><span className="cred-val">{loading || !classesLoaded ? '—' : graded.length}</span></div>
          <div className="cred-field"><span className="cred-label">{isAlbanian ? 'Mesatarja e lëndëve me nota' : 'Average of graded courses'}</span><span className="cred-val">{loading || !classesLoaded || average === null ? '—' : `${average}%`}</span></div>
        </div>
        <p className="transcript-report-note">{isAlbanian ? 'Ky është raport i notave aktuale nga regjistri i lëndëve, jo transkript i certifikuar i notave përfundimtare ose i krediteve.' : 'This is a report of current course grades from the gradebook, not a certified record of final grades or credits.'}</p>
      </div>

      <div className="official-transcript-sheet glass transcript-records-card">
        <div className="transcript-filter-controls no-print">
          <div className="search-filter-box glass">
            <Search size={16} className="search-icon" />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={isAlbanian ? 'Kërko lëndën...' : 'Search courses...'} aria-label={isAlbanian ? 'Kërko lëndën' : 'Search courses'} />
          </div>
        </div>
        {error ? <div className="empty-transcript-state"><h4>{isAlbanian ? 'Notat nuk mund të ngarkohen' : 'Grades could not be loaded'}</h4><p>{isAlbanian ? 'Kontrolloni qasjen në lëndë dhe provoni përsëri.' : 'Check course access and try again.'}</p></div>
          : (loading || !classesLoaded) ? <div className="empty-transcript-state"><p>{isAlbanian ? 'Po ngarkohen notat...' : 'Loading grades...'}</p></div>
            : !student ? <div className="empty-transcript-state"><p>{isAlbanian ? 'Nuk u gjet profili juaj i nxënësit në këtë shkollë.' : 'Your student profile was not found in this school.'}</p></div>
              : rows.length === 0 ? <div className="empty-transcript-state"><p>{isAlbanian ? 'Nuk ka lëndë që përputhen me kërkimin tuaj.' : 'No enrolled courses match your search.'}</p></div>
                : <div className="courses-table-wrapper"><table className="transcript-courses-table"><thead><tr>
                  <th>{isAlbanian ? 'Kodi' : 'Code'}</th><th>{isAlbanian ? 'Lënda' : 'Course'}</th><th>{isAlbanian ? 'Mësuesi' : 'Teacher'}</th><th>{isAlbanian ? 'Nota aktuale' : 'Current grade'}</th>
                </tr></thead><tbody>{rows.map(row => <tr key={row.id}><td className="font-mono course-code">{row.code}</td><td className="course-title-cell"><strong>{row.name}</strong></td><td>{row.teacher}</td><td className="grade-cell">{row.grade === null ? '—' : `${row.grade}%`}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
};

export default Transcript;
