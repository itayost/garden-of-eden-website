/**
 * Offline shift action queue with dual storage:
 * - localStorage: primary, used by page-side sync hooks
 * - IndexedDB: mirror, accessible by Service Worker for Background Sync
 *
 * Actions are stored with client timestamps and synced when back online.
 * Queue expires after 2 hours.
 */

const QUEUE_KEY = "goe_shift_queue";
const QUEUE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours
const IDB_NAME = "goe_shift_queue_db";
const IDB_STORE = "actions";
const IDB_VERSION = 1;

export type ShiftActionType = "clock_in" | "clock_out";

export interface QueuedShiftAction {
  id: string;
  type: ShiftActionType;
  clientTimestamp: string; // ISO 8601 — when the trainer tapped the button
  queuedAt: number; // Date.now() — when added to queue
  retryCount: number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// localStorage (primary, page-side)
// ---------------------------------------------------------------------------

function readQueue(): QueuedShiftAction[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as QueuedShiftAction[];
  } catch {
    localStorage.removeItem(QUEUE_KEY);
    return [];
  }
}

function writeQueue(queue: QueuedShiftAction[]): void {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(QUEUE_KEY);
    } else {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
    console.error("[shift-queue] Failed to write queue:", error);
  }
}

// ---------------------------------------------------------------------------
// IndexedDB (mirror, accessible by Service Worker)
// ---------------------------------------------------------------------------

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbPut(action: QueuedShiftAction): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(action);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.error("[shift-queue] IDB put failed:", error);
  }
}

async function idbDelete(id: string): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.error("[shift-queue] IDB delete failed:", error);
  }
}

async function idbClear(): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.error("[shift-queue] IDB clear failed:", error);
  }
}

/** Read all actions from IndexedDB (used by Service Worker) */
export async function idbGetAll(): Promise<QueuedShiftAction[]> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const request = store.getAll();
    const result = await new Promise<QueuedShiftAction[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  } catch (error) {
    console.error("[shift-queue] IDB getAll failed:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function enqueueShiftAction(
  type: ShiftActionType,
  clientTimestamp: string
): QueuedShiftAction {
  const action: QueuedShiftAction = {
    id: generateId(),
    type,
    clientTimestamp,
    queuedAt: Date.now(),
    retryCount: 0,
  };

  const queue = readQueue();
  queue.push(action);
  writeQueue(queue);

  // Mirror to IndexedDB (fire-and-forget)
  idbPut(action);

  // Register background sync if available
  registerBackgroundSync();

  // Dispatch event so other components/hooks can react
  window.dispatchEvent(new CustomEvent("shift-queue-changed"));

  return action;
}

export function dequeueShiftAction(id: string): void {
  const queue = readQueue();
  const filtered = queue.filter((a) => a.id !== id);
  writeQueue(filtered);

  // Mirror to IndexedDB
  idbDelete(id);

  window.dispatchEvent(new CustomEvent("shift-queue-changed"));
}

export function getAllQueuedActions(): QueuedShiftAction[] {
  return readQueue();
}

export function isActionExpired(action: QueuedShiftAction): boolean {
  return Date.now() - action.queuedAt > QUEUE_EXPIRY_MS;
}

export function clearExpiredActions(): QueuedShiftAction[] {
  const queue = readQueue();
  const expired = queue.filter(isActionExpired);
  if (expired.length > 0) {
    const remaining = queue.filter((a) => !isActionExpired(a));
    writeQueue(remaining);

    for (const action of expired) {
      idbDelete(action.id);
    }

    window.dispatchEvent(new CustomEvent("shift-queue-changed"));
  }
  return expired;
}

export function incrementRetryCount(id: string): void {
  const queue = readQueue();
  const action = queue.find((a) => a.id === id);
  if (action) {
    action.retryCount++;
    writeQueue(queue);
    idbPut(action);
  }
}

export function clearQueue(): void {
  writeQueue([]);
  idbClear();
  window.dispatchEvent(new CustomEvent("shift-queue-changed"));
}

// ---------------------------------------------------------------------------
// navigator.sendBeacon — last-resort sync on page unload
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget: sends all pending actions via sendBeacon.
 * Called on `visibilitychange` (hidden) or `pagehide`.
 * sendBeacon is reliable even when the page is closing.
 *
 * After sending, localStorage is cleared to prevent page-side sync from
 * re-processing the same items. The IDB mirror remains intact — Service
 * Worker Background Sync serves as a backup if the beacon fails.
 */
export function sendBeaconSync(): void {
  const actions = readQueue();
  if (actions.length === 0) return;

  const payload = JSON.stringify({
    actions: actions.map((a) => ({
      type: a.type,
      clientTimestamp: a.clientTimestamp,
    })),
  });

  const sent = navigator.sendBeacon(
    "/api/shifts/sync",
    new Blob([payload], { type: "application/json" })
  );

  if (sent) {
    // Clear localStorage so page-side sync won't re-process these actions.
    // IDB copy remains — SW Background Sync acts as backup if beacon fails.
    writeQueue([]);
    console.log("[shift-queue] Beacon sent with", actions.length, "action(s)");
  }
}

/**
 * Recover items from IndexedDB that may have been cleared from localStorage
 * by sendBeaconSync but not yet processed by the Service Worker.
 * Call this when the page becomes visible again.
 */
export async function repopulateFromIDB(): Promise<void> {
  try {
    const idbActions = await idbGetAll();
    if (idbActions.length === 0) return;

    const currentQueue = readQueue();
    const currentIds = new Set(currentQueue.map((a) => a.id));

    let changed = false;
    for (const action of idbActions) {
      if (!currentIds.has(action.id)) {
        currentQueue.push(action);
        changed = true;
      }
    }

    if (changed) {
      writeQueue(currentQueue);
      window.dispatchEvent(new CustomEvent("shift-queue-changed"));
    }
  } catch (error) {
    console.error("[shift-queue] repopulateFromIDB failed:", error);
  }
}

/**
 * Remove specific action IDs from localStorage.
 * Called when the Service Worker reports successfully synced actions,
 * so the page-side queue stays in sync with IDB.
 */
export function clearProcessedFromLocalStorage(processedIds: string[]): void {
  if (processedIds.length === 0) return;
  const idSet = new Set(processedIds);
  const queue = readQueue();
  const filtered = queue.filter((a) => !idSet.has(a.id));
  if (filtered.length !== queue.length) {
    writeQueue(filtered);
    window.dispatchEvent(new CustomEvent("shift-queue-changed"));
  }
}

// ---------------------------------------------------------------------------
// Background Sync registration helper
// ---------------------------------------------------------------------------

async function registerBackgroundSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if ("sync" in registration) {
      await (
        registration as ServiceWorkerRegistration & {
          sync: { register(tag: string): Promise<void> };
        }
      ).sync.register("shift-queue-sync");
    }
  } catch {
    // Background Sync not supported or registration failed — not critical
  }
}
