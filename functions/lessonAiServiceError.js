import { HttpsError } from 'firebase-functions/v2/https';
export function lessonAiBillingError(error){
  if(error?.status!==402)return null;
  return new HttpsError('failed-precondition','AI generation is unavailable because the school AI service has run out of prepaid credits. The service owner needs to restore credits in Google AI Studio.',{kind:'lesson-ai-billing'});
}
