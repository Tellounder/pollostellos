import type { FirebaseApp } from "firebase/app";
import type { Unsubscribe, User, Auth, GoogleAuthProvider } from "firebase/auth";

export type { User } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

type FirebaseAppModule = typeof import("firebase/app");
type FirebaseAuthModule = typeof import("firebase/auth");

let firebaseAppModulePromise: Promise<FirebaseAppModule> | null = null;
let firebaseAppPromise: Promise<FirebaseApp> | null = null;
let authModulePromise: Promise<FirebaseAuthModule> | null = null;
let authInstancePromise: Promise<Auth> | null = null;
let providerCache: GoogleAuthProvider | null = null;

const loadFirebaseAppModule = async (): Promise<FirebaseAppModule> => {
  if (!firebaseAppModulePromise) {
    firebaseAppModulePromise = import("firebase/app");
  }
  return firebaseAppModulePromise;
};

const loadFirebaseApp = async () => {
  if (!firebaseAppPromise) {
    firebaseAppPromise = (async () => {
      const { initializeApp, getApps, getApp } = await loadFirebaseAppModule();
      return getApps().length ? getApp() : initializeApp(firebaseConfig);
    })();
  }
  return firebaseAppPromise;
};

const loadAuthModule = async () => {
  if (!authModulePromise) {
    authModulePromise = import("firebase/auth");
  }
  return authModulePromise;
};

const getAuthInstance = async () => {
  if (!authInstancePromise) {
    authInstancePromise = (async () => {
      const app = await loadFirebaseApp();
      const { getAuth } = await loadAuthModule();
      return getAuth(app);
    })();
  }
  return authInstancePromise;
};

const getProvider = async () => {
  if (!providerCache) {
    const { GoogleAuthProvider } = await loadAuthModule();
    providerCache = new GoogleAuthProvider();
  }
  return providerCache;
};

const shouldUseRedirect = () => {
  if (typeof window === "undefined") return false;

  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isSamsungBrowser = ua.includes("samsungbrowser");
  const isWebView = ua.includes("wv;") || ua.includes("line") || ua.includes("instagram");

  return isIOS || isStandalone || isSamsungBrowser || isWebView;
};

export const watchAuthState = async (
  listener: (user: User | null) => void,
): Promise<Unsubscribe> => {
  const auth = await getAuthInstance();
  const { onAuthStateChanged } = await loadAuthModule();
  return onAuthStateChanged(auth, listener);
};

export const loginWithGoogle = async () => {
  const auth = await getAuthInstance();
  const authModule = await loadAuthModule();
  const provider = await getProvider();

  if (shouldUseRedirect()) {
    await authModule.signInWithRedirect(auth, provider);
    return;
  }

  try {
    await authModule.signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (
      code === authModule.AuthErrorCodes.OPERATION_NOT_SUPPORTED ||
      code === authModule.AuthErrorCodes.POPUP_BLOCKED ||
      code === authModule.AuthErrorCodes.POPUP_CLOSED_BY_USER
    ) {
      await authModule.signInWithRedirect(auth, provider);
      return;
    }

    throw error;
  }
};

export const logout = async () => {
  const auth = await getAuthInstance();
  const { signOut } = await loadAuthModule();
  await signOut(auth);
};
