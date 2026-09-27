import React, { useEffect, useId, useRef, useState } from 'react';
import { BookOpen, Layers3, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { CURRICULAR_AREAS, parseClassLabel } from '../features/lessonPlans';
import { translateCatalogValue } from '../features/lessonPlans/i18n';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import './LessonPlanAdminSettings.css';

const copy = {
  en: {
    missingGrades: 'Enter at least one grade.',
    missingClasses: 'Enter at least one class.',
    invalidGrade: 'Grade “{value}” was not recognized. Try VI, VII, or Preparatory.',
    invalidClass: 'Class “{value}” was not recognized. Try VI/2 or VII/1.',
    classes: 'Classes: {value}', grades: 'Grades: {value}', allClasses: 'All classes',
    class: 'Class {value}', grade: 'Grade {value}',
    subjectNameRequired: 'Enter a subject name.',
    invalidArea: 'Choose a valid curricular area.',
    duplicateSubject: 'This subject already has a school mapping. Edit the existing entry.',
    subjectUpdated: 'Subject mapping updated.', subjectAdded: 'Subject mapping added.',
    subjectSaveFailed: 'The subject mapping could not be saved.',
    invalidStageGrade: 'Enter a valid grade, such as VI or Preparatory.',
    invalidStageClass: 'Enter a valid class, such as VI/2.',
    stageRequired: 'Enter the curriculum stage.',
    duplicateStage: 'This class or grade already has a curriculum stage. Edit the existing entry.',
    stageUpdated: 'Curriculum stage updated.', stageAdded: 'Curriculum stage added.',
    stageSaveFailed: 'The curriculum stage could not be saved.',
    removeSubjectConfirm: 'Remove the subject mapping for “{value}”?',
    removeSubjectTitle: 'Remove subject mapping?',
    subjectRemoved: 'Subject mapping removed.', subjectRemoveFailed: 'The subject mapping could not be removed.',
    removeStageConfirm: 'Remove the curriculum stage mapping for {value}?',
    removeStageTitle: 'Remove curriculum stage?',
    stageRemoved: 'Curriculum stage mapping removed.', stageRemoveFailed: 'The curriculum stage mapping could not be removed.',
    subjectHeading: 'School subjects',
    subjectDescription: 'Approved school mappings take priority over the general subject catalog.',
    subject: 'Subject', subjectPlaceholder: 'e.g. Mathematics',
    curricularArea: 'Curricular area', scope: 'Applies to',
    byGrade: 'Specific grades', byClass: 'Specific classes',
    gradePlural: 'Grades', classPlural: 'Classes / sections',
    aliases: 'Alternative names (optional)', aliasesPlaceholder: 'Separate with commas',
    active: 'Show this subject in the plan selector',
    saveChanges: 'Save changes', addSubject: 'Add subject', cancel: 'Cancel',
    subjectMappings: 'Saved subject mappings',
    noSubjectMappings: 'No school mappings yet. Subjects from the general catalog are still available.',
    approved: 'Approved', unapproved: 'Unapproved', inactive: 'Inactive',
    editSubject: 'Edit subject {value}', removeSubject: 'Remove subject {value}',
    edit: 'Edit', remove: 'Remove',
    stageHeading: 'Curriculum stages',
    stageDescription: 'Set the stage for a grade or a specific class section.',
    gradeSingular: 'Grade', classSingular: 'Class / section',
    gradePlaceholder: 'e.g. VI', classPlaceholder: 'e.g. VI/2',
    stage: 'Curriculum stage', stagePlaceholder: 'e.g. Stage III',
    addStage: 'Add stage', savedStages: 'Saved curriculum stages',
    noStages: 'No school exceptions yet. The general grade-to-stage mapping applies.',
    editStage: 'Edit {value}', removeStage: 'Remove {value}',
  },
  sq: {
    missingGrades: 'Shënoni të paktën një vit shkollor.',
    missingClasses: 'Shënoni të paktën një klasë.',
    invalidGrade: 'Viti “{value}” nuk njihet. Përdorni p.sh. VI, VII ose Përgatitore.',
    invalidClass: 'Klasa “{value}” nuk njihet. Përdorni p.sh. VI/2 ose VII/1.',
    classes: 'Klasat: {value}', grades: 'Vitet: {value}', allClasses: 'Të gjitha klasat',
    class: 'Klasa {value}', grade: 'Viti {value}',
    subjectNameRequired: 'Shënoni emrin e lëndës.',
    invalidArea: 'Zgjidhni një fushë kurrikulare të vlefshme.',
    duplicateSubject: 'Kjo lëndë ka tashmë një hartë të shkollës. Redaktoni regjistrimin ekzistues.',
    subjectUpdated: 'Harta e lëndës u përditësua.', subjectAdded: 'Harta e lëndës u shtua.',
    subjectSaveFailed: 'Harta e lëndës nuk u ruajt.',
    invalidStageGrade: 'Zgjidhni një vit të vlefshëm, p.sh. VI ose Përgatitore.',
    invalidStageClass: 'Shënoni një klasë të vlefshme, p.sh. VI/2.',
    stageRequired: 'Shënoni shkallën e kurrikulës.',
    duplicateStage: 'Kjo klasë ose ky vit ka tashmë një shkallë. Redaktoni regjistrimin ekzistues.',
    stageUpdated: 'Shkalla e kurrikulës u përditësua.', stageAdded: 'Shkalla e kurrikulës u shtua.',
    stageSaveFailed: 'Shkalla e kurrikulës nuk u ruajt.',
    removeSubjectConfirm: 'Të hiqet harta e lëndës “{value}”?',
    removeSubjectTitle: 'Të hiqet harta e lëndës?',
    subjectRemoved: 'Harta e lëndës u hoq.', subjectRemoveFailed: 'Harta e lëndës nuk u hoq.',
    removeStageConfirm: 'Të hiqet harta e shkallës për {value}?',
    removeStageTitle: 'Të hiqet shkalla e kurrikulës?',
    stageRemoved: 'Harta e shkallës u hoq.', stageRemoveFailed: 'Harta e shkallës nuk u hoq.',
    subjectHeading: 'Lëndët e shkollës',
    subjectDescription: 'Hartat e miratuara të shkollës kanë përparësi ndaj katalogut të përgjithshëm.',
    subject: 'Lënda', subjectPlaceholder: 'P.sh. Matematikë',
    curricularArea: 'Fusha kurrikulare', scope: 'Zbatimi',
    byGrade: 'Sipas vitit shkollor', byClass: 'Sipas klasës/paraleles',
    gradePlural: 'Vitet shkollore', classPlural: 'Klasat / paralelet',
    aliases: 'Emra alternativë (opsionale)', aliasesPlaceholder: 'Ndajini me presje',
    active: 'Lënda aktive në zgjedhësin e planit',
    saveChanges: 'Ruaj ndryshimet', addSubject: 'Shto lëndën', cancel: 'Anulo',
    subjectMappings: 'Hartat e ruajtura',
    noSubjectMappings: 'Ende nuk ka harta të shkollës. Vlerat e katalogut të përgjithshëm mbeten të disponueshme.',
    approved: 'Miratuar', unapproved: 'Pa miratim', inactive: 'Joaktive',
    editSubject: 'Redakto lëndën {value}', removeSubject: 'Hiq lëndën {value}',
    edit: 'Redakto', remove: 'Hiq',
    stageHeading: 'Shkallët e kurrikulës',
    stageDescription: 'Përcaktoni shkallën për një vit shkollor ose një paralele të veçantë.',
    gradeSingular: 'Vit shkollor', classSingular: 'Klasë / paralele',
    gradePlaceholder: 'P.sh. VI', classPlaceholder: 'P.sh. VI/2',
    stage: 'Shkalla e kurrikulës', stagePlaceholder: 'P.sh. Shkalla III',
    addStage: 'Shto shkallën', savedStages: 'Shkallët e ruajtura',
    noStages: 'Ende nuk ka përjashtime të shkollës. Përdoret ndarja e përgjithshme sipas vitit shkollor.',
    editStage: 'Redakto {value}', removeStage: 'Hiq {value}',
  },
};

function textFor(language, key, values = {}) {
  const locale = String(language ?? 'en').toLowerCase().startsWith('sq') ? 'sq' : 'en';
  return (copy[locale][key] ?? copy.en[key] ?? key).replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}

function validationError(message) {
  const error = new Error(message);
  error.isAdminValidation = true;
  return error;
}

function displayGrade(language, value) {
  return String(language ?? 'en').toLowerCase().startsWith('sq') ? value : String(value ?? '').replace(/^Përgatitore$/i, 'Preparatory');
}

function displayStage(language, value) {
  return String(language ?? 'en').toLowerCase().startsWith('sq') ? value : String(value ?? '').replace(/^Shkalla\s+(I|II|III|IV|V|VI)$/i, 'Stage $1');
}

const EMPTY_SUBJECT = () => ({
  name: '', area: CURRICULAR_AREAS[0], scope: 'all', targets: '', aliases: '', active: true,
});
const EMPTY_STAGE = () => ({ scope: 'grade', target: '', stage: '' });
const normalize = (value) => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sq-AL').replace(/\s+/g, ' ');
const splitValues = (value) => [...new Set(String(value ?? '').split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean))];

function subjectDraftFrom(record) {
  const scope = record.classes?.length ? 'classes' : record.grades?.length ? 'grades' : 'all';
  return {
    name: record.name ?? record.subject ?? '',
    area: record.area ?? record.curricularArea ?? CURRICULAR_AREAS[0],
    scope,
    targets: (scope === 'classes' ? record.classes : scope === 'grades' ? record.grades : []).join(', '),
    aliases: (record.aliases ?? []).join(', '),
    active: record.active !== false,
  };
}

function stageDraftFrom(record) {
  return {
    scope: record.classLabel ? 'class' : 'grade',
    target: record.classLabel ?? String(record.grade ?? record.grades?.[0] ?? ''),
    stage: record.stage ?? '',
  };
}

function targetList(value, scope, t) {
  const values = splitValues(value);
  if (scope === 'all') return [];
  if (!values.length) throw validationError(t(scope === 'grades' ? 'missingGrades' : 'missingClasses'));
  return values.map((value) => {
    const parsed = parseClassLabel(value);
    if (!parsed || (scope === 'grades' && parsed.section) || (scope === 'classes' && !parsed.section)) {
      throw validationError(t(scope === 'grades' ? 'invalidGrade' : 'invalidClass', { value }));
    }
    return scope === 'grades' ? parsed.gradeLabel : parsed.classLabel;
  });
}

function describeSubjectScope(record, t) {
  if (record.classes?.length) return t('classes', { value: record.classes.join(', ') });
  if (record.grades?.length) return t('grades', { value: record.grades.join(', ') });
  return t('allClasses');
}

function describeStageScope(record, t, language) {
  return record.classLabel ? t('class', { value: record.classLabel }) : t('grade', { value: displayGrade(language, record.grade ?? record.grades?.join(', ') ?? '') });
}

export default function LessonPlanAdminSettings({ repository, onChange, notify, language = 'en' }) {
  const t = (key, values) => textFor(language, key, values);
  const idPrefix = useId();
  const deleteTrigger = useRef(null);
  const { activeSchoolId } = useAuth();
  const [subjects, setSubjects] = useState(() => repository.listSubjectMappings());
  const [stages, setStages] = useState(() => repository.listStageMappings());
  const [subjectDraft, setSubjectDraft] = useState(EMPTY_SUBJECT);
  const [stageDraft, setStageDraft] = useState(EMPTY_STAGE);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingStageId, setEditingStageId] = useState(null);
  const [subjectError, setSubjectError] = useState('');
  const [stageError, setStageError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Real-time synchronization of curriculum mappings from Firestore
  useEffect(() => {
    if (!activeSchoolId) return;

    const subCol = collection(db, 'schools', activeSchoolId, 'subjectMappings');
    const unsubSub = onSnapshot(subCol, (snap) => {
      snap.forEach(docSnap => {
        try {
          repository.saveSubjectMapping({ id: docSnap.id, ...docSnap.data() }, { isAdmin: true });
        } catch {}
      });
      setSubjects(repository.listSubjectMappings());
    }, (err) => console.warn('Subject mappings cloud sync notice:', err.message));

    const stageCol = collection(db, 'schools', activeSchoolId, 'stageMappings');
    const unsubStage = onSnapshot(stageCol, (snap) => {
      snap.forEach(docSnap => {
        try {
          repository.saveStageMapping({ id: docSnap.id, ...docSnap.data() }, { isAdmin: true });
        } catch {}
      });
      setStages(repository.listStageMappings());
    }, (err) => console.warn('Stage mappings cloud sync notice:', err.message));

    return () => {
      unsubSub();
      unsubStage();
    };
  }, [activeSchoolId, repository]);

  const closeConfirmation = () => {
    setConfirmDelete(null);
    queueMicrotask(() => deleteTrigger.current?.focus());
  };

  const requestRemoval = (kind, record, event) => {
    deleteTrigger.current = event.currentTarget;
    setConfirmDelete({ kind, record });
  };

  const handleConfirmationKeys = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeConfirmation();
    } else if (event.key === 'Tab') {
      const buttons = [...event.currentTarget.querySelectorAll('button')];
      const first = buttons[0];
      const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  const refresh = () => {
    setSubjects(repository.listSubjectMappings());
    setStages(repository.listStageMappings());
    onChange?.();
  };

  const resetSubject = () => {
    setSubjectDraft(EMPTY_SUBJECT());
    setEditingSubjectId(null);
    setSubjectError('');
  };

  const resetStage = () => {
    setStageDraft(EMPTY_STAGE());
    setEditingStageId(null);
    setStageError('');
  };

  const saveSubject = (event) => {
    event.preventDefault();
    try {
      const name = subjectDraft.name.trim();
      if (!name) throw validationError(t('subjectNameRequired'));
      if (!CURRICULAR_AREAS.includes(subjectDraft.area)) throw validationError(t('invalidArea'));
      const duplicate = subjects.find((record) => record.id !== editingSubjectId && normalize(record.name ?? record.subject) === normalize(name));
      if (duplicate) throw validationError(t('duplicateSubject'));
      const targets = targetList(subjectDraft.targets, subjectDraft.scope, t);
      const previous = subjects.find((record) => record.id === editingSubjectId);
      const saved = repository.saveSubjectMapping({
        ...(previous ?? {}),
        name,
        area: subjectDraft.area,
        aliases: splitValues(subjectDraft.aliases),
        grades: subjectDraft.scope === 'grades' ? targets : [],
        classes: subjectDraft.scope === 'classes' ? targets : [],
        active: subjectDraft.active,
        validated: true,
      }, { isAdmin: true });
      if (activeSchoolId && saved?.id) {
        setDoc(doc(db, 'schools', activeSchoolId, 'subjectMappings', String(saved.id)), saved, { merge: true }).catch(() => {});
      }
      const wasEditing = Boolean(editingSubjectId);
      resetSubject();
      refresh();
      notify?.(t(wasEditing ? 'subjectUpdated' : 'subjectAdded'));
    } catch (error) {
      setSubjectError(error.isAdminValidation ? error.message : t('subjectSaveFailed'));
    }
  };

  const saveStage = (event) => {
    event.preventDefault();
    try {
      const parsed = parseClassLabel(stageDraft.target.trim());
      if (!parsed || (stageDraft.scope === 'grade' && parsed.section) || (stageDraft.scope === 'class' && !parsed.section)) {
        throw validationError(t(stageDraft.scope === 'grade' ? 'invalidStageGrade' : 'invalidStageClass'));
      }
      const stage = stageDraft.stage.trim();
      if (!stage) throw validationError(t('stageRequired'));
      const duplicate = stages.find((record) => record.id !== editingStageId && (
        stageDraft.scope === 'class'
          ? record.classLabel && normalize(record.classLabel) === normalize(parsed.classLabel)
          : !record.classLabel && parseClassLabel(String(record.grade ?? record.grades?.[0] ?? ''))?.grade === parsed.grade
      ));
      if (duplicate) throw validationError(t('duplicateStage'));
      const previous = stages.find((record) => record.id === editingStageId);
      const saved = repository.saveStageMapping({
        ...(previous ?? {}),
        grade: stageDraft.scope === 'grade' ? parsed.gradeLabel : undefined,
        classLabel: stageDraft.scope === 'class' ? parsed.classLabel : '',
        grades: [],
        stage,
        validated: true,
      }, { isAdmin: true });
      if (activeSchoolId && saved?.id) {
        setDoc(doc(db, 'schools', activeSchoolId, 'stageMappings', String(saved.id)), saved, { merge: true }).catch(() => {});
      }
      const wasEditing = Boolean(editingStageId);
      resetStage();
      refresh();
      notify?.(t(wasEditing ? 'stageUpdated' : 'stageAdded'));
    } catch (error) {
      setStageError(error.isAdminValidation ? error.message : t('stageSaveFailed'));
    }
  };

  const removeSubject = (record) => {
    try {
      repository.deleteSubjectMapping(record.id, { isAdmin: true });
      if (activeSchoolId && record?.id) {
        deleteDoc(doc(db, 'schools', activeSchoolId, 'subjectMappings', String(record.id))).catch(() => {});
      }
      if (editingSubjectId === record.id) resetSubject();
      refresh();
      notify?.(t('subjectRemoved'));
    } catch {
      setSubjectError(t('subjectRemoveFailed'));
    }
  };

  const removeStage = (record) => {
    try {
      repository.deleteStageMapping(record.id, { isAdmin: true });
      if (activeSchoolId && record?.id) {
        deleteDoc(doc(db, 'schools', activeSchoolId, 'stageMappings', String(record.id))).catch(() => {});
      }
      if (editingStageId === record.id) resetStage();
      refresh();
      notify?.(t('stageRemoved'));
    } catch {
      setStageError(t('stageRemoveFailed'));
    }
  };

  const confirmRemoval = () => {
    if (!confirmDelete) return;
    if (confirmDelete.kind === 'subject') removeSubject(confirmDelete.record);
    else removeStage(confirmDelete.record);
    closeConfirmation();
  };

  return (
    <div className="lp-admin-settings">
      <section className="lp-admin-card glass" aria-labelledby={`${idPrefix}-subjects-title`}>
        <div className="lp-admin-heading">
          <span className="lp-admin-heading-icon"><BookOpen size={20} /></span>
          <div>
            <h2 id={`${idPrefix}-subjects-title`}>{t('subjectHeading')}</h2>
            <p>{t('subjectDescription')}</p>
          </div>
        </div>

        <form className="lp-admin-form" onSubmit={saveSubject}>
          <div className="lp-admin-form-grid">
            <label className="lp-admin-field">
              <span>{t('subject')}</span>
              <input value={subjectDraft.name} onChange={(event) => setSubjectDraft({ ...subjectDraft, name: event.target.value })} placeholder={t('subjectPlaceholder')} required />
            </label>
            <label className="lp-admin-field">
              <span>{t('curricularArea')}</span>
              <select value={subjectDraft.area} onChange={(event) => setSubjectDraft({ ...subjectDraft, area: event.target.value })}>
                {CURRICULAR_AREAS.map((area) => <option key={area} value={area}>{translateCatalogValue(language, area)}</option>)}
              </select>
            </label>
            <label className="lp-admin-field">
              <span>{t('scope')}</span>
              <select value={subjectDraft.scope} onChange={(event) => setSubjectDraft({ ...subjectDraft, scope: event.target.value, targets: '' })}>
                <option value="all">{t('allClasses')}</option>
                <option value="grades">{t('byGrade')}</option>
                <option value="classes">{t('byClass')}</option>
              </select>
            </label>
            {subjectDraft.scope !== 'all' && (
              <label className="lp-admin-field">
                <span>{t(subjectDraft.scope === 'grades' ? 'gradePlural' : 'classPlural')}</span>
                <input value={subjectDraft.targets} onChange={(event) => setSubjectDraft({ ...subjectDraft, targets: event.target.value })} placeholder={subjectDraft.scope === 'grades' ? 'VI, VII' : 'VI/2, VII/1'} required />
              </label>
            )}
            <label className="lp-admin-field lp-admin-field-wide">
              <span>{t('aliases')}</span>
              <input value={subjectDraft.aliases} onChange={(event) => setSubjectDraft({ ...subjectDraft, aliases: event.target.value })} placeholder={t('aliasesPlaceholder')} />
            </label>
          </div>
          <label className="lp-admin-check"><input type="checkbox" checked={subjectDraft.active} onChange={(event) => setSubjectDraft({ ...subjectDraft, active: event.target.checked })} /> {t('active')}</label>
          {subjectError && <p className="lp-admin-error" role="alert">{subjectError}</p>}
          <div className="lp-admin-form-actions">
            <button type="submit" className="btn-primary"><Plus size={16} /> {t(editingSubjectId ? 'saveChanges' : 'addSubject')}</button>
            {editingSubjectId && <button type="button" className="btn-secondary" onClick={resetSubject}><X size={16} /> {t('cancel')}</button>}
          </div>
        </form>

        <div className="lp-admin-records">
          <h3>{t('subjectMappings')} <span>{subjects.length}</span></h3>
          {subjects.length === 0 ? <p className="lp-admin-empty">{t('noSubjectMappings')}</p> : (
            <ul>
              {subjects.map((record) => <li key={record.id} className="lp-admin-record">
                <div className="lp-admin-record-content">
                  <div className="lp-admin-record-title"><strong>{translateCatalogValue(language, record.name ?? record.subject)}</strong><span className={record.validated ? 'lp-admin-approved' : 'lp-admin-unapproved'}><ShieldCheck size={12} /> {t(record.validated ? 'approved' : 'unapproved')}</span></div>
                  <p>{translateCatalogValue(language, record.area ?? record.curricularArea)} · {describeSubjectScope(record, t)}{record.active === false ? ` · ${t('inactive')}` : ''}</p>
                </div>
                <div className="lp-admin-record-actions">
                  <button type="button" aria-label={t('editSubject', { value: translateCatalogValue(language, record.name ?? record.subject) })} title={t('edit')} onClick={() => { setEditingSubjectId(record.id); setSubjectDraft(subjectDraftFrom(record)); setSubjectError(''); }}><Pencil size={16} /></button>
                  <button type="button" aria-label={t('removeSubject', { value: translateCatalogValue(language, record.name ?? record.subject) })} title={t('remove')} onClick={(event) => requestRemoval('subject', record, event)}><Trash2 size={16} /></button>
                </div>
              </li>)}
            </ul>
          )}
        </div>
      </section>

      <section className="lp-admin-card glass" aria-labelledby={`${idPrefix}-stages-title`}>
        <div className="lp-admin-heading">
          <span className="lp-admin-heading-icon"><Layers3 size={20} /></span>
          <div>
            <h2 id={`${idPrefix}-stages-title`}>{t('stageHeading')}</h2>
            <p>{t('stageDescription')}</p>
          </div>
        </div>

        <form className="lp-admin-form" onSubmit={saveStage}>
          <div className="lp-admin-form-grid">
            <label className="lp-admin-field">
              <span>{t('scope')}</span>
              <select value={stageDraft.scope} onChange={(event) => setStageDraft({ ...stageDraft, scope: event.target.value, target: '' })}>
                <option value="grade">{t('gradeSingular')}</option>
                <option value="class">{t('classSingular')}</option>
              </select>
            </label>
            <label className="lp-admin-field">
              <span>{t(stageDraft.scope === 'grade' ? 'gradeSingular' : 'classSingular')}</span>
              <input value={stageDraft.target} onChange={(event) => setStageDraft({ ...stageDraft, target: event.target.value })} placeholder={t(stageDraft.scope === 'grade' ? 'gradePlaceholder' : 'classPlaceholder')} required />
            </label>
            <label className="lp-admin-field lp-admin-field-wide">
              <span>{t('stage')}</span>
              <input value={stageDraft.stage} onChange={(event) => setStageDraft({ ...stageDraft, stage: event.target.value })} placeholder={t('stagePlaceholder')} required />
            </label>
          </div>
          {stageError && <p className="lp-admin-error" role="alert">{stageError}</p>}
          <div className="lp-admin-form-actions">
            <button type="submit" className="btn-primary"><Plus size={16} /> {t(editingStageId ? 'saveChanges' : 'addStage')}</button>
            {editingStageId && <button type="button" className="btn-secondary" onClick={resetStage}><X size={16} /> {t('cancel')}</button>}
          </div>
        </form>

        <div className="lp-admin-records">
          <h3>{t('savedStages')} <span>{stages.length}</span></h3>
          {stages.length === 0 ? <p className="lp-admin-empty">{t('noStages')}</p> : (
            <ul>
              {stages.map((record) => <li key={record.id} className="lp-admin-record">
                <div className="lp-admin-record-content">
                  <div className="lp-admin-record-title"><strong>{describeStageScope(record, t, language)}</strong><span className={record.validated ? 'lp-admin-approved' : 'lp-admin-unapproved'}><ShieldCheck size={12} /> {t(record.validated ? 'approved' : 'unapproved')}</span></div>
                  <p>{displayStage(language, record.stage)}</p>
                </div>
                <div className="lp-admin-record-actions">
                  <button type="button" aria-label={t('editStage', { value: describeStageScope(record, t, language) })} title={t('edit')} onClick={() => { setEditingStageId(record.id); setStageDraft(stageDraftFrom(record)); setStageError(''); }}><Pencil size={16} /></button>
                  <button type="button" aria-label={t('removeStage', { value: describeStageScope(record, t, language) })} title={t('remove')} onClick={(event) => requestRemoval('stage', record, event)}><Trash2 size={16} /></button>
                </div>
              </li>)}
            </ul>
          )}
        </div>
      </section>
      {confirmDelete && (
        <div className="lp-admin-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeConfirmation(); }}>
          <div
            className="lp-admin-confirm-card glass"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${idPrefix}-confirm-title`}
            aria-describedby={`${idPrefix}-confirm-description`}
            onKeyDown={handleConfirmationKeys}
          >
            <h2 id={`${idPrefix}-confirm-title`}>{t(confirmDelete.kind === 'subject' ? 'removeSubjectTitle' : 'removeStageTitle')}</h2>
            <p id={`${idPrefix}-confirm-description`}>{confirmDelete.kind === 'subject'
              ? t('removeSubjectConfirm', { value: translateCatalogValue(language, confirmDelete.record.name ?? confirmDelete.record.subject) })
              : t('removeStageConfirm', { value: describeStageScope(confirmDelete.record, t, language) })}</p>
            <div className="lp-admin-confirm-actions">
              <button type="button" className="btn-secondary" onClick={closeConfirmation} autoFocus>{t('cancel')}</button>
              <button type="button" className="lp-admin-confirm-remove" onClick={confirmRemoval}><Trash2 size={16} /> {t('remove')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
