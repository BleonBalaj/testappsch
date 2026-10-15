export function lessonAiQuotaRefreshDelay(quota, now = Date.now()) {
  const reset = Date.parse(quota?.resetsAt || '');
  if (!Number.isFinite(reset)) return null;
  // Use server time so a device clock cannot keep yesterday's limit on screen.
  const server = Date.parse(quota?.serverTime || '');
  const resetDelay = Math.max(1000, reset - (Number.isFinite(server) ? server : now) + 100);
  // Recheck occupied slots, so failed jobs cannot leave the button disabled.
  return quota.remaining === 0 && quota.reserved > 0 ? Math.min(resetDelay, 15000) : resetDelay;
}

export function lessonAiQuotaExhausted(quota) {
  if (!quota) return false;
  return quota.remaining === 0 || quota.used >= (quota.limit || 50);
}
