// Service Worker for PWA installability + Background Sync for shift queue

const IDB_NAME = "goe_shift_queue_db";
const IDB_STORE = "actions";
const IDB_VERSION = 1;
const QUEUE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours
const SYNC_TAG = "shift-queue-sync";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Let Next.js handle all requests — pass through
  // This SW exists primarily to enable PWA installability
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable",
          })
      )
    );
  }
});

// ---------------------------------------------------------------------------
// Background Sync — processes queued shift actions from IndexedDB
// ---------------------------------------------------------------------------

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processShiftQueue());
  }
});

async function processShiftQueue() {
  const actions = await idbGetAll();
  if (actions.length === 0) return;

  // Filter expired actions
  const now = Date.now();
  const valid = [];
  const expired = [];

  for (const action of actions) {
    if (now - action.queuedAt > QUEUE_EXPIRY_MS) {
      expired.push(action);
    } else {
      valid.push(action);
    }
  }

  // Remove expired from IDB
  for (const action of expired) {
    await idbDelete(action.id);
  }

  if (valid.length === 0) {
    await notifyClients("shift-queue-synced", expired.map((a) => a.id));
    return;
  }

  // Sort chronologically
  valid.sort((a, b) => a.queuedAt - b.queuedAt);

  // Send to sync API (include action IDs for coordination)
  try {
    const response = await fetch("/api/shifts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actions: valid.map((a) => ({
          id: a.id,
          type: a.type,
          clientTimestamp: a.clientTimestamp,
        })),
      }),
      credentials: "same-origin",
    });

    if (response.ok) {
      const data = await response.json();
      const processedIds = [];

      // Remove handled actions from IDB (success, expired, or server rejection)
      // Only network failures should keep the action in the queue
      if (data.results) {
        for (let i = 0; i < data.results.length && i < valid.length; i++) {
          await idbDelete(valid[i].id);
          processedIds.push(valid[i].id);
        }
      }

      await notifyClients("shift-queue-synced", processedIds);
    } else if (response.status === 401) {
      // Auth expired — keep items in IDB for retry after re-authentication.
      // Notify clients so they can prompt the user to log in.
      await notifyClients("shift-queue-auth-needed", []);
    }
    // Other server errors: leave in IDB, background sync will retry
  } catch {
    // Network error — throw so background sync retries automatically
    throw new Error("Network unavailable");
  }
}

// Notify all open tabs about queue state changes
async function notifyClients(type = "shift-queue-synced", processedIds = []) {
  const allClients = await self.clients.matchAll({ type: "window" });
  for (const client of allClients) {
    client.postMessage({ type, processedIds });
  }
}

// ---------------------------------------------------------------------------
// IndexedDB helpers (duplicated here since SW can't import ES modules)
// ---------------------------------------------------------------------------

function openIDB() {
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

async function idbGetAll() {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, "readonly");
  const store = tx.objectStore(IDB_STORE);
  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function idbDelete(id) {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, "readwrite");
  tx.objectStore(IDB_STORE).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
