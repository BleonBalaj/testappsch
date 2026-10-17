import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonAiBillingError} from './lessonAiServiceError.js';
test('provider credit depletion reaches the client as a clear billing issue, not an app quota or generic failure',()=>{
 const error=lessonAiBillingError({status:402,message:'sensitive provider details'});
 assert.equal(error.code,'failed-precondition');assert.equal(error.details.kind,'lesson-ai-billing');assert.match(error.message,/prepaid credits/);assert.doesNotMatch(error.message,/sensitive/);
 assert.equal(lessonAiBillingError({status:429}),null);assert.equal(lessonAiBillingError({status:500}),null);
});
