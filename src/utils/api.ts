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

  async createOrder(payload: CreateOrderPayload) {
    return request<ApiOrder>(`/orders`, {
      method: 'POST',
      json: payload,
    });
  },

  async listOrders(params: ListOrdersParams = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (typeof params.skip === 'number') query.set('skip', String(params.skip));
    if (typeof params.take === 'number') query.set('take', String(params.take));
    if (params.userId) query.set('userId', params.userId);

    const search = query.toString();
    return request<{ items: ApiOrder[]; total: number; skip: number; take: number }>(
      `/orders${search ? `?${search}` : ''}`,
    );
  },

  async getUserOrders(userId: string, take = 10) {
    return request<ApiOrder[]>(`/orders/user/${userId}?take=${take}`);
  },

  async confirmOrder(orderId: string) {
    return request<ApiOrder>(`/orders/${orderId}/confirm`, {
      method: 'PATCH',
    });
  },

  async cancelOrder(orderId: string, reason?: string) {
    return request<ApiOrder>(`/orders/${orderId}/cancel`, {
      method: 'PATCH',
      json: reason ? { reason } : {},
    });
  },

  async getUserDetail(userId: string) {
    return request<ApiUserDetail>(`/users/${userId}`);
  },

  async getUserEngagement(userId: string) {
    return request<ApiUserEngagement>(`/users/${userId}/engagement`);
  },
};

export type ApiUser = Awaited<ReturnType<typeof api.upsertUser>>;

export type OrderStatus = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'FULFILLED';

export type ApiOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  totalGross: number;
  totalNet: number;
  discountTotal: number;
  metadata: OrderMetadata | null;
  whatsappLink?: string | null;
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
  placedAt?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  note?: string | null;
};

export type OrderMetadata = {
  customer?: {
    name: string;
    email: string;
    phone?: string | null;
  };
  delivery?: {
    addressLine: string;
    notes?: string | null;
  };
  paymentMethod?: string;
  items?: Array<{
    productId?: string | null;
    label: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    side?: string | null;
    type?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  notes?: string | null;
  extra?: Record<string, unknown> | null;
};

export type CreateOrderPayload = {
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  delivery: {
    addressLine: string;
    notes?: string;
  };
  paymentMethod: string;
  notes?: string;
  items: Array<{
    productId?: string;
    label: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    side?: string;
    type?: string;
    metadata?: Record<string, unknown>;
  }>;
  totalGross: number;
  totalNet?: number;
  discountTotal?: number;
  whatsappLink?: string;
  metadata?: Record<string, unknown>;
};

type ListOrdersParams = {
  status?: OrderStatus;
  skip?: number;
  take?: number;
  userId?: string;
};

export type ApiAddress = {
  id: string;
  label: string | null;
  line1: string;
  line2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  notes?: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiDiscountRedemption = {
  id: string;
  codeId: string;
  userId?: string | null;
  orderId?: string | null;
  valueApplied: string;
  redeemedAt: string;
  code?: {
    id: string;
    code: string;
    type: string;
  };
  order?: {
    id: string;
    number: number;
    placedAt: string | null;
  } | null;
};

export type ApiDiscountCode = {
  id: string;
  code: string;
  type: string;
  scope: string;
  value: string;
  percentage?: string | null;
  maxRedemptions: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  redemptions: ApiDiscountRedemption[];
};

export type ApiUserDetail = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  phone?: string | null;
  addresses: ApiAddress[];
  discountCodesOwned: ApiDiscountCode[];
  discountRedemptions: ApiDiscountRedemption[];
};

export type ApiUserEngagement = {
  monthlyOrders: number;
  lifetimeOrders: number;
  lifetimeNetSales: string;
  lastOrderAt: string | null;
  shareEvents: number;
  loyaltyEvents: number;
  referralProfile: unknown;
  discountUsage: number;
  qualifiesForBonus: boolean;
};
