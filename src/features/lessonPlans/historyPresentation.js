import { translate, translateCatalogValue } from './i18n.js';

export function historyEntryKind(action){
  if(action==='review'||action?.startsWith('reviewer_'))return 'review';
  if(['comment','feedback','reply'].includes(action))return 'comment';
  if(['auto_reopen','unshare'].includes(action))return 'system';
  return 'plan';
}
export const historyHasPlanVersion=entry=>Boolean(entry?.plan&&['share','reshare','update','resubmit'].includes(entry.action));

const labels={
  classLabel:'editor.class',teacherName:'settings.teacherName',academicYear:'settings.academicYear',duration:'settings.duration',
};
const extra={schoolName:['School','Shkolla'],areaManual:['Curricular area selection','Përzgjedhja e fushës kurrikulare'],stageManual:['Curriculum stage selection','Përzgjedhja e shkallës kurrikulare'],grade:['Grade level','Niveli i klasës'],section:['Class section','Paralelja'],status:['Plan status','Statusi i planit'],aiReference:['Teaching reference','Burimi mësimor'],ownerName:['Plan author','Autori i planit'],archivedFromStatus:['Status before archiving','Statusi para arkivimit']};
export function historyFieldLabel(field,language){
  if(extra[field])return extra[field][language==='sq'?1:0];
  const key=labels[field]||`editor.${field}`,label=translate(language,key);
  return label!==key?label:String(field).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/^./,letter=>letter.toUpperCase());
}
export function historyFieldValue(value,field,language){
  if(value===null||value===undefined||value===''||(Array.isArray(value)&&!value.length))return '—';
  const sq=language==='sq';
  if(typeof value==='boolean')return ['areaManual','stageManual'].includes(field)?value?(sq?'E zgjedhur nga autori':'Chosen by the author'):(sq?'Automatike':'Automatic'):value?(sq?'Po':'Yes'):(sq?'Jo':'No');
  if(Array.isArray(value))return value.map(item=>historyFieldValue(item,field,language)).join('\n');
  if(typeof value==='object')return Object.entries(value).map(([key,item])=>`${historyFieldLabel(key,language)}: ${historyFieldValue(item,key,language)}`).join('\n');
  if(['status','archivedFromStatus'].includes(field)){const label=translate(language,`status.${value}`);if(label!==`status.${value}`)return label;}
  if(['subject','curricularArea'].includes(field))return translateCatalogValue(language,String(value));
  return String(value);
}
