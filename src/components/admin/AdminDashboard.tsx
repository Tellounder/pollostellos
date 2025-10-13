import React, { useMemo } from "react";
import type { User } from "utils/firebase";
import type { ApiOrder } from "utils/api";
import { formatCurrency, formatOrderCode } from "utils/orders";

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isWithinDays = (input: Date, days: number) => {
  const now = Date.now();
  return now - input.getTime() <= days * 24 * 60 * 60 * 1000;
};

type AdminDashboardProps = {
  user: User;
  loading: boolean;
  error: string | null;
  pendingOrders: ApiOrder[];
  recentOrders: ApiOrder[];
  onRefresh: () => void;
  onPrepare?: (orderId: string) => void;
  onConfirm: (orderId: string) => void;
  onFulfill?: (orderId: string) => void;
  onCancel: (orderId: string) => void;
  onOpenOrdersModal: () => void;
  onOpenManageModal: () => void;
  onOpenDiscounts: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  loading,
  error,
  pendingOrders,
  recentOrders,
  onRefresh,
  onPrepare,
  onConfirm,
  onFulfill,
  onCancel,
  onOpenOrdersModal,
  onOpenManageModal,
  onOpenDiscounts,
  onOpenProfile,
  onLogout,
}) => {
  const stats = useMemo(() => {
    const now = new Date();
    let confirmedToday = 0;
    let revenueToday = 0;
    let confirmedWeek = 0;
    let revenueWeek = 0;

    const getAmount = (order: ApiOrder) => order.totalNet ?? order.totalGross ?? 0;

    recentOrders.forEach((order) => {
      const reference = order.confirmedAt ?? order.placedAt ?? order.createdAt;
      if (!reference) return;
      const date = new Date(reference);
      if (order.status === "CONFIRMED") {
        if (isSameDay(date, now)) {
          confirmedToday += 1;
          revenueToday += getAmount(order);
        }
        if (isWithinDays(date, 7)) {
          confirmedWeek += 1;
          revenueWeek += getAmount(order);
        }
      }
    });

    const pendingValue = pendingOrders.reduce((sum, order) => sum + getAmount(order), 0);

    const lastUpdate = recentOrders.reduce<Date | null>((latest, order) => {
      const reference = order.updatedAt ?? order.createdAt;
      if (!reference) return latest;
      const date = new Date(reference);
      if (!latest || date.getTime() > latest.getTime()) {
        return date;
      }
      return latest;
    }, null);

    return {
      pendingCount: pendingOrders.length,
      pendingValue,
      confirmedToday,
      revenueToday,
      confirmedWeek,
      revenueWeek,
      lastUpdate,
    };
  }, [pendingOrders, recentOrders]);

  const pendingList = pendingOrders.slice(0, 8);
  const recentActivity = recentOrders.slice(0, 6);

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <p className="admin-dashboard__eyebrow">Panel administrativo</p>
          <h1 className="admin-dashboard__title">Hola, {user.displayName ?? user.email ?? "admin"}</h1>
          <p className="admin-dashboard__subtitle">
            Resumen del negocio, pedidos en tiempo real y accesos a gestión avanzada.
          </p>
        </div>
        <div className="admin-dashboard__header-actions">
          <button type="button" className="btn-secondary" onClick={onRefresh} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
          <button type="button" className="btn-ghost" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      {error && <div className="admin-dashboard__alert">{error}</div>}

      <section className="admin-dashboard__stats">
        <article className="admin-stat">
          <span className="admin-stat__label">Pedidos pendientes</span>
          <strong className="admin-stat__value">{stats.pendingCount}</strong>
          <span className="admin-stat__meta">{formatCurrency(stats.pendingValue)}</span>
        </article>
        <article className="admin-stat">
          <span className="admin-stat__label">Confirmados hoy</span>
          <strong className="admin-stat__value">{stats.confirmedToday}</strong>
          <span className="admin-stat__meta">{formatCurrency(stats.revenueToday)}</span>
        </article>
        <article className="admin-stat">
          <span className="admin-stat__label">Semana actual</span>
          <strong className="admin-stat__value">{stats.confirmedWeek}</strong>
          <span className="admin-stat__meta">{formatCurrency(stats.revenueWeek)}</span>
        </article>
        <article className="admin-stat">
          <span className="admin-stat__label">Última actualización</span>
          <strong className="admin-stat__value">
            {stats.lastUpdate ? dayFormatter.format(stats.lastUpdate) : "Sin registros"}
          </strong>
          <span className="admin-stat__meta">Historial total: {recentOrders.length}</span>
        </article>
      </section>

      <section className="admin-dashboard__content">
        <div className="admin-dashboard__main">
          <div className="admin-card">
            <div className="admin-card__header">
              <h2>Pedidos pendientes</h2>
              <button type="button" className="btn-ghost btn-sm" onClick={onOpenManageModal}>
                Ver todo
              </button>
            </div>
            {loading ? (
              <div className="admin-card__empty" aria-busy="true">
                <div className="loader-ring loader-ring--sm">
                  <div></div>
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
                <span>Cargando pedidos…</span>
              </div>
            ) : pendingList.length === 0 ? (
              <div className="admin-card__empty">
                <p>No hay pedidos pendientes. Todo al día.</p>
              </div>
            ) : (
              <ul className="admin-orders">
                {pendingList.map((order) => {
                  const total = formatCurrency(order.totalNet ?? order.totalGross ?? 0);
                  const customer = order.metadata?.customer?.name ?? "Sin identificar";
                  const placedAt = order.placedAt ?? order.createdAt;
                  const address = order.metadata?.delivery?.addressLine ?? "Retira en local";
                  return (
                    <li key={order.id} className="admin-orders__item">
                      <div className="admin-orders__summary">
                        <div>
                          <span className="admin-orders__code">#{formatOrderCode(order.number)}</span>
                          <strong className="admin-orders__customer">{customer}</strong>
                        </div>
                        <span className="admin-orders__total">{total}</span>
                      </div>
                      <div className="admin-orders__meta">
                        <span>{dateTimeFormatter.format(new Date(placedAt))}</span>
                        <span>{address}</span>
                        {order.metadata?.items && (
                          <span>{order.metadata.items.length} ítems</span>
                        )}
                      </div>
                      <div className="admin-orders__actions">
                        {onPrepare && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => onPrepare(order.id)}
                          >
                            Preparar
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={() => onConfirm(order.id)}
                        >
                          Confirmar
                        </button>
                        {onFulfill && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => onFulfill(order.id)}
                          >
                            Completar
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => onCancel(order.id)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="admin-card">
            <div className="admin-card__header">
              <h2>Actividad reciente</h2>
              <button type="button" className="btn-ghost btn-sm" onClick={onOpenOrdersModal}>
                Historial de clientes
              </button>
            </div>
            {recentActivity.length === 0 ? (
              <div className="admin-card__empty">
                <p>Sin actividad registrada todavía.</p>
              </div>
            ) : (
              <ul className="admin-activity">
                {recentActivity.map((order) => {
                  const statusClass = `admin-activity__status admin-activity__status--${order.status.toLowerCase()}`;
                  const marker = order.confirmedAt ?? order.cancelledAt ?? order.placedAt ?? order.createdAt;
                  const label = order.metadata?.customer?.name ?? "Cliente anónimo";
                  return (
                    <li key={order.id} className="admin-activity__item">
                      <div>
                        <span className="admin-activity__code">#{formatOrderCode(order.number)}</span>
                        <strong>{label}</strong>
                        <span className="admin-activity__date">{marker ? dayFormatter.format(new Date(marker)) : ""}</span>
                      </div>
                      <div className="admin-activity__aside">
                        <span className={statusClass}>{order.status}</span>
                        <span>{formatCurrency(order.totalNet ?? order.totalGross ?? 0)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <aside className="admin-dashboard__aside">
          <div className="admin-card admin-card--actions">
            <div className="admin-card__header">
              <h2>Accesos rápidos</h2>
            </div>
            <div className="admin-quick-actions">
              <button type="button" className="btn-secondary" onClick={onOpenManageModal}>
                Gestionar pedidos
              </button>
              <button type="button" className="btn-secondary" onClick={onOpenDiscounts}>
                Descuentos de clientes
              </button>
              <button type="button" className="btn-secondary" onClick={onOpenProfile}>
                Datos del negocio
              </button>
              <button type="button" className="btn-ghost" onClick={onOpenOrdersModal}>
                Ver pedidos como cliente
              </button>
            </div>
          </div>
          <div className="admin-card admin-card--notes">
            <div className="admin-card__header">
              <h2>Notas operativas</h2>
            </div>
            <ul className="admin-notes">
              <li>Revisá los pedidos confirmados antes de finalizar el día.</li>
              <li>Actualizá los descuentos promocionales cada semana.</li>
              <li>Registrá comentarios importantes en el perfil del cliente.</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
};
