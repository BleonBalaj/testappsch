import test from 'node:test';
import assert from 'node:assert/strict';
import { requestFields, datesBetween, validDate, clock, interval, explicitInterval, absenceCovers, assertCoverAvailable, matchesTeacher } from './schoolWorkflowCore.js';
import { mergeCourseSchedule } from './workflowSchedule.js';
import { mergeCourseSchedule as frontendSchedule } from '../src/features/courseSchedule.js';
const throws = (fn,key) => assert.throws(fn,error=>error.key===key);
const supply = { type:'supply',title:'Chairs',items:[{id:'a',name:'Chair',needed:4,provided:0}] };
test('supply quantities derive completion and reject underdelivery, fractions and duplicates',()=>{
  assert.equal(requestFields(supply).status,'needed');
  assert.equal(requestFields({...supply,items:[{...supply.items[0],provided:2}]}).status,'partial');
  assert.equal(requestFields({...supply,items:[{...supply.items[0],provided:4}]}).status,'completed');
  throws(()=>requestFields({...supply,status:'completed'}),'notFulfilled');
  for(const provided of [-1,5,1.5,Infinity]) throws(()=>requestFields({...supply,items:[{...supply.items[0],provided}]}),'quantities');
  throws(()=>requestFields({...supply,items:[...supply.items,...supply.items]}),'items');
  throws(()=>requestFields({type:'repair',title:'Leak',status:'completed'}),'resolution');
  assert.equal(requestFields({type:'repair',title:'Leak',status:'completed',resolution:'Pipe replaced'}).status,'completed');
});
test('dates and times preserve exact boundaries without guessing duration',()=>{
  throws(()=>validDate('2026-02-30'),'date'); throws(()=>validDate('wrong'),'date');
  assert.equal(datesBetween('2026-01-01','2026-01-31').length,31);
  throws(()=>datesBetween('2026-01-01','2026-02-01'),'dateRange');
  throws(()=>datesBetween('2026-01-02','2026-01-01'),'dateRange');
  assert.equal(clock('00:00'),0);assert.equal(clock('12:00 AM'),0);assert.equal(clock('12:30 PM'),750);
  assert.equal(clock('24:00'),null);assert.deepEqual(interval('09:00–09:45'),{start:540,end:585});
  assert.equal(interval('09:00').end,null);throws(()=>explicitInterval('10:00','09:00'),'times');
});
test('cover conflict checks include own lessons, other covers, absences and exact adjacency',()=>{
  const args={substituteUid:'sub',teacherUid:'teacher',date:'2026-10-19',slot:explicitInterval('09:00','09:45'),absences:[],covers:[],ownLessons:[]};
  assertCoverAvailable(args);
  throws(()=>assertCoverAvailable({...args,substituteUid:'teacher'}),'sameTeacher');
  const absence={teacherUid:'sub',status:'active',from:args.date,to:args.date,startTime:'09:15',endTime:'10:00'};
  throws(()=>assertCoverAvailable({...args,absences:[absence]}),'substituteAbsent');
  throws(()=>assertCoverAvailable({...args,ownLessons:[{time:'09:30–10:15'}]}),'timetableConflict');
  throws(()=>assertCoverAvailable({...args,ownLessons:[{time:'09:00'}]}),'ambiguousSchedule');
  assertCoverAvailable({...args,ownLessons:[{time:'09:45–10:30'}]});
  throws(()=>assertCoverAvailable({...args,covers:[{id:'other',date:args.date,substituteUid:'sub',status:'assigned',startTime:'09:30',endTime:'10:15'}]}),'coverConflict');
  assert.equal(absenceCovers(absence,args.date,{start:null,end:null}),true);
  assert.equal(matchesTeacher({teacher:'Similar Name'},{id:'teacher',name:'Similar Name'}),false);
  assert.equal(matchesTeacher({teacherEmail:'A@school.test'},{id:'teacher',email:'a@school.test'}),true);
});
test('backend and app derive identical course and saved timetables',()=>{
  const courses=[{id:'c1',name:'Math',teacherId:'teacher',schedule:'Mon and Wed 09:00–09:45'},{id:'c2',name:'Science',weeklySchedule:[{day:'Friday',time:'1:00 PM–1:45 PM'}]}];
  const saved=[{id:'s1',courseId:'c1',subject:'Math',day:'Monday',time:'09:00–09:45'}];
  assert.deepEqual(mergeCourseSchedule(courses,saved),frontendSchedule(courses,saved));
  assert.equal(mergeCourseSchedule(courses,saved).Monday.length,1);
});
