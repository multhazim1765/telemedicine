import {
  createUserWithEmailAndPassword,
  deleteUser,
  getIdTokenResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword
} from "firebase/auth";
import { deleteDoc, doc, getDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";
import { AppUser, UserRole } from "../types/models";
import { assignUserRole } from "./functionService";
import { hospitalDoctors, hospitalLoginAccounts } from "../data/hospitalDoctors";
import { setDocumentById } from "./firestoreService";
import { nowIso } from "../utils/date";
import { demoPharmacies } from "../data/demoPharmacies";

interface DemoUser extends AppUser {
  password: string;
  doctorCode?: string;
}

const DEMO_SESSION_KEY = "telehealth-demo-user-id";
const DEMO_USERS_KEY = "telehealth-demo-users";
const DEMO_STORE_KEY = "telehealth-demo-store";
const PATIENT_HOSPITAL_PASSWORD_KEY = "telehealth-patient-hospital-login-password";
const DEFAULT_PATIENT_HOSPITAL_PASSWORD = "am9790";

const memoryStorage = new Map<string, string>();

const safeStorageGet = (key: string): string | null => {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) {
      memoryStorage.set(key, value);
      return value;
    }
  } catch {
    // Fall through to in-memory cache.
  }
  return memoryStorage.get(key) ?? null;
};

const safeStorageSet = (key: string, value: string): void => {
  memoryStorage.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // Keep in-memory value when browser storage is unavailable/full.
  }
};

const safeStorageRemove = (key: string): void => {
  memoryStorage.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage removal failures.
  }
};

const isPatientOrHospitalRole = (role: UserRole): boolean => role === "patient" || role === "doctor";

export const getPatientHospitalLoginPassword = (): string => {
  const configured = safeStorageGet(PATIENT_HOSPITAL_PASSWORD_KEY)?.trim();
  return configured || DEFAULT_PATIENT_HOSPITAL_PASSWORD;
};

const applyManagedPassword = (users: DemoUser[]): DemoUser[] => {
  const managedPassword = getPatientHospitalLoginPassword();
  return users.map((user) =>
    isPatientOrHospitalRole(user.role)
      ? {
        ...user,
        password: managedPassword
      }
      : user
  );
};

export const setPatientHospitalLoginPassword = (password: string): void => {
  const nextPassword = password.trim();
  if (nextPassword.length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }

  safeStorageSet(PATIENT_HOSPITAL_PASSWORD_KEY, nextPassword);
  const updatedUsers = applyManagedPassword(getDemoUsers());
  setDemoUsers(updatedUsers);
  broadcastDemoAuthChange();
};

const buildDefaultDemoUsers = (): DemoUser[] => [
  {
    uid: "demo-super-admin-1",
    email: "am9790@telehealth.local",
    password: "am9790@@",
    role: "super_admin",
    displayName: "System Admin",
    phone: "+910000000099"
  },
  {
    uid: "demo-patient-1",
    email: "patient@demo.local",
    password: getPatientHospitalLoginPassword(),
    role: "patient",
    displayName: "Rural Patient",
    phone: "+910000000001"
  },
  ...demoPharmacies.map((pharmacy) => ({
    uid: pharmacy.uid,
    email: pharmacy.email,
    password: pharmacy.password,
    role: "pharmacy" as const,
    displayName: pharmacy.displayName,
    pharmacyName: pharmacy.pharmacyName,
    district: pharmacy.district,
    phone: pharmacy.phone
  })),
  ...hospitalDoctors.map((doctor, index) => ({
    uid: doctor.id,
    email: `${doctor.id}@telehealth.local`,
    password: getPatientHospitalLoginPassword(),
    role: "doctor" as const,
    doctorCode: doctor.doctorCode,
    displayName: doctor.name,
    phone: `+910001${String(index + 1).padStart(6, "0")}`,
    hospitalName: doctor.hospitalName
  })),
  ...hospitalLoginAccounts
];

const mergeDefaultDemoUsers = (users: DemoUser[]): DemoUser[] => {
  const DEFAULT_DEMO_USERS = buildDefaultDemoUsers();
  const byUid = new Map(users.map((user) => [user.uid, user]));

  for (const defaultUser of DEFAULT_DEMO_USERS) {
    const existing = byUid.get(defaultUser.uid);
    if (!existing) {
      byUid.set(defaultUser.uid, defaultUser);
      continue;
    }

    byUid.set(defaultUser.uid, {
      ...existing,
      role: defaultUser.role,
      displayName: defaultUser.displayName,
      phone: defaultUser.phone,
      email: defaultUser.email,
      password: defaultUser.password,
      hospitalName: defaultUser.hospitalName,
      pharmacyName: defaultUser.pharmacyName,
      district: defaultUser.district
    });
  }

  return Array.from(byUid.values());
};

const mergeDoctorsFromDemoStore = (users: DemoUser[]): DemoUser[] => {
  const serializedStore = safeStorageGet(DEMO_STORE_KEY);
  if (!serializedStore) {
    return users;
  }

  type DemoStoreDoctorLike = {
    id?: unknown;
    userId?: unknown;
    doctorCode?: unknown;
    name?: unknown;
    phone?: unknown;
    hospitalName?: unknown;
  };

  let storeDoctors: DemoStoreDoctorLike[] = [];
  try {
    const parsedStore = JSON.parse(serializedStore) as { doctors?: unknown };
    if (Array.isArray(parsedStore.doctors)) {
      storeDoctors = parsedStore.doctors as DemoStoreDoctorLike[];
    }
  } catch {
    return users;
  }

  if (storeDoctors.length === 0) {
    return users;
  }

  const managedPassword = getPatientHospitalLoginPassword();
  const byUid = new Map(users.map((user) => [user.uid, user]));
  const activeDoctorIds = new Set<string>();

  for (const storeDoctor of storeDoctors) {
    const uid = String(storeDoctor.userId ?? storeDoctor.id ?? "").trim();
    if (!uid) {
      continue;
    }
    activeDoctorIds.add(uid);

    const current = byUid.get(uid);
    const hospitalName = String(storeDoctor.hospitalName ?? current?.hospitalName ?? "").trim();
    const displayName = String(storeDoctor.name ?? current?.displayName ?? uid).trim() || uid;
    const doctorCode = String(storeDoctor.doctorCode ?? current?.doctorCode ?? "").trim();
    const email = String(current?.email ?? `${uid}@hospital.local`).trim() || `${uid}@hospital.local`;
    const phone = String(storeDoctor.phone ?? current?.phone ?? "").trim();

    byUid.set(uid, {
      uid,
      role: "doctor",
      doctorCode,
      displayName,
      email,
      phone,
      hospitalName,
      password: managedPassword
    });
  }

  // Remove stale doctor credentials that no longer exist in Hospital Management doctors list.
  for (const [uid, user] of byUid.entries()) {
    if (user.role !== "doctor") {
      continue;
    }
    if (!/^d\d+$/i.test(uid)) {
      continue;
    }
    if (!activeDoctorIds.has(uid)) {
      byUid.delete(uid);
    }
  }

  return Array.from(byUid.values());
};

const getDemoUsers = (): DemoUser[] => {
  const DEFAULT_DEMO_USERS = buildDefaultDemoUsers();
  const raw = safeStorageGet(DEMO_USERS_KEY);
  if (!raw) {
    const managedDefaults = applyManagedPassword(DEFAULT_DEMO_USERS);
    safeStorageSet(DEMO_USERS_KEY, JSON.stringify(managedDefaults));
    return managedDefaults;
  }

  try {
    const parsed = JSON.parse(raw) as DemoUser[];
    if (!Array.isArray(parsed)) {
      safeStorageSet(DEMO_USERS_KEY, JSON.stringify(DEFAULT_DEMO_USERS));
      return [...DEFAULT_DEMO_USERS];
    }
    const merged = mergeDefaultDemoUsers(parsed);
    const mergedWithDoctors = mergeDoctorsFromDemoStore(merged);
    const managed = applyManagedPassword(mergedWithDoctors);
    safeStorageSet(DEMO_USERS_KEY, JSON.stringify(managed));
    return managed;
  } catch {
    const managedDefaults = applyManagedPassword(DEFAULT_DEMO_USERS);
    safeStorageSet(DEMO_USERS_KEY, JSON.stringify(managedDefaults));
    return managedDefaults;
  }
};

const setDemoUsers = (users: DemoUser[]) => {
  safeStorageSet(DEMO_USERS_KEY, JSON.stringify(users));
};

const findDemoUserByUid = (uid: string): AppUser | null => {
  const user = getDemoUsers().find((item) => item.uid === uid);
  if (!user) {
    return null;
  }
  const { password: _password, ...rest } = user;
  return rest;
};

const broadcastDemoAuthChange = () => {
  window.dispatchEvent(new Event("telehealth-demo-auth-changed"));
};

const normalizePhone = (value: string): string => value.replace(/[^0-9+]/g, "").trim();

const phoneToEmail = (phone: string): string => {
  const normalized = normalizePhone(phone).replace("+", "");
  return `${normalized}@telehealth.local`;
};

const resolveLoginIdentifierToEmail = (identifier: string): string => {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) {
    return trimmed;
  }

  if (/[a-zA-Z]/.test(trimmed)) {
    return `${trimmed.toLowerCase()}@telehealth.local`;
  }

  return phoneToEmail(trimmed);
};

const toFriendlyAuthError = (error: unknown, fallbackMessage: string): Error => {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";

  if (code === "auth/configuration-not-found") {
    return new Error("Firebase Authentication is not configured. In Firebase Console, enable Authentication, turn on Email/Password sign-in, and create the required user account.");
  }

  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-login-credentials") {
    return new Error("Invalid credentials. Check the username/email and password, and make sure the Firebase Auth user exists.");
  }

  if (code === "auth/operation-not-allowed") {
    return new Error("Email/Password sign-in is disabled in Firebase Authentication. Enable it in Firebase Console.");
  }

  if (code === "auth/unauthorized-domain") {
    return new Error("This domain is not authorized for Firebase Authentication. Add localhost under Authentication > Settings > Authorized domains.");
  }

  if (error instanceof Error && error.message) {
    return error;
  }

  return new Error(fallbackMessage);
};

export const loginWithEmail = (
  emailOrPhone: string,
  password: string
): Promise<AppUser> => {
  if (!isFirebaseConfigured) {
    const email = resolveLoginIdentifierToEmail(emailOrPhone);
    const matchedUser = getDemoUsers().find(
      (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password
    );

    if (!matchedUser) {
      return Promise.reject(new Error("Invalid credentials. Try demo accounts listed below."));
    }

    safeStorageSet(DEMO_SESSION_KEY, matchedUser.uid);
    broadcastDemoAuthChange();

    const { password: _password, ...profile } = matchedUser;
    return Promise.resolve(profile);
  }

  const email = resolveLoginIdentifierToEmail(emailOrPhone);

  return signInWithEmailAndPassword(auth, email, password)
    .then(async (credential) => {
      const profile = await getCurrentUserProfile(credential.user.uid);
      if (!profile) {
        throw new Error("User profile not found.");
      }
      return profile;
    })
    .catch((error) => {
      throw toFriendlyAuthError(error, "Login failed.");
    });
};

interface SignUpInput {
  phone: string;
  password: string;
  role: UserRole;
  displayName: string;
  specialization?: string;
  hospitalName?: string;
  district?: string;
  village?: string;
  age?: number;
  gender?: "male" | "female" | "other";
}

const designationFromSpecialization = (specialization?: string): string => {
  if (specialization === "cardiology") {
    return "Cardiologist";
  }
  if (specialization === "pediatrics") {
    return "Pediatrician";
  }
  return "General Physician";
};

export const signUpWithPhone = async (input: SignUpInput): Promise<AppUser> => {
  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) {
    throw new Error("Phone number is required.");
  }

  if (!isFirebaseConfigured) {
    const email = phoneToEmail(normalizedPhone);
    const users = getDemoUsers();
    const managedPassword = getPatientHospitalLoginPassword();
    const resolvedPassword = isPatientOrHospitalRole(input.role) ? managedPassword : input.password;
    const alreadyExists = users.some(
      (item) => item.email.toLowerCase() === email.toLowerCase() || item.phone === normalizedPhone
    );

    if (alreadyExists) {
      throw new Error("Account already exists for this phone number. Please login.");
    }

    const created: DemoUser = {
      uid: `demo-${input.role}-${Date.now()}`,
      email,
      password: resolvedPassword,
      role: input.role,
      displayName: input.displayName,
      phone: normalizedPhone
    };

    setDemoUsers([...users, created]);

    if (input.role === "patient") {
      const resolvedDistrict = input.district ?? input.village ?? "Unknown District";
      await setDocumentById("patients", created.uid, {
        id: created.uid,
        userId: created.uid,
        name: input.displayName,
        age: input.age ?? 25,
        gender: input.gender ?? "other",
        district: resolvedDistrict,
        village: input.village ?? resolvedDistrict,
        phone: normalizedPhone,
        createdAt: nowIso()
      });
    }

    if (input.role === "doctor") {
      const specialization = input.specialization ?? "general";
      const district = input.district ?? "Chennai District";
      await setDocumentById("doctors", created.uid, {
        id: created.uid,
        userId: created.uid,
        doctorCode: `D${created.uid.slice(-4).toUpperCase()}`,
        name: input.displayName,
        hospitalName: input.hospitalName ?? "Apollo Hospital Chennai",
        place: district,
        district,
        designation: designationFromSpecialization(specialization),
        specialization,
        availabilitySlots: ["09:00", "11:00", "15:00"],
        city: district,
        phone: normalizedPhone
      });
    }

    safeStorageSet(DEMO_SESSION_KEY, created.uid);
    broadcastDemoAuthChange();

    const { password: _password, ...profile } = created;
    return profile;
  }

  const email = phoneToEmail(normalizedPhone);
  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, email, input.password);
  } catch (error) {
    throw toFriendlyAuthError(error, "Failed to create account.");
  }

  await assignUserRole({
    role: input.role,
    displayName: input.displayName,
    phone: normalizedPhone,
    specialization: input.specialization,
    hospitalName: input.hospitalName,
    district: input.district,
    village: input.village,
    age: input.age,
    gender: input.gender
  });

  await credential.user.getIdToken(true);
  const profile = await getCurrentUserProfile(credential.user.uid);
  if (!profile) {
    throw new Error("Unable to create profile. Try again.");
  }

  return profile;
};

export const logout = (): Promise<void> => {
  if (!isFirebaseConfigured) {
    safeStorageRemove(DEMO_SESSION_KEY);
    broadcastDemoAuthChange();
    return Promise.resolve();
  }
  return signOut(auth);
};

export const observeAuth = (callback: (uid: string | null) => void): (() => void) => {
  if (!isFirebaseConfigured) {
    const run = () => callback(safeStorageGet(DEMO_SESSION_KEY));
    run();
    window.addEventListener("telehealth-demo-auth-changed", run);
    return () => window.removeEventListener("telehealth-demo-auth-changed", run);
  }
  return onAuthStateChanged(auth, (user) => callback(user?.uid ?? null));
};

export const getCurrentUserProfile = async (uid: string): Promise<AppUser | null> => {
  if (!isFirebaseConfigured) {
    return Promise.resolve(findDemoUserByUid(uid));
  }

  const authUser = auth.currentUser;
  const tokenResult = authUser ? await getIdTokenResult(authUser, true) : null;
  const claimRole = tokenResult?.claims.role as UserRole | undefined;

  const userDoc = await getDoc(doc(db, "users", uid));
  if (!userDoc.exists()) {
    if (!authUser?.email || !claimRole) {
      return null;
    }
    return {
      uid,
      email: authUser.email,
      role: claimRole,
      displayName: authUser.displayName ?? authUser.email
    };
  }

  const user = userDoc.data() as AppUser;
  return {
    ...user,
    role: claimRole ?? user.role,
    uid
  };
};

export const hasRole = (role: UserRole, allowed: UserRole[]): boolean =>
  allowed.includes(role);

export const deleteMyDoctorAccount = async (): Promise<void> => {
  if (!isFirebaseConfigured) {
    throw new Error("Configure Firebase to delete real accounts.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Not signed in.");
  }

  const uid = currentUser.uid;
  await deleteDoc(doc(db, "doctors", uid));
  await deleteDoc(doc(db, "users", uid));
  await deleteUser(currentUser);
};

export const getDemoCredentials = (): Array<{
  uid: string;
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
  doctorCode?: string;
  phone?: string;
  hospitalName?: string;
  pharmacyName?: string;
  district?: string;
}> => getDemoUsers().map(({ uid, displayName, email, password, role, doctorCode, phone, hospitalName, pharmacyName, district }) => ({
  uid,
  displayName,
  email,
  password,
  role,
  doctorCode,
  phone,
  hospitalName,
  pharmacyName,
  district
}));

export const requestPasswordReset = async (emailOrPhone: string): Promise<void> => {
  const email = resolveLoginIdentifierToEmail(emailOrPhone);

  if (!isFirebaseConfigured) {
    const exists = getDemoUsers().some((user) => user.email.toLowerCase() === email.toLowerCase());
    if (!exists) {
      throw new Error("Account not found for this email/phone.");
    }
    return;
  }

  await sendPasswordResetEmail(auth, email);
};

export const changeCurrentPassword = async (newPassword: string): Promise<void> => {
  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (!isFirebaseConfigured) {
    const uid = safeStorageGet(DEMO_SESSION_KEY);
    if (!uid) {
      throw new Error("Not signed in.");
    }

    const users = getDemoUsers();
    const updated = users.map((user) =>
      user.uid === uid
        ? {
          ...user,
          password: newPassword
        }
        : user
    );
    setDemoUsers(updated);
    return;
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Not signed in.");
  }

  await updatePassword(currentUser, newPassword);
};

export const isJwtSessionValid = async (): Promise<boolean> => {
  if (!isFirebaseConfigured) {
    return Boolean(safeStorageGet(DEMO_SESSION_KEY));
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return false;
  }

  const tokenResult = await getIdTokenResult(currentUser, false);
  const expiresAt = new Date(tokenResult.expirationTime).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

export const listDemoUsers = (): AppUser[] => {
  return getDemoUsers().map(({ password: _password, ...user }) => user);
};

export const addDemoUser = (input: {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  hospitalName?: string;
  pharmacyName?: string;
  district?: string;
}): AppUser => {
  const users = getDemoUsers();
  const resolvedRole = input.role;
  const managedPassword = getPatientHospitalLoginPassword();
  const normalizedPhone = input.phone ? normalizePhone(input.phone) : undefined;
  const email = input.email.trim().toLowerCase() || (normalizedPhone ? phoneToEmail(normalizedPhone) : "");
  const resolvedPassword = isPatientOrHospitalRole(resolvedRole) ? managedPassword : input.password;
  if (!email || !resolvedPassword) {
    throw new Error("Phone/email and password are required.");
  }

  const exists = users.some((user) => user.email.toLowerCase() === email);
  if (exists) {
    throw new Error("User already exists.");
  }

  const user: DemoUser = {
    uid: `demo-${input.role}-${Date.now()}`,
    email,
    password: resolvedPassword,
    role: resolvedRole,
    displayName: input.displayName,
    phone: normalizedPhone,
    hospitalName: input.hospitalName,
    pharmacyName: input.pharmacyName,
    district: input.district
  };

  setDemoUsers([...users, user]);
  broadcastDemoAuthChange();

  const { password: _password, ...profile } = user;
  return profile;
};

export const deleteDemoUser = (uid: string): void => {
  const users = getDemoUsers();
  setDemoUsers(users.filter((user) => user.uid !== uid));

  const currentUid = safeStorageGet(DEMO_SESSION_KEY);
  if (currentUid === uid) {
    safeStorageRemove(DEMO_SESSION_KEY);
  }

  broadcastDemoAuthChange();
};

export const updateDemoUser = (uid: string, input: {
  email?: string;
  displayName?: string;
  role?: UserRole;
  phone?: string;
}): AppUser => {
  const users = getDemoUsers();
  const index = users.findIndex((user) => user.uid === uid);
  if (index < 0) {
    throw new Error("User not found.");
  }

  const current = users[index];
  const nextPhone = input.phone !== undefined ? normalizePhone(input.phone) : current.phone;
  const nextEmail = input.email?.trim().toLowerCase()
    || (
      input.phone !== undefined && current.email.endsWith("@telehealth.local")
        ? phoneToEmail(nextPhone ?? "")
        : current.email
    );

  if (!nextEmail) {
    throw new Error("Email is required.");
  }

  const duplicate = users.some(
    (user) =>
      user.uid !== uid
      && (user.email.toLowerCase() === nextEmail.toLowerCase()
        || (nextPhone && user.phone === nextPhone))
  );
  if (duplicate) {
    throw new Error("Another user already exists with this email/phone.");
  }

  const updated: DemoUser = {
    ...current,
    email: nextEmail,
    displayName: input.displayName ?? current.displayName,
    role: input.role ?? current.role,
    phone: nextPhone
  };

  users[index] = updated;
  setDemoUsers(users);
  broadcastDemoAuthChange();

  const { password: _password, ...profile } = updated;
  return profile;
};

export const upsertDemoUserByUid = (uid: string, input: {
  email?: string;
  displayName: string;
  role?: UserRole;
  phone?: string;
  password?: string;
  hospitalName?: string;
  pharmacyName?: string;
  district?: string;
}): AppUser => {
  const users = getDemoUsers();
  const index = users.findIndex((user) => user.uid === uid);

  const normalizedPhone = input.phone ? normalizePhone(input.phone) : undefined;
  const fallbackEmail = normalizedPhone ? phoneToEmail(normalizedPhone) : `${uid}@telehealth.local`;
  const resolvedEmail = input.email?.trim().toLowerCase() || fallbackEmail;

  const duplicate = users.some(
    (user) => user.uid !== uid
      && (user.email.toLowerCase() === resolvedEmail.toLowerCase()
        || (normalizedPhone && user.phone === normalizedPhone))
  );
  if (duplicate) {
    throw new Error("Another user already exists with this email/phone.");
  }

  const current = index >= 0 ? users[index] : undefined;
  const resolvedRole = input.role ?? current?.role ?? "patient";
  const managedPassword = getPatientHospitalLoginPassword();
  const next: DemoUser = {
    uid,
    email: resolvedEmail,
    password: isPatientOrHospitalRole(resolvedRole)
      ? managedPassword
      : current?.password ?? input.password ?? "am9790",
    role: resolvedRole,
    displayName: input.displayName,
    phone: normalizedPhone ?? current?.phone,
    hospitalName: input.hospitalName ?? current?.hospitalName,
    pharmacyName: input.pharmacyName ?? current?.pharmacyName,
    district: input.district ?? current?.district
  };

  if (index >= 0) {
    users[index] = next;
  } else {
    users.push(next);
  }

  setDemoUsers(users);
  broadcastDemoAuthChange();

  const { password: _password, ...profile } = next;
  return profile;
};
