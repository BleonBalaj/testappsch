// Embedded in the Nature scene by its generator; no polling or React updates.
function createNaturePerformanceCheck() {
  let settleUntil = null, start = 0, total = 0, cpu = 0, count = 0, slow = 0, disabled = false;
  return {
    disable() { disabled = true; },
    sample(now, gap, cost, eligible) {
      if (disabled) return false;
      if (settleUntil === null) settleUntil = now + 5000;
      // Throttled/occluded windows and interrupted runs need fresh evidence.
      if (!eligible || gap >= 250 || gap <= 0) {
        settleUntil = Math.max(settleUntil, now + 3000);
        start = total = cpu = count = slow = 0;
        return false;
      }
      if (now < settleUntil) return false;
      if (!start) start = now;
      total += gap; cpu += cost; count++;
      if (now - start < 2000) return false;
      // Normal capped 30fps (including 24fps displays) is not overload.
      // Two consecutive windows below ~17fps, or expensive CPU frames,
      // establish sustained contention rather than a single loading hitch.
      slow = count >= 8 && (total / count > 60 || cpu / count > 28) ? slow + 1 : 0;
      start = total = cpu = count = 0;
      if (slow < 2) return false;
      disabled = true;
      return true;
    },
  };
}
module.exports = { createNaturePerformanceCheck };
