/**
 * Onboarding screen: invita a registrarse o continuar como invitado antes de entrar al flujo in-app.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { CancelOrderModal } from "components/orders/CancelOrderModal";
import { api, type ApiOrder, type ApiOrderMessage } from "utils/api";
import { useUserDataLoader } from "hooks/useUserDataLoader";
import {
  buildProfileValues,
  mapOrderItemsToProducts,
  processDiscounts,
  type DiscountEntry,
  type DiscountSnapshot,
} from "utils/orders";
import { ADMIN_EMAIL } from "config/admin";

export function Home() {
  const { user, backendUserId, logout } = useAuth();
  const { addItem, clearCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginOpen, setLoginOpen] = useState(false);
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [ordersView, setOrdersView] = useState<"user" | "admin">("user");
  const [viewerOrders, setViewerOrders] = useState<ApiOrder[]>([]);
  const [pendingOrders, setPendingOrders] = useState<ApiOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<{ order: ApiOrder; messages: ApiOrderMessage[] } | null>(null);
  const [discountsModalOpen, setDiscountsModalOpen] = useState(false);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [discountsError, setDiscountsError] = useState<string | null>(null);
  const [activeDiscounts, setActiveDiscounts] = useState<DiscountSnapshot["active"]>([]);
  const [discountHistory, setDiscountHistory] = useState<DiscountSnapshot["history"]>([]);
  const [shareCoupons, setShareCoupons] = useState<DiscountSnapshot["shareCoupons"]>([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalRedemptions, setTotalRedemptions] = useState(0);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileValues, setProfileValues] = useState<ProfileFormValues | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const { ensureUserData } = useUserDataLoader(backendUserId);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);

  const handleReorder = useCallback(
    (order: ApiOrder) => {
      const matched = mapOrderItemsToProducts(order);

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
    [addItem, clearCart, navigate]
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
    () => (user?.email ? user.email.toLowerCase() === ADMIN_EMAIL : false),
    [user?.email]
  );

  const hasActiveOrder = useMemo(() => {
    if (!activeOrder) {
      return false;
    }
    return !["CANCELLED", "FULFILLED"].includes(activeOrder.order.status);
  }, [activeOrder]);

  useEffect(() => {
    if (isAdmin) {
      setOrdersView((current) => (current === "admin" ? current : "admin"));
    } else {
      setOrdersView("user");
    }
  }, [isAdmin]);

  const loadActiveOrder = useCallback(async () => {
    if (!backendUserId) {
      setActiveOrder(null);
      return;
    }
    try {
      const response = await api.getActiveOrder(backendUserId, 50);
      setActiveOrder(response);
    } catch (error) {
      console.error("No se pudo obtener el pedido activo", error);
    }
  }, [backendUserId]);

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
      await loadActiveOrder();
    } catch (error) {
      console.error("No se pudieron cargar los pedidos", error);
      setOrdersError("No pudimos cargar los pedidos. Intentalo de nuevo en unos segundos.");
    } finally {
      setOrdersLoading(false);
    }
  }, [backendUserId, isAdmin, loadActiveOrder]);

  useEffect(() => {
    if (ordersModalOpen) {
      loadOrders();
    }
  }, [ordersModalOpen, loadOrders]);

  useEffect(() => {
    loadActiveOrder();
  }, [loadActiveOrder]);

  useEffect(() => {
    if (isAdmin && user) {
      navigate("/admin", { replace: true });
    }
  }, [isAdmin, user, navigate]);

  useEffect(() => {
    const state = (location.state as { openOrders?: boolean } | null) ?? null;
    if (state?.openOrders) {
      setOrdersView("user");
      setOrdersModalOpen(true);
      loadOrders();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, loadOrders, navigate]);

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
        setShareCoupons(discountData.shareCoupons);
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
        setShareCoupons(discountData.shareCoupons);
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

  const handleShareCoupon = useCallback(
    async (coupon: DiscountSnapshot["shareCoupons"][number]) => {
      if (!backendUserId) {
        window.alert("Necesitás iniciar sesión para compartir tus códigos.");
        return;
      }

      const message = `🔥 Probá Pollos Tello's y conseguí descuentos para tu próximo pedido. Usá mi código ${coupon.code} en https://www.pollostellos.com.ar`; // simple share text
      const shareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

      window.open(shareUrl, "_blank", "noopener,noreferrer");

      try {
        await api.activateShareCoupon(backendUserId, coupon.code);
        await loadDiscounts(true);
      } catch (error) {
        console.error("No se pudo marcar el cupón como compartido", error);
      }
    },
    [backendUserId, loadDiscounts]
  );

  const handleSendOrderMessage = useCallback(
    async (orderId: string, message: string) => {
      const text = message.trim();
      if (!text) {
        return;
      }

      try {
        await api.createOrderMessage(orderId, text);
        await loadActiveOrder();
      } catch (error) {
        console.error("No se pudo enviar el mensaje del pedido", error);
        throw error;
      }
    },
    [loadActiveOrder]
  );

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

  const handleApplyDiscountFromModal = useCallback(
    (discount: DiscountEntry) => {
      try {
        window.sessionStorage.setItem("pt_checkout_discount", discount.code);
      } catch (error) {
        console.error("No se pudo persistir el código aplicado desde el modal", error);
      }
      setDiscountsModalOpen(false);
      navigate("/checkout");
    },
    [navigate]
  );

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

  const handleCloseCancelModal = () => {
    setCancelModalOpen(false);
    setCancelOrderId(null);
  };

  const handleRequestCancelOrder = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelModalOpen(true);
  };

  const handleConfirmCancelOrder = async (reason: string | null) => {
    if (!cancelOrderId) {
      setCancelModalOpen(false);
      return;
    }
    try {
      setOrdersLoading(true);
      await api.cancelOrder(cancelOrderId, reason ?? undefined);
      await loadOrders();
      setCancelModalOpen(false);
      setCancelOrderId(null);
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

  const handleOpenLogin = useCallback(() => {
    console.log("[Home] abrir login modal");
    setLoginOpen(true);
  }, []);

  return (
    <>
      <title>Pollos Tello's | Delivery de Alta Gastronomía en Zona Oeste</title>
      <meta
        name="description"
        content="Pedí online en Pollos Tello's. Disfrutá de nuestros combos premium con entrada, principal y postre. Entrega en menos de 45 minutos en Ciudadela, Villa Real, Versalles y más."
      />
      <div className="home-shell">
        <div className="home-notice" aria-label="Beneficios de los combos">
          <div className="home-notice__track" role="presentation">
            <span>TODOS NUESTROS COMBOS: ENTRADA · PRINCIPAL · POSTRE</span>
            <span>TODOS NUESTROS COMBOS: ENTRADA · PRINCIPAL · POSTRE</span>
            <span>TODOS NUESTROS COMBOS: ENTRADA · PRINCIPAL · POSTRE</span>
          </div>
        </div>

        <section className="card home-hero-card" aria-labelledby="home-hero-title">
          <header className="home-hero-card__header">
            <span className="home-hero-card__eyebrow">Delivery premium en el oeste</span>
            <h1 id="home-hero-title" className="home-hero-card__title">
              Delivery de Pollos a las Brasas
            </h1>
            <p className="home-hero-card__subtitle">Alta gastronomía sin espera</p>
          </header>

          <AccessActions
            user={user}
            onStartAsGuest={startAsGuest}
            onOpenLogin={handleOpenLogin}
            onLogout={logout}
            onGoToMenu={() => navigate("/menu")}
            onOpenOrders={() => handleOpenOrders("user")}
            onOpenAdmin={isAdmin ? () => handleOpenOrders("admin") : undefined}
            isAdmin={isAdmin}
            onOpenDiscounts={handleOpenDiscounts}
            onOpenProfile={handleOpenProfile}
            actionsDisabled={!backendUserId}
            hasActiveOrder={hasActiveOrder}
          />
        </section>

        <section className="card home-zone-card" aria-labelledby="home-zone-title">
          <header className="home-zone-card__header">
            <h2 id="home-zone-title">Zona de reparto</h2>
            <p className="home-zone-card__copy">Entregamos en menos de 45 minutos en los barrios destacados.</p>
          </header>
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
            <img src="/mapa.png" alt="Mapa de la zona de reparto de Pollos Tello's" draggable={false} />
            <div className="radar-overlay" aria-hidden="true" />
          </div>
        </section>
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
          onCancel={handleRequestCancelOrder}
          onReorder={handleReorder}
          onOpenAdminPanel={isAdmin ? () => navigate('/admin/pedidos') : undefined}
          activeOrder={activeOrder}
          onSendMessage={handleSendOrderMessage}
          onRefreshActive={loadActiveOrder}
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
          shareCoupons={shareCoupons}
          onShareCoupon={handleShareCoupon}
          onRefresh={() => loadDiscounts(true)}
          onApplyDiscount={handleApplyDiscountFromModal}
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
        <CancelOrderModal
          open={cancelModalOpen}
          loading={ordersLoading}
          onClose={handleCloseCancelModal}
          onConfirm={handleConfirmCancelOrder}
        />
      </div>
    </>
  );
}
