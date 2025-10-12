import { useCallback, useEffect, useState } from "react";
import { api, type ApiUserDetail, type ApiUserEngagement } from "utils/api";

export type UserDataBundle = {
  detail: ApiUserDetail;
  engagement: ApiUserEngagement;
};

/**
 * Hook para cachear y recuperar el detalle + engagement del usuario backend.
 * Evita repetir fetch en Home/Admin reutilizando la misma llamada.
 */
export function useUserDataLoader(backendUserId: string | null) {
  const [detailCache, setDetailCache] = useState<ApiUserDetail | null>(null);
  const [engagementCache, setEngagementCache] = useState<ApiUserEngagement | null>(null);

  const ensureUserData = useCallback(
    async (force = false): Promise<UserDataBundle | null> => {
      if (!backendUserId) return null;

      if (!force && detailCache && engagementCache) {
        return { detail: detailCache, engagement: engagementCache };
      }

      const [detail, engagement] = await Promise.all([
        api.getUserDetail(backendUserId),
        api.getUserEngagement(backendUserId),
      ]);

      setDetailCache(detail);
      setEngagementCache(engagement);

      return { detail, engagement };
    },
    [backendUserId, detailCache, engagementCache]
  );

  const resetUserData = useCallback(() => {
    setDetailCache(null);
    setEngagementCache(null);
  }, []);

  useEffect(() => {
    setDetailCache(null);
    setEngagementCache(null);
  }, [backendUserId]);

  return {
    detailCache,
    engagementCache,
    ensureUserData,
    resetUserData,
  } as const;
}
