import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ApiOrder, type ApiOrderMessage, type OrderStatus } from "utils/api";
import { formatOrderCode, formatCurrency } from "utils/orders";
import { CancelOrderModal } from "components/orders/CancelOrderModal";

const BOARD_COLUMNS: Array<{
  status: OrderStatus;
  title: string;
  helper: string;
  empty: string;
}> = [
  {
    status: "PENDING",
    title: "Pendientes",
    helper: "Pedidos recién ingresados a la espera de validación.",
    empty: "No hay pedidos pendientes.",
  },
  {
    status: "PREPARING",
    title: "En preparación",
    helper: "Pedidos aceptados que están siendo elaborados.",
    empty: "Todavía no marcaste pedidos en preparación.",
  },
  {
    status: "CONFIRMED",
    title: "En camino",
    helper: "Listos para retiro o entrega. Marcá completado cuando finalicen.",
    empty: "No hay pedidos listos para entregar.",
  },
  {
    status: "FULFILLED",
    title: "Completados",
    helper: "Pedidos finalizados. Se muestran las últimas entregas.",
    empty: "Cuando cierres un pedido aparecerá acá.",
  },
];

const statusLabels: Record<OrderStatus, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  PREPARING: "En preparación",
  CONFIRMED: "En camino",
  FULFILLED: "Completado",
  CANCELLED: "Cancelado",
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

const mapOrderActions = (
  order: ApiOrder,
  handlers: {
    prepare: (orderId: string) => void;
    confirm: (orderId: string) => void;
    fulfill: (orderId: string) => void;
    cancel: (orderId: string) => void;
  }
): Array<{ key: string; label: string; variant: "primary" | "secondary" | "ghost"; onClick: () => void }> => {
  switch (order.status) {
    case "PENDING":
      return [
        { key: "prepare", label: "Preparar", variant: "secondary", onClick: () => handlers.prepare(order.id) },
        { key: "confirm", label: "Confirmar", variant: "primary", onClick: () => handlers.confirm(order.id) },
        { key: "cancel", label: "Cancelar", variant: "ghost", onClick: () => handlers.cancel(order.id) },
      ];
    case "PREPARING":
      return [
        { key: "confirm", label: "Listo para entregar", variant: "primary", onClick: () => handlers.confirm(order.id) },
        { key: "fulfill", label: "Marcar completado", variant: "secondary", onClick: () => handlers.fulfill(order.id) },
        { key: "cancel", label: "Cancelar", variant: "ghost", onClick: () => handlers.cancel(order.id) },
      ];
    case "CONFIRMED":
      return [
        { key: "fulfill", label: "Marcar completado", variant: "primary", onClick: () => handlers.fulfill(order.id) },
        { key: "cancel", label: "Cancelar", variant: "ghost", onClick: () => handlers.cancel(order.id) },
      ];
    default:
      return [];
  }
};

const getOrderTotals = (order: ApiOrder) => formatCurrency(order.totalNet ?? order.totalGross ?? 0);

export function AdminOrders() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ApiOrderMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.listOrders({ take: 200 });
      setOrders(response.items);
      setError(null);
    } catch (err) {
      console.error("No se pudieron cargar los pedidos", err);
      setError("No pudimos obtener los pedidos. Reintentá en unos segundos.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (orderId: string) => {
    setChatLoading(true);
    try {
      const data = await api.listOrderMessages(orderId, 200);
      setMessages(data);
    } catch (err) {
      console.error("No se pudo cargar el historial de mensajes", err);
      setMessages([]);
    } finally {
      setChatLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) {
      return orders;
    }
    return orders.filter((order) => {
      const customer = order.metadata?.customer?.name?.toLowerCase() ?? "";
      const code = formatOrderCode(order.number).toLowerCase();
      const note = order.note?.toLowerCase() ?? "";
      return customer.includes(normalized) || code.includes(normalized) || note.includes(normalized);
    });
  }, [orders, searchTerm]);

  const sortedOrders = useMemo(
    () =>
      [...filteredOrders].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [filteredOrders],
  );

  const ordersByStatus = useMemo(() => {
    const buckets: Record<OrderStatus, ApiOrder[]> = {
      DRAFT: [],
      PENDING: [],
      PREPARING: [],
      CONFIRMED: [],
      FULFILLED: [],
      CANCELLED: [],
    };
    sortedOrders.forEach((order) => {
      if (!buckets[order.status]) {
        buckets[order.status] = [];
      }
      buckets[order.status].push(order);
    });
    return buckets;
  }, [sortedOrders]);

  const firstAvailableOrder = useMemo(() => {
    for (const column of BOARD_COLUMNS) {
      const list = ordersByStatus[column.status];
      if (list && list.length > 0) {
        return list[0];
      }
    }
    return sortedOrders[0] ?? null;
  }, [ordersByStatus, sortedOrders]);

  useEffect(() => {
    if (sortedOrders.length === 0) {
      setSelectedOrderId(null);
      setMessages([]);
      return;
    }
    if (!selectedOrderId || !sortedOrders.some((order) => order.id === selectedOrderId)) {
      if (firstAvailableOrder) {
        setSelectedOrderId(firstAvailableOrder.id);
        loadMessages(firstAvailableOrder.id);
      }
    }
  }, [sortedOrders, selectedOrderId, loadMessages, firstAvailableOrder]);

  const selectedOrder = useMemo(
    () => sortedOrders.find((order) => order.id === selectedOrderId) ?? null,
    [sortedOrders, selectedOrderId],
  );

  const runAction = useCallback(
    async (orderId: string, task: () => Promise<void>) => {
      setActionLoadingId(orderId);
      try {
        await task();
        await loadOrders();
        if (selectedOrderId === orderId) {
          await loadMessages(orderId);
        }
      } finally {
        setActionLoadingId(null);
      }
    },
    [loadOrders, loadMessages, selectedOrderId],
  );

  const handlePrepare = useCallback(
    (orderId: string) =>
      runAction(orderId, async () => {
        await api.prepareOrder(orderId);
      }),
    [runAction],
  );

  const handleConfirm = useCallback(
    (orderId: string) =>
      runAction(orderId, async () => {
        await api.confirmOrder(orderId);
      }),
    [runAction],
  );

  const handleFulfill = useCallback(
    (orderId: string) =>
      runAction(orderId, async () => {
        await api.fulfillOrder(orderId);
      }),
    [runAction],
  );

  const handleCancel = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async (reason: string | null) => {
    if (!cancelOrderId) {
      setCancelModalOpen(false);
      return;
    }
    try {
      setCancellingOrder(true);
      await api.cancelOrder(cancelOrderId, reason ?? undefined);
      setCancelModalOpen(false);
      await loadOrders();
      if (selectedOrderId === cancelOrderId) {
        await loadMessages(cancelOrderId);
      }
    } catch (err) {
      console.error("No se pudo cancelar el pedido", err);
      setError("No pudimos cancelar el pedido.");
    } finally {
      setCancellingOrder(false);
      setCancelOrderId(null);
    }
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    loadMessages(orderId);
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrder) return;
    const text = messageDraft.trim();
    if (!text) return;
    try {
      setSendingMessage(true);
      await api.createOrderMessage(selectedOrder.id, text, "ADMIN_BOARD");
      setMessageDraft("");
      await loadMessages(selectedOrder.id);
    } catch (err) {
      console.error("No se pudo enviar el mensaje", err);
      setError("No pudimos enviar el mensaje al cliente.");
    } finally {
      setSendingMessage(false);
    }
  };

  const actionsHandlers = useMemo(
    () => ({
      prepare: handlePrepare,
      confirm: handleConfirm,
      fulfill: handleFulfill,
      cancel: handleCancel,
    }),
    [handlePrepare, handleConfirm, handleFulfill, handleCancel],
  );

  return (
    <div className="admin-orders-page" aria-live="polite">
      <header className="admin-orders-header">
        <div className="admin-orders-filters">
          <label>
            <span>Buscar</span>
            <input
              type="search"
              placeholder="Cliente, código o nota"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <button className="btn-secondary btn-sm" type="button" onClick={loadOrders} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
        {error && <p className="admin-alert admin-alert--error">{error}</p>}
      </header>

      <div className="admin-board" aria-label="Tablero de pedidos">
        {BOARD_COLUMNS.map((column) => {
          const columnOrders = ordersByStatus[column.status] ?? [];
          return (
            <section key={column.status} className="admin-board__column">
              <header className="admin-board__column-header">
                <div>
                  <h3>{column.title}</h3>
                  <span>{column.helper}</span>
                </div>
                <span className="admin-board__badge">{columnOrders.length}</span>
              </header>
              {columnOrders.length === 0 ? (
                <p className="admin-board__empty">{column.empty}</p>
              ) : (
                <ul className="admin-board__list">
                  {columnOrders.map((order) => {
                    const isSelected = order.id === selectedOrderId;
                    const actions = mapOrderActions(order, actionsHandlers);
                    const disabled = actionLoadingId === order.id || loading;
                    return (
                      <li key={order.id} className={`admin-board-card${isSelected ? " is-selected" : ""}`}>
                        <button
                          type="button"
                          className="admin-board-card__body"
                          onClick={() => handleSelectOrder(order.id)}
                        >
                          <div className="admin-board-card__headline">
                            <strong>#{formatOrderCode(order.number)}</strong>
                            <span>{statusLabels[order.status]}</span>
                          </div>
                          <div className="admin-board-card__meta">
                            <span>{order.metadata?.customer?.name ?? "Cliente sin datos"}</span>
                            <span>{getOrderTotals(order)}</span>
                          </div>
                          <div className="admin-board-card__foot">
                            <span>{dateTimeFormatter.format(new Date(order.createdAt))}</span>
                            {order.metadata?.delivery?.addressLine && (
                              <span>{order.metadata.delivery.addressLine}</span>
                            )}
                          </div>
                        </button>
                        {actions.length > 0 && (
                          <div className="admin-board-card__actions">
                            {actions.map((action) => (
                              <button
                                key={action.key}
                                type="button"
                                className={`btn-${action.variant} btn-xs`}
                                onClick={action.onClick}
                                disabled={disabled}
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
            </section>
          );
        })}
      </div>

      <OrderDetailPanel
        order={selectedOrder}
        messages={messages}
        loading={chatLoading}
        messageDraft={messageDraft}
        onChangeMessage={setMessageDraft}
        onSubmit={handleSendMessage}
        sending={sendingMessage}
        actions={selectedOrder ? mapOrderActions(selectedOrder, actionsHandlers) : []}
        disableActions={loading || (selectedOrder ? actionLoadingId === selectedOrder.id : false)}
      />

      <CancelOrderModal
        open={cancelModalOpen}
        loading={cancellingOrder}
        onClose={() => {
          setCancelModalOpen(false);
          setCancelOrderId(null);
        }}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}

type OrderDetailPanelProps = {
  order: ApiOrder | null;
  messages: ApiOrderMessage[];
  loading: boolean;
  messageDraft: string;
  onChangeMessage: (text: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  sending: boolean;
  actions: Array<{ key: string; label: string; variant: "primary" | "secondary" | "ghost"; onClick: () => void }>;
  disableActions: boolean;
};

const OrderDetailPanel: React.FC<OrderDetailPanelProps> = ({
  order,
  messages,
  loading,
  messageDraft,
  onChangeMessage,
  onSubmit,
  sending,
  actions,
  disableActions,
}) => {
  if (!order) {
    return (
      <section className="admin-order-detail" aria-live="polite">
        <div className="admin-orders-empty">
          <p>Seleccioná un pedido para ver los detalles.</p>
        </div>
      </section>
    );
  }

  const items = order.normalizedItems ?? [];

  return (
    <section className="admin-order-detail" aria-live="polite">
      <article className="admin-order-detail__card">
        <header className="admin-order-detail__header">
          <div>
            <h3>#{formatOrderCode(order.number)}</h3>
            <span>Creado: {dateTimeFormatter.format(new Date(order.createdAt))}</span>
          </div>
          <span className={`orders-status orders-status--${order.status.toLowerCase()}`}>
            {statusLabels[order.status] ?? order.status}
          </span>
        </header>

        <div className="admin-order-detail__grid">
          <div>
            <span>Cliente</span>
            <strong>{order.metadata?.customer?.name ?? "Sin identificar"}</strong>
          </div>
          <div>
            <span>Contacto</span>
            <strong>{order.metadata?.customer?.phone ?? "Sin número"}</strong>
          </div>
          <div>
            <span>Entrega</span>
            <strong>{order.metadata?.delivery?.addressLine ?? "Retira en local"}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{getOrderTotals(order)}</strong>
          </div>
          {order.preparingAt && (
            <div>
              <span>Preparación</span>
              <strong>{timeFormatter.format(new Date(order.preparingAt))}</strong>
            </div>
          )}
          {order.confirmedAt && (
            <div>
              <span>Confirmado</span>
              <strong>{timeFormatter.format(new Date(order.confirmedAt))}</strong>
            </div>
          )}
          {order.fulfilledAt && (
            <div>
              <span>Completado</span>
              <strong>{timeFormatter.format(new Date(order.fulfilledAt))}</strong>
            </div>
          )}
        </div>

        {actions.length > 0 && (
          <div className="admin-order-detail__actions">
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                className={`btn-${action.variant} btn-sm`}
                onClick={action.onClick}
                disabled={disableActions}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        <section aria-label="Productos del pedido" className="admin-order-detail__items">
          <h4>Ítems ({items.length})</h4>
          <ul>
            {items.map((item) => (
              <li key={`${item.label}-${item.quantity}`}>
                <span>{item.label}</span>
                <span>
                  x{item.quantity}
                  {item.side ? ` · ${item.side}` : ""}
                </span>
                <span>{formatCurrency(item.lineTotal ?? 0)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-order-detail__chat" aria-label="Chat con el cliente">
          <header>
            <h4>Mensajes</h4>
          </header>
          <div className="admin-order-detail__chat-log">
            {loading ? (
              <div className="admin-orders-empty" aria-busy="true">
                <div className="loader-ring loader-ring--sm">
                  <div></div>
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
                <span>Cargando mensajes…</span>
              </div>
            ) : messages.length === 0 ? (
              <p className="admin-order-detail__chat-empty">
                Todavía no hay mensajes. Podés dejar una nota para el cliente o responder sus consultas.
              </p>
            ) : (
              <ul>
                {messages.map((entry) => (
                  <li
                    key={entry.id}
                    className={`admin-order-detail__chat-message admin-order-detail__chat-message--${entry.authorType.toLowerCase()}`}
                  >
                    <span className="admin-order-detail__chat-text">{extractMessage(entry.payload)}</span>
                    <span className="admin-order-detail__chat-meta">
                      {entry.authorType === "ADMIN" ? "Equipo" : "Cliente"} · {dateTimeFormatter.format(new Date(entry.createdAt))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <form className="admin-order-detail__chat-form" onSubmit={onSubmit}>
            <textarea
              aria-label="Mensaje para el cliente"
              value={messageDraft}
              onChange={(event) => onChangeMessage(event.target.value)}
              placeholder="Ej: Estamos preparando tus pollos, sale en 10 minutos."
              disabled={sending}
              rows={3}
            />
            <div className="admin-order-detail__chat-actions">
              <button
                type="submit"
                className="btn-primary btn-sm"
                disabled={sending || messageDraft.trim().length === 0}
              >
                {sending ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </form>
        </section>
      </article>
    </section>
  );
};

type Payload = Record<string, unknown>;

const extractMessage = (payload: Payload): string => {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const candidate = (payload as { message?: unknown }).message;
    if (typeof candidate === "string") {
      return candidate;
    }
  }
  return "";
};
