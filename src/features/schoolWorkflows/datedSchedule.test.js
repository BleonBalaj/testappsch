import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDatedCoverage } from './datedSchedule.js';
test('dated coverage preserves weekly records, restores cancelled absences and includes manual lessons',()=>{
  const original={Monday:[{id:'slot',subject:'Math',time:'09:00–09:45'}]},dates={Monday:'2026-10-19'};
  const cover={id:'a',slotId:'slot',subject:'Math',date:dates.Monday,status:'assigned',substituteUid:'sub',startTime:'09:05',endTime:'09:50'};
  const changed=applyDatedCoverage(original,[cover],dates);
  assert.equal(changed.Monday[0].coverage.substituteUid,'sub');assert.equal(changed.Monday[0].time,'09:05–09:50');
  assert.equal(original.Monday[0].time,'09:00–09:45');assert.equal(original.Monday[0].coverage,undefined);
  assert.deepEqual(applyDatedCoverage(original,[{...cover,restoredWeekly:true}],dates),original);
  assert.deepEqual(applyDatedCoverage(original,[{...cover,date:'2026-10-20'}],dates),original);
  const manual=applyDatedCoverage(original,[{...cover,id:'manual',slotId:'manual:c1',status:'cancelled'}],dates);
  assert.equal(manual.Monday.length,2);assert.equal(manual.Monday[1].source,'coverage');assert.equal(manual.Monday[1].coverage.status,'cancelled');
});
