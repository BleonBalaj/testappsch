import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useSchoolData } from '../../context/SchoolDataContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  GRADE_LEVELS, MAX_SECTION_LENGTH, classGroupLabel, cleanSection, gradeLevelName, validateClassGroupDraft,
} from '../../features/classGroups';

const ERRORS = {
  grade: ['Choose the grade level.', 'Zgjidhni nivelin e klasës.'],
  section: ['Use letters or numbers for the section, for example A or 1.', 'Përdorni shkronja ose numra për paralelen, p.sh. A ose 1.'],
  teacher: ['Choose the homeroom teacher.', 'Zgjidhni mësimdhënësin kujdestar.'],
  duplicate: ['This class already exists.', 'Kjo klasë ekziston tashmë.'],
};

const ClassGroupForm = ({ mode, group, onClose, addNotification }) => {
  const { classGroups = [], staffList = [], addClassGroup, updateClassGroup } = useSchoolData();
  const { isAlbanian } = useLanguage();
  const editing = mode === 'edit' && group;
  const [draft, setDraft] = useState(() => ({
    gradeLevel: editing ? String(group.gradeLevel) : '',
    section: editing ? group.section || '' : '',
    homeroomTeacherId: editing ? group.homeroomTeacherId || '' : '',
    room: editing ? group.room || '' : '',
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const staffOptions = useMemo(() => {
    const options = [...staffList].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'sq'));
    if (editing && group.homeroomTeacherId && !options.some(member => String(member.id) === String(group.homeroomTeacherId))) {
      options.push({ id: group.homeroomTeacherId, name: `${group.homeroomTeacherName || '—'} ${isAlbanian ? '(nuk është më në staf)' : '(no longer on staff)'}`, missing: true });
    }
    return options;
  }, [staffList, editing, group, isAlbanian]);

  const preview = draft.gradeLevel === '' ? '' : classGroupLabel({ gradeLevel: Number(draft.gradeLevel), section: draft.section });
  const liveError = draft.gradeLevel === '' ? '' : validateClassGroupDraft({ ...draft, gradeLevel: Number(draft.gradeLevel), homeroomTeacherId: 'x' }, classGroups, editing ? group.id : '');
  const renamed = editing && preview && preview !== group.label;
  const update = patch => { setDraft(previous => ({ ...previous, ...patch })); setError(''); };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = { ...draft, gradeLevel: draft.gradeLevel === '' ? '' : Number(draft.gradeLevel) };
    const code = validateClassGroupDraft(payload, classGroups, editing ? group.id : '');
    if (code) { setError(ERRORS[code][isAlbanian ? 1 : 0]); return; }
    setSaving(true);
    try {
      if (editing) {
        const saved = await updateClassGroup(group.id, payload);
        addNotification?.('success', isAlbanian ? `Klasa ${saved.label} u ruajt.` : `Class ${saved.label} saved.`);
      } else {
        const saved = await addClassGroup(payload);
        addNotification?.('success', isAlbanian ? `Klasa ${saved.label} u krijua.` : `Class ${saved.label} created.`);
      }
      onClose();
    } catch (saveError) {
      setError(saveError.message || (isAlbanian ? 'Klasa nuk u ruajt.' : 'The class could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <motion.div
        className="modal-content"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cg-form-title"
      >
        <div className="modal-header">
          <h3 id="cg-form-title">{editing ? (isAlbanian ? `Ndrysho klasën ${group.label}` : `Edit class ${group.label}`) : (isAlbanian ? 'Krijo klasë' : 'Create class')}</h3>
          <p className="modal-subtitle">{isAlbanian
            ? 'Klasa është grupi i nxënësve (p.sh. 10A) me mësimdhënësin kujdestar. Orari vjen nga lëndët e lidhura.'
            : 'A class is a group of students (for example 10A) with its homeroom teacher. Its timetable comes from linked courses.'}</p>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label={isAlbanian ? 'Mbyll' : 'Close'} disabled={saving}><X size={16} /></button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="cg-notice is-error" role="alert">{error}</div>}
          <div className="form-grid-2">
            <div className="input-group">
              <label htmlFor="cg-grade">{isAlbanian ? 'Niveli' : 'Grade level'} <span className="cg-required">*</span></label>
              <select id="cg-grade" className="custom-form-select" value={draft.gradeLevel} onChange={event => update({ gradeLevel: event.target.value })} required>
                <option value="">{isAlbanian ? 'Zgjidhni nivelin' : 'Choose grade level'}</option>
                {GRADE_LEVELS.map(level => <option key={level} value={level}>{gradeLevelName(level, isAlbanian)}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label htmlFor="cg-section">{isAlbanian ? 'Paralelja' : 'Section'}</label>
              <input id="cg-section" type="text" value={draft.section} maxLength={MAX_SECTION_LENGTH + 4}
                placeholder={isAlbanian ? 'p.sh. A ose 1 (opsionale)' : 'e.g. A or 1 (optional)'}
                onChange={event => update({ section: event.target.value })} />
            </div>
          </div>
          <div className={`cg-preview ${liveError === 'duplicate' ? 'is-error' : ''}`} aria-live="polite">
            {preview
              ? (liveError === 'duplicate'
                ? (isAlbanian ? `Klasa ${preview} ekziston tashmë.` : `Class ${preview} already exists.`)
                : <>{isAlbanian ? 'Emri i klasës:' : 'Class name:'} <strong>{preview}</strong>{draft.section && cleanSection(draft.section) !== draft.section.trim() ? ` (${isAlbanian ? 'vetëm shkronja dhe numra' : 'letters and numbers only'})` : ''}</>)
              : (isAlbanian ? 'Zgjidhni nivelin për të parë emrin e klasës.' : 'Choose a grade level to see the class name.')}
          </div>
          {renamed && (
            <p className="cg-hint">{isAlbanian
              ? `Emri ndryshon nga ${group.label} në ${preview} për të gjithë nxënësit dhe lëndët e saj.`
              : `The name changes from ${group.label} to ${preview} for all of its students and courses.`}</p>
          )}
          <div className="form-grid-2">
            <div className="input-group">
              <label htmlFor="cg-teacher">{isAlbanian ? 'Mësimdhënësi kujdestar' : 'Homeroom teacher'} <span className="cg-required">*</span></label>
              <select id="cg-teacher" className="custom-form-select" value={draft.homeroomTeacherId} onChange={event => update({ homeroomTeacherId: event.target.value })} required>
                <option value="">{isAlbanian ? 'Zgjidhni mësimdhënësin' : 'Choose a teacher'}</option>
                {staffOptions.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email}{!member.missing && (member.roleName || member.department) ? ` (${member.roleName || member.department})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label htmlFor="cg-room">{isAlbanian ? 'Salla (opsionale)' : 'Room (optional)'}</label>
              <input id="cg-room" type="text" value={draft.room} maxLength={100} placeholder={isAlbanian ? 'p.sh. Salla 12' : 'e.g. Room 12'} onChange={event => update({ room: event.target.value })} />
            </div>
          </div>
          <div className="modal-footer-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>{isAlbanian ? 'Anulo' : 'Cancel'}</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (isAlbanian ? 'Duke ruajtur…' : 'Saving…') : editing ? (isAlbanian ? 'Ruaj ndryshimet' : 'Save changes') : (isAlbanian ? 'Krijo klasën' : 'Create class')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ClassGroupForm;
