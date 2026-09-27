import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

const provisionCallable = httpsCallable(functions, 'provisionSchoolUser');

/** Create or link a Firebase Auth account using the school's authorized server function. */
export async function provisionNewUser({ email, password, name, role = 'student', schoolId, extraData = {} }) {
  if (!schoolId) throw new Error('Select a school before adding an account.');
  if (!email?.trim() || !name?.trim()) throw new Error('Enter a name and email address.');
  try {
    const result = await provisionCallable({
      email: email.trim().toLowerCase(), password, name: name.trim(), role, schoolId, extraData,
    });
    return result.data;
  } catch (error) {
    const message = typeof error?.message === 'string' ? error.message : 'Could not create the school account.';
    throw new Error(message);
  }
}
