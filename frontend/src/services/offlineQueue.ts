export interface QueuedAttachment {
  fileName: string;
  mimeType: string;
  data: ArrayBuffer;
}

export interface QueuedMessage {
  clientMessageId: string;
  conversationId: string;
  content: string | null;
  replyToId: string | null;
  messageType: "text" | "image" | "video" | "audio" | "document" | "voice";
  createdAt: string;
  retryCount: number;
  attachment?: QueuedAttachment;
}

const DB_NAME = "MessengerOfflineDB";
const DB_VERSION = 1;
const STORE_NAME = "queued_messages";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "clientMessageId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveQueuedMessage(msg: QueuedMessage): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(msg);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to save message to IndexedDB, fallback to localStorage", err);
    try {
      const existing = getLocalStorageQueue();
      const filtered = existing.filter((m) => m.clientMessageId !== msg.clientMessageId);
      filtered.push(msg);
      localStorage.setItem("messenger_offline_queue", JSON.stringify(filtered));
    } catch {
      /* ignore */
    }
  }
}

export async function getQueuedMessages(): Promise<QueuedMessage[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to read from IndexedDB, fallback to localStorage", err);
    return getLocalStorageQueue();
  }
}

export async function removeQueuedMessage(clientMessageId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(clientMessageId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* fallback to localStorage */
  }
  try {
    const existing = getLocalStorageQueue();
    const filtered = existing.filter((m) => m.clientMessageId !== clientMessageId);
    localStorage.setItem("messenger_offline_queue", JSON.stringify(filtered));
  } catch {
    /* ignore */
  }
}

function getLocalStorageQueue(): QueuedMessage[] {
  try {
    const data = localStorage.getItem("messenger_offline_queue");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}
