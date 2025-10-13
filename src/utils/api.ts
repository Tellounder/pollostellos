import { getIdToken } from './firebase';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type AuthMode = 'none' | 'optional' | 'required';

type FetchOptions = RequestInit & {
  json?: unknown;
  authMode?: AuthMode;
};

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const { json, authMode = 'none', ...init } = options;
  const headers = new Headers(init.headers);

  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (authMode !== 'none') {
    let token = await getIdToken();
    if (!token) {
      token = await getIdToken(true);
    }

    if (!token) {
      if (authMode === 'required') {
        throw new Error('Necesitás iniciar sesión para continuar.');
      }
    } else {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...init,
    headers,
    body: json !== undefined ? JSON.stringify(json) : init.body,
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
      authMode: 'required',
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
      authMode: 'required',
    });
  },

  async registerPurchase(userId: string) {
    return request<{ totalPurchases: number; unlockBonus: boolean }>(`/users/${userId}/purchases`, {
      method: 'POST',
      authMode: 'required',
    });
  },

  async listUsers(params: ListUsersParams = {}) {
    const query = new URLSearchParams();
    if (typeof params.skip === 'number') query.set('skip', String(params.skip));
    if (typeof params.take === 'number') query.set('take', String(params.take));
    if (params.search) query.set('search', params.search);
    if (params.activeOnly) query.set('activeOnly', 'true');

    const search = query.toString();
    return request<{ items: ApiUserListItem[]; total: number; skip: number; take: number }>(
      `/users${search ? `?${search}` : ''}`,
      { authMode: 'required' },
    );
  },

  async createOrder(payload: CreateOrderPayload) {
    return request<ApiOrder>(`/orders`, {
      method: 'POST',
      json: payload,
      authMode: 'optional',
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
      { authMode: 'required' },
    );
  },

  async getUserOrders(userId: string, take = 10) {
    return request<ApiOrder[]>(`/orders/user/${userId}?take=${take}`, {
      authMode: 'required',
    });
  },

  async getActiveOrder(userId: string, takeMessages = 50) {
    return request<{ order: ApiOrder; messages: ApiOrderMessage[] } | null>(
      `/orders/user/${userId}/active?takeMessages=${takeMessages}`,
      { authMode: 'required' },
    );
  },

  async listOrderMessages(orderId: string, take = 50) {
    return request<ApiOrderMessage[]>(`/orders/${orderId}/messages?take=${take}`, {
      authMode: 'required',
    });
  },

  async createOrderMessage(orderId: string, message: string, context?: string) {
    return request<ApiOrderMessage>(`/orders/${orderId}/messages`, {
      method: 'POST',
      json: { message, context },
      authMode: 'required',
    });
  },

  async confirmOrder(orderId: string) {
    return request<ApiOrder>(`/orders/${orderId}/confirm`, {
      method: 'PATCH',
      authMode: 'required',
    });
  },

  async prepareOrder(orderId: string) {
    return request<ApiOrder>(`/orders/${orderId}/prepare`, {
      method: 'PATCH',
      authMode: 'required',
    });
  },


  async fulfillOrder(orderId: string) {
    return request<ApiOrder>(`/orders/${orderId}/fulfill`, {
      method: 'PATCH',
      authMode: 'required',
    });
  },

  async cancelOrder(orderId: string, reason?: string) {
    return request<ApiOrder>(`/orders/${orderId}/cancel`, {
      method: 'PATCH',
      json: reason ? { reason } : {},
      authMode: 'required',
    });
  },

  async getUserDetail(userId: string) {
    return request<ApiUserDetail>(`/users/${userId}`, {
      authMode: 'required',
    });
  },

  async getUserEngagement(userId: string) {
    return request<ApiUserEngagement>(`/users/${userId}/engagement`, {
      authMode: 'required',
    });
  },

  async listShareCoupons(userId: string) {
    return request<ApiShareCoupon[]>(`/users/${userId}/share-coupons`, {
      authMode: 'required',
    });
  },

  async issueShareCoupons(userId: string) {
    return request<ApiShareCoupon[]>(`/users/${userId}/share-coupons/issue`, {
      method: 'POST',
      authMode: 'required',
    });
  },

  async activateShareCoupon(userId: string, code: string) {
    return request<ApiShareCoupon>(`/users/${userId}/share-coupons/${encodeURIComponent(code)}/activate`, {
      method: 'POST',
      authMode: 'required',
    });
  },

  async listAllShareCoupons(status?: ApiShareCoupon['status']) {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    const search = query.toString();
    return request<ApiShareCoupon[]>(`/users/share-coupons${search ? `?${search}` : ''}`, {
      authMode: 'required',
    });
  },

  async createUserDiscount(userId: string, payload: CreateUserDiscountPayload) {
    return request<ApiDiscountCode>(`/users/${userId}/discounts`, {
      method: 'POST',
      json: payload,
      authMode: 'required',
    });
  },

  async listDiscountCodes(params: { activeOnly?: boolean } = {}) {
    const query = new URLSearchParams();
    if (params.activeOnly) query.set('activeOnly', 'true');
    const search = query.toString();
    return request<ApiDiscountCode[]>(`/users/discount-codes${search ? `?${search}` : ''}`, {
      authMode: 'required',
    });
  },
};

export type ApiUser = Awaited<ReturnType<typeof api.upsertUser>>;

export type OrderStatus = 'DRAFT' | 'PENDING' | 'PREPARING' | 'CONFIRMED' | 'CANCELLED' | 'FULFILLED';

export type ApiOrderItemSnapshot = {
  id: string;
  productKey?: string | null;
  label: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice?: number | null;
  discountValue?: number | null;
  lineTotal: number;
  side?: string | null;
  type?: string | null;
};

export type ApiOrderMessage = {
  id: string;
  orderId: string;
  authorType: 'ADMIN' | 'USER' | string;
  authorId?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt?: string | null;
};

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
  preparingAt?: string | null;
  confirmedAt?: string | null;
  fulfilledAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  note?: string | null;
  normalizedItems: ApiOrderItemSnapshot[];
};

export type ApiShareCoupon = {
  id: string;
  userId: string;
  code: string;
  month: number;
  year: number;
  status: 'ISSUED' | 'ACTIVATED' | 'REDEEMED';
  metadata?: Record<string, unknown> | null;
  activatedAt?: string | null;
  redeemedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    displayName?: string | null;
  } | null;
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
    originalUnitPrice?: number;
    discountValue?: number;
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
  owner?: {
    id: string;
    email: string;
    displayName?: string | null;
  } | null;
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
  shareCoupons: ApiShareCoupon[];
  orders?: Array<{
    id: string;
    number: number;
    status: OrderStatus;
    totalGross: number;
    totalNet: number;
    createdAt: string;
    placedAt?: string | null;
  }>;
};

export type ApiUserListItem = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
  addresses: ApiAddress[];
};

export type ListUsersParams = {
  skip?: number;
  take?: number;
  search?: string;
  activeOnly?: boolean;
};

export type CreateUserDiscountPayload = {
  value: number;
  label?: string;
  expiresAt?: string;
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
