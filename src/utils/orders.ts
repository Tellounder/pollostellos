import {
  COMBOS,
  EXTRAS,
  INDIVIDUALES,
  type Combo,
  type Extra,
} from "utils/constants";
import type { ApiOrder, ApiUserDetail } from "utils/api";
import type { ProfileFormValues } from "components/profile/ProfileModal";

type DiscountEntry = {
  id: string;
  code: string;
  label: string;
  value: string;
  percentage?: string | null;
  expiresAt?: string | null;
  usesRemaining: number;
  totalUses: number;
};

type DiscountHistory = {
  id: string;
  code: string;
  valueApplied: number;
  redeemedAt: string;
  orderCode?: string;
};

export type DiscountSnapshot = {
  active: DiscountEntry[];
  history: DiscountHistory[];
  shareCoupons: ShareCouponSummary[];
  totalSavings: number;
  totalRedemptions: number;
};

export type ShareCouponSummary = {
  id: string;
  code: string;
  status: 'ISSUED' | 'ACTIVATED' | 'REDEEMED';
  month: number;
  year: number;
  activatedAt?: string | null;
  redeemedAt?: string | null;
};

export type OrderProductMatch = {
  product: Combo | Extra;
  quantity: number;
  side?: string;
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
});

export const formatOrderCode = (orderNumber: number) => `PT-${orderNumber.toString().padStart(5, "0")}`;

export const processDiscounts = (detail: ApiUserDetail, now: number = Date.now()): DiscountSnapshot => {
  const active = detail.discountCodesOwned.reduce<DiscountEntry[]>((acc, code) => {
    const uses = code.redemptions.length;
    const usesRemaining = Math.max(code.maxRedemptions - uses, 0);
    const expiresAt = code.expiresAt ?? undefined;
    const isExpired = expiresAt ? new Date(expiresAt).getTime() < now : false;

    if (usesRemaining <= 0 || isExpired) {
      return acc;
    }

    acc.push({
      id: code.id,
      code: code.code,
      label: code.type,
      value: code.value,
      percentage: code.percentage,
      expiresAt,
      usesRemaining,
      totalUses: uses,
    });

    return acc;
  }, []);

  const history = detail.discountRedemptions
    .map<DiscountHistory>((entry) => ({
      id: entry.id,
      code: entry.code?.code ?? entry.codeId,
      valueApplied: parseFloat(entry.valueApplied ?? "0"),
      redeemedAt: entry.redeemedAt,
      orderCode: entry.order ? formatOrderCode(entry.order.number) : undefined,
    }))
    .sort((a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime());

  const totalSavings = history.reduce((sum, item) => sum + item.valueApplied, 0);
  const shareCoupons: ShareCouponSummary[] = (detail.shareCoupons ?? [])
    .map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      status: coupon.status,
      month: coupon.month,
      year: coupon.year,
      activatedAt: coupon.activatedAt ?? null,
      redeemedAt: coupon.redeemedAt ?? null,
    }))
    .sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year;
      }
      if (a.month !== b.month) {
        return b.month - a.month;
      }
      return a.code.localeCompare(b.code);
    });

  return {
    active,
    history,
    shareCoupons,
    totalSavings,
    totalRedemptions: history.length,
  };
};

export const buildProfileValues = (detail: ApiUserDetail): ProfileFormValues => {
  const primary = detail.addresses.find((address) => address.isPrimary) ?? detail.addresses[0];

  return {
    email: detail.email,
    firstName: detail.firstName ?? "",
    lastName: detail.lastName ?? "",
    displayName: detail.displayName ?? detail.firstName ?? "",
    phone: detail.phone ?? "",
    addressLine: primary?.line1 ?? "",
    addressNotes: primary?.notes ?? "",
  };
};

export const findProductById = (productId: string): (Combo | Extra) | undefined => {
  const numericId = Number(productId);

  if (!Number.isNaN(numericId)) {
    const combo = COMBOS.find((item) => item.id === numericId) ?? INDIVIDUALES.find((item) => item.id === numericId);
    if (combo) {
      return combo;
    }
  }

  return EXTRAS.find((extra) => String(extra.id) === productId);
};

type OrderItemReference = {
  productId?: string;
  quantity: number;
  side?: string;
};

const getOrderItemReferences = (order: ApiOrder): OrderItemReference[] => {
  const normalized = Array.isArray(order.normalizedItems) ? order.normalizedItems : [];

  if (normalized.length) {
    return normalized.map((item) => ({
      productId: item.productKey ?? undefined,
      quantity: item.quantity,
      side: item.side ?? undefined,
    }));
  }

  return (order.metadata?.items ?? []).map((item) => ({
    productId: item.productId ?? undefined,
    quantity: item.quantity,
    side: item.side ?? undefined,
  }));
};

export const mapOrderItemsToProducts = (order: ApiOrder): OrderProductMatch[] => {
  const items = getOrderItemReferences(order);

  if (items.length === 0) {
    return [];
  }

  return items.reduce<OrderProductMatch[]>((acc, item) => {
    if (!item.productId || item.quantity <= 0) {
      return acc;
    }

    const product = findProductById(item.productId);
    if (!product) {
      return acc;
    }

    acc.push({
      product,
      quantity: item.quantity,
      side: item.side ?? undefined,
    });
    return acc;
  }, []);
};

export const canReorder = (order: ApiOrder) => {
  if (order.status !== "CONFIRMED" && order.status !== "FULFILLED") {
    return false;
  }
  const items = getOrderItemReferences(order);

  if (items.length === 0) {
    return false;
  }
  return items.every((item) => Boolean(item.productId) && item.quantity > 0);
};

export const formatCurrency = (value: number) => currencyFormatter.format(value);
