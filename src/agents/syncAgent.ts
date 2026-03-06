import { openDB } from "idb";

interface QueuedAction {
  id?: number;
  action: "create" | "update";
  collection: string;
  documentId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

const DB_NAME = "telehealth-offline-queue";
const STORE_NAME = "sync-actions";

const queueDb = openDB(DB_NAME, 1, {
  upgrade(database) {
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    }
  }
});

export const enqueueSyncAction = async (action: Omit<QueuedAction, "id" | "createdAt">) => {
  const db = await queueDb;
  await db.add(STORE_NAME, {
    ...action,
    createdAt: new Date().toISOString()
  });
};

export const getQueueSize = async (): Promise<number> => {
  const db = await queueDb;
  return db.count(STORE_NAME);
};

export const syncAgent = async (
  handler: (action: QueuedAction) => Promise<void>
): Promise<number> => {
  if (!navigator.onLine) {
    return 0;
  }

  const db = await queueDb;
  const allActions = await db.getAll(STORE_NAME);

  let synced = 0;
  for (const action of allActions) {
    try {
      await handler(action);
      if (action.id) {
        await db.delete(STORE_NAME, action.id);
      }
      synced += 1;
    } catch {
      break;
    }
  }

  return synced;
};

export const startAutoSync = (handler: (action: QueuedAction) => Promise<void>) => {
  window.addEventListener("online", () => {
    void syncAgent(handler);
  });
};

export type { QueuedAction };
