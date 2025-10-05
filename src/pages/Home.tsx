/**
 * Onboarding screen: invita a registrarse o continuar como invitado antes de entrar al flujo in-app.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "hooks/useAuth";
import { useCart } from "hooks/useCart";
import { LoginModal } from "components/layout/LoginModal";
import { AccessActions } from "components/auth/AccessActions";
import { OrdersModal } from "components/orders/OrdersModal";
import { DiscountsModal } from "components/discounts/DiscountsModal";
import {
  ProfileModal,
  type ProfileFormValues,
  type ProfileStats,
} from "components/profile/ProfileModal";
import {
  api,
  type ApiOrder,
  type ApiUserDetail,
  type ApiUserEngagement,
} from "utils/api";
import { COMBOS, EXTRAS, INDIVIDUALES } from "utils/constants";

type ActiveDiscount = {
  id: string;
  code: string;
  label: string;
  value: string;
  percentage?: string | null;
  expiresAt?: string | null;
  usesRemaining: number;
  totalUses: number;
};

type DiscountHistoryItem = {
  id: string;
  code: string;
  valueApplied: number;
  redeemedAt: string;
  orderCode?: string;
};

export function Home() {
  const { user, backendUserId, logout } = useAuth();
  const { addItem, clearCart } = useCart();
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [ordersView, setOrdersView] = useState<"user" | "admin">("user");
  const [viewerOrders, setViewerOrders] = useState<ApiOrder[]>([]);
  const [pendingOrders, setPendingOrders] = useState<ApiOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [discountsModalOpen, setDiscountsModalOpen] = useState(false);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [discountsError, setDiscountsError] = useState<string | null>(null);
  const [activeDiscounts, setActiveDiscounts] = useState<ActiveDiscount[]>([]);
  const [discountHistory, setDiscountHistory] = useState<DiscountHistoryItem[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalRedemptions, setTotalRedemptions] = useState(0);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileValues, setProfileValues] = useState<ProfileFormValues | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [cachedDetail, setCachedDetail] = useState<ApiUserDetail | null>(null);
  const [cachedEngagement, setCachedEngagement] = useState<ApiUserEngagement | null>(null);

  const formatOrderCode = useCallback((orderNumber: number) => `PT-${orderNumber.toString().padStart(5, "0")}`, []);

  const ensureUserData = useCallback(
    async (force = false) => {
      if (!backendUserId) return null;
      if (!force && cachedDetail && cachedEngagement) {
        return { detail: cachedDetail, engagement: cachedEngagement };
      }
      const [detail, engagement] = await Promise.all([
        api.getUserDetail(backendUserId),
        api.getUserEngagement(backendUserId),
      ]);
      setCachedDetail(detail);
      setCachedEngagement(engagement);
      return { detail, engagement };
    },
    [backendUserId, cachedDetail, cachedEngagement]
  );

  const processDiscounts = useCallback((detail: ApiUserDetail) => {
    const now = Date.now();
    const active = detail.discountCodesOwned.reduce<ActiveDiscount[]>((acc, code) => {
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

    const history: DiscountHistoryItem[] = detail.discountRedemptions
      .map((entry) => ({
        id: entry.id,
        code: entry.code?.code ?? entry.codeId,
        valueApplied: parseFloat(entry.valueApplied ?? "0"),
        redeemedAt: entry.redeemedAt,
        orderCode: entry.order ? formatOrderCode(entry.order.number) : undefined,
      }))
      .sort((a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime());

    const totalSavings = history.reduce((sum, item) => sum + item.valueApplied, 0);

    return { active, history, totalSavings, totalRedemptions: history.length };
  }, []);

  const findProductById = useCallback((productId: string) => {
    const numericId = Number(productId);
    if (!Number.isNaN(numericId)) {
      return (
        COMBOS.find((combo) => combo.id === numericId) ??
        INDIVIDUALES.find((combo) => combo.id === numericId)
      );
    }
    return EXTRAS.find((extra) => String(extra.id) === productId);
  }, []);

  const buildProfileValues = useCallback((detail: ApiUserDetail): ProfileFormValues => {
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
  }, []);

  const handleReorder = useCallback(
    (order: ApiOrder) => {
      const items = order.metadata?.items ?? [];
      if (items.length === 0) {
        setOrdersError("No pudimos repetir este pedido porque falta la información original.");
        return;
      }

      const matched = items.reduce<
        Array<{ product: NonNullable<ReturnType<typeof findProductById>>; quantity: number; side?: string }>
      >((acc, item) => {
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

      if (matched.length === 0) {
        setOrdersError("Algunos productos ya no están disponibles para repetir este pedido.");
        return;
      }

      clearCart();
      matched.forEach(({ product, quantity, side }) => {
        addItem(product, quantity, side);
      });
      setOrdersModalOpen(false);
      navigate("/checkout");
    },
    [addItem, clearCart, findProductById, navigate]
  );

  const startAsGuest = () => {
    try {
      sessionStorage.setItem("pt_guest", "true");
      sessionStorage.setItem("pt_greet_shown", "true");
    } catch (e) {
      console.error(e);
    }
    navigate("/menu");
  };

  const isAdmin = useMemo(
    () => (user?.email ? user.email.toLowerCase() === "pollostellos.arg@gmail.com" : false),
    [user?.email]
  );

  useEffect(() => {
    if (isAdmin) {
      setOrdersView((current) => (current === "admin" ? current : "admin"));
    } else {
      setOrdersView("user");
    }
  }, [isAdmin]);

  const loadOrders = useCallback(async () => {
    if (!backendUserId && !isAdmin) {
      return;
    }
    setOrdersLoading(true);
    try {
      const userOrdersPromise = backendUserId ? api.getUserOrders(backendUserId, 10) : Promise.resolve([]);
      const adminOrdersPromise = isAdmin ? api.listOrders({ status: "PENDING", take: 50 }) : Promise.resolve(null);

      const [userOrders, adminOrders] = await Promise.all([userOrdersPromise, adminOrdersPromise]);

      setViewerOrders(userOrders);
      if (isAdmin && adminOrders) {
        setPendingOrders(adminOrders.items);
      } else {
        setPendingOrders([]);
      }
      setOrdersError(null);
    } catch (error) {
      console.error("No se pudieron cargar los pedidos", error);
      setOrdersError("No pudimos cargar los pedidos. Intentalo de nuevo en unos segundos.");
    } finally {
      setOrdersLoading(false);
    }
  }, [backendUserId, isAdmin]);

  useEffect(() => {
    if (ordersModalOpen) {
      loadOrders();
    }
  }, [ordersModalOpen, loadOrders]);

  const loadDiscounts = useCallback(
    async (force = false) => {
      if (!backendUserId) {
        setDiscountsError("Necesitás iniciar sesión para ver tus descuentos.");
        return;
      }
      setDiscountsLoading(true);
      try {
        const data = await ensureUserData(force);
        if (!data) {
          throw new Error("Sin datos");
        }
        const discountData = processDiscounts(data.detail);
        setActiveDiscounts(discountData.active);
        setDiscountHistory(discountData.history);
        setTotalSavings(discountData.totalSavings);
        setTotalRedemptions(discountData.totalRedemptions);
        setDiscountsError(null);
      } catch (error) {
        console.error("No se pudieron cargar los descuentos", error);
        setDiscountsError("No pudimos cargar tus descuentos. Probá nuevamente en unos segundos.");
      } finally {
        setDiscountsLoading(false);
      }
    },
    [backendUserId, ensureUserData, processDiscounts]
  );

  const loadProfile = useCallback(
    async (force = false) => {
      if (!backendUserId) {
        setProfileError("Necesitás iniciar sesión para editar tu perfil.");
        return;
      }
      setProfileLoading(true);
      try {
        const data = await ensureUserData(force);
        if (!data) {
          throw new Error("Sin datos");
        }
        const profileForm = buildProfileValues(data.detail);
        const discountData = processDiscounts(data.detail);
        setActiveDiscounts(discountData.active);
        setDiscountHistory(discountData.history);
        setTotalSavings(discountData.totalSavings);
        setTotalRedemptions(discountData.totalRedemptions);
        setProfileValues(profileForm);
        const lifetimeNet = parseFloat(data.engagement.lifetimeNetSales ?? "0");
        setProfileStats({
          monthlyOrders: data.engagement.monthlyOrders,
          lifetimeOrders: data.engagement.lifetimeOrders,
          lifetimeNetSales: Number.isNaN(lifetimeNet) ? 0 : lifetimeNet,
          discountUsage: discountData.totalSavings,
          qualifiesForBonus: data.engagement.qualifiesForBonus,
        });
        setProfileError(null);
      } catch (error) {
        console.error("No se pudo cargar el perfil", error);
        setProfileError("No pudimos cargar tu perfil. Reintentá en un momento.");
      } finally {
        setProfileLoading(false);
      }
    },
    [backendUserId, ensureUserData, buildProfileValues, processDiscounts]
  );

  const handleOpenOrders = (view: "user" | "admin" = "user") => {
    setOrdersView(view);
    setOrdersModalOpen(true);
  };

  const handleCloseOrders = () => {
    setOrdersModalOpen(false);
  };

  const handleConfirmOrder = async (orderId: string) => {
    try {
      setOrdersLoading(true);
      await api.confirmOrder(orderId);
      await loadOrders();
    } catch (error) {
      console.error("No se pudo confirmar el pedido", error);
      setOrdersError("No pudimos confirmar el pedido. Reintentá en un momento.");
      setOrdersLoading(false);
    }
  };

  const handleOpenDiscounts = () => {
    setDiscountsModalOpen(true);
    loadDiscounts();
  };

  const handleCloseDiscounts = () => {
    setDiscountsModalOpen(false);
  };

  const handleOpenProfile = () => {
    setProfileSuccess(null);
    setProfileError(null);
    setProfileValues(null);
    setProfileModalOpen(true);
    loadProfile();
  };

  const handleCloseProfile = () => {
    setProfileModalOpen(false);
    setProfileError(null);
    setProfileSuccess(null);
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = window.prompt("¿Querés agregar un motivo?", "");
    if (reason === null) {
      return;
    }
    try {
      setOrdersLoading(true);
      await api.cancelOrder(orderId, reason?.trim() ? reason.trim() : undefined);
      await loadOrders();
    } catch (error) {
      console.error("No se pudo cancelar el pedido", error);
      setOrdersError("No pudimos cancelar el pedido. Probá nuevamente.");
      setOrdersLoading(false);
    }
  };

  const handleSaveProfile = async (values: ProfileFormValues) => {
    if (!backendUserId) {
      setProfileError("No encontramos tu usuario. Volvé a iniciar sesión.");
      return;
    }
    setProfileSaving(true);
    setProfileSuccess(null);
    try {
      await api.updateUserProfile(backendUserId, {
        firstName: values.firstName.trim() || undefined,
        lastName: values.lastName.trim() || undefined,
        displayName: values.displayName.trim() || undefined,
        phone: values.phone.trim() || undefined,
        address: values.addressLine.trim()
          ? {
              line1: values.addressLine.trim(),
              label: "Entrega",
              notes: values.addressNotes.trim() ? values.addressNotes.trim() : undefined,
            }
          : undefined,
      });
      await loadProfile(true);
      setProfileSuccess("Guardamos tus datos correctamente.");
    } catch (error) {
      console.error("No se pudo guardar el perfil", error);
      setProfileError("No pudimos guardar los cambios. Reintentá en unos segundos.");
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="grid" style={{ maxWidth: 560, margin: "24px auto", justifyItems: "center" }}>
      <div className="home-casino-banner" aria-label="Beneficios de los combos">
        
        
        <div className="home-casino-banner__inner">
          <div className="home-casino-banner__track" role="presentation">
            <span>TODOS NUESTROS COMBOS INCLUYEN ENTRADA · PRINCIPAL · POSTRE</span>
            <span>TODOS NUESTROS COMBOS INCLUYEN ENTRADA · PRINCIPAL · POSTRE</span>
            <span>TODOS NUESTROS COMBOS INCLUYEN ENTRADA · PRINCIPAL · POSTRE</span>
          </div>
        </div>
      </div>
      <div className="card center auth-card home-hero">
        <h1 className="home-hero__title">
          <span className="home-hero__icon" aria-hidden>
            🍗
          </span>
          <span>NUEVO PEDIDO</span>
        </h1>
        <p className="small home-hero__subtitle">Alta gastronomía sin espera</p>

        <AccessActions
          user={user}
          onStartAsGuest={startAsGuest}
          onOpenLogin={() => setLoginOpen(true)}
          onLogout={logout}
          onGoToMenu={() => navigate("/menu")}
          onOpenOrders={() => handleOpenOrders("user")}
          onOpenAdmin={isAdmin ? () => handleOpenOrders("admin") : undefined}
          isAdmin={isAdmin}
          onOpenDiscounts={handleOpenDiscounts}
          onOpenProfile={handleOpenProfile}
          actionsDisabled={!backendUserId}
        />
      </div>
      <div className="card center auth-card" style={{ padding: "24px 20px" }}>
        <h2>Zona de reparto</h2>
        <div className="zone-marquee" aria-label="Zonas disponibles">
          <div className="zone-marquee__track" aria-hidden>
            <span className="zone-marquee__item">CIUDADELA</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">VILLA REAL</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">VERSALLES</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">VILLA RAFFO</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">CASEROS</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">CIUDADELA</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">VILLA REAL</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">VERSALLES</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">VILLA RAFFO</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">CASEROS</span>
          </div>
        </div>
        <div className="map-container" aria-label="Cobertura de reparto">
          <iframe
            title="Zona de reparto Pollos Tello's"
            src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d10647.59322850008!2d-58.53262697618754!3d-34.62290339114094!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1ses-419!2sar!4v1758408103462!5m2!1ses-419!2sar"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <div className="radar-overlay" aria-hidden="true"></div>
        </div>
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <OrdersModal
        open={ordersModalOpen}
        onClose={handleCloseOrders}
        loading={ordersLoading}
        error={ordersError}
        viewerOrders={viewerOrders}
        pendingOrders={pendingOrders}
        isAdmin={isAdmin}
        activeView={isAdmin ? ordersView : "user"}
        onViewChange={(view) => setOrdersView(view)}
        onRefresh={loadOrders}
        onConfirm={handleConfirmOrder}
        onCancel={handleCancelOrder}
        onReorder={handleReorder}
      />
      <DiscountsModal
        open={discountsModalOpen}
        onClose={handleCloseDiscounts}
        loading={discountsLoading}
        error={discountsError}
        totalSavings={totalSavings}
        totalRedemptions={totalRedemptions}
        activeDiscounts={activeDiscounts}
        history={discountHistory}
        onRefresh={() => loadDiscounts(true)}
      />
      <ProfileModal
        open={profileModalOpen}
        onClose={handleCloseProfile}
        loading={profileLoading}
        saving={profileSaving}
        error={profileError}
        success={profileSuccess}
        initialValues={profileValues}
        stats={profileStats}
        onSubmit={handleSaveProfile}
      />
    </div>
  );
}
