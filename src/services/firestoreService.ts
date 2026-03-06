import {
  CollectionReference,
  DocumentData,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { FirestoreCollections } from "../types/firestoreCollections";
import { QueuedAction } from "../agents/syncAgent";
import { nowIso } from "../utils/date";
import { hospitalDoctors } from "../data/hospitalDoctors";
import { medicineRules } from "../data/medicineTriageDataset";
import { hospitalLoginAccounts } from "../data/hospitalDoctors";
import { defaultHospitalCatalog } from "../utils/hospitalCatalog";

type CollectionName = keyof FirestoreCollections;
type CollectionRecord = FirestoreCollections[CollectionName];
const DEMO_STORE_KEY = "telehealth-demo-store";
const DEMO_STORE_EVENT = "telehealth-demo-store-updated";

const coll = <K extends CollectionName>(name: K): CollectionReference<DocumentData> =>
  collection(db, name);

type DemoStore = Record<CollectionName, CollectionRecord[]>;

const seedStore = (): DemoStore => ({
  users: [
    {
      id: "demo-super-admin-1",
      uid: "demo-super-admin-1",
      email: "am9790@telehealth.local",
      role: "super_admin",
      displayName: "System Admin",
      phone: "+910000000099"
    },
    {
      id: "demo-patient-1",
      uid: "demo-patient-1",
      email: "patient@demo.local",
      role: "patient",
      displayName: "Rural Patient",
      phone: "+910000000001"
    },
    {
      id: "demo-pharmacy-1",
      uid: "demo-pharmacy-1",
      email: "pharmacy@demo.local",
      role: "pharmacy",
      displayName: "Village Pharmacy",
      phone: "+910000000003"
    },
    ...hospitalLoginAccounts.map((account) => ({
      id: account.uid,
      uid: account.uid,
      email: account.email,
      role: account.role,
      displayName: account.displayName,
      phone: account.phone,
      hospitalName: account.hospitalName
    }))
  ],
  patients: [
    {
      id: "demo-patient-1",
      userId: "demo-patient-1",
      name: "Rural Patient",
      age: 34,
      gender: "female",
      district: "Chennai District",
      village: "Bishnupur",
      phone: "+910000000001",
      createdAt: nowIso()
    }
  ],
  doctors: hospitalDoctors,
  hospital_catalog: defaultHospitalCatalog,
  appointments: [],
  triage_sessions: [],
  consultations: [],
  prescriptions: [],
  pharmacy_requests: [],
  medicine_stock: medicineRules.map((rule, index) => ({
    id: `stock-${rule.id.toLowerCase()}`,
    medicineId: rule.id,
    medicineName: rule.medicineName,
    quantity: index % 7 === 0 ? 0 : 25,
    inStock: index % 7 !== 0,
    alternatives: [],
    updatedAt: nowIso()
  }))
});

const emitDemoStoreUpdated = () => {
  window.dispatchEvent(new Event(DEMO_STORE_EVENT));
};

const loadDemoStore = (): DemoStore => {
  const serialized = localStorage.getItem(DEMO_STORE_KEY);
  if (!serialized) {
    const initialStore = seedStore();
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(initialStore));
    return initialStore;
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<DemoStore>;
    const seeded = seedStore();
    const parsedDoctors = parsed.doctors ?? [];
    const hasMasterDoctorShape = parsedDoctors.every(
      (doctor) =>
        Boolean((doctor as { doctorCode?: string }).doctorCode) &&
        Boolean((doctor as { hospitalName?: string }).hospitalName) &&
        Boolean((doctor as { place?: string }).place) &&
        Boolean((doctor as { designation?: string }).designation)
    );

    const seededDoctors = seeded.doctors as FirestoreCollections["doctors"][];
    const parsedDoctorsTyped = parsedDoctors as FirestoreCollections["doctors"][];
    const parsedDoctorsById = new Map(parsedDoctorsTyped.map((doctor) => [doctor.id, doctor]));
    const seededDoctorIds = new Set(seededDoctors.map((doctor) => doctor.id));

    const mergedSeededDoctors = seededDoctors.map(
      (seedDoctor) => parsedDoctorsById.get(seedDoctor.id) ?? seedDoctor
    );

    const customParsedDoctors = parsedDoctorsTyped.filter(
      (doctor) => !seededDoctorIds.has(doctor.id)
    );

    const migratedDoctors = hasMasterDoctorShape
      ? [...mergedSeededDoctors, ...customParsedDoctors]
      : seeded.doctors;

    const parsedCatalog = (parsed.hospital_catalog ?? []) as FirestoreCollections["hospital_catalog"][];
    const seededCatalog = seeded.hospital_catalog as FirestoreCollections["hospital_catalog"][];
    const parsedCatalogById = new Map(parsedCatalog.map((item) => [item.id, item]));
    const mergedCatalog = seededCatalog.map((seedItem) => parsedCatalogById.get(seedItem.id) ?? seedItem);
    const seededCatalogIds = new Set(seededCatalog.map((item) => item.id));
    const customCatalogItems = parsedCatalog.filter((item) => !seededCatalogIds.has(item.id));

    return {
      users: parsed.users ?? seeded.users,
      patients: parsed.patients ?? seeded.patients,
      doctors: migratedDoctors,
      hospital_catalog: [...mergedCatalog, ...customCatalogItems],
      appointments: parsed.appointments ?? seeded.appointments,
      triage_sessions: parsed.triage_sessions ?? seeded.triage_sessions,
      consultations: parsed.consultations ?? seeded.consultations,
      prescriptions: parsed.prescriptions ?? seeded.prescriptions,
      pharmacy_requests: parsed.pharmacy_requests ?? seeded.pharmacy_requests,
      medicine_stock: parsed.medicine_stock ?? seeded.medicine_stock
    };
  } catch {
    const initialStore = seedStore();
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(initialStore));
    return initialStore;
  }
};

const saveDemoStore = (store: DemoStore) => {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
  emitDemoStoreUpdated();
};

const makeDemoId = (collectionName: string) => `${collectionName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const createDocument = async <K extends CollectionName>(
  collectionName: K,
  data: Partial<FirestoreCollections[K]>
): Promise<string> => {
  if (!isFirebaseConfigured) {
    const store = loadDemoStore();
    const id = makeDemoId(String(collectionName));
    const newRecord = {
      id,
      ...data,
      createdAt: (data as { createdAt?: string }).createdAt ?? nowIso(),
      updatedAt: nowIso()
    } as unknown as CollectionRecord;
    store[collectionName] = [...store[collectionName], newRecord] as CollectionRecord[];
    saveDemoStore(store);
    return id;
  }

  const ref = await addDoc(coll(collectionName), {
    ...data,
    createdAt: (data as { createdAt?: string }).createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
};

export const setDocumentById = async <K extends CollectionName>(
  collectionName: K,
  id: string,
  data: Partial<FirestoreCollections[K]>
): Promise<void> => {
  if (!isFirebaseConfigured) {
    const store = loadDemoStore();
    const list = store[collectionName] as FirestoreCollections[K][];
    const index = list.findIndex((item) => item.id === id);
    const nextRecord = {
      id,
      ...(index >= 0 ? list[index] : {}),
      ...data,
      updatedAt: nowIso()
    } as FirestoreCollections[K];

    if (index >= 0) {
      list[index] = nextRecord;
    } else {
      list.push(nextRecord);
    }
    store[collectionName] = list as CollectionRecord[];
    saveDemoStore(store);
    return;
  }

  await setDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const updateDocumentById = async <K extends CollectionName>(
  collectionName: K,
  id: string,
  data: Partial<FirestoreCollections[K]>
): Promise<void> => {
  if (!isFirebaseConfigured) {
    const store = loadDemoStore();
    const list = store[collectionName] as FirestoreCollections[K][];
    store[collectionName] = list.map((item) =>
      item.id === id
        ? ({
            ...item,
            ...data,
            updatedAt: nowIso()
          } as FirestoreCollections[K])
        : item
    ) as CollectionRecord[];
    saveDemoStore(store);
    return;
  }

  await updateDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: serverTimestamp()
  });
};

export const deleteDocumentById = async <K extends CollectionName>(
  collectionName: K,
  id: string
): Promise<void> => {
  if (!isFirebaseConfigured) {
    const store = loadDemoStore();
    store[collectionName] = (store[collectionName] as FirestoreCollections[K][]).filter(
      (item) => item.id !== id
    ) as CollectionRecord[];
    saveDemoStore(store);
    return;
  }

  await deleteDoc(doc(db, collectionName, id));
};

export const getDocumentById = async <K extends CollectionName>(
  collectionName: K,
  id: string
): Promise<FirestoreCollections[K] | null> => {
  if (!isFirebaseConfigured) {
    const store = loadDemoStore();
    return ((store[collectionName] as FirestoreCollections[K][]).find((item) => item.id === id) ?? null) as FirestoreCollections[K] | null;
  }

  const snapshot = await getDoc(doc(db, collectionName, id));
  if (!snapshot.exists()) {
    return null;
  }
  return {
    id: snapshot.id,
    ...snapshot.data()
  } as FirestoreCollections[K];
};

export const listCollection = async <K extends CollectionName>(
  collectionName: K
): Promise<FirestoreCollections[K][]> => {
  if (!isFirebaseConfigured) {
    const store = loadDemoStore();
    return [...(store[collectionName] as FirestoreCollections[K][])].reverse();
  }

  const snapshot = await getDocs(coll(collectionName));
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...entry.data()
  })) as FirestoreCollections[K][];
};

export const listByField = async <K extends CollectionName>(
  collectionName: K,
  field: string,
  value: string
): Promise<FirestoreCollections[K][]> => {
  if (!isFirebaseConfigured) {
    const store = loadDemoStore();
    return (store[collectionName] as FirestoreCollections[K][]).filter(
      (item) => String((item as unknown as Record<string, unknown>)[field]) === value
    );
  }

  const q = query(coll(collectionName), where(field, "==", value), orderBy("updatedAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...entry.data()
  })) as FirestoreCollections[K][];
};

export const subscribeCollection = <K extends CollectionName>(
  collectionName: K,
  callback: (items: FirestoreCollections[K][]) => void
): (() => void) => {
  if (!isFirebaseConfigured) {
    const run = () => {
      const store = loadDemoStore();
      callback([...(store[collectionName] as FirestoreCollections[K][])].reverse());
    };
    run();
    window.addEventListener(DEMO_STORE_EVENT, run);
    return () => window.removeEventListener(DEMO_STORE_EVENT, run);
  }

  const q = query(coll(collectionName), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data()
      })) as FirestoreCollections[K][]
    );
  });
};

export const processSyncAction = async (action: QueuedAction): Promise<void> => {
  if (!isFirebaseConfigured) {
    if (action.action === "create") {
      await createDocument(action.collection as CollectionName, action.payload as Partial<FirestoreCollections[CollectionName]>);
    } else if (action.action === "update" && action.documentId) {
      await updateDocumentById(action.collection as CollectionName, action.documentId, action.payload as Partial<FirestoreCollections[CollectionName]>);
    }
    return;
  }

  if (action.action === "create") {
    await addDoc(collection(db, action.collection), {
      ...action.payload,
      updatedAt: serverTimestamp()
    });
    return;
  }

  if (!action.documentId) {
    return;
  }

  await updateDoc(doc(db, action.collection, action.documentId), {
    ...action.payload,
    updatedAt: serverTimestamp()
  });
};
