import React, { useState, useMemo } from 'react';
import { 
  Sparkles, AlertCircle, Key, 
  Loader2, Check, Clock
} from 'lucide-react';
import { parseClassLabel } from '../features/lessonPlans/catalog.js';
import { generateLessonPlanWithAI } from '../services/geminiLessonService.js';

export function LessonAiAssistanceCard({ 
  activePlan, 
  updatePlan, 
  saveNow, 
  language = 'sq', 
  notify 
}) {
  const isSq = language === 'sq';
  const [isGenerating, setIsGenerating] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [customKey, setCustomKey] = useState(() => localStorage.getItem('lumi-gemini-api-key') || '');
  const [keySaved, setKeySaved] = useState(false);

  // Prerequisites verification
  const hasSubject = Boolean(activePlan?.subject?.trim());
  const hasClass = Boolean(activePlan?.classLabel?.trim());
  const hasUnit = Boolean(activePlan?.lessonUnit?.trim());
  const isReady = hasSubject && hasClass && hasUnit;

  // Grade parsing (e.g. "II" -> 2, "X" -> 10)
  const parsedClass = useMemo(() => parseClassLabel(activePlan?.classLabel), [activePlan?.classLabel]);
  const gradeNumber = parsedClass?.grade ?? (activePlan?.classLabel ? parseInt(activePlan.classLabel.replace(/\D/g, ''), 10) || null : null);

  // Period / Ora mësimore (Defaults to "1")
  const currentPeriodRaw = activePlan?.period ? String(activePlan.period).trim() : '1';
  const periodMatch = currentPeriodRaw.match(/\d+/);
  const currentPeriodNum = periodMatch ? periodMatch[0] : '1';

  const handleSaveKey = () => {
    localStorage.setItem('lumi-gemini-api-key', customKey.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
    setShowKeyInput(false);
    if (notify) {
      notify(isSq ? 'Çelësi i Gemini API u ruajt me sukses!' : 'Gemini API key saved successfully!');
    }
  };

  const handlePeriodChange = (val) => {
    updatePlan({ period: String(val) });
  };

  const handleGenerate = async () => {
    if (!isReady || isGenerating) return;
    setIsGenerating(true);

    try {
      const planContext = {
        subject: activePlan.subject,
        classLabel: activePlan.classLabel,
        grade: gradeNumber,
        lessonUnit: activePlan.lessonUnit,
        curricularArea: activePlan.curricularArea,
        curriculumStage: activePlan.curriculumStage,
        date: activePlan.date,
        period: currentPeriodNum,
        academicYear: activePlan.academicYear,
        duration: activePlan.duration,
        language: isSq ? 'sq' : 'en'
      };

      const result = await generateLessonPlanWithAI(planContext, customKey);

      // Auto-fill all fields in activePlan
      updatePlan((prev) => ({
        ...prev,
        period: prev.period || currentPeriodNum,
        topic: result.topic || prev.topic,
        topicLearningOutcome: result.topicLearningOutcome || prev.topicLearningOutcome,
        competencyOutcomes: result.competencyOutcomes?.length ? result.competencyOutcomes : prev.competencyOutcomes,
        fieldOutcomes: result.fieldOutcomes?.length ? result.fieldOutcomes : prev.fieldOutcomes,
        keywords: result.keywords || prev.keywords,
        lessonOutcomes: result.lessonOutcomes?.length ? result.lessonOutcomes : prev.lessonOutcomes,
        successCriteria: result.successCriteria?.length ? result.successCriteria : prev.successCriteria,
        resources: result.resources || prev.resources,
        crossCurricular: result.crossCurricular || prev.crossCurricular,
        methodology: result.methodology || prev.methodology,
        assessment: result.assessment || prev.assessment,
        homework: result.homework || prev.homework,
        reflection: result.reflection || prev.reflection,
        status: 'draft'
      }));

      // Flush to disk and cloud
      if (saveNow) {
        saveNow();
      }

      if (notify) {
        notify(isSq 
          ? `Plani mësimor për Orën ${currentPeriodNum} u plotësua me sukses me AI! ✨` 
          : `Lesson plan for Period ${currentPeriodNum} successfully generated with AI! ✨`);
      }
    } catch (err) {
      console.error('AI generation error:', err);
      if (notify) {
        notify(isSq 
          ? 'Gabim gjatë gjenerimit me AI: ' + (err.message || 'Ju lutem provoni përsëri.') 
          : 'Failed to generate lesson plan: ' + (err.message || 'Please try again.'));
      }
    } finally {
      setIsGenerating(false);
    }
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
              <span className="lesson-ai-pill-badge">Gemini 2.0 Flash</span>
              {isReady ? (
                <span className="lesson-ai-status-pill ready">
                  <Check size={12} /> {isSq ? 'Gati për gjenerim' : 'Ready'}
                </span>
              ) : (
                <span className="lesson-ai-status-pill pending">
                  <AlertCircle size={12} /> {isSq ? 'Kërkohen 3 fusha' : '3 Fields Required'}
                </span>
              )}
            </div>
            <p className="lesson-ai-desc">
              {isSq 
                ? 'Përshtat automatikisht lëndën, klasën dhe Orën Mësimore (hyrje, ushtrime apo zbatim) duke plotësuar saktë të gjithë planin.' 
                : 'Adapts curriculum, grade, and lesson period (introductory, practice, or applied) to auto-fill your exact lesson plan.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="lesson-ai-key-toggle-btn"
          onClick={() => setShowKeyInput(!showKeyInput)}
          title={isSq ? 'Konfiguro Çelësin Gemini API' : 'Configure Gemini API Key'}
        >
          <Key size={14} />
          <span>{customKey ? (isSq ? 'API Key: Aktiv' : 'API Key: Set') : (isSq ? 'Konfiguro API Key' : 'Configure API Key')}</span>
        </button>
      </div>

      {/* API Key Drawer */}
      {showKeyInput && (
        <div className="lesson-ai-key-drawer">
          <div className="lesson-ai-key-drawer-header">
            <div>
              <strong>{isSq ? 'Konfigurimi i Google Gemini API' : 'Google Gemini API Setup'}</strong>
              <p>
                {isSq 
                  ? 'Mund të vendosni çelësin tuaj falas nga Google AI Studio:' 
                  : 'You can insert your free API key from Google AI Studio:'}{' '}
                <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer">aistudio.google.com</a>
              </p>
            </div>
          </div>
          <div className="lesson-ai-key-row">
            <input
              type="password"
              placeholder="AIzaSy..."
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
            />
            <button type="button" className="btn-primary" onClick={handleSaveKey}>
              {keySaved ? <Check size={15} /> : (isSq ? 'Ruaj Çelësin' : 'Save Key')}
            </button>
          </div>
        </div>
      )}

      {/* Interactive "Ora Mësimore" (Period) Selector Bar */}
      <div className="lesson-ai-period-bar">
        <div className="lesson-ai-period-heading">
          <div className="lesson-ai-period-label-left">
            <Clock size={15} style={{ color: 'hsl(var(--primary))' }} />
            <span>{isSq ? 'Ora Mësimore për këtë njësi:' : 'Lesson Period for this unit:'}</span>
          </div>
          <span className="lesson-ai-period-badge">
            {currentPeriodNum === '1' 
              ? (isSq ? 'Ora 1: Hyrje & Konceptet Bazë' : 'Period 1: Intro & Foundational Rules')
              : currentPeriodNum === '2'
                ? (isSq ? 'Ora 2: Ushtrime Praktike & Përforcim' : 'Period 2: Guided Drills & Practice')
                : currentPeriodNum === '3'
                  ? (isSq ? 'Ora 3: Zbatim në Jetën Reale & Problema' : 'Period 3: Real-World Applied Problems')
                  : (isSq ? `Ora ${currentPeriodNum}: Konsolidim & Vlerësim` : `Period ${currentPeriodNum}: Review & Assessment`)}
          </span>
        </div>

        <div className="lesson-ai-period-buttons">
          <button
            type="button"
            className={`lesson-ai-pbtn ${currentPeriodNum === '1' ? 'active' : ''}`}
            onClick={() => handlePeriodChange('1')}
          >
            <strong>{isSq ? 'Ora 1' : 'Period 1'}</strong>
            <span>{isSq ? 'Hyrje / Bazë' : 'Intro / Basic'}</span>
          </button>
          <button
            type="button"
            className={`lesson-ai-pbtn ${currentPeriodNum === '2' ? 'active' : ''}`}
            onClick={() => handlePeriodChange('2')}
          >
            <strong>{isSq ? 'Ora 2' : 'Period 2'}</strong>
            <span>{isSq ? 'Ushtrime & Përforcim' : 'Practice & Drill'}</span>
          </button>
          <button
            type="button"
            className={`lesson-ai-pbtn ${currentPeriodNum === '3' ? 'active' : ''}`}
            onClick={() => handlePeriodChange('3')}
          >
            <strong>{isSq ? 'Ora 3' : 'Period 3'}</strong>
            <span>{isSq ? 'Zbatim & Problema' : 'Applied / Problems'}</span>
          </button>
          <button
            type="button"
            className={`lesson-ai-pbtn ${['4', '5', '6'].includes(currentPeriodNum) ? 'active' : ''}`}
            onClick={() => handlePeriodChange('4')}
          >
            <strong>{isSq ? 'Ora 4+' : 'Period 4+'}</strong>
            <span>{isSq ? 'Përsëritje & Test' : 'Review & Evaluation'}</span>
          </button>
        </div>
      </div>

      {/* Main Body: Prerequisites Missing Banner OR Ready Context Strip */}
      {!isReady ? (
        <div className="lesson-ai-notice-box">
          <div className="lesson-ai-notice-top">
            <AlertCircle size={16} className="lesson-ai-notice-icon" />
            <span>
              {isSq 
                ? 'Plotësoni së pari Lëndën, Klasën dhe Njësinë Mësimore më poshtë për të aktivizuar gjenerimin:' 
                : 'Please first fill in the Subject, Class, and Lesson Unit below to proceed:'}
            </span>
          </div>
          <div className="lesson-ai-check-chips">
            <div className={`lesson-ai-chip ${hasSubject ? 'is-complete' : 'is-waiting'}`}>
              {hasSubject ? <Check size={13} /> : <span className="chip-circle">1</span>}
              <span>{isSq ? 'Lënda' : 'Subject'}</span>
            </div>
            <div className={`lesson-ai-chip ${hasClass ? 'is-complete' : 'is-waiting'}`}>
              {hasClass ? <Check size={13} /> : <span className="chip-circle">2</span>}
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
        <p className="lesson-ai-hint-text">
          {isReady ? (
            isSq 
              ? `✨ AI do të plotësojë planin e orës ${currentPeriodNum} me rezultate specifike, metodologjinë EVR, mjetet dhe reflektimin pa shabllone të përgjithshme.` 
              : `✨ AI will generate period ${currentPeriodNum} plan with concrete curriculum outcomes, ERR stages, and realistic classroom activities.`
          ) : (
            isSq 
              ? 'Zgjidhni lëndën, klasën dhe njësinë në formularin më poshtë për të aktivizuar butonin.' 
              : 'Select subject, class, and unit in the form below to activate the button.'
          )}
        </p>

        <button
          type="button"
          className="btn-primary lesson-ai-generate-btn bouncy"
          disabled={!isReady || isGenerating}
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
              <span>{isSq ? `Gjenero Orën ${currentPeriodNum} me AI` : `Generate Period ${currentPeriodNum} with AI`}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default LessonAiAssistanceCard;
