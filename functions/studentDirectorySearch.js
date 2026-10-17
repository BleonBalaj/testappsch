import { FieldPath, Filter } from 'firebase-admin/firestore';
import { fail, id, text } from './schoolWorkflowCore.js';
import { matchesStudentSearch, searchQueryToken } from './studentSearch.js';

export async function searchStudentDirectory(tx,school,data) {
  const f=data.filters||{},search=text(f.search||'',200),status=f.status||'all';
  if(!['all','active','archived','unassigned'].includes(status))fail('invalid');
  const classId=f.classId?id(f.classId):'',courseId=f.courseId?id(f.courseId):'';
  const course=courseId?(await tx.get(school.collection('classes').doc(courseId))).data():null;
  if(courseId&&!course)fail('missing');
  const field=f.ordered===false?FieldPath.documentId():'nameLower';
  let source=school.collection('students');
  if(classId){
    source=source.where('classGroupId','==',classId);
    if(status==='active'||status==='archived')source=source.where('status','==',status);
  }
  else if(courseId)source=source.where(course.classGroupId?Filter.or(Filter.where('assignedClasses','array-contains',courseId),Filter.where('classGroupId','==',course.classGroupId)):Filter.where('assignedClasses','array-contains',courseId));
  else if(search&&f.ordered!==false)source=source.where('searchTokens','array-contains',searchQueryToken(search));
  else if(status==='unassigned')source=source.where('classGroupId','==','').where('status','==','active');
  else if(status!=='all')source=source.where('status','==',status);

  source=source.orderBy(field,'asc');
  if(f.ordered!==false)source=source.orderBy(FieldPath.documentId(),'asc');
  let cursor=data.cursor||null;
  if(cursor){id(cursor.id);text(cursor.value,200);}
  const wanted=data.remaining??41;
  if(!Number.isSafeInteger(wanted)||wanted<1||wanted>101)fail('invalid');
  const rows=[],cursors=[];let more=true,scanned=0;
  while(more&&scanned<800&&rows.length<wanted){
    const query=cursor?source.startAfter(...(f.ordered===false?[cursor.id]:[cursor.value,cursor.id])):source;
    const page=await tx.get(query.limit(200));if(!page.size){more=false;break;}
    let consumed=0;
    for(const snapshot of page.docs){
      const row=snapshot.data();scanned++;consumed++;cursor={id:snapshot.id,value:f.ordered===false?snapshot.id:row.nameLower};
      const archived=row.status==='archived';
      const matches=(status==='all'||(status==='archived'?archived:!archived))
        &&(status!=='unassigned'||!row.classGroupId)&&(!classId||row.classGroupId===classId)
        &&(!courseId||row.assignedClasses?.includes(courseId)||(course.classGroupId&&row.classGroupId===course.classGroupId))
        &&matchesStudentSearch(row,search);
      if(matches){rows.push({...JSON.parse(JSON.stringify(row)),id:snapshot.id});cursors.push(cursor);}
      if(rows.length===wanted)break;
    }
    more=consumed<page.size||page.size===200;
  }
  return{rows,cursors,cursor,more,scanned};
}
