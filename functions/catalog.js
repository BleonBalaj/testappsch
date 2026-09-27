// Kosovo general-education defaults. School-approved records can override these.
export const CURRICULAR_AREAS = Object.freeze([
  'Gjuhët dhe komunikimi',
  'Matematika',
  'Shkencat e natyrës',
  'Shoqëria dhe mjedisi',
  'Artet',
  'Edukata fizike, sportet dhe shëndeti',
  'Jeta dhe puna',
]);

export const SUBJECTS = Object.freeze([
  { name: 'Gjuhë shqipe', area: 'Gjuhët dhe komunikimi', aliases: [] },
  { name: 'Gjuhë angleze', area: 'Gjuhët dhe komunikimi', aliases: [] },
  { name: 'Gjuhë gjermane', area: 'Gjuhët dhe komunikimi', aliases: [] },
  { name: 'Gjuhë frënge', area: 'Gjuhët dhe komunikimi', aliases: [] },
  { name: 'Matematikë', area: 'Matematika', aliases: [] },
  { name: 'Fizikë', area: 'Shkencat e natyrës', aliases: [] },
  { name: 'Kimi', area: 'Shkencat e natyrës', aliases: [] },
  { name: 'Biologji', area: 'Shkencat e natyrës', aliases: [] },
  { name: 'Njeriu dhe natyra', area: 'Shkencat e natyrës', aliases: [] },
  { name: 'Histori', area: 'Shoqëria dhe mjedisi', aliases: [] },
  { name: 'Gjeografi', area: 'Shoqëria dhe mjedisi', aliases: [] },
  { name: 'Edukatë qytetare', area: 'Shoqëria dhe mjedisi', aliases: [] },
  { name: 'Shoqëria dhe mjedisi', area: 'Shoqëria dhe mjedisi', aliases: [] },
  { name: 'Edukatë figurative', area: 'Artet', aliases: ['Art figurativ'] },
  { name: 'Edukatë muzikore', area: 'Artet', aliases: ['Art muzikor'] },
  { name: 'Edukatë fizike, sportet dhe shëndeti', area: 'Edukata fizike, sportet dhe shëndeti', aliases: [] },
  { name: 'Shkathtësi për jetë', area: 'Jeta dhe puna', aliases: [] },
  { name: 'Teknologji me TIK', area: 'Jeta dhe puna', aliases: [] },
  { name: 'TIK', area: 'Jeta dhe puna', aliases: [] },
]);

const ROMAN = Object.freeze(['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']);
const normalize = (value) => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sq-AL').replace(/\s+/g, ' ');

function numberFromGrade(value) {
  const text = String(value ?? '').trim().toUpperCase();
  if (/^(?:0|P|PARA|PERGATITORE|PËRGATITORE)$/.test(text)) return 0;
  if (/^(?:[1-9]|1[0-2])$/.test(text)) return Number(text);
  const roman = ROMAN.indexOf(text);
  return roman > 0 ? roman : null;
}

// Returns null for ambiguous labels rather than guessing a curriculum stage.
export function parseClassLabel(input) {
  if (input && typeof input === 'object') {
    const label = input.classLabel ?? input.label ?? input.name;
    if (label) return parseClassLabel(label);
    const grade = numberFromGrade(input.grade);
    if (grade === null) return null;
    const section = String(input.section ?? '').trim();
    return { grade, gradeLabel: grade === 0 ? 'Përgatitore' : ROMAN[grade], section, classLabel: grade === 0 ? 'Përgatitore' : `${ROMAN[grade]}${section ? `/${section}` : ''}` };
  }
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const raw = String(input).trim().replace(/^(?:klasa|class|grade)\s+/i, '').trim();
  if (/^(?:p[eë]rgatitore|parap[eë]rgatitore|preparatory)$/i.test(raw)) {
    return { grade: 0, gradeLabel: 'Përgatitore', section: '', classLabel: 'Përgatitore' };
  }
  const match = raw.match(/^((?:XII|XI|IX|VIII|VII|VI|IV|III|II|X|V|I)|(?:1[0-2]|[1-9]))(?:\s*(?:\/|[-–—]|\s)\s*([\p{L}\p{N}]+)|([A-Z]))?$/iu);
  if (!match) return null;
  const grade = numberFromGrade(match[1]);
  if (grade === null) return null;
  return { grade, gradeLabel: ROMAN[grade], section: match[2] ?? match[3] ?? '', classLabel: raw };
}

export function stageForClass(classInput, { schoolStages = [] } = {}) {
  const parsed = parseClassLabel(classInput);
  if (!parsed) return '';
  const valid = schoolStages.filter((record) => record?.validated === true && record.stage);
  const override = valid.find((record) => {
    const label = record.classLabel || record.class || record.className;
    return label && normalize(label) === normalize(parsed.classLabel);
  })
    ?? valid.find((record) => {
      const label = record.classLabel || record.class || record.className;
      if (label) {
        const recParsed = parseClassLabel(label);
        if (recParsed && recParsed.grade === parsed.grade) return true;
      }
      return false;
    })
    ?? valid.find((record) => record.grade !== undefined && numberFromGrade(record.grade) === parsed.grade)
    ?? valid.find((record) => Array.isArray(record.grades) && record.grades.some((grade) => numberFromGrade(grade) === parsed.grade));
  if (override) return override.stage;
  if (parsed.grade <= 2) return 'Shkalla I';
  if (parsed.grade <= 5) return 'Shkalla II';
  if (parsed.grade <= 7) return 'Shkalla III';
  if (parsed.grade <= 9) return 'Shkalla IV';
  if (parsed.grade <= 11) return 'Shkalla V';
  return 'Shkalla VI';
}

function recordAppliesToClass(record, classLabel) {
  if (!classLabel) return true;
  const target = parseClassLabel(classLabel);
  if (!target) return true;
  if (Array.isArray(record.classes) && record.classes.length) {
    return record.classes.some((item) => normalize(item) === normalize(target.classLabel));
  }
  if (Array.isArray(record.grades) && record.grades.length) {
    return record.grades.some((grade) => numberFromGrade(grade) === target.grade);
  }
  return true;
}

export function getSubjectArea(subject, { schoolSubjects = [], classLabel = '' } = {}) {
  const needle = normalize(typeof subject === 'object' ? (subject.name ?? subject.subject) : subject);
  if (!needle) return '';
  const approved = schoolSubjects.find((record) => {
    if (!record || record.validated !== true || record.active === false || !(record.area ?? record.curricularArea) || !recordAppliesToClass(record, classLabel)) return false;
    return normalize(record.name ?? record.subject) === needle || (record.aliases ?? []).some((alias) => normalize(alias) === needle);
  });
  if (approved) return approved.area ?? approved.curricularArea ?? '';
  const builtin = SUBJECTS.find((record) => normalize(record.name) === needle || record.aliases.some((alias) => normalize(alias) === needle));
  return builtin?.area ?? '';
}

export function listSubjects({ query = '', classLabel = '', schoolSubjects = [] } = {}) {
  const applicable = schoolSubjects.filter((record) => record?.active !== false && recordAppliesToClass(record, classLabel));
  const restricted = new Set(schoolSubjects.filter((record) => record?.active !== false && record.validated === true &&
    ((Array.isArray(record.grades) && record.grades.length) || (Array.isArray(record.classes) && record.classes.length)) &&
    !recordAppliesToClass(record, classLabel)).map((record) => normalize(record.name ?? record.subject)));
  const merged = new Map(SUBJECTS.filter((record) => !restricted.has(normalize(record.name))).map((record) => [normalize(record.name), record]));
  for (const record of applicable) {
    const name = record.name ?? record.subject;
    if (!name) continue;
    const key = normalize(name);
    const builtin = merged.get(key);
    merged.set(key, {
      name,
      area: record.validated === true ? (record.area ?? record.curricularArea ?? builtin?.area ?? '') : (builtin?.area ?? ''),
      aliases: record.aliases ?? builtin?.aliases ?? [],
    });
  }
  const source = [...merged.values()];
  const needle = normalize(query);
  return source.filter((record) => record.name && (!needle || [record.name, record.area, ...record.aliases].some((part) => normalize(part).includes(needle))))
    .sort((a, b) => CURRICULAR_AREAS.indexOf(a.area) - CURRICULAR_AREAS.indexOf(b.area) || a.name.localeCompare(b.name, 'sq'));
}
