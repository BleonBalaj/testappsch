export const storageRead = key => { try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; } };
export const storageWrite = (key, value) => { try { globalThis.localStorage?.setItem(key, value); } catch { /* Optional cache. */ } };
export const storageRemove = key => { try { globalThis.localStorage?.removeItem(key); } catch { /* Optional cache. */ } };
