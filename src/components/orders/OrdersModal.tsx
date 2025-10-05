import React from "react";
import { OverlayPortal } from "components/common/OverlayPortal";
import type { ApiOrder } from "utils/api";

type OrdersModalProps = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error?: string | null;
  viewerOrders: ApiOrder[];
  pendingOrders: ApiOrder[];
  isAdmin: boolean;
  activeView: "user" | "admin";
  onViewChange: (view: "user" | "admin") => void;
  onRefresh: () => void;
  onConfirm: (orderId: string) => void;
  onCancel: (orderId: string) => void;
  onReorder: (order: ApiOrder) => void;
};

const statusLabels: Record<ApiOrder["status"], string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  FULFILLED: "Entregado",
};

const canReorder = (order: ApiOrder) => {
  if (order.status !== "CONFIRMED" && order.status !== "FULFILLED") {
    return false;
  }
  if (!order.metadata?.items || order.metadata.items.length === 0) {
    return false;
  }
  return order.metadata.items.every((item) => Boolean(item.productId) && item.quantity > 0);
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

const formatOrderCode = (orderNumber: number) => `PT-${orderNumber.toString().padStart(5, "0")}`;

export const OrdersModal: React.FC<OrdersModalProps> = ({
  open,
  onClose,
  loading,
  error,
  viewerOrders,
  pendingOrders,
  isAdmin,
  activeView,
  onViewChange,
  onRefresh,
  onConfirm,
  onCancel,
  onReorder,
}) => {
  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const showAdminSection = isAdmin && activeView === "admin";

  const viewerContent = (
    <section className="orders-section" aria-label="Pedidos recientes">
      <div className="orders-section__header">
        <h3>Pedidos recientes</h3>
        <button className="btn-ghost btn-sm" type="button" onClick={onRefresh}>
          Actualizar
        </button>
      </div>
      {viewerOrders.length === 0 ? (
        <p className="orders-empty">Todavía no registramos pedidos confirmados.</p>
      ) : (
        <ul className="orders-list">
          {viewerOrders.map((order) => (
            <li key={order.id} className="orders-item">
              <OrderHeader order={order} />
              <OrderDetails order={order} />
              <div className="orders-user-actions">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => onReorder(order)}
                  disabled={!canReorder(order)}
                >
                  Repetir pedido
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const adminContent = showAdminSection ? (
    <section className="orders-section" aria-label="Pedidos pendientes de confirmación">
      <div className="orders-section__header">
        <h3>Pendientes de confirmación</h3>
        <button className="btn-ghost btn-sm" type="button" onClick={onRefresh}>
          Actualizar
        </button>
      </div>
      {pendingOrders.length === 0 ? (
        <p className="orders-empty">No hay pedidos pendientes.</p>
      ) : (
        <ul className="orders-list orders-list--admin">
          {pendingOrders.map((order) => (
            <li key={order.id} className="orders-item orders-item--admin">
              <OrderHeader order={order} />
              <OrderDetails order={order} />
              <div className="orders-admin-actions">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => onConfirm(order.id)}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => onCancel(order.id)}
                >
                  Cancelar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  ) : null;

  return (
    <OverlayPortal>
      <div className="orders-overlay" role="dialog" aria-modal="true" aria-label="Historial de pedidos">
        <div className="orders-modal">
          <header className="orders-modal__header">
            <div>
              <h2>Mis pedidos</h2>
              <p className="orders-modal__subtitle">
                Seguimos tus pedidos y te avisamos cuando cada uno esté confirmado.
              </p>
            </div>
            <button className="orders-close" type="button" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </header>

          {isAdmin && (
            <div className="orders-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeView === "user"}
                className={`orders-tab${activeView === "user" ? " is-active" : ""}`}
                onClick={() => onViewChange("user")}
              >
                Tus pedidos
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeView === "admin"}
                className={`orders-tab${activeView === "admin" ? " is-active" : ""}`}
                onClick={() => onViewChange("admin")}
              >
                Gestionar pedidos
              </button>
            </div>
          )}

          {error && <p className="orders-error">{error}</p>}

          {loading ? (
            <div className="orders-loading" aria-busy="true">
              <div className="loader-ring loader-ring--sm">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <span>Cargando pedidos...</span>
            </div>
          ) : (
            <div className="orders-content">
              {viewerContent}
              {adminContent}
            </div>
          )}

          <footer className="orders-modal__footer">
            <button className="btn-primary" type="button" onClick={onClose}>
              Cerrar
            </button>
          </footer>
        </div>
      </div>
    </OverlayPortal>
  );
};

const OrderHeader: React.FC<{ order: ApiOrder }> = ({ order }) => {
  const code = formatOrderCode(order.number);
  const statusLabel = statusLabels[order.status] ?? order.status;
  const statusClass = `orders-status orders-status--${order.status.toLowerCase()}`;
  const placedAt = order.placedAt ?? order.createdAt;

  return (
    <div className="orders-item__header">
      <div>
        <span className="orders-code">#{code}</span>
        <span className="orders-date">{dateFormatter.format(new Date(placedAt))}</span>
      </div>
      <span className={statusClass}>{statusLabel}</span>
    </div>
  );
};

const OrderDetails: React.FC<{ order: ApiOrder }> = ({ order }) => {
  const meta = order.metadata;
  const items = meta?.items ?? [];
  const customerName = meta?.customer?.name ?? "";
  const address = meta?.delivery?.addressLine ?? "";
  const payment = meta?.paymentMethod ?? order.note ?? "";

  return (
    <div className="orders-item__body">
      <div className="orders-item__summary">
        <dl>
          {customerName && (
            <div>
              <dt>Cliente</dt>
              <dd>{customerName}</dd>
            </div>
          )}
          {address && (
            <div>
              <dt>Entrega</dt>
              <dd>{address}</dd>
            </div>
          )}
          {payment && (
            <div>
              <dt>Pago</dt>
              <dd>{payment}</dd>
            </div>
          )}
          <div>
            <dt>Total</dt>
            <dd>{currencyFormatter.format(order.totalNet ?? order.totalGross)}</dd>
          </div>
        </dl>
      </div>
      {items.length > 0 && (
        <ul className="orders-item__products">
          {items.map((item, index) => (
            <li key={`${order.id}-${index}`}>
              <span className="orders-item__product-label">{item.label}</span>
              <span className="orders-item__product-meta">
                x{item.quantity} — {currencyFormatter.format(item.lineTotal)}
                {item.side ? ` · ${item.side}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
