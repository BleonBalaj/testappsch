export const dataScope = (...parts) => JSON.stringify(parts.map(value => value ?? null));

// A subscription may finish after its account/tenant has changed. Only its
// current generation may publish; unsubscribe alone does not cancel promises.
export function createResponseGate() {
  let generation = 0;
  return {
    begin() { const token = ++generation; return () => token === generation; },
    cancel() { generation++; },
  };
}

export const scopedUpdate = (previous, scope, initial, update) => ({
  scope, value: typeof update === 'function' ? update(previous.scope === scope ? previous.value : initial) : update,
});
