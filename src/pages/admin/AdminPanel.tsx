import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "hooks/useAuth";
import {
  api,
  type ApiDiscountCode,
  type ApiOrder,
  type ApiOrderMessage,
  type ApiShareCoupon,
  type ApiUserDetail,
  type ApiUserEngagement,
  type ApiUserListItem,
  type CreateUserDiscountPayload,
  type OrderStatus,
} from "utils/api";
import { formatCurrency, formatOrderCode } from "utils/orders";
import { CancelOrderModal } from "components/orders/CancelOrderModal";
import ordersStyles from "./AdminOrders.module.css";

type AdminSectionId = "orders" | "clients" | "discounts" | "codes" | "operations";

type AdminPanelProps = {
  initialSection?: AdminSectionId;
};

type RewardKind = "discount" | "combo" | "dessert";

type OrderFoldState = {
  timeline: boolean;
  info: boolean;
  items: boolean;
  chat: boolean;
};

type ClientFoldState = {
  summary: boolean;
  benefits: boolean;
  history: boolean;
};

type DiscountFoldState = {
  active: boolean;
  scheduled: boolean;
  expired: boolean;
};

type OperationsFoldState = {
  metrics: boolean;
  backlog: boolean;
};

const SECTION_CONFIG: Array<{ id: AdminSectionId; label: string; description: string; emoji: string }> = [
  {
    id: "orders",
    label: "Pedidos",
    description: "Monitoreá el pipeline en tiempo real y accioná en un click.",
    emoji: "📦",
  },
  {
    id: "clients",
    label: "Clientes",
    description: "Perfila, recompensa y revisá el historial de cada cuenta.",
    emoji: "🧑‍🍳",
  },
  {
    id: "discounts",
    label: "Descuentos",
    description: "Gestioná campañas, beneficios y seguimiento de redenciones.",
    emoji: "🎟️",
  },
  {
    id: "codes",
    label: "Códigos canjeados",
    description: "Controlá cupones únicos, estados y performance.",
    emoji: "🔐",
  },
  {
    id: "operations",
    label: "Operaciones",
    description: "KPIs, tendencias y tareas para el equipo.",
    emoji: "📊",
  },
];

const ORDER_PIPELINE: Array<{ status: OrderStatus; label: string; helper: string }> = [
  {
    status: "PENDING",
    label: "Pendientes",
    helper: "Tomá el pedido cuando lo empieces a atender.",
  },
  {
    status: "PREPARING",
    label: "En preparación",
    helper: "Avisá cuando esté listo para retirar o enviar.",
  },
  {
    status: "CONFIRMED",
    label: "Listos para entregar",
    helper: "Confirmá en cuanto el cliente lo reciba.",
  },
  {
    status: "FULFILLED",
    label: "Completados",
    helper: "Últimos pedidos cerrados (24 h).",
  },
];

const ORDER_SEQUENCE: OrderStatus[] = ["PENDING", "PREPARING", "CONFIRMED", "FULFILLED"];

type OrderTabId = "pipeline" | "pending" | "preparing" | "confirmed" | "fulfilled" | "cancelled";

const ORDER_TABS: Array<{
  id: OrderTabId;
  label: string;
  helper: string;
  statuses?: OrderStatus[];
  defaultLimit?: number;
}> = [
  {
    id: "pipeline",
    label: "Pipeline",
    helper: "Vista en columnas para gestionar en vivo.",
  },
  {
    id: "pending",
    label: "Pendientes",
    helper: "Pedidos que esperan ser tomados.",
    statuses: ["PENDING"],
    defaultLimit: 40,
  },
  {
    id: "preparing",
    label: "En preparación",
    helper: "Pedidos en cocina o empaquetado.",
    statuses: ["PREPARING"],
    defaultLimit: 40,
  },
  {
    id: "confirmed",
    label: "Listos",
    helper: "Listos para retirar o entregar.",
    statuses: ["CONFIRMED"],
    defaultLimit: 40,
  },
  {
    id: "fulfilled",
    label: "Completados",
    helper: "Últimos pedidos cerrados.",
    statuses: ["FULFILLED"],
    defaultLimit: 50,
  },
  {
    id: "cancelled",
    label: "Cancelados",
    helper: "Órdenes anuladas recientemente.",
    statuses: ["CANCELLED"],
    defaultLimit: 30,
  },
];

const statusLabels: Record<OrderStatus, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  PREPARING: "En preparación",
  CONFIRMED: "Listo",
  FULFILLED: "Completado",
  CANCELLED: "Cancelado",
};

const pipelineStatusClass: Partial<Record<OrderStatus, string>> = {
  PENDING: ordersStyles.cardStatusPending,
  PREPARING: ordersStyles.cardStatusPreparing,
  CONFIRMED: ordersStyles.cardStatusConfirmed,
  FULFILLED: ordersStyles.cardStatusFulfilled,
  CANCELLED: ordersStyles.cardStatusCancelled,
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

const shortTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
});

const formatOrderTimestamp = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    return dateTimeFormatter.format(date);
  } catch {
    return "—";
  }
};

const extractMessage = (payload: Record<string, unknown>): string => {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const candidate = (payload as { message?: unknown }).message;
    if (typeof candidate === "string") {
      return candidate;
    }
  }
  return "";
};

const clampValue = (value: number) => Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : 0;

export function AdminPanel({ initialSection = "orders" }: AdminPanelProps) {
  const { user, logout } = useAuth();
  const cn = (...classes: Array<string | null | false | undefined>) => classes.filter(Boolean).join(" ");
  const actionClassMap: Record<string, string> = {
    primary: ordersStyles.actionPrimary,
    secondary: ordersStyles.actionSecondary,
    neutral: ordersStyles.actionSecondary,
    danger: ordersStyles.actionDanger,
    ghost: "",
  };

  const [activeSection, setActiveSection] = useState<AdminSectionId>(initialSection);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiOrderMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);

  const [customersBootstrapped, setCustomersBootstrapped] = useState(false);
  const [customers, setCustomers] = useState<ApiUserListItem[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<ApiUserListItem | null>(null);
  const [customerDetail, setCustomerDetail] = useState<ApiUserDetail | null>(null);
  const [customerEngagement, setCustomerEngagement] = useState<ApiUserEngagement | null>(null);
  const [customerCoupons, setCustomerCoupons] = useState<ApiShareCoupon[]>([]);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [customerFeedback, setCustomerFeedback] = useState<string | null>(null);
  const [rewardKind, setRewardKind] = useState<RewardKind>("discount");
  const [rewardLabel, setRewardLabel] = useState("Premio fidelidad");
  const [discountValue, setDiscountValue] = useState("5000");
  const [grantingDiscount, setGrantingDiscount] = useState(false);
  const [issuingCoupons, setIssuingCoupons] = useState(false);

  const [discountsBootstrapped, setDiscountsBootstrapped] = useState(false);
  const [discountCodes, setDiscountCodes] = useState<ApiDiscountCode[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [discountsError, setDiscountsError] = useState<string | null>(null);

  const [globalCoupons, setGlobalCoupons] = useState<ApiShareCoupon[]>([]);
  const [couponFilter, setCouponFilter] = useState<"" | ApiShareCoupon["status"]>("");
  const [globalCouponsLoading, setGlobalCouponsLoading] = useState(false);
  const [globalCouponsError, setGlobalCouponsError] = useState<string | null>(null);
  const [codesBootstrapped, setCodesBootstrapped] = useState(false);
  const [orderFold, setOrderFold] = useState<OrderFoldState>({
    timeline: true,
    info: true,
    items: false,
    chat: true,
  });
  const [clientFold, setClientFold] = useState<ClientFoldState>({
    summary: true,
    benefits: true,
    history: false,
  });
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [codesModalOpen, setCodesModalOpen] = useState(false);
  const [discountFold, setDiscountFold] = useState<DiscountFoldState>({
    active: true,
    scheduled: false,
    expired: false,
  });
  const [codesFoldOpen, setCodesFoldOpen] = useState(true);
  const [operationsFold, setOperationsFold] = useState<OperationsFoldState>({
    metrics: true,
    backlog: true,
  });
  const [ordersTab, setOrdersTab] = useState<OrderTabId>("pipeline");
  const [listVisibleLimit, setListVisibleLimit] = useState<number>(
    ORDER_TABS.find((tab) => tab.id === "fulfilled")?.defaultLimit ?? 40
  );
  const toggleOrderFold = (key: keyof OrderFoldState) =>
    setOrderFold((previous) => ({ ...previous, [key]: !previous[key] }));
  const toggleClientFold = (key: keyof ClientFoldState) =>
    setClientFold((previous) => ({ ...previous, [key]: !previous[key] }));
  const toggleDiscountFold = (key: keyof DiscountFoldState) =>
    setDiscountFold((previous) => ({ ...previous, [key]: !previous[key] }));
  const toggleOperationsFold = (key: keyof OperationsFoldState) =>
    setOperationsFold((previous) => ({ ...previous, [key]: !previous[key] }));
  const closeRewardModal = () => setRewardModalOpen(false);
  const closeCodesModal = () => setCodesModalOpen(false);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const response = await api.listOrders({ take: 200 });
      setOrders(response.items);
      setOrdersError(null);
    } catch (error) {
      console.error("No se pudieron cargar los pedidos", error);
      setOrdersError("No pudimos obtener los pedidos. Reintentá en unos segundos.");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (orderId: string) => {
      setChatLoading(true);
      try {
        const data = await api.listOrderMessages(orderId, 120);
        setMessages(data);
      } catch (error) {
        console.error("No se pudo cargar el historial de mensajes", error);
        setMessages([]);
      } finally {
        setChatLoading(false);
      }
    },
    []
  );

  const runOrderAction = useCallback(
    async (orderId: string, task: () => Promise<ApiOrder | void>, failure: string) => {
      setActionLoadingId(orderId);
      try {
        await task();
        await loadOrders();
        setOrdersError(null);
      } catch (error) {
        console.error("No se pudo actualizar el pedido", error);
        setOrdersError(failure);
      } finally {
        setActionLoadingId(null);
      }
    },
    [loadOrders]
  );

  const handlePrepareOrder = useCallback(
    (orderId: string) =>
      runOrderAction(orderId, () => api.prepareOrder(orderId), "No pudimos mover el pedido a preparación."),
    [runOrderAction]
  );

  const handleConfirmOrder = useCallback(
    (orderId: string) =>
      runOrderAction(orderId, () => api.confirmOrder(orderId), "No pudimos marcar el pedido como listo."),
    [runOrderAction]
  );

  const handleFulfillOrder = useCallback(
    (orderId: string) =>
      runOrderAction(orderId, () => api.fulfillOrder(orderId), "No pudimos marcar el pedido como completado."),
    [runOrderAction]
  );

  const handleRequestCancelOrder = useCallback((orderId: string) => {
    setCancelOrderId(orderId);
    setCancelModalOpen(true);
  }, []);

  const handleConfirmCancelOrder = useCallback(
    async (reason: string | null) => {
      if (!cancelOrderId) {
        setCancelModalOpen(false);
        return;
      }
      await runOrderAction(
        cancelOrderId,
        () => api.cancelOrder(cancelOrderId, reason ?? undefined),
        "No pudimos cancelar el pedido."
      );
      setCancelModalOpen(false);
      setCancelOrderId(null);
    },
    [cancelOrderId, runOrderAction]
  );

  const handleSendMessage = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      if (event) event.preventDefault();
      if (!selectedOrderId) return;
      const text = messageDraft.trim();
      if (!text) return;
      setSendingMessage(true);
      try {
        await api.createOrderMessage(selectedOrderId, text, "ADMIN_BOARD");
        setMessageDraft("");
        await loadMessages(selectedOrderId);
      } catch (error) {
        console.error("No se pudo enviar el mensaje", error);
      } finally {
        setSendingMessage(false);
      }
    },
    [loadMessages, messageDraft, selectedOrderId]
  );

  const loadCustomers = useCallback(
    async (term: string) => {
      setCustomersLoading(true);
      try {
        const response = await api.listUsers({ take: 60, search: term.trim() || undefined });
        setCustomers(response.items);
        setCustomersError(null);
      } catch (error) {
        console.error("No se pudieron cargar los clientes", error);
        setCustomersError("No pudimos cargar los clientes. Reintentá en segundos.");
      } finally {
        setCustomersLoading(false);
      }
    },
    []
  );

  const loadCustomerDetail = useCallback(async (customer: ApiUserListItem) => {
    setCustomerDetailLoading(true);
    setCustomerFeedback(null);
    try {
      const [detail, engagement, coupons] = await Promise.all([
        api.getUserDetail(customer.id),
        api.getUserEngagement(customer.id),
        api.listShareCoupons(customer.id),
      ]);
      setCustomerDetail(detail);
      setCustomerEngagement(engagement);
      setCustomerCoupons(coupons);
    } catch (error) {
      console.error("No se pudo cargar el detalle del cliente", error);
      setCustomerDetail(null);
      setCustomerEngagement(null);
      setCustomerCoupons([]);
      setCustomerFeedback("No pudimos cargar el detalle de este cliente.");
    } finally {
      setCustomerDetailLoading(false);
    }
  }, []);

  const handleSelectCustomer = useCallback(
    (customer: ApiUserListItem) => {
      setSelectedCustomer(customer);
      loadCustomerDetail(customer);
    },
    [loadCustomerDetail]
  );

  const handleGrantReward = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedCustomer) return;
      if (rewardKind === "discount") {
        const parsedValue = Number(discountValue);
        if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
          setCustomerFeedback("Ingresá un monto válido para el descuento.");
          return;
        }
        const payload: CreateUserDiscountPayload = {
          value: clampValue(parsedValue),
          label: rewardLabel.trim() || "Premio fidelidad",
        };
        try {
          setGrantingDiscount(true);
          await api.createUserDiscount(selectedCustomer.id, payload);
          setCustomerFeedback("Asignamos un nuevo descuento de cortesía.");
          await loadCustomerDetail(selectedCustomer);
          setRewardModalOpen(false);
          setDiscountValue("5000");
          setRewardLabel("Premio fidelidad");
          setRewardKind("discount");
        } catch (error) {
          console.error("No se pudo otorgar el descuento", error);
          setCustomerFeedback("No pudimos otorgar el descuento. Probá nuevamente.");
        } finally {
          setGrantingDiscount(false);
        }
      } else {
        setCustomerFeedback(
          "Para combos/postres generá un cupón de una sola vez (próxima iteración). Por ahora usá descuentos monetarios."
        );
      }
    },
    [discountValue, loadCustomerDetail, rewardLabel, rewardKind, selectedCustomer]
  );

  const handleIssueCoupons = useCallback(async () => {
    if (!selectedCustomer) return;
    try {
      setIssuingCoupons(true);
      const coupons = await api.issueShareCoupons(selectedCustomer.id);
      setCustomerCoupons(coupons);
      setCustomerFeedback("Generamos nuevos códigos para compartir.");
      setCodesModalOpen(false);
    } catch (error) {
      console.error("No se pudieron generar los códigos", error);
      setCustomerFeedback("No pudimos generar códigos. Intentá de nuevo.");
    } finally {
      setIssuingCoupons(false);
    }
  }, [selectedCustomer]);

  const loadDiscountCodes = useCallback(async () => {
    setDiscountsLoading(true);
    try {
      const codes = await api.listDiscountCodes();
      setDiscountCodes(codes);
      setDiscountsError(null);
    } catch (error) {
      console.error("No se pudieron cargar los descuentos", error);
      setDiscountsError("No pudimos obtener las campañas.");
    } finally {
      setDiscountsLoading(false);
    }
  }, []);

  const loadGlobalCoupons = useCallback(
    async (status?: ApiShareCoupon["status"]) => {
      setGlobalCouponsLoading(true);
      try {
        const data = await api.listAllShareCoupons(status);
        setGlobalCoupons(data);
        setGlobalCouponsError(null);
      } catch (error) {
        console.error("No se pudieron cargar los códigos compartidos", error);
        setGlobalCouponsError("No pudimos obtener los códigos compartidos.");
      } finally {
        setGlobalCouponsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (orders.length === 0) {
      setSelectedOrderId(null);
      return;
    }
    if (!selectedOrderId || !orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(orders[0]?.id ?? null);
    }
  }, [orders, selectedOrderId]);

  useEffect(() => {
    if (!selectedOrderId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedOrderId);
  }, [loadMessages, selectedOrderId]);

  useEffect(() => {
    if (activeSection === "clients" && !customersBootstrapped) {
      loadCustomers("");
      setCustomersBootstrapped(true);
    }
  }, [activeSection, customersBootstrapped, loadCustomers]);

  useEffect(() => {
    if (customersBootstrapped && customers.length > 0 && !selectedCustomer) {
      const first = customers[0];
      setSelectedCustomer(first);
      loadCustomerDetail(first);
    }
  }, [customers, customersBootstrapped, loadCustomerDetail, selectedCustomer]);

  useEffect(() => {
    if (activeSection === "discounts" && !discountsBootstrapped) {
      loadDiscountCodes();
      setDiscountsBootstrapped(true);
    }
  }, [activeSection, discountsBootstrapped, loadDiscountCodes]);

  useEffect(() => {
    if (activeSection === "codes" && !codesBootstrapped) {
      loadGlobalCoupons();
      setCodesBootstrapped(true);
    }
  }, [activeSection, codesBootstrapped, loadGlobalCoupons]);

  const ordersByStatus = useMemo(() => {
    const buckets: Record<OrderStatus, ApiOrder[]> = {
      DRAFT: [],
      PENDING: [],
      PREPARING: [],
      CONFIRMED: [],
      FULFILLED: [],
      CANCELLED: [],
    };
    orders.forEach((order) => {
      buckets[order.status]?.push(order);
    });
    return buckets;
  }, [orders]);

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((order) => order.id === selectedOrderId) ?? null : null),
    [orders, selectedOrderId]
  );

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const normalized = customerSearch.trim().toLowerCase();
    return customers.filter((customer) => {
      const fullName = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.toLowerCase();
      return (
        customer.email.toLowerCase().includes(normalized) ||
        (customer.displayName ?? "").toLowerCase().includes(normalized) ||
        fullName.includes(normalized)
      );
    });
  }, [customerSearch, customers]);

  const now = Date.now();

  const discountsBuckets = useMemo(() => {
    const active: ApiDiscountCode[] = [];
    const scheduled: ApiDiscountCode[] = [];
    const expired: ApiDiscountCode[] = [];
    discountCodes.forEach((discount) => {
      const startsAt = discount.startsAt ? Date.parse(discount.startsAt) : null;
      const expiresAt = discount.expiresAt ? Date.parse(discount.expiresAt) : null;
      if (expiresAt && expiresAt < now) {
        expired.push(discount);
      } else if (startsAt && startsAt > now) {
        scheduled.push(discount);
      } else {
        active.push(discount);
      }
    });
    return { active, scheduled, expired };
  }, [discountCodes, now]);

  const discountMetrics = useMemo(() => {
    const totalRedemptions = discountCodes.reduce(
      (sum, discount) => sum + (discount.redemptions?.length ?? 0),
      0
    );
    const totalValueRedeemed = discountCodes.reduce((sum, discount) => {
      return (
        sum +
        discount.redemptions.reduce((acc, redemption) => {
          const value = Number.parseFloat(redemption.valueApplied ?? "0");
          return acc + (Number.isFinite(value) ? value : 0);
        }, 0)
      );
    }, 0);
    return {
      count: discountCodes.length,
      totalRedemptions,
      totalValueRedeemed,
    };
  }, [discountCodes]);

  const filteredCoupons = useMemo(() => {
    if (!couponFilter) return globalCoupons;
    return globalCoupons.filter((coupon) => coupon.status === couponFilter);
  }, [couponFilter, globalCoupons]);

  const operationsMetrics = useMemo(() => {
    const fulfilled = ordersByStatus.FULFILLED;
    const pending = ordersByStatus.PENDING;
    const preparing = ordersByStatus.PREPARING;
    const confirmed = ordersByStatus.CONFIRMED;
    const pendingValue = pending.reduce((sum, order) => sum + (order.totalNet ?? order.totalGross ?? 0), 0);
    const revenueFulfilled = fulfilled.reduce(
      (sum, order) => sum + (order.totalNet ?? order.totalGross ?? 0),
      0
    );
    const avgTicket = fulfilled.length > 0 ? revenueFulfilled / fulfilled.length : 0;
    const today = new Date();
    const fulfilledToday = fulfilled.filter((order) => {
      const reference = order.fulfilledAt ?? order.confirmedAt ?? order.updatedAt;
      if (!reference) return false;
      const date = new Date(reference);
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    });
    const fulfilledTodayValue = fulfilledToday.reduce(
      (sum, order) => sum + (order.totalNet ?? order.totalGross ?? 0),
      0
    );
    return {
      pendingCount: pending.length,
      preparingCount: preparing.length,
      confirmedCount: confirmed.length,
      pendingValue,
      revenueFulfilled,
      avgTicket,
      fulfilledToday: fulfilledToday.length,
      fulfilledTodayValue,
      totalOrders: orders.length,
    };
  }, [orders.length, ordersByStatus.CONFIRMED, ordersByStatus.FULFILLED, ordersByStatus.PENDING, ordersByStatus.PREPARING]);

  useEffect(() => {
    const tabConfig = ORDER_TABS.find((tab) => tab.id === ordersTab);
    if (tabConfig?.defaultLimit) {
      setListVisibleLimit(tabConfig.defaultLimit);
    } else {
      setListVisibleLimit(40);
    }
  }, [ordersTab]);

  if (!user) {
    return null;
  }

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  const guaranteeClosedSidebar = () => setSidebarOpen(false);

  const handleSectionChange = (section: AdminSectionId) => {
    setActiveSection(section);
    guaranteeClosedSidebar();
  };

  const selectedSection = SECTION_CONFIG.find((section) => section.id === activeSection) ?? SECTION_CONFIG[0];

  const renderOrderActions = (order: ApiOrder) => {
    const actions: Array<{
      key: string;
      label: string;
      intent: "primary" | "neutral" | "danger";
      handler: () => void;
    }> = [];
    if (order.status === "PENDING") {
      actions.push(
        {
          key: "prepare",
          label: "Tomar pedido",
          intent: "neutral",
          handler: () => handlePrepareOrder(order.id),
        },
        {
          key: "ready",
          label: "Listo para entregar",
          intent: "primary",
          handler: () => handleConfirmOrder(order.id),
        },
        {
          key: "cancel",
          label: "Cancelar pedido",
          intent: "danger",
          handler: () => handleRequestCancelOrder(order.id),
        }
      );
    } else if (order.status === "PREPARING") {
      actions.push(
        {
          key: "ready",
          label: "Listo para entregar",
          intent: "primary",
          handler: () => handleConfirmOrder(order.id),
        },
        {
          key: "complete",
          label: "Pedido entregado",
          intent: "neutral",
          handler: () => handleFulfillOrder(order.id),
        },
        {
          key: "cancel",
          label: "Cancelar pedido",
          intent: "danger",
          handler: () => handleRequestCancelOrder(order.id),
        }
      );
    } else if (order.status === "CONFIRMED") {
      actions.push(
        {
          key: "complete",
          label: "Pedido entregado",
          intent: "primary",
          handler: () => handleFulfillOrder(order.id),
        },
        {
          key: "cancel",
          label: "Cancelar pedido",
          intent: "danger",
          handler: () => handleRequestCancelOrder(order.id),
        }
      );
    }
    return actions;
  };

  const renderOrdersSection = () => {
    const stats = [
      {
        label: "En cola",
        value: ordersByStatus.PENDING.length,
        helper: formatCurrency(operationsMetrics.pendingValue),
      },
      {
        label: "En preparación",
        value: operationsMetrics.preparingCount,
        helper: formatCurrency(ordersByStatus.PREPARING.reduce((sum, order) => sum + (order.totalNet ?? order.totalGross ?? 0), 0)),
      },
      {
        label: "Listos para entrega",
        value: operationsMetrics.confirmedCount,
        helper: formatCurrency(ordersByStatus.CONFIRMED.reduce((sum, order) => sum + (order.totalNet ?? order.totalGross ?? 0), 0)),
      },
      {
        label: "Cerrados hoy",
        value: operationsMetrics.fulfilledToday,
        helper: formatCurrency(operationsMetrics.fulfilledTodayValue),
      },
    ];

    const tabConfig = ORDER_TABS.find((tab) => tab.id === ordersTab) ?? ORDER_TABS[0];
    const isPipelineView = tabConfig.id === "pipeline";
    const pipelineColumns = ORDER_PIPELINE.filter((column) => column.status !== "FULFILLED");
    const tabOrders = isPipelineView
      ? []
      : tabConfig.statuses?.flatMap((status) => ordersByStatus[status] ?? []) ?? [];
    const sortedTabOrders = isPipelineView
      ? []
      : [...tabOrders].sort((a, b) => {
          const aDate = new Date(a.updatedAt ?? a.createdAt ?? Date.now()).getTime();
          const bDate = new Date(b.updatedAt ?? b.createdAt ?? Date.now()).getTime();
          return bDate - aDate;
        });
    const visibleTabOrders = isPipelineView ? [] : sortedTabOrders.slice(0, listVisibleLimit);
    const tabHasMore = !isPipelineView && sortedTabOrders.length > listVisibleLimit;

    const detailContent = selectedOrder ? (
      <>
        <header className={ordersStyles.detailHeader}>
          <div>
            <span>Pedido</span>
            <h3>PT {formatOrderCode(selectedOrder.number)}</h3>
            <p>Creado {formatOrderTimestamp(selectedOrder.createdAt)}</p>
          </div>
          <span className={cn(ordersStyles.statusChip, pipelineStatusClass[selectedOrder.status] ?? ordersStyles.cardStatusPending)}>
            {statusLabels[selectedOrder.status]}
          </span>
        </header>

        <div className={ordersStyles.foldGroup}>
          <div>
            <button
              type="button"
              className={cn(ordersStyles.foldButton, orderFold.timeline && ordersStyles.foldButtonOpen)}
              onClick={() => toggleOrderFold("timeline")}
              aria-expanded={orderFold.timeline}
            >
              <span>Línea de tiempo</span>
              <span className={ordersStyles.foldChevron} aria-hidden="true">⌄</span>
            </button>
            {orderFold.timeline && (
              <div className={ordersStyles.foldBody}>
                <div className={ordersStyles.timelineDetail} aria-label="Linea de tiempo del pedido">
                  {ORDER_SEQUENCE.map((step) => {
                    const isReached = ORDER_SEQUENCE.indexOf(selectedOrder.status) >= ORDER_SEQUENCE.indexOf(step);
                    const timestamp =
                      step === "PENDING"
                        ? selectedOrder.placedAt ?? selectedOrder.createdAt
                        : step === "PREPARING"
                        ? selectedOrder.preparingAt
                        : step === "CONFIRMED"
                        ? selectedOrder.confirmedAt
                        : selectedOrder.fulfilledAt;
                    return (
                      <div key={step} className={cn(ordersStyles.timelineStep, isReached && ordersStyles.timelineStepComplete)}>
                        <span>{statusLabels[step]}</span>
                        <small>{timestamp ? shortTimeFormatter.format(new Date(timestamp)) : "—"}</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              className={cn(ordersStyles.foldButton, orderFold.info && ordersStyles.foldButtonOpen)}
              onClick={() => toggleOrderFold("info")}
              aria-expanded={orderFold.info}
            >
              <span>Datos y totales</span>
              <span className={ordersStyles.foldChevron} aria-hidden="true">⌄</span>
            </button>
            {orderFold.info && (
              <div className={ordersStyles.foldBody}>
                <div className={ordersStyles.infoGrid}>
                  <article className={ordersStyles.infoCard}>
                    <span>Cliente</span>
                    <strong>{selectedOrder.metadata?.customer?.name ?? "Sin identificar"}</strong>
                    <small>{selectedOrder.metadata?.customer?.phone ?? "Sin teléfono"}</small>
                  </article>
                  <article className={ordersStyles.infoCard}>
                    <span>Entrega</span>
                    <strong>{selectedOrder.metadata?.delivery?.addressLine ?? "Retira en local"}</strong>
                    <small>{selectedOrder.metadata?.delivery?.notes ?? "Sin notas"}</small>
                  </article>
                  <article className={ordersStyles.infoCard}>
                    <span>Total</span>
                    <strong>{formatCurrency(selectedOrder.totalNet ?? selectedOrder.totalGross ?? 0)}</strong>
                    {selectedOrder.discountTotal > 0 && <small>Ahorrado: {formatCurrency(selectedOrder.discountTotal)}</small>}
                  </article>
                  <article className={ordersStyles.infoCard}>
                    <span>Notas</span>
                    <strong>{selectedOrder.note || selectedOrder.metadata?.notes || "Sin notas adicionales"}</strong>
                  </article>
                </div>
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              className={cn(ordersStyles.foldButton, orderFold.items && ordersStyles.foldButtonOpen)}
              onClick={() => toggleOrderFold("items")}
              aria-expanded={orderFold.items}
            >
              <span>Ítems del pedido</span>
              <span className={ordersStyles.foldChevron} aria-hidden="true">⌄</span>
            </button>
            {orderFold.items && (
              <div className={ordersStyles.foldBody}>
                <div className={ordersStyles.itemsList} aria-label="Productos del pedido">
                  <header>
                    <h4>Ítems ({selectedOrder.normalizedItems.length})</h4>
                    <span>
                      {formatCurrency(
                        selectedOrder.normalizedItems.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0)
                      )}
                    </span>
                  </header>
                  <ul>
                    {selectedOrder.normalizedItems.map((item) => (
                      <li key={`${item.label}-${item.quantity}`}>
                        <div>
                          <strong>{item.label}</strong>
                          {item.side && <small>{item.side}</small>}
                        </div>
                        <span>x{item.quantity}</span>
                        <span>{formatCurrency(item.lineTotal ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              className={cn(ordersStyles.foldButton, orderFold.chat && ordersStyles.foldButtonOpen)}
              onClick={() => toggleOrderFold("chat")}
              aria-expanded={orderFold.chat}
            >
              <span>Mensajes</span>
              <span className={ordersStyles.foldChevron} aria-hidden="true">⌄</span>
            </button>
            {orderFold.chat && (
              <div className={ordersStyles.foldBody}>
                <div className={ordersStyles.chat} aria-label="Mensajes">
                  <div className={ordersStyles.chatLog}>
                    {chatLoading ? (
                      <p className={ordersStyles.chatPlaceholder} aria-busy="true">
                        Cargando mensajes…
                      </p>
                    ) : messages.length === 0 ? (
                      <p className={ordersStyles.chatPlaceholder}>
                        Todavía no hay mensajes. Podés dejar una nota para avisar tiempos o promociones.
                      </p>
                    ) : (
                      <ul>
                        {messages.map((entry) => {
                          const author = entry.authorType.toLowerCase();
                          const isCustomer = author === "customer" || author === "user";
                          return (
                            <li
                              key={entry.id}
                              className={cn(ordersStyles.chatMessage, author === "admin" && ordersStyles.chatMessageAdmin, isCustomer && ordersStyles.chatMessageUser)}
                            >
                              <span className={ordersStyles.chatText}>{extractMessage(entry.payload)}</span>
                              <small>
                                {entry.authorType === "ADMIN" ? "Equipo" : "Cliente"} · {dateTimeFormatter.format(new Date(entry.createdAt))}
                              </small>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <form className={ordersStyles.chatForm} onSubmit={(event) => handleSendMessage(event)}>
                    <textarea
                      placeholder="Ej: Estamos preparando tus pollos, sale en 10 minutos."
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      disabled={sendingMessage}
                      rows={3}
                    />
                    <div className={ordersStyles.chatActions}>
                      <button
                        type="submit"
                        className="btn-primary btn-pill"
                        disabled={sendingMessage || messageDraft.trim().length === 0}
                      >
                        {sendingMessage ? "Enviando…" : "Enviar"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    ) : (
      <div className={ordersStyles.detailEmpty}>
        <p>Elegí un pedido para ver el detalle, timeline y mensajes.</p>
      </div>
    );

    return (
      <section className={cn("admin-section admin-section--orders", ordersStyles.root)} aria-label="Gestión de pedidos">
        <header className={cn("admin-section__head", ordersStyles.header)}>
          <div className={ordersStyles.titleGroup}>
            <h2>Pipeline de pedidos</h2>
            <p>Visualizá el flujo completo: pendientes, preparación, listos y completados.</p>
          </div>
          <div className="admin-section__actions">
            <button type="button" className="btn-ghost btn-pill" onClick={loadOrders} disabled={ordersLoading}>
              {ordersLoading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        </header>
        {ordersError && <p className="admin-notice admin-notice--error">{ordersError}</p>}

        <nav className={ordersStyles.tabBar} role="tablist" aria-label="Filtrar pedidos por estado">
          {ORDER_TABS.map((tab) => {
            const isActive = ordersTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={cn(ordersStyles.tabButton, isActive && ordersStyles.tabButtonActive)}
                onClick={() => setOrdersTab(tab.id)}
              >
                <span>{tab.label}</span>
                <small>{tab.helper}</small>
              </button>
            );
          })}
        </nav>

        <div className={ordersStyles.stats}>
          {stats.map((stat) => (
            <article key={stat.label} className={ordersStyles.statCard}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.helper}</small>
            </article>
          ))}
        </div>

        <div className={ordersStyles.workspace}>
          <div className={ordersStyles.pipeline}>
            {isPipelineView ? (
              pipelineColumns.map((column) => {
                const columnOrders = ordersByStatus[column.status];
                return (
                  <section key={column.status} className={ordersStyles.column}>
                    <header>
                      <div>
                        <span>{column.label}</span>
                        <small>{column.helper}</small>
                      </div>
                      <span className={ordersStyles.badge}>{columnOrders.length}</span>
                    </header>
                    {columnOrders.length === 0 ? (
                      <p className={ordersStyles.empty}>Sin pedidos en esta etapa.</p>
                    ) : (
                      <div className={ordersStyles.list}>
                        {columnOrders.map((order) => {
                          const customerName = order.metadata?.customer?.name ?? "Sin identificar";
                          const address = order.metadata?.delivery?.addressLine ?? "Retira en local";
                          const placedAt = order.placedAt ?? order.createdAt;
                          const total = formatCurrency(order.totalNet ?? order.totalGross ?? 0);
                          const isSelected = selectedOrderId === order.id;
                          const cardActions = renderOrderActions(order);
                          return (
                            <article
                              key={order.id}
                              className={cn(ordersStyles.card, isSelected && ordersStyles.cardActive)}
                              onClick={() => setSelectedOrderId(order.id)}
                            >
                              <div className={ordersStyles.cardHead}>
                                <span className={ordersStyles.cardCode}>PT {formatOrderCode(order.number)}</span>
                                <span className={cn(ordersStyles.cardStatus, pipelineStatusClass[order.status] ?? ordersStyles.cardStatusPending)}>
                                  {statusLabels[order.status]}
                                </span>
                              </div>
                              <div className={ordersStyles.cardBody}>
                                <p className={ordersStyles.cardCustomer}>{customerName}</p>
                                <p className={ordersStyles.cardAddress} title={address}>
                                  {address}
                                </p>
                                <div className={ordersStyles.cardMeta}>
                                  <span>{total}</span>
                                  <span>{shortTimeFormatter.format(new Date(placedAt))}</span>
                                </div>
                              </div>
                              {cardActions.length > 0 && (
                                <div className={ordersStyles.actionGroup}>
                                  {cardActions.map((action) => (
                                    <button
                                      key={action.key}
                                      type="button"
                                      className={cn(ordersStyles.actionChip, actionClassMap[action.intent] ?? ordersStyles.actionSecondary)}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        action.handler();
                                      }}
                                      disabled={actionLoadingId === order.id || ordersLoading}
                                    >
                                      {action.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })
            ) : (
              <section className={ordersStyles.listPanel} aria-live="polite">
                <header className={ordersStyles.listHeader}>
                  <div>
                    <span>{tabConfig.label}</span>
                    <small>{sortedTabOrders.length} pedidos</small>
                  </div>
                </header>
                {visibleTabOrders.length === 0 ? (
                  <p className={ordersStyles.empty}>No hay pedidos en este estado.</p>
                ) : (
                  <ul className={ordersStyles.listRows}>
                    {visibleTabOrders.map((order) => {
                      const customerName = order.metadata?.customer?.name ?? "Sin identificar";
                      const address = order.metadata?.delivery?.addressLine ?? "Retira en local";
                      const total = formatCurrency(order.totalNet ?? order.totalGross ?? 0);
                      const placedAt = order.fulfilledAt ?? order.confirmedAt ?? order.preparingAt ?? order.placedAt ?? order.createdAt;
                      const isSelected = selectedOrderId === order.id;
                      const cardActions = renderOrderActions(order);
                      return (
                        <li key={order.id} className={cn(ordersStyles.listRow, isSelected && ordersStyles.listRowActive)}>
                          <button
                            type="button"
                            className={ordersStyles.listRowButton}
                            onClick={() => setSelectedOrderId(order.id)}
                          >
                            <div className={ordersStyles.listRowHead}>
                              <span className={ordersStyles.cardCode}>PT {formatOrderCode(order.number)}</span>
                              <span className={cn(ordersStyles.cardStatus, pipelineStatusClass[order.status] ?? ordersStyles.cardStatusPending)}>
                                {statusLabels[order.status]}
                              </span>
                              <span className={ordersStyles.listRowTime}>{shortTimeFormatter.format(new Date(placedAt))}</span>
                            </div>
                            <p className={ordersStyles.listRowCustomer}>{customerName}</p>
                            <p className={ordersStyles.listRowMeta}>
                              <span title={address}>{address}</span>
                              <span>{total}</span>
                            </p>
                          </button>
                          {cardActions.length > 0 && (
                            <div className={ordersStyles.listRowActions}>
                              {cardActions.map((action) => (
                                <button
                                  key={action.key}
                                  type="button"
                                  className={cn(ordersStyles.actionChip, actionClassMap[action.intent] ?? ordersStyles.actionSecondary)}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    action.handler();
                                  }}
                                  disabled={actionLoadingId === order.id || ordersLoading}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {tabHasMore && (
                  <div className={ordersStyles.listMore}>
                    <button
                      type="button"
                      className="btn-ghost btn-pill"
                      onClick={() => setListVisibleLimit((prev) => prev + (tabConfig.defaultLimit ?? 20))}
                    >
                      Ver más pedidos
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
          <aside className={ordersStyles.detail} aria-live="polite">
            {detailContent}
          </aside>
        </div>

        {isPipelineView && ordersByStatus.CANCELLED.length > 0 && (
          <footer className={ordersStyles.cancelled}>
            <h3>Cancelados recientes</h3>
            <div className={ordersStyles.cancelledList}>
              {ordersByStatus.CANCELLED.slice(0, 6).map((order) => (
                <article key={order.id} className={ordersStyles.cancelledItem}>
                  <strong>PT {formatOrderCode(order.number)}</strong>
                  <span>{formatOrderTimestamp(order.cancelledAt)}</span>
                  <small>{order.cancellationReason ?? "Sin motivo"}</small>
                </article>
              ))}
            </div>
          </footer>
        )}
      </section>
    );
  };


  const renderCustomersSection = () => (
    <section className="admin-section admin-section--clients" aria-label="Gestión de clientes">
      <header className="admin-section__head">
        <div>
          <h2>Clientes</h2>
          <p>Buscá, segmentá y otorgá beneficios personalizados.</p>
        </div>
        <div className="admin-section__actions">
          <div className="field field--search">
            <input
              type="search"
              placeholder="Correo, nombre o alias"
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-ghost btn-pill"
            onClick={() => loadCustomers(customerSearch)}
            disabled={customersLoading}
          >
            {customersLoading ? "Buscando…" : "Buscar"}
          </button>
          <button type="button" className="btn-secondary btn-pill" onClick={() => loadCustomers("")}>
            Refrescar
          </button>
        </div>
      </header>
      {(customersError || customerFeedback) && (
        <p className={`admin-notice ${customersError ? "admin-notice--error" : "admin-notice--info"}`}>
          {customersError ?? customerFeedback}
        </p>
      )}
      <div className="clients-workspace">
        <aside className="clients-list" aria-label="Listado de clientes">
          {customersLoading && customers.length === 0 ? (
            <p className="clients-placeholder" aria-busy="true">
              Cargando clientes…
            </p>
          ) : filteredCustomers.length === 0 ? (
            <p className="clients-placeholder">No encontramos clientes con ese criterio.</p>
          ) : (
            <ul>
              {filteredCustomers.map((customer) => {
                const isSelected = selectedCustomer?.id === customer.id;
                return (
                  <li key={customer.id}>
                    <button
                      type="button"
                      className={`client-card${isSelected ? " is-active" : ""}`}
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <div className="client-card__head">
                        <strong>{customer.displayName ?? customer.firstName ?? customer.email}</strong>
                        <span>{dayFormatter.format(new Date(customer.createdAt))}</span>
                      </div>
                      <span className="client-card__email">{customer.email}</span>
                      {customer.phone && <span className="client-card__phone">{customer.phone}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
        <article className="clients-detail" aria-live="polite">
          {selectedCustomer ? (
            <div className="clients-detail__card">
              <header>
                <div>
                  <span>Cliente</span>
                  <h3>{selectedCustomer.displayName ?? selectedCustomer.firstName ?? selectedCustomer.email}</h3>
                  <p>Alta {formatOrderTimestamp(selectedCustomer.createdAt)}</p>
                </div>
                <div className="clients-detail__status">
                  <span className={`status-dot ${selectedCustomer.isActive ? "is-online" : "is-offline"}`}></span>
                  <small>{selectedCustomer.isActive ? "Activo" : "Inactivo"}</small>
                </div>
              </header>
              {clientFold.summary && (
                <div className="clients-detail__summary">
                  <div className="clients-detail__grid">
                    <article>
                      <span>Órdenes totales</span>
                      <strong>{customerEngagement?.lifetimeOrders ?? 0}</strong>
                    </article>
                    <article>
                      <span>Importe acumulado</span>
                      <strong>{formatCurrency(Number.parseFloat(customerEngagement?.lifetimeNetSales ?? "0") || 0)}</strong>
                    </article>
                    <article>
                      <span>Órdenes este mes</span>
                      <strong>{customerEngagement?.monthlyOrders ?? 0}</strong>
                    </article>
                    <article>
                      <span>Último pedido</span>
                      <strong>{formatOrderTimestamp(customerEngagement?.lastOrderAt ?? null)}</strong>
                    </article>
                  </div>
                </div>
              )}
              <div className="fold">
                <button
                  type="button"
                  className={`fold__head${clientFold.benefits ? " is-open" : ""}`}
                  onClick={() => toggleClientFold("benefits")}
                  aria-expanded={clientFold.benefits}
                >
                  <span>Beneficios y recompensas</span>
                  <span className="fold__chevron" aria-hidden="true">⌄</span>
                </button>
                {clientFold.benefits && (
                  <div className="fold__body">
                    {customerDetailLoading ? (
                      <p className="clients-placeholder" aria-busy="true">
                        Actualizando datos…
                      </p>
                    ) : (
                      <div className="clients-detail__rewards-grid">
                        <article>
                          <span>Descuentos activos</span>
                          <strong>{customerDetail?.discountCodesOwned.length ?? 0}</strong>
                        </article>
                        <article>
                          <span>Redenciones</span>
                          <strong>{customerDetail?.discountRedemptions.length ?? 0}</strong>
                        </article>
                        <article>
                          <span>Códigos compartidos</span>
                          <strong>{customerCoupons.length}</strong>
                        </article>
                        <article>
                          <span>Share events</span>
                          <strong>{customerEngagement?.shareEvents ?? 0}</strong>
                        </article>
                      </div>
                    )}
                    <div className="fold__actions">
                      <button
                        type="button"
                        className="chip-action chip-action--neutral"
                        onClick={() => setCodesModalOpen(true)}
                      >
                        Gestionar códigos
                      </button>
                      <button
                        type="button"
                        className="chip-action chip-action--primary"
                        onClick={() => setRewardModalOpen(true)}
                      >
                        Otorgar beneficio
                      </button>
                    </div>
                    {customerCoupons.length > 0 && (
                      <div className="clients-detail__coupons clients-detail__coupons--inline">
                        <h5>Códigos recientes</h5>
                        <ul>
                          {customerCoupons.slice(0, 4).map((coupon) => (
                            <li key={coupon.id}>
                              <span>{coupon.code}</span>
                              <small>{coupon.status}</small>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="fold">
                <button
                  type="button"
                  className={`fold__head${clientFold.history ? " is-open" : ""}`}
                  onClick={() => toggleClientFold("history")}
                  aria-expanded={clientFold.history}
                >
                  <span>Historial reciente</span>
                  <span className="fold__chevron" aria-hidden="true">⌄</span>
                </button>
                {clientFold.history && (
                  <div className="fold__body">
                    {customerDetailLoading ? (
                      <p className="clients-placeholder" aria-busy="true">
                        Cargando historial…
                      </p>
                    ) : customerDetail?.orders && customerDetail.orders.length > 0 ? (
                      <ul className="list-compact">
                        {customerDetail.orders.slice(0, 6).map((order) => (
                          <li key={order.id}>
                            <div>
                              <strong>PT {formatOrderCode(order.number)}</strong>
                              <span>{statusLabels[order.status]}</span>
                            </div>
                            <div>
                              <span>{formatOrderTimestamp(order.createdAt)}</span>
                              <span>{formatCurrency(order.totalNet ?? order.totalGross)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="clients-placeholder">Sin pedidos registrados todavía.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="clients-placeholder">Elegí un cliente para ver detalle y beneficios.</div>
          )}
        </article>
      </div>
    </section>
  );

  const renderDiscountsSection = () => (
    <section className="admin-section admin-section--discounts" aria-label="Campañas de descuento">
      <header className="admin-section__head">
        <div>
          <h2>Campañas y descuentos</h2>
          <p>Controlá beneficios activos, próximos y vencidos.</p>
        </div>
        <div className="admin-section__actions">
          <button
            type="button"
            className="btn-ghost btn-pill"
            onClick={loadDiscountCodes}
            disabled={discountsLoading}
          >
            {discountsLoading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </header>
      {discountsError && <p className="admin-notice admin-notice--error">{discountsError}</p>}
      <div className="discounts-metrics">
        <article>
          <span>Campañas totales</span>
          <strong>{discountMetrics.count}</strong>
        </article>
        <article>
          <span>Redenciones</span>
          <strong>{discountMetrics.totalRedemptions}</strong>
        </article>
        <article>
          <span>Monto aplicado</span>
          <strong>{formatCurrency(discountMetrics.totalValueRedeemed)}</strong>
        </article>
      </div>
      <div className="discounts-buckets">
        <div className="fold">
          <button
            type="button"
            className={`fold__head${discountFold.active ? " is-open" : ""}`}
            onClick={() => toggleDiscountFold("active")}
            aria-expanded={discountFold.active}
          >
            <span>Activos ({discountsBuckets.active.length})</span>
            <span className="fold__chevron" aria-hidden="true">⌄</span>
          </button>
          {discountFold.active && (
            <div className="fold__body">
              {discountsBuckets.active.length === 0 ? (
                <p className="discounts-empty">Sin campañas activas.</p>
              ) : (
                <div className="discounts-bucket__grid">
                  {discountsBuckets.active.map((discount) => (
                    <article key={discount.id} className="discount-card">
                      <header>
                        <span>{discount.code}</span>
                        <small>{discount.type}</small>
                      </header>
                      <div className="discount-card__body">
                        <strong>
                          {discount.scope === "ITEM"
                            ? `${
                                discount.percentage
                                  ? `${discount.percentage}%`
                                  : formatCurrency(Number(discount.value ?? 0))
                              }`
                            : discount.percentage
                            ? `${discount.percentage}%`
                            : formatCurrency(Number(discount.value ?? 0))}
                        </strong>
                        <small>
                          Vence {discount.expiresAt ? dateTimeFormatter.format(new Date(discount.expiresAt)) : "sin fecha"}
                        </small>
                      </div>
                      <footer>
                        <span>{discount.redemptions.length} usos</span>
                        <button
                          type="button"
                          className="chip-action chip-action--neutral"
                          onClick={() => navigator.clipboard.writeText(discount.code).catch(() => void 0)}
                        >
                          Copiar
                        </button>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="fold">
          <button
            type="button"
            className={`fold__head${discountFold.scheduled ? " is-open" : ""}`}
            onClick={() => toggleDiscountFold("scheduled")}
            aria-expanded={discountFold.scheduled}
          >
            <span>Próximos ({discountsBuckets.scheduled.length})</span>
            <span className="fold__chevron" aria-hidden="true">⌄</span>
          </button>
          {discountFold.scheduled && (
            <div className="fold__body">
              {discountsBuckets.scheduled.length === 0 ? (
                <p className="discounts-empty">Sin campañas programadas.</p>
              ) : (
                <div className="discounts-bucket__grid">
                  {discountsBuckets.scheduled.map((discount) => (
                    <article key={discount.id} className="discount-card">
                      <header>
                        <span>{discount.code}</span>
                        <small>{discount.type}</small>
                      </header>
                      <div className="discount-card__body">
                        <strong>
                          {discount.percentage ? `${discount.percentage}%` : formatCurrency(Number(discount.value ?? 0))}
                        </strong>
                        <small>
                          Empieza {discount.startsAt ? dateTimeFormatter.format(new Date(discount.startsAt)) : "Próximamente"}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="fold">
          <button
            type="button"
            className={`fold__head${discountFold.expired ? " is-open" : ""}`}
            onClick={() => toggleDiscountFold("expired")}
            aria-expanded={discountFold.expired}
          >
            <span>Finalizados ({discountsBuckets.expired.length})</span>
            <span className="fold__chevron" aria-hidden="true">⌄</span>
          </button>
          {discountFold.expired && (
            <div className="fold__body">
              {discountsBuckets.expired.length === 0 ? (
                <p className="discounts-empty">Todavía no hay campañas finalizadas.</p>
              ) : (
                <div className="discounts-bucket__grid">
                  {discountsBuckets.expired.slice(0, 6).map((discount) => (
                    <article key={discount.id} className="discount-card discount-card--muted">
                      <header>
                        <span>{discount.code}</span>
                        <small>{discount.type}</small>
                      </header>
                      <div className="discount-card__body">
                        <strong>
                          {discount.percentage ? `${discount.percentage}%` : formatCurrency(Number(discount.value ?? 0))}
                        </strong>
                        <small>
                          Expiró {discount.expiresAt ? dateTimeFormatter.format(new Date(discount.expiresAt)) : "sin fecha"}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const renderCodesSection = () => (
    <section className="admin-section admin-section--codes" aria-label="Códigos compartidos">
      <header className="admin-section__head">
        <div>
          <h2>Códigos compartidos y canjeados</h2>
          <p>Seguimiento fino de referidos y promociones individuales.</p>
        </div>
        <div className="admin-section__actions">
          <select
            value={couponFilter}
            onChange={(event) => {
              const value = event.target.value as "" | ApiShareCoupon["status"];
              setCouponFilter(value);
              loadGlobalCoupons(value || undefined);
            }}
          >
            <option value="">Todos</option>
            <option value="ISSUED">Emitidos</option>
            <option value="ACTIVATED">Compartidos</option>
            <option value="REDEEMED">Redimidos</option>
          </select>
          <button
            type="button"
            className="btn-ghost btn-pill"
            onClick={() => loadGlobalCoupons(couponFilter || undefined)}
            disabled={globalCouponsLoading}
          >
            {globalCouponsLoading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </header>
      {globalCouponsError && <p className="admin-notice admin-notice--error">{globalCouponsError}</p>}
      <div className="fold">
        <button
          type="button"
          className={`fold__head${codesFoldOpen ? " is-open" : ""}`}
          onClick={() => setCodesFoldOpen((previous) => !previous)}
          aria-expanded={codesFoldOpen}
        >
          <span>Listado ({filteredCoupons.length})</span>
          <span className="fold__chevron" aria-hidden="true">⌄</span>
        </button>
        {codesFoldOpen && (
          <div className="fold__body">
            <div className="codes-table-wrapper">
              {globalCouponsLoading && filteredCoupons.length === 0 ? (
                <p className="codes-placeholder" aria-busy="true">
                  Cargando códigos…
                </p>
              ) : filteredCoupons.length === 0 ? (
                <p className="codes-placeholder">No hay códigos bajo ese estado.</p>
              ) : (
                <table className="codes-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Cliente</th>
                      <th>Estado</th>
                      <th>Creado</th>
                      <th>Actualizado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCoupons.slice(0, 40).map((coupon) => (
                      <tr key={coupon.id}>
                        <td>
                          <span className={`code-pill code-pill--${coupon.status.toLowerCase()}`}>{coupon.code}</span>
                        </td>
                        <td>{coupon.user?.displayName ?? coupon.user?.email ?? "—"}</td>
                        <td>{coupon.status}</td>
                        <td>{formatOrderTimestamp(coupon.createdAt)}</td>
                        <td>{formatOrderTimestamp(coupon.updatedAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="chip-action chip-action--neutral"
                            onClick={() => navigator.clipboard.writeText(coupon.code).catch(() => void 0)}
                          >
                            Copiar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );

  const renderOperationsSection = () => (
    <section className="admin-section admin-section--operations" aria-label="Panel operativo">
      <header className="admin-section__head">
        <div>
          <h2>Operaciones y KPIs</h2>
          <p>Resumen ejecutivo para tomar decisiones rápidas.</p>
        </div>
      </header>
      <div className="fold">
        <button
          type="button"
          className={`fold__head${operationsFold.metrics ? " is-open" : ""}`}
          onClick={() => toggleOperationsFold("metrics")}
          aria-expanded={operationsFold.metrics}
        >
          <span>Indicadores clave</span>
          <span className="fold__chevron" aria-hidden="true">⌄</span>
        </button>
        {operationsFold.metrics && (
          <div className="fold__body">
            <div className="operations-grid">
              <article>
                <span>Pedidos totales</span>
                <strong>{operationsMetrics.totalOrders}</strong>
              </article>
              <article>
                <span>Pipeline pendiente</span>
                <strong>{operationsMetrics.pendingCount}</strong>
                <small>{formatCurrency(operationsMetrics.pendingValue)}</small>
              </article>
              <article>
                <span>Ingresos cerrados</span>
                <strong>{formatCurrency(operationsMetrics.revenueFulfilled)}</strong>
              </article>
              <article>
                <span>Ticket promedio</span>
                <strong>{formatCurrency(operationsMetrics.avgTicket)}</strong>
              </article>
              <article>
                <span>Completados hoy</span>
                <strong>{operationsMetrics.fulfilledToday}</strong>
                <small>{formatCurrency(operationsMetrics.fulfilledTodayValue)}</small>
              </article>
            </div>
          </div>
        )}
      </div>
      <div className="fold">
        <button
          type="button"
          className={`fold__head${operationsFold.backlog ? " is-open" : ""}`}
          onClick={() => toggleOperationsFold("backlog")}
          aria-expanded={operationsFold.backlog}
        >
          <span>Backlog y próximos pasos</span>
          <span className="fold__chevron" aria-hidden="true">⌄</span>
        </button>
        {operationsFold.backlog && (
          <div className="fold__body">
            <div className="operations-board">
              <div className="operations-card">
                <h3>Backlog operativo</h3>
                <ul>
                  <li>
                    <strong>Revisar pendientes</strong>
                    <span>{operationsMetrics.pendingCount} pedidos sin preparar.</span>
                  </li>
                  <li>
                    <strong>Control de cocina</strong>
                    <span>{operationsMetrics.preparingCount} pedidos en cocina.</span>
                  </li>
                  <li>
                    <strong>Listos para salida</strong>
                    <span>{operationsMetrics.confirmedCount} entregas para despachar.</span>
                  </li>
                </ul>
              </div>
              <div className="operations-card">
                <h3>Próximos pasos</h3>
                <ul>
                  <li>
                    <strong>Automatizar notificaciones</strong>
                    <span>Sincronizar envío de WhatsApp con cambio de estado.</span>
                  </li>
                  <li>
                    <strong>Balance semanal</strong>
                    <span>Exportar métricas de ventas y costos (pendiente backend).</span>
                  </li>
                  <li>
                    <strong>Stock crítico</strong>
                    <span>Agregar módulo de inventario (próxima iteración).</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  let sectionContent: JSX.Element;

  switch (activeSection) {
    case "orders":
      sectionContent = renderOrdersSection();
      break;
    case "clients":
      sectionContent = renderCustomersSection();
      break;
    case "discounts":
      sectionContent = renderDiscountsSection();
      break;
    case "codes":
      sectionContent = renderCodesSection();
      break;
    case "operations":
    default:
      sectionContent = renderOperationsSection();
      break;
  }

  return (
    <>
      <div className="admin-hub">
        <aside className={`admin-hub__sidebar${sidebarOpen ? " is-open" : ""}`}>
          <div className="admin-hub__brand">
            <span>🐔</span>
            <div>
              <strong>Pollos Tello’s</strong>
              <small>Control Center</small>
            </div>
          </div>
          <nav className="admin-hub__nav" aria-label="Secciones de administración">
            {SECTION_CONFIG.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`admin-hub__nav-item${activeSection === section.id ? " is-active" : ""}`}
                onClick={() => handleSectionChange(section.id)}
              >
                <strong>{section.label}</strong>
                <small>{section.description}</small>
              </button>
            ))}
          </nav>
          <footer className="admin-hub__sidebar-footer">
            <button type="button" className="btn-ghost btn-pill" onClick={logout}>
              Cerrar sesión
            </button>
            <small>v2 · Experiencia reconstruida</small>
          </footer>
        </aside>
        <div className="admin-hub__viewport">
          <header className="admin-hub__topbar">
            <button className="admin-hub__burger" type="button" onClick={toggleSidebar} aria-label="Alternar menú">
              ☰
            </button>
            <div>
              <span>{selectedSection.description}</span>
              <h1>{selectedSection.label}</h1>
            </div>
            <div className="admin-hub__user">
              <span>{user.displayName ?? user.email ?? "Admin"}</span>
              <small>Equipo Pollos Tello’s</small>
            </div>
          </header>
          <main className="admin-hub__content">{sectionContent}</main>
        </div>
      </div>
      <CancelOrderModal
        open={cancelModalOpen}
        loading={actionLoadingId !== null}
        onClose={() => {
          setCancelModalOpen(false);
          setCancelOrderId(null);
        }}
        onConfirm={handleConfirmCancelOrder}
      />
      {selectedCustomer && rewardModalOpen && (
        <div className="admin-modal" role="dialog" aria-modal="true">
          <div className="admin-modal__box">
            <header className="admin-modal__header">
              <div>
                <h3>Otorgar beneficio</h3>
                <p>{selectedCustomer.displayName ?? selectedCustomer.firstName ?? selectedCustomer.email}</p>
              </div>
              <button type="button" className="admin-modal__close" onClick={closeRewardModal} aria-label="Cerrar">
                ×
              </button>
            </header>
            <form className="admin-modal__body" onSubmit={handleGrantReward}>
              <p className="admin-modal__lead">Elegí el tipo de recompensa y completá los datos necesarios.</p>
              <div className="reward-kind reward-kind--stacked">
                <label>
                  <input
                    type="radio"
                    name="reward-kind"
                    value="discount"
                    checked={rewardKind === "discount"}
                    onChange={() => setRewardKind("discount")}
                  />
                  <span>Descuento ($)</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="reward-kind"
                    value="combo"
                    checked={rewardKind === "combo"}
                    onChange={() => setRewardKind("combo")}
                    disabled
                  />
                  <span>Combo de cortesía (próximamente)</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="reward-kind"
                    value="dessert"
                    checked={rewardKind === "dessert"}
                    onChange={() => setRewardKind("dessert")}
                    disabled
                  />
                  <span>Postre / extra (próximamente)</span>
                </label>
              </div>
              {rewardKind === "discount" && (
                <div className="reward-form">
                  <label>
                    <span>Monto</span>
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(event) => setDiscountValue(event.target.value)}
                      required
                      min={0}
                      max={2000}
                      step={50}
                    />
                  </label>
                  <label>
                    <span>Etiqueta</span>
                    <input
                      type="text"
                      value={rewardLabel}
                      onChange={(event) => setRewardLabel(event.target.value)}
                      placeholder="Motivo del beneficio"
                    />
                  </label>
                </div>
              )}
              <footer className="admin-modal__footer">
                <button type="button" className="btn-ghost btn-pill" onClick={closeRewardModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary btn-pill" disabled={grantingDiscount}>
                  {grantingDiscount ? "Asignando…" : "Guardar beneficio"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
      {selectedCustomer && codesModalOpen && (
        <div className="admin-modal" role="dialog" aria-modal="true">
          <div className="admin-modal__box">
            <header className="admin-modal__header">
              <div>
                <h3>Gestionar códigos</h3>
                <p>{selectedCustomer.displayName ?? selectedCustomer.firstName ?? selectedCustomer.email}</p>
              </div>
              <button type="button" className="admin-modal__close" onClick={closeCodesModal} aria-label="Cerrar">
                ×
              </button>
            </header>
            <div className="admin-modal__body">
              <p className="admin-modal__lead">
                Revisá los códigos activos para este cliente y generá nuevos con un click.
              </p>
              {customerCoupons.length === 0 ? (
                <p className="clients-placeholder">Todavía no generaste códigos para este cliente.</p>
              ) : (
                <ul className="list-compact">
                  {customerCoupons.map((coupon) => (
                    <li key={coupon.id}>
                      <div>
                        <strong>{coupon.code}</strong>
                        <span>{coupon.status}</span>
                      </div>
                      <div>
                        <span>Creado {formatOrderTimestamp(coupon.createdAt)}</span>
                        <button
                          type="button"
                          className="chip-action chip-action--neutral"
                          onClick={() => navigator.clipboard.writeText(coupon.code).catch(() => void 0)}
                        >
                          Copiar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <footer className="admin-modal__footer">
              <button type="button" className="btn-ghost btn-pill" onClick={closeCodesModal}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn-primary btn-pill"
                onClick={handleIssueCoupons}
                disabled={issuingCoupons}
              >
                {issuingCoupons ? "Generando…" : "Generar nuevos códigos"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
