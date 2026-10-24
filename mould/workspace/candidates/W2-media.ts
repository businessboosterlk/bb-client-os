const DB_NAME = 'hub_media';
const STORE_NAME = 'files';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) {
    return dbPromise;
  }

  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      resolve(null);
    };
  });

  return dbPromise;
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function newMediaId(): string {
  const timePart = performance.now().toString(36).replace('.', '');
  const randomPart = Math.random().toString(36).slice(2);
  return 'md' + timePart + randomPart;
}

export async function putMedia(slug: string, blob: Blob, id?: string): Promise<string> {
  const key = `${slug}:${id ?? newMediaId()}`;
  const db = await openDatabase();
  if (!db) {
    return id ?? key.split(':')[1];
  }

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(blob, key);
    await transactionComplete(transaction);
    return key.split(':')[1];
  } catch {
    return id ?? key.split(':')[1];
  }
}

export async function hasMedia(slug: string, id: string): Promise<boolean> {
  const key = `${slug}:${id}`;
  const db = await openDatabase();
  if (!db) {
    return false;
  }

  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getKey(key);
    const result = await requestResult(request);
    await transactionComplete(transaction);
    return result !== undefined;
  } catch {
    return false;
  }
}

export async function getMedia(slug: string, id: string): Promise<Blob | null> {
  const key = `${slug}:${id}`;
  const db = await openDatabase();
  if (!db) {
    return null;
  }

  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    const result = await requestResult(request);
    await transactionComplete(transaction);
    return result instanceof Blob ? result : null;
  } catch {
    return null;
  }
}

const urlMap = new Map<string, string>();

export async function mediaUrl(slug: string, id: string): Promise<string> {
  const key = `${slug}:${id}`;
  const existing = urlMap.get(key);
  if (existing) {
    return existing;
  }

  const blob = await getMedia(slug, id);
  if (!blob) {
    return '';
  }

  const url = URL.createObjectURL(blob);
  urlMap.set(key, url);
  return url;
}

export async function removeMedia(slug: string, id: string): Promise<void> {
  const key = `${slug}:${id}`;
  const db = await openDatabase();
  if (!db) {
    return;
  }

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(key);
    await transactionComplete(transaction);
  } catch {
    // Swallow the error.
  }

  const url = urlMap.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlMap.delete(key);
  }
}

export async function clearMedia(slug: string): Promise<void> {
  const prefix = `${slug}:`;
  const db = await openDatabase();
  if (!db) {
    return;
  }

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const keysRequest = store.getAllKeys();
    const keys = await requestResult(keysRequest);
    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        store.delete(key);
        const url = urlMap.get(key);
        if (url) {
          URL.revokeObjectURL(url);
          urlMap.delete(key);
        }
      }
    }
    await transactionComplete(transaction);
  } catch {
    // Swallow the error.
  }
}

export async function seedMedia(slug: string, id: string, href: string): Promise<void> {
  const key = `${slug}:${id}`;
  const db = await openDatabase();
  if (!db) {
    return;
  }

  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getKey(key);
    const result = await requestResult(request);
    await transactionComplete(transaction);
    if (result !== undefined) {
      return;
    }
  } catch {
    return;
  }

  try {
    const response = await fetch(href);
    if (!response.ok) {
      return;
    }
    const blob = await response.blob();
    await putMedia(slug, blob, id);
  } catch {
    // Swallow the error.
  }
}

export async function shrinkImage(file: Blob, max = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;
    const scale = Math.min(1, max / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }

    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', quality);
    });

    if (!blob) {
      return file;
    }
    return blob;
  } catch {
    return file;
  }
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime = 0;
  private isRecording = false;

  static supported(): boolean {
    return Boolean(
      navigator.mediaDevices?.getUserMedia &&
      window.MediaRecorder
    );
  }

  get recording(): boolean {
    return this.isRecording;
  }

  async start(): Promise<void> {
    if (this.isRecording || !VoiceRecorder.supported()) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.stream = stream;

      const mimeTypes = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
      let mimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      this.mediaRecorder = recorder;
      this.chunks = [];
      this.startTime = performance.now();
      this.isRecording = true;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };
      recorder.start();
    } catch {
      this.stopTracks();
      this.isRecording = false;
    }
  }

  elapsed(): number {
    if (!this.isRecording) {
      return 0;
    }
    return (performance.now() - this.startTime) / 1000;
  }

  async stop(): Promise<{ blob: Blob; secs: number }> {
    const recorder = this.mediaRecorder;
    const stream = this.stream;
    if (!recorder || !this.isRecording) {
      return { blob: new Blob(), secs: 0 };
    }

    this.isRecording = false;

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.stop();
    await stopped;

    const mimeType = recorder.mimeType || 'audio/webm';
    const blob = new Blob(this.chunks, { type: mimeType });
    const secs = Math.max(0.5, Math.round(this.elapsed() * 10) / 10);

    this.stopTracks();
    this.mediaRecorder = null;
    this.chunks = [];
    this.startTime = 0;

    return { blob, secs };
  }

  cancel(): void {
    const recorder = this.mediaRecorder;
    if (recorder && this.isRecording) {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // Swallow the error.
      }
    }
    this.isRecording = false;
    this.stopTracks();
    this.mediaRecorder = null;
    this.chunks = [];
    this.startTime = 0;
  }

  private stopTracks(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}
