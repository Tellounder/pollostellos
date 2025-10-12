import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminDashboard } from "components/admin/AdminDashboard";
import { OrdersModal } from "components/orders/OrdersModal";
import { CancelOrderModal } from "components/orders/CancelOrderModal";
import { DiscountsModal } from "components/discounts/DiscountsModal";
import {
  ProfileModal,
  type ProfileFormValues,
  type ProfileStats,
} from "components/profile/ProfileModal";
import { useAuth } from "hooks/useAuth";
import { useCart } from "hooks/useCart";
import { api, type ApiOrder } from "utils/api";
import { useUserDataLoader } from "hooks/useUserDataLoader";
import {
  buildProfileValues,
  mapOrderItemsToProducts,
  processDiscounts,
  type DiscountSnapshot,
} from "utils/orders";

export function AdminPanel() {
  const { user, backendUserId, logout } = useAuth();
  const { addItem, clearCart } = useCart();
  const navigate = useNavigate();

  const [pendingOrders, setPendingOrders] = useState<ApiOrder[]>([]);
  const [recentOrders, setRecentOrders] = useState<ApiOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [ordersView, setOrdersView] = useState<"user" | "admin">("admin");
  const [viewerOrders, setViewerOrders] = useState<ApiOrder[]>([]);

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
      navigate("/checkout");
    },
    [addItem, clearCart, navigate]
  );

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const pendingPromise = api.listOrders({ status: "PENDING", take: 50 });
      const recentPromise = api.listOrders({ take: 25 });
      const viewerOrdersPromise = backendUserId ? api.getUserOrders(backendUserId, 10) : Promise.resolve([]);

      const [pending, recent, viewer] = await Promise.all([
        pendingPromise,
        recentPromise,
        viewerOrdersPromise,
      ]);

      setPendingOrders(pending.items);
      setRecentOrders(recent.items);
      setViewerOrders(viewer);
      setOrdersError(null);
    } catch (error) {
      console.error("No se pudieron cargar los pedidos", error);
      setOrdersError("No pudimos cargar los pedidos. Intentalo de nuevo en unos segundos.");
    } finally {
      setOrdersLoading(false);
    }
  }, [backendUserId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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
        setDiscountsError("No pudimos cargar los descuentos.");
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
        setProfileValues(profileForm);
        const discountData = processDiscounts(data.detail);
        setActiveDiscounts(discountData.active);
        setDiscountHistory(discountData.history);
        setShareCoupons(discountData.shareCoupons);
        setTotalSavings(discountData.totalSavings);
        setTotalRedemptions(discountData.totalRedemptions);
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

  const handleShareCoupon = useCallback(
    async (coupon: DiscountSnapshot["shareCoupons"][number]) => {
      if (!backendUserId) {
        return;
      }

      const message = `🔥 Compartí Pollos Tello's: usá el código ${coupon.code} y disfrutá combos con descuento en https://www.pollostellos.com.ar`;
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

  const handleOpenOrdersModal = (view: "user" | "admin") => {
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

  const handleCloseCancelModal = () => {
    setCancelModalOpen(false);
    setCancelOrderId(null);
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

  if (!user) {
    return null;
  }

  return (
    <>
      <AdminDashboard
        user={user}
        loading={ordersLoading}
        error={ordersError}
        pendingOrders={pendingOrders}
        recentOrders={recentOrders}
        onRefresh={loadOrders}
        onConfirm={handleConfirmOrder}
        onCancel={handleRequestCancelOrder}
        onOpenOrdersModal={() => handleOpenOrdersModal("user")}
        onOpenManageModal={() => handleOpenOrdersModal("admin")}
        onOpenDiscounts={handleOpenDiscounts}
        onOpenProfile={handleOpenProfile}
        onLogout={logout}
      />
      <OrdersModal
        open={ordersModalOpen}
        onClose={handleCloseOrders}
        loading={ordersLoading}
        error={ordersError}
        viewerOrders={viewerOrders}
        pendingOrders={pendingOrders}
        isAdmin
        activeView={ordersView}
        onViewChange={(view) => setOrdersView(view)}
        onRefresh={loadOrders}
        onConfirm={handleConfirmOrder}
        onCancel={handleRequestCancelOrder}
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
        shareCoupons={shareCoupons}
        onShareCoupon={handleShareCoupon}
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
      <CancelOrderModal
        open={cancelModalOpen}
        loading={ordersLoading}
        onClose={handleCloseCancelModal}
        onConfirm={handleConfirmCancelOrder}
      />
    </>
  );
}
