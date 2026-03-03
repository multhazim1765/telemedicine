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
import { hospitalLoginAccounts } from "../data/hospitalDoctors";

interface DemoUser extends AppUser {
  password: string;
}

const DEMO_SESSION_KEY = "telehealth-demo-user-id";
const DEMO_USERS_KEY = "telehealth-demo-users";

const DEFAULT_DEMO_USERS: DemoUser[] = [
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
    password: "demo123",
    role: "patient",
    displayName: "Rural Patient",
    phone: "+910000000001"
  },
  {
    uid: "demo-pharmacy-1",
    email: "pharmacy@demo.local",
    password: "demo123",
    role: "pharmacy",
    displayName: "Village Pharmacy",
    phone: "+910000000003"
  },
  ...hospitalLoginAccounts
];

const mergeDefaultDemoUsers = (users: DemoUser[]): DemoUser[] => {
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
      password: defaultUser.password
    });
  }

  return Array.from(byUid.values());
};

const getDemoUsers = (): DemoUser[] => {
  const raw = localStorage.getItem(DEMO_USERS_KEY);
  if (!raw) {
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(DEFAULT_DEMO_USERS));
    return [...DEFAULT_DEMO_USERS];
  }

  try {
    const parsed = JSON.parse(raw) as DemoUser[];
    if (!Array.isArray(parsed)) {
      localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(DEFAULT_DEMO_USERS));
      return [...DEFAULT_DEMO_USERS];
    }
    const merged = mergeDefaultDemoUsers(parsed);
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(DEFAULT_DEMO_USERS));
    return [...DEFAULT_DEMO_USERS];
  }
};

const setDemoUsers = (users: DemoUser[]) => {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
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

    localStorage.setItem(DEMO_SESSION_KEY, matchedUser.uid);
    broadcastDemoAuthChange();

    const { password: _password, ...profile } = matchedUser;
    return Promise.resolve(profile);
  }

  const email = resolveLoginIdentifierToEmail(emailOrPhone);

  return signInWithEmailAndPassword(auth, email, password).then(async (credential) => {
    const profile = await getCurrentUserProfile(credential.user.uid);
    if (!profile) {
      throw new Error("User profile not found.");
    }
    return profile;
  });
};

interface SignUpInput {
  phone: string;
  password: string;
  role: UserRole;
  displayName: string;
  specialization?: string;
  village?: string;
  age?: number;
  gender?: "male" | "female" | "other";
}

export const signUpWithPhone = async (input: SignUpInput): Promise<AppUser> => {
  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) {
    throw new Error("Phone number is required.");
  }

  if (!isFirebaseConfigured) {
    const email = phoneToEmail(normalizedPhone);
    const users = getDemoUsers();
    const alreadyExists = users.some(
      (item) => item.email.toLowerCase() === email.toLowerCase() || item.phone === normalizedPhone
    );

    if (alreadyExists) {
      throw new Error("Account already exists for this phone number. Please login.");
    }

    const created: DemoUser = {
      uid: `demo-${input.role}-${Date.now()}`,
      email,
      password: input.password,
      role: input.role,
      displayName: input.displayName,
      phone: normalizedPhone
    };

    setDemoUsers([...users, created]);
    localStorage.setItem(DEMO_SESSION_KEY, created.uid);
    broadcastDemoAuthChange();

    const { password: _password, ...profile } = created;
    return profile;
  }

  const email = phoneToEmail(normalizedPhone);
  const credential = await createUserWithEmailAndPassword(auth, email, input.password);

  await assignUserRole({
    role: input.role,
    displayName: input.displayName,
    phone: normalizedPhone,
    specialization: input.specialization,
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
    localStorage.removeItem(DEMO_SESSION_KEY);
    broadcastDemoAuthChange();
    return Promise.resolve();
  }
  return signOut(auth);
};

export const observeAuth = (callback: (uid: string | null) => void): (() => void) => {
  if (!isFirebaseConfigured) {
    const run = () => callback(localStorage.getItem(DEMO_SESSION_KEY));
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

export const getDemoCredentials = (): Array<{ email: string; password: string; role: UserRole }> =>
  getDemoUsers().map(({ email, password, role }) => ({ email, password, role }));

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
    const uid = localStorage.getItem(DEMO_SESSION_KEY);
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
    return Boolean(localStorage.getItem(DEMO_SESSION_KEY));
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
}): void => {
  const users = getDemoUsers();
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    throw new Error("Email and password are required.");
  }

  const exists = users.some((user) => user.email.toLowerCase() === email);
  if (exists) {
    throw new Error("User already exists.");
  }

  const user: DemoUser = {
    uid: `demo-${input.role}-${Date.now()}`,
    email,
    password: input.password,
    role: input.role,
    displayName: input.displayName,
    phone: input.phone
  };

  setDemoUsers([...users, user]);
};

export const deleteDemoUser = (uid: string): void => {
  const users = getDemoUsers();
  setDemoUsers(users.filter((user) => user.uid !== uid));
};
