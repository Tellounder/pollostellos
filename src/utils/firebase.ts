import { initializeApp } from "firebase/app";
import {
  AuthErrorCodes,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";

// ---
// Configuración de Firebase
// Las credenciales se cargan desde variables de entorno (archivo .env.local)
// para mayor seguridad y flexibilidad entre entornos.
// ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const shouldUseRedirect = () => {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isSamsungBrowser = ua.includes("samsungbrowser");
  const isWebView = ua.includes("wv;") || ua.includes("line") || ua.includes("instagram");
  return isIOS || isStandalone || isSamsungBrowser || isWebView;
};

/**
 * Iniciar sesión con Google.
 * En desktop intentamos `signInWithPopup`. Si el navegador bloquea popups o no
 * soporta la operación, hacemos fallback automático a `signInWithRedirect`, que
 * es más confiable en dispositivos móviles.
 */
export const loginWithGoogle = async () => {
  if (shouldUseRedirect()) {
    await signInWithRedirect(auth, provider);
    return;
  }

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (
      code === AuthErrorCodes.OPERATION_NOT_SUPPORTED ||
      code === AuthErrorCodes.POPUP_BLOCKED ||
      code === AuthErrorCodes.POPUP_CLOSED_BY_USER
    ) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
};

/**
 * Cerrar sesión.
 */
export const logout = async () => {
  await signOut(auth);
};
