import { useEffect, useMemo, useState } from "react";
import {
  buildBonusCounterKeys,
  buildLastPurchaseKeys,
  buildPendingBonusKeys,
  readFirstString,
  readFirstJSON,
  type StoredPurchase,
  type PendingBonusState,
} from "utils/customerStorage";

export type CustomerSummary = {
  totalPurchases: number;
  progressPercent: number;
  remainingToNext: number;
  nextMilestone: number;
  previousMilestone: number;
  lastPurchase?: StoredPurchase;
  pendingBonus: boolean;
  pendingBonusInfo?: PendingBonusState | null;
};

const INITIAL_SUMMARY: CustomerSummary = {
  totalPurchases: 0,
  progressPercent: 0,
  remainingToNext: 3,
  nextMilestone: 3,
  previousMilestone: 0,
  pendingBonus: false,
  pendingBonusInfo: null,
};

const computeMilestones = (count: number) => {
  if (count <= 0) {
    return { previous: 0, next: 3, progress: 0, remaining: 3 };
  }
  if (count < 3) {
    return {
      previous: 0,
      next: 3,
      progress: Math.min(count / 3, 1),
      remaining: Math.max(0, 3 - count),
    };
  }

  const offset = count - 3;
  const cycle = Math.floor(offset / 4);
  const previous = 3 + cycle * 4;
  const next = previous + 4;
  const progressRaw = (count - previous) / (next - previous);
  return {
    previous,
    next,
    progress: Math.max(0, Math.min(progressRaw, 1)),
    remaining: Math.max(0, next - count),
  };
};

const shouldObserveKey = (key: string | null, watched: string[]) => {
  if (!key) return false;
  return watched.includes(key);
};

export function useCustomerSummary(
  backendUserId?: string | null,
  userUid?: string | null
): CustomerSummary {
  const [summary, setSummary] = useState<CustomerSummary>(INITIAL_SUMMARY);

  const bonusKeys = useMemo(
    () => buildBonusCounterKeys(backendUserId, userUid ?? null),
    [backendUserId, userUid]
  );
  const lastPurchaseKeys = useMemo(
    () => buildLastPurchaseKeys(backendUserId, userUid ?? null),
    [backendUserId, userUid]
  );
  const pendingBonusKeys = useMemo(
    () => buildPendingBonusKeys(backendUserId, userUid ?? null),
    [backendUserId, userUid]
  );

  useEffect(() => {
    if (!backendUserId && !userUid) {
      setSummary(INITIAL_SUMMARY);
      return;
    }

    const load = () => {
      const totalRaw = readFirstString(bonusKeys);
      const totalPurchases = totalRaw ? Number(totalRaw) || 0 : 0;
      const milestones = computeMilestones(totalPurchases);
      const lastPurchase = readFirstJSON<StoredPurchase>(lastPurchaseKeys) ?? undefined;
      const pendingBonusInfo = readFirstJSON<PendingBonusState>(pendingBonusKeys);
      setSummary({
        totalPurchases,
        progressPercent: milestones.progress,
        remainingToNext: milestones.remaining,
        nextMilestone: milestones.next,
        previousMilestone: milestones.previous,
        lastPurchase,
        pendingBonus: Boolean(pendingBonusInfo),
        pendingBonusInfo,
      });
    };

    load();

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (
        shouldObserveKey(event.key, bonusKeys) ||
        shouldObserveKey(event.key, lastPurchaseKeys) ||
        shouldObserveKey(event.key, pendingBonusKeys)
      ) {
        load();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [backendUserId, userUid, bonusKeys, lastPurchaseKeys, pendingBonusKeys]);

  return summary;
}
