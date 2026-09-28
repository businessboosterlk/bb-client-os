/* THE LAST SAFE COPY. The rows a seat last saw, kept on the device so the screen opens at once and
   still opens with no connection. IndexedDB, because five thousand rows do not fit in localStorage.
   One key per client and kind. Signing out removes every key for that client. */
const DB = 'hub_copy', STORE = 'rows';
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('no indexedDB'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((res, rej) => {
      const t = db.transaction(STORE, mode); const q = fn(t.objectStore(STORE));
      t.oncomplete = () => res(q ? (q as IDBRequest<T>).result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  } finally { db.close(); }
}
export async function copyGet<T>(slug: string, kind: string): Promise<T[] | null> {
  try { const v = await tx<{ at: string; rows: T[] }>('readonly', s => s.get(`${slug}:${kind}`)); return v && Array.isArray(v.rows) ? v.rows : null; } catch { return null; }
}
export async function copyPut<T>(slug: string, kind: string, rows: T[]): Promise<void> {
  try { await tx('readwrite', s => s.put({ at: new Date().toISOString(), rows }, `${slug}:${kind}`)); } catch {}
}
export async function copyClear(slug: string): Promise<void> {
  try { await tx('readwrite', s => { s.delete(IDBKeyRange.bound(`${slug}:`, `${slug}:￿`)); }); } catch {}
}
export async function copyKeys(): Promise<string[]> {
  try { return ((await tx<IDBValidKey[]>('readonly', s => s.getAllKeys())) || []).map(String); } catch { return []; }
}
