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
      const authModule = await loadAuthModule();

      if ("initializeAuth" in authModule) {
        try {
          return authModule.initializeAuth(app, {
            persistence: [
              authModule.indexedDBLocalPersistence,
              authModule.browserLocalPersistence,
              authModule.browserSessionPersistence,
            ],
            popupRedirectResolver: authModule.browserPopupRedirectResolver,
          });
        } catch (error) {
          // initializeAuth can throw if auth was already initialized elsewhere
        }
      }

      return authModule.getAuth(app);
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

const canUseSessionStorage = () => {
  if (typeof window === "undefined") return false;
  try {
    const testKey = "__pt_storage_probe";
    window.sessionStorage.setItem(testKey, "1");
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
};

const shouldUseRedirect = () => {
  if (typeof window === "undefined") return false;

  const ua = window.navigator.userAgent.toLowerCase();
  const isSamsungBrowser = ua.includes("samsungbrowser");
  const isWebView = ua.includes("wv;") || ua.includes("line") || ua.includes("instagram");

  if (isSamsungBrowser || isWebView) {
    return canUseSessionStorage();
  }

  return false;
};

export const getRedirectResultSafe = async () => {
  const auth = await getAuthInstance();
  const authModule = await loadAuthModule();

  try {
    const result = await authModule.getRedirectResult(auth);
    return result?.user ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Fallo al resolver login con redirect", message);
    return null;
  }
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
