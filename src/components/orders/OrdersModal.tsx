import React from "react";
import { OverlayPortal } from "components/common/OverlayPortal";
import type { ApiOrder, ApiOrderMessage, OrderStatus } from "utils/api";
import { canReorder, formatOrderCode } from "utils/orders";
import styles from "./OrdersModal.module.css";

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

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

const statusClassMap: Record<OrderStatus, string> = {
  DRAFT: styles.statusDraft,
  PENDING: styles.statusPending,
  PREPARING: styles.statusPreparing,
  CONFIRMED: styles.statusConfirmed,
  CANCELLED: styles.statusCancelled,
  FULFILLED: styles.statusFulfilled,
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
    <section className={styles.section} aria-label="Pedidos recientes">
      <div className={styles.sectionHeader}>
        <h3>Pedidos recientes</h3>
        <button className="btn-ghost btn-sm" type="button" onClick={onRefresh}>
          Actualizar
        </button>
      </div>
      {viewerOrders.length === 0 ? (
        <p className={styles.empty}>Todavía no registramos pedidos confirmados.</p>
      ) : (
        <ul className={styles.list}>
          {viewerOrders.map((order) => (
            <li key={order.id} className={styles.item}>
              <article className={cx(styles.card, styles.historyCard)}>
                <OrderHeader order={order} />
                <OrderDetails order={order} />
                <div className={styles.userActions}>
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
    <section className={styles.section} aria-label="Gestionar pedidos">
      <div className={styles.sectionHeader}>
        <h3>Gestionar pedidos</h3>
        <button className="btn-ghost btn-sm" type="button" onClick={onRefresh}>
          Actualizar
        </button>
      </div>
      {pendingOrders.length === 0 ? (
        <p className={styles.empty}>No hay pedidos pendientes por gestionar.</p>
      ) : (
        <ul className={cx(styles.list, styles.listAdmin)}>
          {pendingOrders.map((order) => {
            const adminActions: Array<{ key: string; label: string; variant: "primary" | "secondary" | "ghost"; onClick: () => void }> = [];
            if (onPrepare) {
              adminActions.push({ key: "prepare", label: "Tomar pedido", variant: "secondary", onClick: () => onPrepare(order.id) });
            }
            adminActions.push({ key: "confirm", label: "Listo para entregar", variant: "primary", onClick: () => onConfirm(order.id) });
            if (onFulfill) {
              adminActions.push({ key: "fulfill", label: "Pedido entregado", variant: "secondary", onClick: () => onFulfill(order.id) });
            }
            adminActions.push({ key: "cancel", label: "Cancelar pedido", variant: "ghost", onClick: () => onCancel(order.id) });

            return (
              <li key={order.id} className={styles.item}>
                <article className={styles.card}>
                  <OrderHeader order={order} />
                  <OrderDetails order={order} />
                  <div className={styles.adminActions}>
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
        <div className={styles.adminCta}>
          <button type="button" className="btn-primary btn-sm" onClick={onOpenAdminPanel}>
            Ver más en /admin
          </button>
        </div>
      )}
    </section>
  ) : null;

  return (
    <OverlayPortal>
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Historial de pedidos">
        <div className={styles.container}>
          <header className={styles.header}>
            <div>
              <h2 className={styles.title}>Mis pedidos</h2>
              <p className={styles.subtitle}>Seguimos tus pedidos y te avisamos cuando cada uno esté confirmado.</p>
            </div>
            <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </header>
          <div className={styles.body}>
            {isAdmin && (
              <div className={styles.tabs} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeView === "user"}
                  className={cx(styles.tab, activeView === "user" && styles.tabActive)}
                  onClick={() => onViewChange("user")}
                >
                  Tus pedidos
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeView === "admin"}
                  className={cx(styles.tab, activeView === "admin" && styles.tabActive)}
                  onClick={() => onViewChange("admin")}
                >
                  Gestionar pedidos
                </button>
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            {loading ? (
              <div className={styles.loading} aria-busy="true">
                <div className="loader-ring loader-ring--sm">
                  <div></div>
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
                <span>Cargando pedidos...</span>
              </div>
            ) : (
              <div className={cx(styles.layout, activeContent && styles.layoutWithActive)}>
                {activeContent && <aside className={styles.aside}>{activeContent}</aside>}
                <div className={styles.main}>
                  {viewerContent}
                  {adminContent}
                </div>
              </div>
            )}
          </div>

          <footer className={styles.footer}>
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

  const content = (
    <div className={styles.activeOrderContent}>
      <OrderDetails order={order} />
      <OrderChat messages={messages} onSubmit={handleSubmit} message={message} setMessage={setMessage} sending={sending} />
    </div>
  );

  return (
    <section className={styles.section} aria-label="Pedido en curso">
      <div className={styles.sectionHeader}>
        <h3>Pedido en curso</h3>
        <div className={styles.sectionActions}>
          {onRefresh && (
            <button className="btn-ghost btn-sm" type="button" onClick={onRefresh}>
              Actualizar
            </button>
          )}
        </div>
      </div>
      <article className={cx(styles.card, styles.activeCard, isCancelled && styles.activeCardCancelled)}>
        <OrderHeader order={order} />

        {!isCancelled ? (
          <div className={styles.timeline} role="list">
            {timeline.map((step, index) => (
              <div
                key={step.status}
                className={cx(
                  styles.timelineStep,
                  step.state === "done" && styles.timelineStateDone,
                  step.state === "current" && styles.timelineStateCurrent,
                  step.state === "todo" && styles.timelineStateTodo
                )}
                role="listitem"
              >
                <span className={styles.timelineLabel} aria-hidden="true">{index + 1}</span>
                <span className={styles.timelineTitle}>{step.title}</span>
                <span className={styles.timelineDescription}>{step.description}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.cancelledBadge}>Este pedido fue cancelado. Si necesitás ayuda, dejá un mensaje al equipo.</p>
        )}

        {content}
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
    <div className={styles.chat}>
      <div className={styles.chatHeader}>
        <h4>Chat con el equipo</h4>
        <span>Respondemos desde el panel admin</span>
      </div>
      <div className={styles.chatMessages}>
        {items.length === 0 ? (
          <p className={styles.chatEmpty}>Podés dejar una nota o consulta para el equipo.</p>
        ) : (
          <ul>
            {items.map((entry) => {
              const author = entry.author.toLowerCase();
              const isCustomer = author === "customer" || author === "user";
              return (
                <li key={entry.id} className={cx(styles.chatMessage, isCustomer && styles.chatMessageUser)}>
                  <span className={styles.chatText}>{entry.text}</span>
                  <span className={styles.chatMeta}>{dateFormatter.format(new Date(entry.createdAt))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <form className={styles.chatForm} onSubmit={onSubmit}>
        <label htmlFor="order-chat" className={styles.srOnly}>
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
        <div className={styles.chatActions}>
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
  const statusClass = cx(styles.status, statusClassMap[order.status]);
  const placedAt = order.placedAt ?? order.createdAt;

  return (
    <div className={styles.itemHeader}>
      <div>
        <span className={styles.orderCode}>#{code}</span>
        <span className={styles.orderDate}>{dateFormatter.format(new Date(placedAt))}</span>
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
    <section className={styles.details} aria-label="Resumen del pedido">
      <dl className={styles.detailsMeta}>
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
      {items.length > 0 && (
        <ul className={styles.detailsItems}>
          {items.map((item, index) => (
            <li key={`${order.id}-${index}`} className={styles.detailsItem}>
              <span className={styles.detailsItemName}>{item.label}</span>
              <span className={styles.detailsMetaInline}>
                x{item.quantity}
                {item.side ? ` · ${item.side}` : ""}
                {item.lineTotal ? ` — ${currencyFormatter.format(item.lineTotal)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
