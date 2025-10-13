import React from "react";
import { OverlayPortal } from "components/common/OverlayPortal";
import type { ApiOrder, ApiOrderMessage, OrderStatus } from "utils/api";
import { canReorder, formatOrderCode } from "utils/orders";

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
  onPrepare?: (orderId: string) => void;
  onFulfill?: (orderId: string) => void;
  onOpenAdminPanel?: () => void;
  activeOrder?: { order: ApiOrder; messages: ApiOrderMessage[] } | null;
  onSendMessage?: (orderId: string, message: string) => Promise<void>;
  onRefreshActive?: () => void;
};

const statusLabels: Record<ApiOrder["status"], string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  PREPARING: "En preparación",
  CONFIRMED: "En camino",
  CANCELLED: "Cancelado",
  FULFILLED: "Completado",
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

const ACTIVE_TIMELINE_ORDER: OrderStatus[] = ["PENDING", "PREPARING", "CONFIRMED", "FULFILLED"];

type TimelineStepConfig = {
  status: OrderStatus;
  title: string;
  description: string;
};

const TIMELINE_STEPS: TimelineStepConfig[] = [
  {
    status: "PENDING",
    title: "Pendiente",
    description: "Estamos validando tu pedido.",
  },
  {
    status: "PREPARING",
    title: "En preparación",
    description: "Estamos preparando tus pollos a las brasas.",
  },
  {
    status: "CONFIRMED",
    title: "En camino",
    description: "Coordinamos la entrega. Aguardá unos minutos.",
  },
  {
    status: "FULFILLED",
    title: "Completado",
    description: "El pedido fue entregado y quedó registrado.",
  },
];

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
  onPrepare,
  onFulfill,
  onOpenAdminPanel,
  activeOrder,
  onSendMessage,
  onRefreshActive,
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
  const activeContent = activeOrder ? (
    <ActiveOrderPanel
      data={activeOrder}
      onSendMessage={onSendMessage}
      onRefresh={onRefreshActive ?? onRefresh}
    />
  ) : null;

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
              <article className="orders-card orders-card--history">
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
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const adminContent = showAdminSection ? (
    <section className="orders-section" aria-label="Gestionar pedidos">
      <div className="orders-section__header">
        <h3>Gestionar pedidos</h3>
        <button className="btn-ghost btn-sm" type="button" onClick={onRefresh}>
          Actualizar
        </button>
      </div>
      {pendingOrders.length === 0 ? (
        <p className="orders-empty">No hay pedidos pendientes por gestionar.</p>
      ) : (
        <ul className="orders-list orders-list--admin">
          {pendingOrders.map((order) => {
            const adminActions: Array<{ key: string; label: string; variant: "primary" | "secondary" | "ghost"; onClick: () => void }> = [];
            if (onPrepare) {
              adminActions.push({ key: "prepare", label: "Preparar", variant: "secondary", onClick: () => onPrepare(order.id) });
            }
            adminActions.push({ key: "confirm", label: "Confirmar", variant: "primary", onClick: () => onConfirm(order.id) });
            if (onFulfill) {
              adminActions.push({ key: "fulfill", label: "Completar", variant: "secondary", onClick: () => onFulfill(order.id) });
            }
            adminActions.push({ key: "cancel", label: "Cancelar", variant: "ghost", onClick: () => onCancel(order.id) });

            return (
              <li key={order.id} className="orders-item orders-item--admin">
                <article className="orders-card">
                  <OrderHeader order={order} />
                  <OrderDetails order={order} />
                  <div className="orders-admin-actions">
                    {adminActions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        className={`btn-${action.variant} btn-sm`}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      {onOpenAdminPanel && (
        <div className="orders-admin-cta">
          <button type="button" className="btn-primary btn-sm" onClick={onOpenAdminPanel}>
            Ver más en /admin
          </button>
        </div>
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
            <div className={`orders-layout${activeContent ? " orders-layout--with-active" : ""}`}>
              {activeContent && <aside className="orders-layout__aside">{activeContent}</aside>}
              <div className="orders-layout__main">
                {viewerContent}
                {adminContent}
              </div>
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

type ActiveOrderPanelProps = {
  data: { order: ApiOrder; messages: ApiOrderMessage[] };
  onSendMessage?: (orderId: string, message: string) => Promise<void>;
  onRefresh?: () => void;
};

const ActiveOrderPanel: React.FC<ActiveOrderPanelProps> = ({ data, onSendMessage, onRefresh }) => {
  const { order, messages } = data;
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const isCancelled = order.status === "CANCELLED";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onSendMessage) {
      return;
    }
    const text = message.trim();
    if (!text) {
      return;
    }
    try {
      setSending(true);
      await onSendMessage(order.id, text);
      setMessage("");
    } catch (error) {
      console.error("No se pudo enviar el mensaje del pedido", error);
    } finally {
      setSending(false);
    }
  };

  const statusState = resolveTimelineState(order.status);
  const timeline = TIMELINE_STEPS.map((step) => ({
    ...step,
    state: statusState(step.status),
  }));

  return (
    <section className="orders-section" aria-label="Pedido en curso">
      <div className="orders-section__header">
        <h3>Pedido en curso</h3>
        <div className="orders-section__actions">
          {onRefresh && (
            <button className="btn-ghost btn-sm" type="button" onClick={onRefresh}>
              Actualizar
            </button>
          )}
        </div>
      </div>
      <article className={`orders-card orders-card--active${isCancelled ? " is-cancelled" : ""}`}>
        <OrderHeader order={order} />

        {!isCancelled && (
          <ul className="active-order__timeline">
            {timeline.map((step) => (
              <li key={step.status} className={`active-order__timeline-step active-order__timeline-step--${step.state}`}>
                <span className="active-order__timeline-title">{step.title}</span>
                <span className="active-order__timeline-desc">{step.description}</span>
              </li>
            ))}
          </ul>
        )}

        {isCancelled && (
          <p className="active-order__cancelled">Este pedido fue cancelado. Si necesitás ayuda, dejá un mensaje al equipo.</p>
        )}

        <OrderDetails order={order} />

        <OrderChat messages={messages} onSubmit={handleSubmit} message={message} setMessage={setMessage} sending={sending} />
      </article>
    </section>
  );
};

type OrderChatProps = {
  messages: ApiOrderMessage[];
  onSubmit: (event: React.FormEvent) => void;
  message: string;
  setMessage: (text: string) => void;
  sending: boolean;
};

const OrderChat: React.FC<OrderChatProps> = ({ messages, onSubmit, message, setMessage, sending }) => {
  const items = messages
    .map((entry) => ({
      id: entry.id,
      author: entry.authorType,
      text: extractMessage(entry.payload),
      createdAt: entry.createdAt,
    }))
    .filter((entry) => entry.text.length > 0);

  return (
    <div className="active-order__chat">
      <div className="active-order__chat-header">
        <h4>Chat con el equipo</h4>
        <span>Respondemos desde el panel admin</span>
      </div>
      <div className="active-order__chat-messages">
        {items.length === 0 ? (
          <p className="active-order__chat-empty">Podés dejar una nota o consulta para el equipo.</p>
        ) : (
          <ul>
            {items.map((entry) => (
              <li key={entry.id} className={`active-order__chat-message active-order__chat-message--${entry.author.toLowerCase()}`}>
                <span className="active-order__chat-text">{entry.text}</span>
                <span className="active-order__chat-meta">{dateFormatter.format(new Date(entry.createdAt))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form className="active-order__chat-form" onSubmit={onSubmit}>
        <label htmlFor="order-chat" className="sr-only">
          Escribí un mensaje para el equipo
        </label>
        <textarea
          id="order-chat"
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ej: Podés avisarme cuando salga del horno?"
          disabled={sending}
        />
        <div className="active-order__chat-actions">
          <button className="btn-primary btn-sm" type="submit" disabled={sending || message.trim().length === 0}>
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
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

const resolveTimelineState = (current: OrderStatus) => {
  const currentIndex = ACTIVE_TIMELINE_ORDER.indexOf(current);
  return (stepStatus: OrderStatus) => {
    const stepIndex = ACTIVE_TIMELINE_ORDER.indexOf(stepStatus);
    if (current === "CANCELLED") {
      return "todo";
    }
    if (currentIndex > stepIndex) {
      return "done";
    }
    if (currentIndex === stepIndex) {
      return "current";
    }
    return "todo";
  };
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
  const normalized = Array.isArray(order.normalizedItems) ? order.normalizedItems : [];
  const items = normalized.length
    ? normalized.map((item) => ({
        label: item.label,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        side: item.side ?? undefined,
      }))
    : meta?.items ?? [];
  const customerName = meta?.customer?.name ?? "";
  const address = meta?.delivery?.addressLine ?? "";
  const payment = meta?.paymentMethod ?? order.note ?? "";
  const totalItems = items.reduce<number>((sum, item) => sum + (Number(item.quantity) || 0), 0);

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
          {totalItems > 0 && (
            <div>
              <dt>Ítems</dt>
              <dd>{totalItems}</dd>
            </div>
          )}
        </dl>
      </div>
      {items.length > 0 && (
        <ul className="orders-item__products">
          {items.map((item, index) => (
            <li key={`${order.id}-${index}`}>
              <span className="orders-item__product-label">{item.label}</span>
              <span className="orders-item__product-meta">
                x{item.quantity}
                {item.side ? ` · ${item.side}` : ""}
                {item.lineTotal ? ` — ${currencyFormatter.format(item.lineTotal)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
