// Keep writes for each plan in order. A newer edit replaces an unsent edit,
// while an in-flight write finishes before the next version is sent.
export function createLessonCloudAutosave({ write, onStatus, delay = 450 }) {
  const pending = new Map();
  const timers = new Map();
  const inFlight = new Map();
  const status = new Map();
  const keyFor = (schoolId, planId) => `${schoolId}\u0000${planId}`;

  function drain(key) {
    if (inFlight.has(key) || !pending.has(key)) return inFlight.get(key);
    const entry = pending.get(key);
    pending.delete(key);
    let operation;
    try { operation = Promise.resolve(write(entry.plan, entry.schoolId)); }
    catch (error) { operation = Promise.reject(error); }
    inFlight.set(key, operation);
    operation.then(() => {
      inFlight.delete(key);
      if (pending.has(key)) drain(key);
      else {
        status.set(key, 'saved');
        onStatus(entry.plan.id, entry.schoolId, 'saved');
      }
    }, (error) => {
      inFlight.delete(key);
      if (pending.has(key)) drain(key);
      else {
        pending.set(key, entry);
        status.set(key, 'error');
        onStatus(entry.plan.id, entry.schoolId, 'error', error);
      }
    });
    return operation;
  }

  function flush(schoolId, planId) {
    for (const key of pending.keys()) {
      if (schoolId && !key.startsWith(`${schoolId}\u0000`)) continue;
      if (planId && key !== keyFor(schoolId, planId)) continue;
      if (timers.has(key)) clearTimeout(timers.get(key));
      timers.delete(key);
      drain(key);
    }
  }

  function enqueue(plan, schoolId, immediate = false) {
    if (!schoolId || !plan?.id) return false;
    const key = keyFor(schoolId, plan.id);
    pending.set(key, { plan, schoolId });
    status.set(key, 'saving');
    onStatus(plan.id, schoolId, 'saving');
    if (timers.has(key)) clearTimeout(timers.get(key));
    if (immediate) flush(schoolId, plan.id);
    else timers.set(key, setTimeout(() => { timers.delete(key); drain(key); }, delay));
    return true;
  }

  return {
    enqueue,
    flush,
    hasUnconfirmed: (schoolId, planId) => {
      const key = keyFor(schoolId, planId);
      return pending.has(key) || inFlight.has(key);
    },
    getStatus: (schoolId, planId) => status.get(keyFor(schoolId, planId))
  };
}
