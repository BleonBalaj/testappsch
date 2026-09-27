import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Sparkles, AlertCircle,
  Loader2, Check, Clock, RotateCcw
} from 'lucide-react';
import { parseClassLabel } from '../features/lessonPlans/catalog.js';
import { buildLessonAiRequestContext } from '../services/lessonAiContext.js';
import { generateLessonPlanWithAI, getLessonAiUsage, mergeGeneratedLessonFields, GENERATED_LESSON_FIELDS, LESSON_AI_MODEL } from '../services/geminiLessonService.js';
import { makeLessonAiUndoSnapshot, buildLessonAiUndoPatch, lessonAiUndoStorageKey } from '../features/lessonPlans/aiUndo.js';

export function LessonAiAssistanceCard({ 
  activePlan, 
  updatePlan, 
  schoolId,
  accountId,
  language = 'sq', 
  notify 
}) {
  const isSq = language === 'sq';
  const [isGenerating, setIsGenerating] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [quota, setQuota] = useState(null);
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const latestPlanRef = useRef(activePlan);
  latestPlanRef.current = activePlan;
  const latestScopeRef = useRef({ accountId, schoolId, language });
  latestScopeRef.current = { accountId, schoolId, language };
  const requestRef = useRef(null);
  const lastAttemptRef = useRef(null);
  useEffect(() => () => requestRef.current?.abort(), [accountId, schoolId, language]);
  const undoKey = useMemo(() => lessonAiUndoStorageKey({ accountId, schoolId, planId: activePlan?.id }), [accountId, schoolId, activePlan?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!accountId) { setQuota(null); return undefined; }
    getLessonAiUsage().then((usage) => { if (!cancelled) setQuota(usage); })
      .catch((error) => { console.warn('Could not load lesson AI usage:', error); if (!cancelled) setQuota(null); });
    return () => { cancelled = true; };
  }, [accountId]);

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(undoKey) || 'null');
      setUndoSnapshot(stored?.version === 1 && stored.planId === activePlan?.id && stored.schoolId === schoolId && stored.accountId === accountId ? stored : null);
    } catch { setUndoSnapshot(null); }
  }, [undoKey, activePlan?.id, schoolId, accountId]);

  // Prerequisites verification
  const hasSubject = Boolean(activePlan?.subject?.trim());
  const hasClass = Boolean(activePlan?.classLabel?.trim());
  const hasUnit = Boolean(activePlan?.lessonUnit?.trim());
  const hasExistingContent = GENERATED_LESSON_FIELDS.some((field) => {
    const value = activePlan?.[field];
    return Array.isArray(value) ? value.some((item) => String(item || '').trim()) : Boolean(String(value || '').trim());
  });

  // The section/parallel in labels such as II-4 is not the grade.
  const parsedClass = useMemo(() => parseClassLabel(activePlan?.classLabel), [activePlan?.classLabel]);
  const gradeNumber = parsedClass?.grade ?? (Number.isInteger(Number(activePlan?.grade)) && Number(activePlan?.grade) >= 1 && Number(activePlan?.grade) <= 12 ? Number(activePlan.grade) : null);
  const isReady = hasSubject && hasClass && hasUnit && gradeNumber !== null;
  const limitReached = quota?.used >= 50;

  // Any positive period can be entered; an unset period defaults to the first lesson.
  const currentPeriodRaw = activePlan?.period ? String(activePlan.period).trim() : '1';
  const periodMatch = currentPeriodRaw.match(/^(?:(?:period|ora)\s*)?([1-9]\d*)$/i);
  const currentPeriodNum = periodMatch ? periodMatch[1] : '1';

  const handlePeriodChange = (val) => {
    if (val && !/^[1-9]\d*$/.test(String(val))) return;
    updatePlan({ period: String(val) });
  };

  const handleGenerate = async () => {
    if (!isReady || isGenerating || limitReached) return;
    setIsGenerating(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const sourceIdentity = JSON.stringify([accountId, schoolId, language, activePlan?.id, buildLessonAiRequestContext(activePlan, language)]);
    const requestId = lastAttemptRef.current?.identity === sourceIdentity ? lastAttemptRef.current.requestId : crypto.randomUUID();
    lastAttemptRef.current = { identity: sourceIdentity, requestId };

    try {
      const planContext = buildLessonAiRequestContext(activePlan, language);

      const result = await generateLessonPlanWithAI(planContext, { schoolId, signal: controller.signal, requestId });
      lastAttemptRef.current = null;
      if (result.quota) setQuota(result.quota);
      const current = latestPlanRef.current;
      const currentIdentity = JSON.stringify([latestScopeRef.current.accountId, latestScopeRef.current.schoolId, latestScopeRef.current.language, current?.id, buildLessonAiRequestContext(current, latestScopeRef.current.language)]);
      if (controller.signal.aborted || sourceIdentity !== currentIdentity) {
        notify?.(isSq ? 'Konteksti i planit ndryshoi gjatë gjenerimit. Asgjë nuk u zëvendësua.' : 'The lesson context changed while generating. Nothing was replaced.');
        return;
      }

      const next = mergeGeneratedLessonFields(current, result, { replaceExisting, period: currentPeriodNum });
      const snapshot = makeLessonAiUndoSnapshot(current, next, { schoolId, accountId });
      if (Object.keys(snapshot.changes).length) {
        setUndoSnapshot(snapshot);
        try { sessionStorage.setItem(undoKey, JSON.stringify(snapshot)); }
        catch (error) { console.warn('Could not persist lesson AI undo history for this tab:', error); }
      }
      updatePlan(next, { immediate: true });

      if (notify) {
        notify(isSq 
          ? `U krijua drafti për Orën ${currentPeriodNum}. Kontrolloni përmbajtjen para përdorimit.`
          : `Period ${currentPeriodNum} draft generated. Review the content before use.`);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.details?.kind === 'lesson-ai-quota') setQuota(err.details);
      else getLessonAiUsage().then(setQuota).catch(() => {});
      console.error('AI generation error:', err);
      if (notify) {
        const albanianErrors = {
          'functions/unauthenticated': 'Hyni në llogari për të gjeneruar planin.',
          'functions/permission-denied': 'Vetëm mësuesit dhe administratorët aktivë të kësaj shkolle mund të gjenerojnë plane.',
          'functions/invalid-argument': 'Kontrolloni lëndën, klasën, njësinë dhe numrin e orës.',
          'functions/resource-exhausted': 'Kufiri i shërbimit AI u arrit. Provoni më vonë.',
          'functions/aborted': 'Kjo orë po gjenerohet tashmë. Prisni të përfundojë.',
          'functions/unavailable': 'Shërbimi AI nuk është përkohësisht i disponueshëm. Provoni më vonë.',
          'functions/internal': 'Shërbimi i gjenerimit ka një problem konfigurimi. Provoni më vonë.',
          'functions/failed-precondition': 'Plani i gjeneruar nuk u pranua ose shërbimi AI nuk është gati. Provoni përsëri.',
        };
        notify(err.details?.kind === 'lesson-ai-quota'
          ? (isSq ? 'Keni përdorur të 50 gjenerimet me AI për këtë llogari.' : 'You have used all 50 AI generations for this account.')
          : isSq
            ? 'Gabim gjatë gjenerimit me AI: ' + (albanianErrors[err.code] || err.message || 'Provoni përsëri.')
            : 'Failed to generate lesson plan: ' + (err.message || 'Please try again.'));
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleUndo = () => {
    if (!undoSnapshot || isGenerating || undoSnapshot.planId !== activePlan?.id) return;
    const { patch, skipped } = buildLessonAiUndoPatch(activePlan, undoSnapshot);
    if (Object.keys(patch).length) updatePlan(patch, { immediate: true });
    setUndoSnapshot(null);
    try { sessionStorage.removeItem(undoKey); }
    catch (error) { console.warn('Could not clear lesson AI undo history:', error); }
    notify?.(skipped.length
      ? (isSq ? 'Ndryshimet e AI u zhbënë. Fushat që i ndryshuat më pas u ruajtën.' : 'AI changes were undone. Fields you edited afterward were kept.')
      : (isSq ? 'Ndryshimet e AI u zhbënë dhe plani po ruhet në cloud.' : 'AI changes were undone and the restored plan is syncing to the cloud.'));
  };

  return (
    <div className={`lesson-ai-card glass ${isReady ? 'is-ready' : 'is-pending'}`}>
      {/* Header */}
      <div className="lesson-ai-header">
        <div className="lesson-ai-header-left">
          <div className="lesson-ai-icon-box">
            {isGenerating ? <Loader2 size={22} className="spinning-loader" /> : <Sparkles size={22} />}
          </div>
          <div className="lesson-ai-title-group">
            <div className="lesson-ai-title-row">
              <h3>{isSq ? 'Asistenca Inteligjente me AI' : 'AI Pedagogical Assistant'}</h3>
              <span className="lesson-ai-pill-badge">{LESSON_AI_MODEL}</span>
              {isReady ? (
                <span className="lesson-ai-status-pill ready">
                  <Check size={12} /> {isSq ? 'Gati për gjenerim' : 'Ready'}
                </span>
              ) : (
                <span className="lesson-ai-status-pill pending">
                  <AlertCircle size={12} /> {isSq ? 'Plotësoni kontekstin' : 'Complete context'}
                </span>
              )}
            </div>
            <p className="lesson-ai-desc">
              {isSq 
                ? 'Përdor lëndën, klasën, njësinë dhe shënimet tuaja për të hartuar aktivitete e rezultate për këtë orë.'
                : 'Uses your subject, class, unit, and existing notes to draft activities and outcomes for this lesson.'}
            </p>
          </div>
        </div>

      </div>

      {/* Period within this unit */}
      <div className="lesson-ai-period-bar">
        <div className="lesson-ai-period-heading">
          <div className="lesson-ai-period-label-left">
            <Clock size={15} style={{ color: 'hsl(var(--primary))' }} />
            <label htmlFor="lesson-ai-period-input">{isSq ? 'Ora mësimore në këtë njësi' : 'Lesson period within this unit'}</label>
          </div>
        </div>
        <div className="lesson-ai-period-input-row">
          <input
            id="lesson-ai-period-input"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={activePlan?.period && periodMatch ? currentPeriodNum : ''}
            placeholder="1"
            onChange={(event) => handlePeriodChange(event.target.value)}
          />
          <span>{isSq ? 'Lëreni bosh për orën e parë.' : 'Leave blank for the first lesson.'}</span>
        </div>
      </div>

      {/* Main Body: Prerequisites Missing Banner OR Ready Context Strip */}
      {!isReady ? (
        <div className="lesson-ai-notice-box">
          <div className="lesson-ai-notice-top">
            <AlertCircle size={16} className="lesson-ai-notice-icon" />
            <span>
              {isSq 
                ? 'Plotësoni lëndën, klasën me nivel të qartë (p.sh. II-4) dhe njësinë mësimore:'
                : 'Add a subject, a class with a clear grade (for example II-4), and a lesson unit:'}
            </span>
          </div>
          <div className="lesson-ai-check-chips">
            <div className={`lesson-ai-chip ${hasSubject ? 'is-complete' : 'is-waiting'}`}>
              {hasSubject ? <Check size={13} /> : <span className="chip-circle">1</span>}
              <span>{isSq ? 'Lënda' : 'Subject'}</span>
            </div>
            <div className={`lesson-ai-chip ${hasClass && gradeNumber !== null ? 'is-complete' : 'is-waiting'}`}>
              {hasClass && gradeNumber !== null ? <Check size={13} /> : <span className="chip-circle">2</span>}
              <span>{isSq ? 'Klasa' : 'Class'}</span>
            </div>
            <div className={`lesson-ai-chip ${hasUnit ? 'is-complete' : 'is-waiting'}`}>
              {hasUnit ? <Check size={13} /> : <span className="chip-circle">3</span>}
              <span>{isSq ? 'Njësia Mësimore' : 'Lesson Unit'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="lesson-ai-ready-box">
          <div className="lesson-ai-ready-chips">
            <div className="lesson-ai-ready-tag">
              <span className="tag-label">{isSq ? 'Lënda' : 'Subject'}</span>
              <strong>{activePlan.subject}</strong>
            </div>
            <div className="lesson-ai-ready-tag">
              <span className="tag-label">{isSq ? 'Klasa' : 'Class'}</span>
              <strong>
                {activePlan.classLabel} {gradeNumber ? `(${isSq ? `Klasa ${gradeNumber}` : `Grade ${gradeNumber}`})` : ''}
              </strong>
            </div>
            <div className="lesson-ai-ready-tag">
              <span className="tag-label">{isSq ? 'Njësia' : 'Unit'}</span>
              <strong>{activePlan.lessonUnit}</strong>
            </div>
            <div className="lesson-ai-ready-tag" style={{ borderColor: 'hsla(var(--primary), 0.45)' }}>
              <span className="tag-label">{isSq ? 'Ora Mësimore' : 'Period'}</span>
              <strong>{isSq ? `Ora ${currentPeriodNum}` : `Period ${currentPeriodNum}`}</strong>
            </div>
            {activePlan.curriculumStage && (
              <div className="lesson-ai-ready-tag">
                <span className="tag-label">{isSq ? 'Shkalla' : 'Stage'}</span>
                <strong>{activePlan.curriculumStage}</strong>
              </div>
            )}
            <div className="lesson-ai-ready-tag">
              <span className="tag-label">{isSq ? 'Gjuha' : 'Language'}</span>
              <strong>{isSq ? 'Shqip' : 'English'}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="lesson-ai-footer">
        {hasExistingContent && <label className="lesson-pdf-name-toggle">
          <input type="checkbox" checked={replaceExisting} disabled={isGenerating} onChange={(event) => setReplaceExisting(event.target.checked)} />
          {isSq ? 'Zëvendëso edhe fushat e shkruara më parë' : 'Replace existing written fields'}
        </label>}
        <p className="lesson-ai-hint-text">
          {isReady ? (
            isSq 
              ? `AI do të përdorë njësinë, lëndën dhe klasën për të krijuar shembuj dhe detyra konkrete. Reflektimi mbetet i mësuesit.`
              : `AI will use the unit, subject, and class to draft concrete examples and tasks. The reflection stays yours.`
          ) : (
            isSq 
              ? 'Zgjidhni lëndën, klasën dhe njësinë në formularin më poshtë për të aktivizuar butonin.' 
              : 'Select subject, class, and unit in the form below to activate the button.'
          )}
          <span className="lesson-ai-quota-note">
            {quota
              ? (isSq ? `${quota.remaining} nga ${quota.limit} gjenerime të mbetura për këtë llogari.` : `${quota.remaining} of ${quota.limit} generations remaining for this account.`)
              : (isSq ? 'Limiti: 50 gjenerime me AI për llogari.' : 'Limit: 50 AI generations per account.')}
            {' '}{isSq ? 'Zhbërja nuk e kthen një gjenerim.' : 'Undo does not restore a generation.'}
          </span>
        </p>

        {undoSnapshot?.planId === activePlan?.id && Object.keys(undoSnapshot.changes || {}).length > 0 &&
          <button type="button" className="btn-secondary lesson-ai-undo-btn" disabled={isGenerating} onClick={handleUndo}>
            <RotateCcw size={16} /> {isSq ? 'Zhbëj gjenerimin e fundit' : 'Undo last AI generation'}
          </button>}
        <button
          type="button"
          className="btn-primary lesson-ai-generate-btn bouncy"
          disabled={!isReady || isGenerating || limitReached}
          onClick={handleGenerate}
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="spinning-loader" />
              <span>{isSq ? 'Duke gjeneruar me AI...' : 'Generating with AI...'}</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>{limitReached
                ? (isSq ? 'Limiti prej 50 gjenerimesh u arrit' : '50-generation limit reached')
                : (isSq ? `Gjenero Orën ${currentPeriodNum} me AI` : `Generate Period ${currentPeriodNum} with AI`)}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default LessonAiAssistanceCard;
