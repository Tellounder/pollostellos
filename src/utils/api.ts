const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

type FetchOptions = RequestInit & { json?: unknown };

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const headers = new Headers(options.headers);

  if (API_KEY) {
    headers.set('x-api-key', API_KEY);
  }

  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status} ${response.statusText}: ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  async upsertUser(payload: {
    email: string;
    externalAuthId?: string | null;
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    termsAcceptedAt?: string | null;
  }) {
    return request<{ id: string }>(`/users`, {
      method: 'POST',
      json: payload,
    });
  },

  async updateUserProfile(
    userId: string,
    payload: {
      firstName?: string;
      lastName?: string;
      displayName?: string;
      phone?: string;
      address?: {
        line1: string;
        line2?: string;
        city?: string;
        province?: string;
        postalCode?: string;
        label?: string;
        notes?: string;
      };
    },
  ) {
    return request(`/users/${userId}/profile`, {
      method: 'PATCH',
      json: payload,
    });
  },

  async registerPurchase(userId: string) {
    return request<{ totalPurchases: number; unlockBonus: boolean }>(`/users/${userId}/purchases`, {
      method: 'POST',
    });
  },
};

export type ApiUser = Awaited<ReturnType<typeof api.upsertUser>>;
