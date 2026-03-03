import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";

const rawConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const hasRequiredFirebaseConfig =
  Boolean(rawConfig.apiKey) &&
  Boolean(rawConfig.authDomain) &&
  Boolean(rawConfig.projectId) &&
  Boolean(rawConfig.appId);

export const isFirebaseConfigured = hasRequiredFirebaseConfig;

const firebaseConfig = hasRequiredFirebaseConfig
  ? rawConfig
  : {
      apiKey: "demo-key",
      authDomain: "demo.local",
      projectId: "demo-telehealth",
      storageBucket: "demo-telehealth.appspot.com",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:demo"
    };

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth = getAuth(app);
export const functions = getFunctions(app);
