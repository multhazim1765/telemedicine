import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(async () => ({ id: "mock-id" })),
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({ exists: () => true, id: "mock-id", data: () => ({ name: "Patient" }) })),
  getDocs: vi.fn(async () => ({ docs: [] })),
  onSnapshot: vi.fn(() => () => {}),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => new Date().toISOString()),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
  initializeFirestore: vi.fn(),
  persistentLocalCache: vi.fn(),
  persistentMultipleTabManager: vi.fn()
}));

vi.mock("./firebase", () => ({
  db: {},
  isFirebaseConfigured: true
}));

import { createDocument } from "./firestoreService";

describe("firestoreService", () => {
  it("creates a document and returns id", async () => {
    const id = await createDocument("patients", {
      name: "John",
      userId: "u-1"
    });

    expect(id).toBe("mock-id");
  });
});
