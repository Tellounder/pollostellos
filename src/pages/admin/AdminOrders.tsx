import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ApiOrder, type ApiOrderMessage, type OrderStatus } from "utils/api";
import { formatOrderCode, formatCurrency } from "utils/orders";
import { CancelOrderModal } from "components/orders/CancelOrderModal";

type OrderStatusFilter = OrderStatus | "ALL";

const STATUS_OPTIONS: Array<{ value: OrderStatusFilter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "PREPARING", label: "En preparación" },
  { value: "CONFIRMED", label: "Confirmados" },
  { value: "FULFILLED", label: "Entregados" },
  { value: "CANCELLED", label: "Cancelados" },
];

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function AdminOrders() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("PENDING");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiOrderMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.listOrders({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        take: 100,
      });
      setOrders(response.items);
      setError(null);
    } catch (err) {
      console.error("No se pudieron cargar los pedidos", err);
      setError("No pudimos obtener los pedidos. Reintentá en unos segundos.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

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

  useEffect(() => {
    if (!orders.length) {
      setSelectedOrderId(null);
      setMessages([]);
      return;
    }
    if (!selectedOrderId || !orders.some((order) => order.id === selectedOrderId)) {
      const firstOrder = orders[0];
      setSelectedOrderId(firstOrder.id);
      loadMessages(firstOrder.id);
    }
  }, [orders, selectedOrderId, loadMessages]);

  useEffect(() => {
    if (selectedOrderId) {
      loadMessages(selectedOrderId);
    }
  }, [selectedOrderId, loadMessages]);

  const filteredOrders = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) {
      return orders;
    }
    return orders.filter((order) => {
      const customer = order.metadata?.customer?.name?.toLowerCase() ?? "";
      const code = formatOrderCode(order.number).toLowerCase();
      return customer.includes(normalized) || code.includes(normalized);
    });
  }, [orders, searchTerm]);

  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => order.id === selectedOrderId) ?? filteredOrders[0] ?? null,
    [filteredOrders, selectedOrderId],
  );

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    loadMessages(orderId);
  };

  const handlePrepare = async (orderId: string) => {
    try {
      await api.prepareOrder(orderId);
      await loadOrders();
      await loadMessages(orderId);
    } catch (err) {
      console.error("No se pudo marcar como en preparación", err);
      setError("No pudimos pasar el pedido a preparación.");
    }
  };

  const handleConfirm = async (orderId: string) => {
    try {
      await api.confirmOrder(orderId);
      await loadOrders();
      await loadMessages(orderId);
    } catch (err) {
      console.error("No se pudo confirmar el pedido", err);
      setError("No pudimos confirmar el pedido.");
    }
  };

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
      setCancelOrderId(null);
      await loadOrders();
    } catch (err) {
      console.error("No se pudo cancelar el pedido", err);
      setError("No pudimos cancelar el pedido.");
    } finally {
      setCancellingOrder(false);
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrder) return;
    const text = messageDraft.trim();
    if (!text) return;
    try {
      setSendingMessage(true);
      await api.createOrderMessage(selectedOrder.id, text, "ADMIN_DESK");
      setMessageDraft("");
      await loadMessages(selectedOrder.id);
    } catch (err) {
      console.error("No se pudo enviar el mensaje", err);
      setError("No pudimos enviar el mensaje al cliente.");
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="admin-orders-page" aria-live="polite">
      <header className="admin-orders-header">
        <div className="admin-orders-filters">
          <label>
            <span>Estado</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as OrderStatusFilter)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Buscar</span>
            <input
              type="search"
              placeholder="Cliente o código"
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

      <div className="admin-orders-body">
        <aside className="admin-orders-list" aria-label="Listado de pedidos">
          {loading && filteredOrders.length === 0 ? (
            <div className="admin-orders-empty" aria-busy="true">
              <div className="loader-ring loader-ring--sm">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <span>Cargando pedidos…</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="admin-orders-empty">
              <p>No encontramos pedidos con ese criterio.</p>
            </div>
          ) : (
            <ul>
              {filteredOrders.map((order) => {
                const code = formatOrderCode(order.number);
                const customer = order.metadata?.customer?.name ?? "Sin identificar";
                const total = formatCurrency(order.totalNet ?? order.totalGross ?? 0);
                const isSelected = order.id === selectedOrderId;
                return (
                  <li
                    key={order.id}
                    className={`admin-orders-list__item${isSelected ? " is-selected" : ""}`}
                  >
                    <button type="button" onClick={() => handleSelectOrder(order.id)}>
                      <span className={`orders-status orders-status--${order.status.toLowerCase()}`}>
                        {statusLabels(order.status)}
                      </span>
                      <strong>{code}</strong>
                      <span>{customer}</span>
                      <span>{dateTimeFormatter.format(new Date(order.createdAt))}</span>
                      <span>{total}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="admin-orders-detail" aria-live="polite">
          {!selectedOrder ? (
            <div className="admin-orders-empty">
              <p>Seleccioná un pedido para ver los detalles.</p>
            </div>
          ) : (
            <article className="admin-orders-detail__card">
              <header className="admin-orders-detail__header">
                <div>
                  <h3>{formatOrderCode(selectedOrder.number)}</h3>
                  <span>{dateTimeFormatter.format(new Date(selectedOrder.createdAt))}</span>
                </div>
                <span className={`orders-status orders-status--${selectedOrder.status.toLowerCase()}`}>
                  {statusLabels(selectedOrder.status)}
                </span>
              </header>

              <div className="admin-orders-detail__grid">
                <div>
                  <span>Cliente</span>
                  <strong>{selectedOrder.metadata?.customer?.name ?? "Sin identificar"}</strong>
                </div>
                <div>
                  <span>Contacto</span>
                  <strong>{selectedOrder.metadata?.customer?.phone ?? "Sin número"}</strong>
                </div>
                <div>
                  <span>Entrega</span>
                  <strong>{selectedOrder.metadata?.delivery?.addressLine ?? "Retira en local"}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{formatCurrency(selectedOrder.totalNet ?? selectedOrder.totalGross ?? 0)}</strong>
                </div>
              </div>

              <section aria-label="Productos del pedido" className="admin-orders-detail__items">
                <h4>Ítems ({selectedOrder.normalizedItems.length})</h4>
                <ul>
                  {selectedOrder.normalizedItems.map((item) => (
                    <li key={item.id}>
                      <span>{item.label}</span>
                      <span>
                        x{item.quantity}
                        {item.side ? ` · ${item.side}` : ""}
                      </span>
                      <span>{formatCurrency(item.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="admin-orders-detail__actions">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => handlePrepare(selectedOrder.id)}
                  disabled={selectedOrder.status !== "PENDING"}
                >
                  Pasar a preparación
                </button>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => handleConfirm(selectedOrder.id)}
                  disabled={selectedOrder.status !== "PENDING" && selectedOrder.status !== "PREPARING"}
                >
                  Confirmar pedido
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => handleCancel(selectedOrder.id)}
                >
                  Cancelar
                </button>
              </div>

              <section className="admin-orders-detail__chat" aria-label="Chat con el cliente">
                <header>
                  <h4>Mensajes</h4>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => loadMessages(selectedOrder.id)}
                    disabled={chatLoading}
                  >
                    {chatLoading ? "Actualizando…" : "Actualizar"}
                  </button>
                </header>
                <div className="admin-orders-detail__chat-log">
                  {chatLoading ? (
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
                    <p className="admin-orders-detail__chat-empty">
                      Todavía no hay mensajes. Podés dejar una nota para el cliente o responder sus consultas.
                    </p>
                  ) : (
                    <ul>
                      {messages.map((entry) => (
                        <li
                          key={entry.id}
                          className={`admin-orders-detail__chat-message admin-orders-detail__chat-message--${entry.authorType.toLowerCase()}`}
                        >
                          <span className="admin-orders-detail__chat-text">{extractMessage(entry.payload)}</span>
                          <span className="admin-orders-detail__chat-meta">
                            {entry.authorType === "ADMIN" ? "Equipo" : "Cliente"} ·{' '}
                            {dateTimeFormatter.format(new Date(entry.createdAt))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <form className="admin-orders-detail__chat-form" onSubmit={handleSendMessage}>
                  <textarea
                    aria-label="Mensaje para el cliente"
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder="Ej: Estamos preparando tus pollos a las brasas, sale en 10 minutos."
                    disabled={sendingMessage}
                    rows={3}
                  />
                  <div className="admin-orders-detail__chat-actions">
                    <button
                      type="submit"
                      className="btn-primary btn-sm"
                      disabled={sendingMessage || messageDraft.trim().length === 0}
                    >
                      {sendingMessage ? "Enviando…" : "Enviar"}
                    </button>
                  </div>
                </form>
              </section>
            </article>
          )}
        </section>
      </div>

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

const statusLabels = (status: OrderStatus) => {
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "PREPARING":
      return "En preparación";
    case "CONFIRMED":
      return "Confirmado";
    case "FULFILLED":
      return "Entregado";
    case "CANCELLED":
      return "Cancelado";
    default:
      return "Borrador";
  }
};

const extractMessage = (payload: Record<string, unknown>) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }
  const candidate = (payload as { message?: unknown }).message;
  if (typeof candidate === "string") {
    return candidate;
  }
  return "";
};
