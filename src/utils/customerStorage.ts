export const PREFILL_FALLBACK_KEY = "pt_checkout_profile_last";
export const PROFILE_PREFIX = "pt_checkout_profile_";
export const PROFILE_UID_PREFIX = "pt_checkout_profile_uid_";

export const BONUS_COUNTER_PREFIX = "pt_bonus_counter_";
export const BONUS_COUNTER_UID_PREFIX = "pt_bonus_counter_uid_";
export const BONUS_COUNTER_FALLBACK = "pt_bonus_counter_last";

export const LAST_PURCHASE_PREFIX = "pt_last_purchase_";
export const LAST_PURCHASE_UID_PREFIX = "pt_last_purchase_uid_";
export const LAST_PURCHASE_FALLBACK = "pt_last_purchase_last";

export const BONUS_PENDING_PREFIX = "pt_bonus_pending_";
export const BONUS_PENDING_UID_PREFIX = "pt_bonus_pending_uid_";
export const BONUS_PENDING_FALLBACK = "pt_bonus_pending_last";

export type StoredPurchaseItem = {
  productId: string;
  label: string;
  qty: number;
  side?: string | null;
  type: "combo" | "extra";
};

export type StoredPurchase = {
  placedAt: string;
  totalLabel: string;
  items: StoredPurchaseItem[];
};

export type PendingBonusState = {
  totalPurchases: number;
  createdAt: string;
};

const safeLocalStorage = () => (typeof window !== "undefined" ? window.localStorage : null);

const buildKeys = (primary?: string | null, secondary?: string | null, fallback?: string | null) => {
  const keys = new Set<string>();
  if (primary) keys.add(primary);
  if (secondary) keys.add(secondary);
  if (fallback) keys.add(fallback);
  return Array.from(keys);
};

export const buildProfileKeys = (backendUserId?: string | null, userUid?: string | null) =>
  buildKeys(
    backendUserId ? `${PROFILE_PREFIX}${backendUserId}` : null,
    userUid ? `${PROFILE_UID_PREFIX}${userUid}` : null,
    PREFILL_FALLBACK_KEY
  );

export const buildBonusCounterKeys = (backendUserId?: string | null, userUid?: string | null) =>
  buildKeys(
    backendUserId ? `${BONUS_COUNTER_PREFIX}${backendUserId}` : null,
    userUid ? `${BONUS_COUNTER_UID_PREFIX}${userUid}` : null,
    BONUS_COUNTER_FALLBACK
  );

export const buildLastPurchaseKeys = (backendUserId?: string | null, userUid?: string | null) =>
  buildKeys(
    backendUserId ? `${LAST_PURCHASE_PREFIX}${backendUserId}` : null,
    userUid ? `${LAST_PURCHASE_UID_PREFIX}${userUid}` : null,
    LAST_PURCHASE_FALLBACK
  );

export const buildPendingBonusKeys = (backendUserId?: string | null, userUid?: string | null) =>
  buildKeys(
    backendUserId ? `${BONUS_PENDING_PREFIX}${backendUserId}` : null,
    userUid ? `${BONUS_PENDING_UID_PREFIX}${userUid}` : null,
    BONUS_PENDING_FALLBACK
  );

export const writeStringToKeys = (keys: string[], value: string) => {
  const storage = safeLocalStorage();
  if (!storage) return;
  keys.forEach((key) => {
    try {
      storage.setItem(key, value);
    } catch (error) {
      console.error(`No se pudo escribir en localStorage (${key})`, error);
    }
  });
};

export const writeJSONToKeys = (keys: string[], value: unknown) => {
  try {
    const payload = JSON.stringify(value);
    writeStringToKeys(keys, payload);
  } catch (error) {
    console.error("No se pudo serializar el valor para localStorage", error);
  }
};

export const readFirstString = (keys: string[]): string | null => {
  const storage = safeLocalStorage();
  if (!storage) return null;
  for (const key of keys) {
    try {
      const value = storage.getItem(key);
      if (value !== null) {
        return value;
      }
    } catch (error) {
      console.error(`No se pudo leer localStorage (${key})`, error);
    }
  }
  return null;
};

export const readFirstJSON = <T>(keys: string[]): T | null => {
  const raw = readFirstString(keys);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error("No se pudo parsear el contenido almacenado", error);
    return null;
  }
};

export const removeStoredKeys = (keys: string[]) => {
  const storage = safeLocalStorage();
  if (!storage) return;
  keys.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.error(`No se pudo eliminar ${key} de localStorage`, error);
    }
  });
};
