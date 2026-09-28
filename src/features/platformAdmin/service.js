import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';

const overviewCallable = httpsCallable(functions, 'getPlatformAdminOverview', { timeout: 130_000 });
const repairCallable = httpsCallable(functions, 'runPlatformAdminRepair', { timeout: 545_000 });

/** Error raised when the server does not recognize this account as the platform admin. */
export class PlatformAccessError extends Error {}

function unwrap(error, fallback) {
  // The server answers non-admins exactly like a missing endpoint.
  if (error?.code === 'functions/not-found' || error?.code === 'functions/permission-denied') {
    return new PlatformAccessError('Not found.');
  }
  return new Error(typeof error?.message === 'string' && error.message !== 'internal' ? error.message : fallback);
}

export async function fetchPlatformOverview() {
  try {
    return (await overviewCallable()).data;
  } catch (error) {
    throw unwrap(error, 'Could not load the platform overview.');
  }
}

export async function runPlatformRepair(action) {
  try {
    return (await repairCallable({ action })).data;
  } catch (error) {
    throw unwrap(error, 'The repair did not finish. It is safe to run again.');
  }
}
