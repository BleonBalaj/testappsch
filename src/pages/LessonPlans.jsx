import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArrowDown, ArrowLeft, ArrowUp, BookOpen, CalendarDays, Check,
  ChevronDown, Clock3, Copy, Download, FilePlus2, FileText, FolderArchive,
  LayoutTemplate, List, ListOrdered, Plus, Printer,
  RotateCcw, Save, Search, Settings2, Sparkles, Trash2, X, Upload
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import {
  SUBJECTS, changePlanClass, changePlanSubject, createLessonPlanRepository,
  createPlan, dateInTimeZone, duplicatePlan, getDateRange, getSubjectArea, listSubjects, stageForClass,
} from '../features/lessonPlans/index.js';
import { translate, translateCatalogValue } from '../features/lessonPlans/i18n';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { compressImageFile } from '../services/imageUtils';
import LessonPlanDocument from './LessonPlanDocument';
import LessonPlanAdminSettings from './LessonPlanAdminSettings';
import LessonAiAssistanceCard from '../components/LessonAiAssistanceCard';
import './LessonPlans.css';

const DATE_OPTIONS = ['all', 'today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'last7Days', 'custom'];
const REUSABLE_TYPES = ['resources', 'methodology', 'assessment', 'crossCurricular', 'competencyOutcomes', 'fieldOutcomes'];
const SCHOOL_TIME_ZONE = 'Europe/Belgrade';
const LessonLanguageContext = React.createContext('en');

const todayLocal = () => dateInTimeZone(new Date(), SCHOOL_TIME_ZONE);
const dateLabel = (value, language) => value ? (language === 'sq' ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`))) : translate(language, 'date.noDate');
const escapeQuery = (value) => String(value ?? '').toLocaleLowerCase('sq-AL').trim();
const unique = (values) => [...new Set(values.filter(Boolean))];
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const stageLabel = (value, language) => language === 'en' ? String(value ?? '').replace(/^Shkalla\s+/i, 'Stage ') : value;

function dateMatches(value, preset, from, to) {
  if (preset === 'all') return true;
  if (!value) return false;
  if (preset === 'custom') return (!from || value >= from) && (!to || value <= to);
  const { startDate, endDate } = getDateRange(preset, { timeZone: SCHOOL_TIME_ZONE });
  return value >= startDate && value <= endDate;
}

function SubjectPicker({ value, onChange, classLabel, schoolSubjects }) {
  const language = React.useContext(LessonLanguageContext);
  const t = (key) => translate(language, key);
  const ct = (valueToTranslate) => translateCatalogValue(language, valueToTranslate);
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);
  const matches = listSubjects({ classLabel, schoolSubjects }).filter((item) => !open || !query || escapeQuery([ct(item.name), ct(item.area), item.name, item.area, ...item.aliases].join(' ')).includes(escapeQuery(query)));
  const pick = (subject) => { setQuery(ct(subject)); onChange(subject); setOpen(false); };
  return <div className="lesson-subject-picker" ref={rootRef}>
    <input role="combobox" aria-label={t('editor.subjectSearchAria')} aria-expanded={open} aria-controls="lesson-subject-results"
      value={open ? query : ct(value || '')} placeholder={t('editor.subjectSearchPlaceholder')} autoComplete="off"
      onFocus={() => { setQuery(ct(value || '')); setOpen(true); setActiveIndex(0); }}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
        if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, matches.length - 1)); }
        if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
        if (event.key === 'Enter' && open && matches[activeIndex]) { event.preventDefault(); pick(matches[activeIndex].name); }
      }}
      onBlur={(event) => { if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false); }} />
    <button type="button" className="lesson-picker-chevron" aria-label={t('editor.browseSubjectsAria')} onClick={() => { setQuery(ct(value || '')); setOpen(!open); }}><ChevronDown size={16} /></button>
    {open && <div className="lesson-subject-options" id="lesson-subject-results" role="listbox">
      {matches.length ? matches.map((item, index) => <React.Fragment key={item.name}>
        {(index === 0 || matches[index - 1].area !== item.area) && <div className="lesson-subject-group">{ct(item.area)}</div>}
        <button type="button" role="option" aria-selected={item.name === value} className={index === activeIndex ? 'active' : ''}
          onPointerDown={(event) => event.preventDefault()} onClick={() => pick(item.name)}>{ct(item.name)}</button>
      </React.Fragment>) : <p className="lesson-picker-empty">{t('editor.noSubjectFound')}</p>}
    </div>}
  </div>;
}

function Field({ label, hint, auto, children, className = '' }) {
  const language = React.useContext(LessonLanguageContext);
  return <label className={`lesson-field ${className}`}>
    <span className="lesson-field-heading"><span>{label}</span>{auto && <em>{translate(language, 'editor.autoFilled')}</em>}</span>
    {children}{hint && <small>{hint}</small>}
  </label>;
}

function ListEditor({ label, values = [], onChange, placeholder, reusable = [] }) {
  const language = React.useContext(LessonLanguageContext);
  const t = (key, valuesToInsert) => translate(language, key, valuesToInsert);
  const rows = values.length ? values : [''];
  const update = (index, value) => onChange(rows.map((entry, current) => current === index ? value : entry));
  const move = (index, direction) => {
    const next = [...rows]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return <div className="lesson-list-editor">
    <span className="lesson-field-heading"><span>{label}</span></span>
    {rows.map((value, index) => <div className="lesson-list-row" key={index}>
      <span className="lesson-list-number">{index + 1}</span>
      <input value={value} onChange={(event) => update(index, event.target.value)} placeholder={placeholder} />
      <button type="button" title={t('editor.moveUpTitle')} aria-label={t('editor.moveOutcomeUpAria', { index: index + 1 })} onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp size={14} /></button>
      <button type="button" title={t('editor.moveDownTitle')} aria-label={t('editor.moveOutcomeDownAria', { index: index + 1 })} onClick={() => move(index, 1)} disabled={index === rows.length - 1}><ArrowDown size={14} /></button>
      <button type="button" title={t('editor.removeTitle')} aria-label={t('editor.removeOutcomeAria', { index: index + 1 })} onClick={() => onChange(rows.length === 1 ? [''] : rows.filter((_, current) => current !== index))}><X size={14} /></button>
    </div>)}
    <div className="lesson-inline-actions"><button type="button" onClick={() => onChange([...rows, ''])}><Plus size={14} /> {t('editor.addRow')}</button>
      {reusable.length > 0 && <select aria-label={t('editor.chooseSavedAria', { label: label.toLowerCase() })} value="" onChange={(event) => { if (event.target.value) onChange([...rows.filter(Boolean), event.target.value]); }}><option value="">{t('editor.useSaved')}</option>{reusable.map((entry) => <option key={entry.id || entry.text} value={entry.text}>{entry.text}</option>)}</select>}
    </div>
  </div>;
}

function RichEditor({ label, value, onChange, placeholder, tall = false, reusable = [] }) {
  const language = React.useContext(LessonLanguageContext);
  const t = (key, valuesToInsert) => translate(language, key, valuesToInsert);
  const ref = useRef(null);
  const insert = (kind) => {
    const element = ref.current; if (!element) return;
    const start = element.selectionStart, end = element.selectionEnd;
    const selected = value.slice(start, end);
    const prefix = kind === 'bold' ? '**' : kind === 'bullet' ? '• ' : '1. ';
    const suffix = kind === 'bold' ? '**' : '';
    const next = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(start + prefix.length, start + prefix.length + selected.length); });
  };
  return <div className="lesson-rich-field">
    <div className="lesson-rich-heading"><span>{label}</span><div className="lesson-rich-tools">
      <button type="button" onClick={() => insert('bold')} title={t('editor.boldAria')} aria-label={t('editor.boldAria')}><strong>B</strong></button>
      <button type="button" onClick={() => insert('bullet')} title={t('editor.bulletedListAria')} aria-label={t('editor.bulletedListAria')}><List size={15} /></button>
      <button type="button" onClick={() => insert('number')} title={t('editor.numberedListAria')} aria-label={t('editor.numberedListAria')}><ListOrdered size={15} /></button>
    </div></div>
    <textarea ref={ref} value={value || ''} onChange={(event) => onChange(event.target.value)} rows={tall ? 12 : 5} placeholder={placeholder} />
    {reusable.length > 0 && <select className="lesson-reuse-select" aria-label={t('editor.addSavedAria', { label: label.toLowerCase() })} value="" onChange={(event) => { if (event.target.value) onChange([value?.trim(), event.target.value].filter(Boolean).join('\n')); }}><option value="">{t('editor.addSaved')}</option>{reusable.map((entry) => <option key={entry.id || entry.text} value={entry.text}>{entry.text}</option>)}</select>}
  </div>;
}

function Section({ id, title, subtitle, children, open, onToggle }) {
  return <section className="lesson-editor-section glass" id={id}>
    <button type="button" className="lesson-section-toggle" aria-expanded={open} onClick={onToggle}>
      <span><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span><ChevronDown className={open ? 'is-open' : ''} size={20} />
    </button>{open && <div className="lesson-section-body">{children}</div>}
  </section>;
}

function LessonPlans({ initialView = 'plans', userRole = 'teacher', currentUser = {}, language = 'en', onLanguageChange, scheduledLesson = null, onScheduledLessonConsumed }) {
  const t = (key, values) => translate(language, key, values);
  const ct = (value) => translateCatalogValue(language, value);
  const { staffList } = useSchoolData();
  const { 
    activeSchoolId, 
    activeSchool, 
    currentUser: authUser, 
    schoolPreferences, 
    updateSchoolPreferences 
  } = useAuth();
  const effectiveUid = authUser?.uid || currentUser?.uid;
  const teacherId = currentUser?.email || authUser?.email || effectiveUid || 'user@noesishorizon.edu';
  const repository = useMemo(() => createLessonPlanRepository(teacherId, { schoolId: activeSchoolId || 'default' }), [teacherId, activeSchoolId]);
  const [view, setView] = useState(initialView);
  const [plans, setPlans] = useState(() => repository.listPlans());
  const [preferences, setPreferences] = useState(() => {
    const saved = repository.getPreferences();
    const staff = staffList.find((person) => person.email?.toLowerCase() === teacherId.toLowerCase());
    return { 
      ...saved, 
      ...(schoolPreferences || {}),
      teacherName: schoolPreferences?.teacherName || saved.teacherName || currentUser.name || staff?.name || 'Educator', 
      schoolName: schoolPreferences?.schoolName || activeSchool?.name || saved.schoolName || 'Noesis Horizon',
      schoolLogo: schoolPreferences?.schoolLogo || activeSchool?.logo || activeSchool?.schoolLogo || saved.schoolLogo || ''
    };
  });
  const [settingsDraft, setSettingsDraft] = useState(() => preferences);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Real-time synchronization of cloud schoolPreferences and school document (logo, name)
  useEffect(() => {
    if (!schoolPreferences && !activeSchool) return;
    const currentSaved = repository.getPreferences();
    const staff = staffList.find((person) => person.email?.toLowerCase() === teacherId.toLowerCase());
    const merged = {
      ...currentSaved,
      ...(schoolPreferences || {}),
      teacherName: schoolPreferences?.teacherName || currentSaved.teacherName || currentUser?.name || staff?.name || 'Educator',
      schoolName: schoolPreferences?.schoolName || activeSchool?.name || currentSaved.schoolName || 'Noesis Horizon',
      schoolLogo: schoolPreferences?.schoolLogo || activeSchool?.logo || activeSchool?.schoolLogo || currentSaved.schoolLogo || ''
    };
    try {
      repository.savePreferences(merged);
    } catch {}
    setPreferences(merged);
    setSettingsDraft(prev => ({
      ...prev,
      ...merged
    }));
  }, [schoolPreferences, activeSchool, repository, teacherId, currentUser?.name, staffList]);

  const [templates, setTemplates] = useState(() => repository.listTemplates());
  const [topics, setTopics] = useState(() => repository.listTopics());
  const [reusable, setReusable] = useState(() => repository.listReusableEntries());
  const [schoolSubjects, setSchoolSubjects] = useState(() => repository.listSubjectMappings());
  const [activePlan, setActivePlan] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [documentLanguage, setDocumentLanguage] = useState(() => localStorage.getItem('lumi-lesson-document-language') === 'en' ? 'en' : 'sq');
  const changeDocumentLanguage = (next) => { 
    setDocumentLanguage(next); 
    localStorage.setItem('lumi-lesson-document-language', next); 
    if (updateSchoolPreferences) {
      updateSchoolPreferences({ documentLanguage: next }).catch(() => {});
    }
  };
  const [showSchoolName, setShowSchoolName] = useState(() => localStorage.getItem('lumi-lesson-pdf-school-name') !== 'false');
  const changeShowSchoolName = (next) => { 
    setShowSchoolName(next); 
    localStorage.setItem('lumi-lesson-pdf-school-name', String(next)); 
    if (updateSchoolPreferences) {
      updateSchoolPreferences({ showSchoolName: next }).catch(() => {});
    }
  };
  const activePlanRef = useRef(null);
  const scheduledStartRef = useRef(null);
  const [saveState, setSaveState] = useState('saved');
  const [message, setMessage] = useState('');
  const [mobilePane, setMobilePane] = useState('editor');
  const [expanded, setExpanded] = useState({ basics: true, general: true, specific: true, methodology: true, assessment: true, homework: true, reflection: true });
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [topicDraft, setTopicDraft] = useState({ title: '', classLabel: '', subject: '', outcome: '' });
  const [reusableDraft, setReusableDraft] = useState({ type: 'resources', text: '' });
  const [templateSource, setTemplateSource] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [pendingTopic, setPendingTopic] = useState(null);

  const savePlanToCloud = useCallback(async (plan) => {
    if (!activeSchoolId || !plan?.id) return;
    try {
      const planDocRef = doc(db, 'schools', activeSchoolId, 'lessonPlans', String(plan.id));
      await setDoc(planDocRef, {
        ...plan,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('Notice saving plan to Firestore:', err.message);
    }
  }, [activeSchoolId]);

  // Real-time Cloud Sync with Firestore
  useEffect(() => {
    if (!activeSchoolId) return;

    // 1. Sync Lesson Plans from Firestore
    const plansCol = collection(db, 'schools', activeSchoolId, 'lessonPlans');
    const unsubPlans = onSnapshot(plansCol, (snapshot) => {
      let hasChanges = false;
      snapshot.forEach(docSnap => {
        const cloudPlan = { id: docSnap.id, ...docSnap.data() };
        try {
          repository.savePlan(cloudPlan);
          hasChanges = true;
        } catch (e) {
          console.warn('Could not sync cloud plan locally:', e.message);
        }
      });
      if (hasChanges || snapshot.empty) {
        setPlans(repository.listPlans());
      }
    }, (err) => console.warn('Lesson plans cloud sync notice:', err.message));

    // 2. Sync Templates from Firestore
    const tplCol = collection(db, 'schools', activeSchoolId, 'templates');
    const unsubTpl = onSnapshot(tplCol, (snapshot) => {
      snapshot.forEach(docSnap => {
        try {
          repository.saveTemplate({ id: docSnap.id, ...docSnap.data() });
        } catch (e) {}
      });
      setTemplates(repository.listTemplates());
    }, (err) => console.warn('Templates cloud sync notice:', err.message));

    // 3. Sync Topics from Firestore
    const topicsCol = collection(db, 'schools', activeSchoolId, 'topics');
    const unsubTopics = onSnapshot(topicsCol, (snapshot) => {
      snapshot.forEach(docSnap => {
        try {
          repository.saveTopic({ id: docSnap.id, ...docSnap.data() });
        } catch (e) {}
      });
      setTopics(repository.listTopics());
    }, (err) => console.warn('Topics cloud sync notice:', err.message));

    // 4. Sync Reusable Entries from Firestore
    const reusableCol = collection(db, 'schools', activeSchoolId, 'reusableEntries');
    const unsubReusable = onSnapshot(reusableCol, (snapshot) => {
      snapshot.forEach(docSnap => {
        try {
          repository.saveReusableEntry({ id: docSnap.id, ...docSnap.data() });
        } catch (e) {}
      });
      setReusable(repository.listReusableEntries());
    }, (err) => console.warn('Reusable entries cloud sync notice:', err.message));

    return () => {
      unsubPlans();
      unsubTpl();
      unsubTopics();
      unsubReusable();
    };
  }, [activeSchoolId, repository]);

  const refresh = useCallback(() => {
    setPlans(repository.listPlans());
    setTemplates(repository.listTemplates());
    setTopics(repository.listTopics());
    setReusable(repository.listReusableEntries());
    setSchoolSubjects(repository.listSubjectMappings());
  }, [repository]);

  useEffect(() => { activePlanRef.current = activePlan; }, [activePlan]);
  useEffect(() => {
    if (!activePlan || view !== 'editor') return;
    const timeout = setTimeout(() => {
      setSaveState('saving');
      try {
        repository.savePlan(activePlan);
        savePlanToCloud(activePlan);
        if (preferences.rememberLastUsed) {
          repository.savePreferences({ lastUsedClass: activePlan.classLabel, lastUsedSubject: activePlan.subject });
          setPreferences((current) => ({ ...current, lastUsedClass: activePlan.classLabel, lastUsedSubject: activePlan.subject }));
        }
        setSaveState('saved'); refresh();
      }
      catch { setSaveState('error'); }
    }, 550);
    return () => clearTimeout(timeout);
  }, [activePlan, preferences.rememberLastUsed, repository, refresh, view, savePlanToCloud]);
  useEffect(() => {
    const flush = () => { if (activePlanRef.current) { try { repository.savePlan(activePlanRef.current); } catch { /* Visible save error remains in the editor. */ } } };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [repository]);

  useEffect(() => {
    if (!printTarget) return;
    const previousTitle = document.title;
    document.title = printTarget.plan?.lessonUnit || translate(documentLanguage, 'document.title');
    const finish = () => { document.title = previousTitle; setPrintTarget(null); };
    window.addEventListener('afterprint', finish);
    const frame = requestAnimationFrame(() => window.print());
    return () => { cancelAnimationFrame(frame); window.removeEventListener('afterprint', finish); document.title = previousTitle; };
  }, [printTarget, documentLanguage]);

  const notify = (value) => { setMessage(value); window.setTimeout(() => setMessage(''), 4000); };
  const saveNow = () => {
    const current = activePlanRef.current;
    if (!current) return;
    try {
      const saved = repository.savePlan(current);
      savePlanToCloud(saved);
      if (preferences.rememberLastUsed) {
        repository.savePreferences({ lastUsedClass: current.classLabel, lastUsedSubject: current.subject });
        setPreferences((previous) => ({ ...previous, lastUsedClass: current.classLabel, lastUsedSubject: current.subject }));
      }
      setSaveState('saved'); refresh(); return saved;
    }
    catch { setSaveState('error'); return null; }
  };
  const updatePlan = (change) => {
    setSaveState('unsaved');
    setActivePlan((current) => {
      const next = typeof change === 'function' ? change(current) : { ...current, ...change };
      activePlanRef.current = next;
      return next;
    });
  };
  const startPlan = (template = null) => {
    try {
      const plan = template
        ? duplicatePlan(template.plan || template, { date: todayLocal(), teacherId })
        : createPlan({ preferences, schoolData: { subjectMappings: schoolSubjects, stageMappings: repository.listStageMappings(), teacherName: currentUser.name }, teacherId, now: new Date() });
      const saved = repository.savePlan(plan);
      savePlanToCloud(saved);
      activePlanRef.current = saved; setActivePlan(saved); setSaveState('saved'); refresh(); setMobilePane('editor'); setView('editor');
    } catch { notify(t('validation.saveFailed')); }
  };
  useEffect(() => {
    if (!scheduledLesson) return;
    const key = JSON.stringify(scheduledLesson);
    if (scheduledStartRef.current === key) return;
    const timer = window.setTimeout(() => {
      if (scheduledStartRef.current === key) return;
      scheduledStartRef.current = key;
      try {
        const plan = createPlan({ preferences, schoolData: { subjectMappings: schoolSubjects, stageMappings: repository.listStageMappings(), teacherName: currentUser.name }, scheduledLesson, teacherId, now: new Date() });
        const saved = repository.savePlan(plan);
        savePlanToCloud(saved);
        activePlanRef.current = saved;
        setActivePlan(saved); setSaveState('saved'); refresh(); setMobilePane('editor'); setView('editor');
      } catch { setMessage(translate(language, 'validation.saveFailed')); }
      onScheduledLessonConsumed?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [scheduledLesson, preferences, schoolSubjects, repository, teacherId, currentUser.name, language, refresh, onScheduledLessonConsumed, savePlanToCloud]);
  const openPlan = (plan, pane = 'editor') => { activePlanRef.current = plan; setActivePlan(plan); setSaveState('saved'); setMobilePane(pane); setView('editor'); };
  const leaveEditor = () => { if (!saveNow()) return; setView('plans'); setActivePlan(null); activePlanRef.current = null; };
  const changeSubject = (subject) => updatePlan((current) => changePlanSubject(current, subject, { schoolSubjects }));
  const changeClass = (classLabel) => updatePlan((current) => changePlanClass(current, classLabel, { schoolSubjects, schoolStages: repository.listStageMappings() }));
  const updateArray = (key, values) => updatePlan({ [key]: values });
  const toggleSection = (key) => setExpanded((current) => ({ ...current, [key]: !current[key] }));
  const applyTopic = (topic) => {
    if (!topic) return;
    const current = activePlanRef.current;
    if (topic.outcome && current.topicLearningOutcome?.trim() && current.topicLearningOutcome.trim() !== topic.outcome.trim()
    ) { setPendingTopic(topic); return; }
    updatePlan({ topic: topic.title, ...(topic.outcome ? { topicLearningOutcome: topic.outcome } : {}) });
  };
  const duplicate = (plan) => {
    const copy = duplicatePlan(plan, { date: todayLocal(), teacherId });
    const saved = repository.savePlan(copy);
    savePlanToCloud(saved);
    refresh(); openPlan(saved); notify(t('notice.duplicateCreated'));
  };
  const changeStatus = (plan, status) => {
    if (status === 'archived') repository.archivePlan(plan.id);
    else repository.restorePlan(plan.id);
    if (activeSchoolId && plan.id) {
      updateDoc(doc(db, 'schools', activeSchoolId, 'lessonPlans', String(plan.id)), { status }).catch(() => {});
    }
    refresh(); notify(t(status === 'archived' ? 'notice.archived' : 'notice.restored'));
  };
  const makeTemplate = (plan) => { setTemplateSource(plan); setTemplateName(plan.lessonUnit || ct(plan.subject) || t('templates.newName')); };
  const saveTemplate = () => {
    if (!templateName.trim() || !templateSource) return;
    try {
      const tpl = { id: makeId(), name: templateName.trim(), plan: { ...templateSource, reflection: '', date: '', status: 'draft' } };
      repository.saveTemplate(tpl);
      if (activeSchoolId) {
        setDoc(doc(db, 'schools', activeSchoolId, 'templates', String(tpl.id)), tpl, { merge: true }).catch(() => {});
      }
      refresh(); setTemplateSource(null); notify(t('notice.templateSaved'));
    } catch { notify(t('validation.saveFailed')); }
  };
  const printPlan = (plan) => {
    if (activePlanRef.current && !saveNow()) return;
    setPrintTarget({ plan: plan || activePlanRef.current });
  };

  const filtered = useMemo(() => plans.filter((plan) => {
    const searchText = escapeQuery([plan.lessonUnit, plan.subject, translateCatalogValue(language, plan.subject), plan.topic, plan.classLabel].join(' '));
    return (!search || searchText.includes(escapeQuery(search)))
      && (classFilter === 'all' || plan.classLabel === classFilter)
      && (subjectFilter === 'all' || plan.subject === subjectFilter)
      && (statusFilter === 'active' ? plan.status !== 'archived' : statusFilter === 'all' || plan.status === statusFilter)
      && dateMatches(plan.date, dateFilter, customFrom, customTo);
  }).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')), [plans, search, classFilter, subjectFilter, statusFilter, dateFilter, customFrom, customTo, language]);
  const stats = {
    total: plans.filter((plan) => plan.status !== 'archived').length,
    drafts: plans.filter((plan) => plan.status === 'draft').length,
    completed: plans.filter((plan) => plan.status === 'completed').length,
    upcoming: plans.filter((plan) => plan.status !== 'archived' && plan.date >= todayLocal()).length,
    archived: plans.filter((plan) => plan.status === 'archived').length,
  };
  const classes = unique([...plans.map((plan) => plan.classLabel), ...(preferences.assignedClasses || [])]);
  const subjects = unique([...plans.map((plan) => plan.subject), ...SUBJECTS.map((subject) => subject.name)]);
  const topicMatches = topics.filter((topic) => (!topic.classLabel || topic.classLabel === activePlan?.classLabel) && (!topic.subject || topic.subject === activePlan?.subject));
  const reusableFor = (type) => reusable.filter((entry) => entry.type === type);
  const isAdmin = userRole === 'admin';

  const storageStatus = repository.getStorageStatus();
  const storageProblem = !storageStatus.personal.ok || !storageStatus.school.ok;

  return <LessonLanguageContext.Provider value={language}><div lang={language === 'sq' ? 'sq' : 'en'} className="lesson-page">
    {storageProblem && <div className="lesson-storage-warning" role="alert">{t('validation.saveFailed')}</div>}
    {message && <div className="lesson-toast" role="status"><Check size={16} />{message}</div>}
    {view !== 'editor' && <>
      <header className="lesson-page-header">
        <div><div className="lesson-title-row"><h1 className="gradient-text">{t('page.title')}</h1><span className="lesson-count-pill">{t('page.activeCount', { count: stats.total })}</span></div>
          <p>{t('page.subtitle')}</p></div>
        <div className="lesson-header-actions"><div className="lesson-language-switch" role="group" aria-label={t('page.languageAria')}><button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => onLanguageChange?.('en')}>English</button><button type="button" className={language === 'sq' ? 'active' : ''} aria-pressed={language === 'sq'} onClick={() => onLanguageChange?.('sq')}>Shqip</button></div><button type="button" className="btn-secondary" onClick={() => setView('settings')}><Settings2 size={17} /> {t('page.settings')}</button>
          <button type="button" className="btn-primary" onClick={() => startPlan()}><Plus size={18} /> {t('page.createPlan')}</button></div>
      </header>
      <nav className="lesson-tabs" aria-label={t('page.sectionsAria')}>
        <button className={view === 'plans' ? 'active' : ''} onClick={() => setView('plans')}><FileText size={17} /> {t('nav.myPlans')}</button>
        <button className={view === 'templates' ? 'active' : ''} onClick={() => setView('templates')}><LayoutTemplate size={17} /> {t('nav.myTemplates')}</button>
        <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}><Settings2 size={17} /> {t('nav.planningSettings')}</button>
      </nav>
    </>}

    {view === 'plans' && <>
      <div className="lesson-stats">
        {[[FileText, t('stats.total'), stats.total], [Clock3, t('stats.drafts'), stats.drafts], [Check, t('stats.completed'), stats.completed], [CalendarDays, t('stats.upcoming'), stats.upcoming], [FolderArchive, t('stats.archived'), stats.archived]].map(([IconComponent, label, count]) =>
          <div className="lesson-stat-card glass" key={label}><span className="lesson-stat-icon">{React.createElement(IconComponent, { size: 21 })}</span><div><strong>{count}</strong><span>{label}</span></div></div>)}
      </div>
      <section className="lesson-list-panel glass">
        <div className="lesson-panel-heading"><div><h2>{t('plans.heading')}</h2><p>{t('plans.description')}</p></div><span>{t('filter.results', { count: filtered.length })}</span></div>
        <div className="lesson-filters">
          <label className="lesson-search"><Search size={17} /><input aria-label={t('filter.searchAria')} placeholder={t('filter.searchPlaceholder')} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select aria-label={t('filter.classAria')} value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="all">{t('filter.allClasses')}</option>{classes.map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label={t('filter.subjectAria')} value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><option value="all">{t('filter.allSubjects')}</option>{subjects.map((value) => <option key={value} value={value}>{ct(value)}</option>)}</select>
          <select aria-label={t('filter.statusAria')} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">{t('filter.active')}</option><option value="draft">{t('stats.drafts')}</option><option value="completed">{t('stats.completed')}</option><option value="archived">{t('stats.archived')}</option><option value="all">{t('filter.all')}</option></select>
          <select aria-label={t('filter.dateAria')} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>{DATE_OPTIONS.map((value) => <option key={value} value={value}>{t(`date.${value}`)}</option>)}</select>
          {dateFilter === 'custom' && <><input aria-label={t('filter.fromDateAria')} type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /><input aria-label={t('filter.toDateAria')} type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></>}
        </div>
        {filtered.length ? <div className="lesson-plan-list">{filtered.map((plan) => <article className="lesson-plan-row" key={plan.id}>
          <div 
            className="lesson-plan-icon" 
            onClick={() => openPlan(plan)} 
            role="button" 
            tabIndex={0} 
            title={t('plans.edit')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlan(plan); } }}
          >
            <BookOpen size={22} />
          </div>
          <div className="lesson-plan-main">
            <div className="lesson-plan-title">
              <h3 
                onClick={() => openPlan(plan)} 
                role="button" 
                tabIndex={0} 
                title={t('plans.edit')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlan(plan); } }}
              >
                {plan.lessonUnit || t('plans.untitledUnit')}
              </h3>
              <span className={`lesson-status lesson-status-${plan.status}`}>{t(`status.${plan.status}`)}</span>
            </div>
            <p 
              onClick={() => openPlan(plan)} 
              title={t('plans.edit')}
            >
              {[ct(plan.subject), plan.classLabel, plan.topic].filter(Boolean).join(' · ') || t('plans.completeDetails')}
            </p>
            <small>{dateLabel(plan.date, language)} · {t('plans.modified', { date: plan.updatedAt ? language === 'sq' ? dateInTimeZone(plan.updatedAt, SCHOOL_TIME_ZONE).split('-').reverse().slice(0, 2).join('.') : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(plan.updatedAt)) : t('date.todayLower') })}</small>
          </div>
          <div className="lesson-plan-actions">
            <button type="button" onClick={() => openPlan(plan, 'preview')} title={t('plans.openPreviewTitle')}><FileText size={16} /> {t('plans.open')}</button>
            <button type="button" onClick={() => openPlan(plan)} title={t('plans.edit')}><BookOpen size={16} /> {t('plans.edit')}</button>
            <button type="button" onClick={() => duplicate(plan)} title={t('plans.duplicate')}><Copy size={16} /> {t('plans.duplicate')}</button>
            <button type="button" onClick={() => printPlan(plan)} title={t('plans.print')}><Printer size={16} /> {t('plans.print')}</button>
            <button type="button" onClick={() => printPlan(plan)} title={t('plans.pdfTitle')}><Download size={16} /> {t('plans.pdf')}</button>
            <button type="button" onClick={() => changeStatus(plan, plan.status === 'archived' ? 'draft' : 'archived')} title={t(plan.status === 'archived' ? 'plans.restore' : 'plans.archive')}>{plan.status === 'archived' ? <RotateCcw size={16} /> : <Archive size={16} />}{t(plan.status === 'archived' ? 'plans.restore' : 'plans.archive')}</button>
          </div>
        </article>)}</div> : <div className="lesson-empty"><span><FilePlus2 size={29} /></span><h3>{t(plans.length ? 'plans.noResultsTitle' : 'plans.firstPlanTitle')}</h3><p>{t(plans.length ? 'plans.noResultsDescription' : 'plans.firstPlanDescription')}</p><button type="button" className="btn-primary" onClick={() => startPlan()}><Plus size={17} /> {t('page.createPlan')}</button></div>}
      </section>
    </>}

    {view === 'templates' && <section className="lesson-list-panel glass"><div className="lesson-panel-heading"><div><h2>{t('templates.heading')}</h2><p>{t('templates.description')}</p></div></div>
      {templates.length ? <div className="lesson-template-grid">{templates.map((template) => <article className="lesson-template-card" key={template.id}><span><LayoutTemplate size={20} /></span><h3>{template.name}</h3><p>{ct(template.plan?.subject) || t('templates.noSubject')} · {template.plan?.classLabel || t('templates.noClass')}</p><div><button type="button" className="btn-primary" onClick={() => startPlan(template)}><Plus size={16} /> {t('templates.use')}</button><button type="button" className="btn-secondary" onClick={() => { repository.deleteTemplate(template.id); if (activeSchoolId) deleteDoc(doc(db, 'schools', activeSchoolId, 'templates', String(template.id))).catch(() => {}); refresh(); }}><Trash2 size={16} /> {t('templates.remove')}</button></div></article>)}</div>
        : <div className="lesson-empty"><span><LayoutTemplate size={28} /></span><h3>{t('templates.emptyTitle')}</h3><p>{t('templates.emptyDescription')}</p></div>}
    </section>}

    {view === 'settings' && <section className="lesson-settings-grid">
      <div className="lesson-settings-card glass"><div className="lesson-settings-heading"><span><Settings2 size={21} /></span><div><h2>{t('settings.heading')}</h2><p>{t('settings.description')}</p></div></div>
        <div className="lesson-settings-fields">
          <Field label={t('settings.defaultClass')}><input list="lesson-assigned-classes" value={settingsDraft.defaultClass || ''} onChange={(event) => setSettingsDraft({ ...settingsDraft, defaultClass: event.target.value })} placeholder={t('settings.exampleClass')} /></Field>
          <Field label={t('settings.defaultSubject')}><select value={settingsDraft.defaultSubject || ''} onChange={(event) => setSettingsDraft({ ...settingsDraft, defaultSubject: event.target.value })}><option value="">{t('settings.selectSubject')}</option>{listSubjects({ schoolSubjects }).map((subject) => <option key={subject.name} value={subject.name}>{ct(subject.name)}</option>)}</select></Field>
          <Field label={t('settings.assignedClasses')} hint={t('settings.assignedClassesHint')}><input value={(settingsDraft.assignedClasses || []).join(', ')} onChange={(event) => setSettingsDraft({ ...settingsDraft, assignedClasses: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} placeholder="VI/2, VII/1" /></Field>
          <Field label={t('settings.teacherName')}><input value={settingsDraft.teacherName || ''} onChange={(event) => setSettingsDraft({ ...settingsDraft, teacherName: event.target.value })} placeholder={t('settings.teacherNamePlaceholder')} /></Field>
          <Field label={t('settings.school')}><input value={settingsDraft.schoolName || ''} onChange={(event) => setSettingsDraft({ ...settingsDraft, schoolName: event.target.value })} placeholder={t('settings.schoolPlaceholder')} /></Field>
          <Field label={language === 'sq' ? 'Logoja e shkollës (në PDF)' : 'School Logo (for PDF)'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {settingsDraft.schoolLogo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'hsla(var(--background), 0.5)', padding: '0.6rem 0.85rem', borderRadius: '14px', border: '1px solid hsla(var(--border), 0.6)' }}>
                  <img src={settingsDraft.schoolLogo} alt="School Logo" style={{ maxHeight: '48px', maxWidth: '120px', objectFit: 'contain' }} />
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      setSettingsDraft({ ...settingsDraft, schoolLogo: '' });
                      const el = document.getElementById('lesson-school-logo-input');
                      if (el) el.value = '';
                    }}
                  >
                    {language === 'sq' ? 'Hiq Logon' : 'Remove Logo'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    id="lesson-school-logo-input"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const compressed = await compressImageFile(f, 512, 256, 0.85);
                        setSettingsDraft({ ...settingsDraft, schoolLogo: compressed });
                      } catch (err) {
                        console.error('Logo compression failed:', err);
                        notify(language === 'sq' ? 'Gabim gjatë ngarkimit të logos: ' + err.message : 'Failed to load logo: ' + err.message);
                      }
                    }}
                  />
                  <label htmlFor="lesson-school-logo-input" className="btn-secondary glass" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.5rem 1rem', borderRadius: '12px' }}>
                    <Upload size={15} /> {language === 'sq' ? 'Ngarko Logo të Shkollës' : 'Upload School Logo'}
                  </label>
                </div>
              )}
            </div>
          </Field>
          <Field label={t('settings.academicYear')}><input value={settingsDraft.academicYear || ''} onChange={(event) => setSettingsDraft({ ...settingsDraft, academicYear: event.target.value })} placeholder={t('settings.exampleAcademicYear')} /></Field>
          <Field label={t('settings.duration')}><input type="number" min="1" max="240" value={settingsDraft.duration || ''} onChange={(event) => setSettingsDraft({ ...settingsDraft, duration: event.target.value })} placeholder="45" /></Field>
          <label className="lesson-check-row"><input type="checkbox" checked={Boolean(settingsDraft.rememberLastUsed)} onChange={(event) => setSettingsDraft({ ...settingsDraft, rememberLastUsed: event.target.checked })} /> {t('settings.rememberLastUsed')}</label>
          <datalist id="lesson-assigned-classes">{(settingsDraft.assignedClasses || []).map((value) => <option key={value} value={value} />)}</datalist>
        </div>
        <div className="lesson-settings-footer">
          <button 
            type="button" 
            className="btn-primary" 
            disabled={isSavingSettings}
            onClick={async () => {
              setIsSavingSettings(true);
              try {
                // 1. Local storage & state
                const next = repository.savePreferences(settingsDraft);
                setPreferences(next);
                setSettingsDraft(next);

                // 2. Cloud sync to user's school preferences
                if (updateSchoolPreferences) {
                  await updateSchoolPreferences({
                    ...settingsDraft,
                    updatedAt: new Date().toISOString()
                  });
                } else if (activeSchoolId && effectiveUid) {
                  await setDoc(doc(db, 'users', effectiveUid, 'schoolPreferences', activeSchoolId), {
                    ...settingsDraft,
                    updatedAt: new Date().toISOString()
                  }, { merge: true });
                }

                // 3. Cloud sync to school document if logo or name changed
                if (activeSchoolId && (settingsDraft.schoolLogo !== undefined || settingsDraft.schoolName)) {
                  try {
                    const schoolPatch = {};
                    if (settingsDraft.schoolLogo !== undefined) {
                      schoolPatch.logo = settingsDraft.schoolLogo || null;
                      schoolPatch.schoolLogo = settingsDraft.schoolLogo || null;
                    }
                    if (settingsDraft.schoolName) {
                      schoolPatch.name = settingsDraft.schoolName.trim();
                    }
                    if (Object.keys(schoolPatch).length > 0) {
                      await setDoc(doc(db, 'schools', activeSchoolId), {
                        ...schoolPatch,
                        updatedAt: serverTimestamp()
                      }, { merge: true });
                    }
                  } catch (schoolDocErr) {
                    console.warn('Notice saving school doc logo/name:', schoolDocErr.message);
                  }
                }

                notify(t('notice.settingsSaved'));
              } catch (err) {
                console.error('Settings save error:', err);
                notify(t('validation.saveFailed') + (err.message ? `: ${err.message}` : ''));
              } finally {
                setIsSavingSettings(false);
              }
            }}
          >
            <Save size={17} /> 
            {isSavingSettings ? (language === 'sq' ? 'Duke ruajtur...' : 'Saving...') : t('settings.save')}
          </button>
        </div>
      </div>
      <div className="lesson-settings-side">
        <div className="lesson-settings-card glass"><div className="lesson-settings-heading"><span><BookOpen size={20} /></span><div><h2>{t('settings.topicHeading')}</h2><p>{t('settings.topicDescription')}</p></div></div>
          <div className="lesson-settings-fields"><Field label={t('settings.topic')}><input value={topicDraft.title} onChange={(event) => setTopicDraft({ ...topicDraft, title: event.target.value })} placeholder={t('settings.topicPlaceholder')} /></Field>
            <Field label={t('editor.class')}><input value={topicDraft.classLabel} onChange={(event) => setTopicDraft({ ...topicDraft, classLabel: event.target.value })} placeholder={t('settings.exampleClass')} /></Field>
            <Field label={t('editor.subject')}><select value={topicDraft.subject} onChange={(event) => setTopicDraft({ ...topicDraft, subject: event.target.value })}><option value="">{t('settings.selectSubject')}</option>{listSubjects({ schoolSubjects }).map((subject) => <option key={subject.name} value={subject.name}>{ct(subject.name)}</option>)}</select></Field>
            <Field label={t('settings.topicOutcome')}><textarea value={topicDraft.outcome} onChange={(event) => setTopicDraft({ ...topicDraft, outcome: event.target.value })} rows="3" placeholder={t('settings.topicOutcomePlaceholder')} /></Field>
            <button type="button" className="btn-secondary" onClick={() => { if (!topicDraft.title.trim()) return notify(t('validation.topicRequired')); if (!topicDraft.subject) return notify(t('validation.topicSubjectRequired')); try { const newTop = { ...topicDraft, id: makeId() }; repository.saveTopic(newTop); if (activeSchoolId) { setDoc(doc(db, 'schools', activeSchoolId, 'topics', String(newTop.id)), newTop, { merge: true }).catch(() => {}); } setTopicDraft({ title: '', classLabel: '', subject: '', outcome: '' }); refresh(); notify(t('notice.topicSaved')); } catch { notify(t('validation.saveFailed')); } }}><Plus size={16} /> {t('settings.saveTopic')}</button>
          </div>
          {!!topics.length && <div className="lesson-settings-list">{topics.map((topic) => <div key={topic.id}><span><strong>{topic.title}</strong><small>{[topic.classLabel, ct(topic.subject)].filter(Boolean).join(' · ')}</small></span><button type="button" aria-label={t('settings.removeTopicAria', { name: topic.title })} onClick={() => { repository.deleteTopic(topic.id); if (activeSchoolId) { deleteDoc(doc(db, 'schools', activeSchoolId, 'topics', String(topic.id))).catch(() => {}); } refresh(); }}><Trash2 size={15} /></button></div>)}</div>}
        </div>
        <div className="lesson-settings-card glass"><div className="lesson-settings-heading"><span><Sparkles size={20} /></span><div><h2>{t('settings.reusableHeading')}</h2><p>{t('settings.reusableDescription')}</p></div></div>
          <div className="lesson-settings-fields"><Field label={t('settings.entryType')}><select value={reusableDraft.type} onChange={(event) => setReusableDraft({ ...reusableDraft, type: event.target.value })}>{REUSABLE_TYPES.map((value) => <option key={value} value={value}>{t(`reusable.${value}`)}</option>)}</select></Field>
            <Field label={t('settings.entryContent')}><textarea value={reusableDraft.text} onChange={(event) => setReusableDraft({ ...reusableDraft, text: event.target.value })} rows="3" placeholder={t('settings.entryPlaceholder')} /></Field>
            <button type="button" className="btn-secondary" onClick={() => { if (!reusableDraft.text.trim()) return notify(t('validation.entryRequired')); try { const newRe = { ...reusableDraft, id: makeId() }; repository.saveReusableEntry(newRe); if (activeSchoolId) { setDoc(doc(db, 'schools', activeSchoolId, 'reusableEntries', String(newRe.id)), newRe, { merge: true }).catch(() => {}); } setReusableDraft({ ...reusableDraft, text: '' }); refresh(); notify(t('notice.entrySaved')); } catch { notify(t('validation.saveFailed')); } }}><Plus size={16} /> {t('settings.saveEntry')}</button>
          </div>
          {!!reusable.length && <div className="lesson-settings-list">{reusable.map((entry) => <div key={entry.id}><span><strong>{entry.text}</strong><small>{t(`reusable.${entry.type}`)}</small></span><button type="button" aria-label={t('settings.removeEntryAria')} onClick={() => { repository.deleteReusableEntry(entry.id); if (activeSchoolId) { deleteDoc(doc(db, 'schools', activeSchoolId, 'reusableEntries', String(entry.id))).catch(() => {}); } refresh(); }}><Trash2 size={15} /></button></div>)}</div>}
        </div>
        {isAdmin && <LessonPlanAdminSettings repository={repository} onChange={refresh} notify={notify} language={language} />}
      </div>
    </section>}

    {view === 'editor' && activePlan && <>
      <div className="lesson-editor-toolbar glass">
        <div className="lesson-editor-toolbar-left"><button type="button" className="lesson-icon-button" onClick={leaveEditor} aria-label={t('editor.backAria')}><ArrowLeft size={20} /></button><div><h1>{activePlan.lessonUnit || t('editor.newPlanTitle')}</h1><span className={`lesson-save-state lesson-save-${saveState}`}>{t(`save.${saveState}`)}</span></div></div>
        <div className="lesson-editor-toolbar-actions"><div className="lesson-language-switch" role="group" aria-label={t('page.languageAria')}><button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => onLanguageChange?.('en')}>English</button><button type="button" className={language === 'sq' ? 'active' : ''} aria-pressed={language === 'sq'} onClick={() => onLanguageChange?.('sq')}>Shqip</button></div><button type="button" className="btn-secondary" onClick={saveNow}><Save size={16} /> {t('editor.save')}</button><button type="button" className="btn-secondary" onClick={() => { if (!saveNow()) return; setMobilePane('preview'); document.getElementById('lesson-preview')?.scrollIntoView({ block: 'nearest' }); }}><FileText size={16} /> {t('editor.preview')}</button><button type="button" className="btn-secondary" onClick={() => printPlan(activePlan)}><Printer size={16} /> {t('editor.print')}</button><button type="button" className="btn-secondary" onClick={() => printPlan(activePlan)} title={t('editor.pdfTitle')}><Download size={16} /> {t('editor.pdf')}</button></div>
      </div>
      <div className="lesson-editor-subbar"><div><span className={`lesson-status lesson-status-${activePlan.status}`}>{t(`status.${activePlan.status}`)}</span><span>{dateLabel(activePlan.date, language)} · {activePlan.classLabel || t('editor.noClass')}</span></div><div>
        <button type="button" onClick={() => makeTemplate(activePlan)}><LayoutTemplate size={15} /> {t('editor.saveAsTemplate')}</button>
        <button type="button" onClick={() => duplicate(activePlan)}><Copy size={15} /> {t('editor.duplicate')}</button>
        <button type="button" onClick={() => updatePlan({ status: activePlan.status === 'completed' ? 'draft' : 'completed' })}><Check size={15} /> {t(activePlan.status === 'completed' ? 'editor.returnToDraft' : 'editor.markCompleted')}</button>
      </div></div>
      <div className="lesson-mobile-pane-switch"><button className={mobilePane === 'editor' ? 'active' : ''} onClick={() => setMobilePane('editor')}>{t('editor.editorTab')}</button><button className={mobilePane === 'preview' ? 'active' : ''} onClick={() => setMobilePane('preview')}>{t('editor.documentTab')}</button></div>
      <div className="lesson-editor-layout">
        <div className={`lesson-editor-fields ${mobilePane === 'preview' ? 'lesson-mobile-hidden' : ''}`}>
          <LessonAiAssistanceCard
            activePlan={activePlan}
            updatePlan={updatePlan}
            saveNow={saveNow}
            language={language}
            notify={notify}
          />
          <Section id="lesson-basics" title={t('editor.basicsTitle')} subtitle={t('editor.basicsSubtitle')} open={expanded.basics} onToggle={() => toggleSection('basics')}>
            <div className="lesson-form-grid"><Field label={t('editor.date')}><input type="date" value={activePlan.date || ''} onChange={(event) => updatePlan({ date: event.target.value })} /></Field>
              <Field label={t('editor.class')}><input list="lesson-class-list" value={activePlan.classLabel || ''} onChange={(event) => changeClass(event.target.value)} placeholder={t('settings.exampleClass')} /><datalist id="lesson-class-list">{unique([...(preferences.assignedClasses || []), preferences.defaultClass]).map((value) => <option key={value} value={value} />)}</datalist></Field>
              <Field label={t('editor.subject')}><SubjectPicker value={activePlan.subject || ''} onChange={changeSubject} classLabel={activePlan.classLabel} schoolSubjects={schoolSubjects} /></Field>
              <Field label={t('editor.lessonUnit')} className="lesson-grid-wide"><input value={activePlan.lessonUnit || ''} onChange={(event) => updatePlan({ lessonUnit: event.target.value })} placeholder={t('editor.lessonUnitPlaceholder')} autoFocus /></Field>
            </div>
            <div className="lesson-derived-grid"><Field label={t('editor.curricularArea')} auto={!activePlan.areaManual}><div className="lesson-derived-input"><input value={activePlan.areaManual ? activePlan.curricularArea || '' : ct(activePlan.curricularArea || '')} onChange={(event) => updatePlan({ curricularArea: event.target.value, areaManual: true })} placeholder={t('editor.subjectNeededPlaceholder')} />{activePlan.areaManual && <button type="button" title={t('editor.restoreAutomaticTitle')} aria-label={t('editor.restoreAreaAria')} onClick={() => updatePlan({ curricularArea: getSubjectArea(activePlan.subject, { schoolSubjects, classLabel: activePlan.classLabel }), areaManual: false })}><RotateCcw size={14} /></button>}</div></Field>
              <Field label={t('editor.curriculumStage')} auto={!activePlan.stageManual}><div className="lesson-derived-input"><input value={activePlan.stageManual ? activePlan.curriculumStage || '' : stageLabel(activePlan.curriculumStage || '', language)} onChange={(event) => updatePlan({ curriculumStage: event.target.value, stageManual: true })} placeholder={t('editor.classNeededPlaceholder')} />{activePlan.stageManual && <button type="button" title={t('editor.restoreAutomaticTitle')} aria-label={t('editor.restoreStageAria')} onClick={() => updatePlan({ curriculumStage: stageForClass(activePlan.classLabel, { schoolStages: repository.listStageMappings() }), stageManual: false })}><RotateCcw size={14} /></button>}</div></Field>
              <Field label={t('editor.period')}><input value={activePlan.period || ''} onChange={(event) => updatePlan({ period: event.target.value })} placeholder={t('editor.periodPlaceholder')} /></Field>
            </div>
          </Section>
          <Section id="lesson-general" title={t('editor.generalTitle')} subtitle={t('editor.generalSubtitle')} open={expanded.general} onToggle={() => toggleSection('general')}>
            <Field label={t('editor.topic')} hint={t(topicMatches.length ? 'editor.topicSavedHint' : 'editor.topicNewHint')}><input list="lesson-topic-list" value={activePlan.topic || ''} onChange={(event) => updatePlan({ topic: event.target.value })} onBlur={(event) => { const match = topicMatches.find((topic) => topic.title === event.target.value); if (match) applyTopic(match); }} placeholder={t('editor.topicPlaceholder')} /><datalist id="lesson-topic-list">{topicMatches.map((topic) => <option key={topic.id} value={topic.title} />)}</datalist></Field>
            <RichEditor label={t('editor.topicLearningOutcome')} value={activePlan.topicLearningOutcome} onChange={(value) => updatePlan({ topicLearningOutcome: value })} placeholder={t('editor.topicOutcomePlaceholder')} />
            <ListEditor label={t('editor.competencyOutcomes')} values={activePlan.competencyOutcomes} onChange={(values) => updateArray('competencyOutcomes', values)} placeholder={t('editor.addOutcomePlaceholder')} reusable={reusableFor('competencyOutcomes')} />
            <ListEditor label={t('editor.fieldOutcomes')} values={activePlan.fieldOutcomes} onChange={(values) => updateArray('fieldOutcomes', values)} placeholder={t('editor.addOutcomePlaceholder')} reusable={reusableFor('fieldOutcomes')} />
          </Section>
          <Section id="lesson-specific" title={t('editor.specificTitle')} subtitle={t('editor.specificSubtitle')} open={expanded.specific} onToggle={() => toggleSection('specific')}>
            <Field label={t('editor.keywords')}><input value={activePlan.keywords || ''} onChange={(event) => updatePlan({ keywords: event.target.value })} placeholder={t('editor.keywordsPlaceholder')} /></Field>
            <ListEditor label={t('editor.lessonOutcomes')} values={activePlan.lessonOutcomes} onChange={(values) => updateArray('lessonOutcomes', values)} placeholder={t('editor.lessonOutcomePlaceholder')} />
            <ListEditor label={t('editor.successCriteria')} values={activePlan.successCriteria} onChange={(values) => updateArray('successCriteria', values)} placeholder={t('editor.successCriterionPlaceholder')} />
            <RichEditor label={t('editor.resources')} value={activePlan.resources} onChange={(value) => updatePlan({ resources: value })} placeholder={t('editor.resourcesPlaceholder')} reusable={reusableFor('resources')} />
            <RichEditor label={t('editor.crossCurricular')} value={activePlan.crossCurricular} onChange={(value) => updatePlan({ crossCurricular: value })} placeholder={t('editor.crossCurricularPlaceholder')} reusable={reusableFor('crossCurricular')} />
          </Section>
          <Section id="lesson-methodology" title={t('editor.methodologyTitle')} subtitle={t('editor.methodologySubtitle')} open={expanded.methodology} onToggle={() => toggleSection('methodology')}>
            <RichEditor label={t('editor.methodology')} value={activePlan.methodology} onChange={(value) => updatePlan({ methodology: value })} placeholder={t('editor.methodologyPlaceholder')} tall reusable={reusableFor('methodology')} />
          </Section>
          <Section id="lesson-assessment" title={t('editor.assessmentTitle')} open={expanded.assessment} onToggle={() => toggleSection('assessment')}><RichEditor label={t('editor.assessment')} value={activePlan.assessment} onChange={(value) => updatePlan({ assessment: value })} placeholder={t('editor.assessmentPlaceholder')} reusable={reusableFor('assessment')} /></Section>
          <Section id="lesson-homework" title={t('editor.homeworkTitle')} open={expanded.homework} onToggle={() => toggleSection('homework')}><RichEditor label={t('editor.homework')} value={activePlan.homework} onChange={(value) => updatePlan({ homework: value })} placeholder={t('editor.homeworkPlaceholder')} /></Section>
          <Section id="lesson-reflection" title={t('editor.reflectionTitle')} subtitle={t('editor.reflectionSubtitle')} open={expanded.reflection} onToggle={() => toggleSection('reflection')}><RichEditor label={t('editor.reflection')} value={activePlan.reflection} onChange={(value) => updatePlan({ reflection: value })} placeholder={t('editor.reflectionPlaceholder')} /></Section>
        </div>
        <div className={`lesson-preview-panel glass ${mobilePane === 'editor' ? 'lesson-mobile-hidden' : ''}`} id="lesson-preview"><div className="lesson-preview-heading"><div><FileText size={18} /><strong>{t('editor.documentPreview')}</strong></div><div className="lesson-preview-controls"><label>{t('editor.pdfLanguage')} <select aria-label={t('editor.pdfLanguage')} value={documentLanguage} onChange={(event) => changeDocumentLanguage(event.target.value)}><option value="sq">Shqip</option><option value="en">English</option></select></label><span>{t('editor.a4Portrait')}</span></div></div><div className="lesson-paper-wrap"><LessonPlanDocument plan={{ ...(activePlan || {}), schoolLogo: settingsDraft?.schoolLogo !== undefined ? settingsDraft.schoolLogo : (activePlan?.schoolLogo || preferences?.schoolLogo) }} language={documentLanguage} showSchoolName={showSchoolName} /></div></div>
      </div>
    </>}
    {templateSource && <div className="lesson-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTemplateSource(null); }}><div className="lesson-modal-card glass" role="dialog" aria-modal="true" aria-labelledby="lesson-template-dialog-title"><h2 id="lesson-template-dialog-title">{t('templates.dialogTitle')}</h2><p>{t('templates.dialogDescription')}</p><label className="lesson-field"><span className="lesson-field-heading">{t('templates.namePrompt')}</span><input autoFocus value={templateName} onChange={(event) => setTemplateName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveTemplate(); if (event.key === 'Escape') setTemplateSource(null); }} /></label><div className="lesson-modal-actions"><button type="button" className="btn-secondary" onClick={() => setTemplateSource(null)}>{t('common.cancel')}</button><button type="button" className="btn-primary" onClick={saveTemplate} disabled={!templateName.trim()}>{t('editor.saveAsTemplate')}</button></div></div></div>}
    {pendingTopic && <div className="lesson-modal-overlay" role="presentation"><div className="lesson-modal-card glass" role="dialog" aria-modal="true" aria-labelledby="lesson-topic-dialog-title"><h2 id="lesson-topic-dialog-title">{t('confirm.outcomeTitle')}</h2><p>{t('confirm.replaceTopicOutcome')}</p><div className="lesson-modal-actions"><button type="button" className="btn-secondary" onClick={() => setPendingTopic(null)}>{t('confirm.keepOutcome')}</button><button type="button" className="btn-primary" onClick={() => { updatePlan({ topic: pendingTopic.title, topicLearningOutcome: pendingTopic.outcome }); setPendingTopic(null); }}>{t('confirm.useSavedOutcome')}</button></div></div></div>}
    <div className="lesson-print-only"><LessonPlanDocument plan={{ ...(printTarget?.plan || activePlan || {}), schoolLogo: printTarget?.plan?.schoolLogo || (settingsDraft?.schoolLogo !== undefined ? settingsDraft.schoolLogo : (activePlan?.schoolLogo || preferences?.schoolLogo)) }} language={documentLanguage} showSchoolName={showSchoolName} /></div>
  </div></LessonLanguageContext.Provider>;
}

export default LessonPlans;
