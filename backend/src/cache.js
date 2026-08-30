// Simple in-memory TTL cache
const store = new Map();

export function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function set(key, value, ttlMs = 5 * 60 * 1000) {
  store.set(key, { value, expiry: Date.now() + ttlMs });
}

export function clear() {
  store.clear();
}
