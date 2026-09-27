import React from 'react';
import { translate, translateCatalogValue } from '../features/lessonPlans/i18n';

const present = (value) => String(value ?? '').trim() || '—';
const presentStage = (value, language) => language === 'en' ? present(value).replace(/^Shkalla\s+/i, 'Stage ') : present(value);

function DocumentText({ value }) {
  if (!String(value ?? '').trim()) return <span className="lesson-document-empty">—</span>;
  return <div className="lesson-document-rich">{String(value).split('\n').map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div className="lesson-document-spacer" key={index} />;
    const marker = trimmed.match(/^([-•]|\d+[.)])\s+/)?.[1];
    const content = marker ? trimmed.slice(marker.length).trim() : trimmed;
    return <p key={index} className={marker ? 'lesson-document-list-line' : ''}>
      {marker && <span>{/^\d/.test(marker) ? marker : '•'} </span>}
      {content.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) => part.startsWith('**') && part.endsWith('**')
        ? <strong key={partIndex}>{part.slice(2, -2)}</strong> : <React.Fragment key={partIndex}>{part}</React.Fragment>)}
    </p>;
  })}</div>;
}

function OutcomeList({ values }) {
  const entries = (values || []).filter((value) => String(value ?? '').trim());
  if (!entries.length) return <span className="lesson-document-empty">—</span>;
  return <ol className="lesson-document-ordered">{entries.map((value, index) => <li key={`${index}-${value}`}>{value}</li>)}</ol>;
}

function LabeledLine({ label, children, className = '' }) {
  return <div className={`lesson-document-line ${className}`}><span className="lesson-document-label">{label}:</span> <span className="lesson-document-value">{children}</span></div>;
}

function BoxSection({ title, children, className = '' }) {
  return <section className={`lesson-document-box-section ${className}`}>
    <h3>{title}</h3><div className="lesson-document-box-body">{children}</div>
  </section>;
}

export default function LessonPlanDocument({ plan, language = 'sq', showSchoolName = true }) {
  if (!plan) return null;
  const t = (key) => translate(language, `document.${key}`);
  const date = plan.date ? new Date(`${plan.date}T12:00:00`) : null;
  const formattedDate = date && !Number.isNaN(date.getTime())
    ? language === 'sq' ? `${plan.date.slice(8, 10)}.${plan.date.slice(5, 7)}.${plan.date.slice(0, 4)}`
      : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    : '—';

  return <article className="lesson-document" lang={language} aria-label={t('aria')}>
    <header className="lesson-document-header">
      {(plan.schoolLogo || plan.logo) && (
        <div className="lesson-document-logo-wrap" style={{ textAlign: 'center', marginBottom: '0.4rem' }}>
          <img 
            src={plan.schoolLogo || plan.logo} 
            alt="School Logo" 
            className="lesson-document-logo" 
            style={{ maxHeight: '55px', maxWidth: '140px', objectFit: 'contain' }} 
          />
        </div>
      )}
      {showSchoolName && <p className="lesson-document-school">{present(plan.schoolName)}</p>}
      <h2>{t('title')}</h2>
      <div className="lesson-document-meta">
        <span><strong>{t('teacher')}</strong> {present(plan.teacherName)}</span>
        <span><strong>{t('date')}</strong> {formattedDate}</span>
        <span><strong>{t('schoolYear')}</strong> {present(plan.academicYear)}</span>
        {plan.period && <span><strong>{t('period')}</strong> {plan.period}</span>}
        {plan.duration && <span><strong>{t('duration')}</strong> {plan.duration} {t('minutes')}</span>}
      </div>
    </header>

    <section className="lesson-document-block">
      <h3 className="lesson-document-band">{t('generalHeading')}</h3>
      <div className="lesson-document-general-details">
        <div><LabeledLine label={t('curricularArea')}>{translateCatalogValue(language, present(plan.curricularArea))}</LabeledLine><LabeledLine label={t('subject')}>{translateCatalogValue(language, present(plan.subject))}</LabeledLine></div>
        <div><LabeledLine label={t('curriculumStage')}>{presentStage(plan.curriculumStage, language)}</LabeledLine><LabeledLine label={t('class')}>{present(plan.classLabel)}</LabeledLine></div>
      </div>
      <div className="lesson-document-topic-row">
        <div><strong>{t('topic')}:</strong><div className="lesson-document-topic-value"><DocumentText value={plan.topic} /></div></div>
        <div><strong>{t('topicLearningOutcome')}:</strong><div className="lesson-document-topic-value"><DocumentText value={plan.topicLearningOutcome} /></div></div>
      </div>
      <div className="lesson-document-result-row"><div className="lesson-document-label">{t('competencyOutcomes')}:</div><OutcomeList values={plan.competencyOutcomes} /></div>
      <div className="lesson-document-result-row"><div className="lesson-document-label">{t('fieldOutcomes')}:</div><OutcomeList values={plan.fieldOutcomes} /></div>
    </section>

    <section className="lesson-document-block">
      <h3 className="lesson-document-band lesson-document-band-specific">{t('specificHeading')}</h3>
      <LabeledLine label={t('lessonUnit')} className="lesson-document-single-row">{present(plan.lessonUnit)}</LabeledLine>
      <LabeledLine label={t('keywords')} className="lesson-document-single-row lesson-document-keywords">{present(plan.keywords)}</LabeledLine>
      <div className="lesson-document-outcomes-row">
        <div><div className="lesson-document-label">{t('lessonOutcomes')}:</div><OutcomeList values={plan.lessonOutcomes} /></div>
        <div><div className="lesson-document-label">{t('successCriteria')}:</div><OutcomeList values={plan.successCriteria} /></div>
      </div>
      <LabeledLine label={t('resources')} className="lesson-document-single-row"><DocumentText value={plan.resources} /></LabeledLine>
      <LabeledLine label={t('crossCurricular')} className="lesson-document-single-row lesson-document-cross"><DocumentText value={plan.crossCurricular} /></LabeledLine>
    </section>

    <BoxSection title={t('methodologyHeading')} className="lesson-document-methodology"><DocumentText value={plan.methodology} /></BoxSection>
    <BoxSection title={t('assessmentHeading')}><DocumentText value={plan.assessment} /></BoxSection>
    <BoxSection title={t('homeworkHeading')}><DocumentText value={plan.homework} /></BoxSection>
    <BoxSection title={t('reflectionHeading')} className="lesson-document-reflection"><DocumentText value={plan.reflection} /></BoxSection>
  </article>;
}
