import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ApiOrder } from "utils/api";
import { formatCurrency, formatOrderCode } from "utils/orders";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
});

export function AdminOperations() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await api.listOrders({ take: 200 });
      setOrders(items);
      setError(null);
    } catch (err) {
      console.error("No se pudieron cargar los datos operativos", err);
      setError("No pudimos obtener los datos operativos. Reintentá en unos segundos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const metrics = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let totalRevenue = 0;
    let revenueToday = 0;
    let pending = 0;
    let preparing = 0;
    let confirmed = 0;

    orders.forEach((order) => {
      const amount = order.totalNet ?? order.totalGross ?? 0;
      totalRevenue += amount;
      if (order.status === "PENDING") pending += 1;
      if (order.status === "PREPARING") preparing += 1;
      if (order.status === "CONFIRMED") confirmed += 1;

      if (order.createdAt && new Date(order.createdAt) >= startOfDay) {
        revenueToday += amount;
      }
    });

    return { totalRevenue, revenueToday, pending, preparing, confirmed };
  }, [orders]);

  const ordersByDay = useMemo(() => {
    const map = new Map<string, { date: string; count: number; revenue: number }>();
    orders.forEach((order) => {
      if (!order.createdAt) return;
      const key = order.createdAt.slice(0, 10);
      const entry = map.get(key) ?? { date: key, count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += order.totalNet ?? order.totalGross ?? 0;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
  }, [orders]);

  const topProducts = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        quantity: number;
        revenue: number;
      }
    >();

    orders.forEach((order) => {
      order.normalizedItems.forEach((item) => {
        const entry = map.get(item.label) ?? { label: item.label, quantity: 0, revenue: 0 };
        entry.quantity += item.quantity;
        entry.revenue += item.lineTotal;
        map.set(item.label, entry);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 8);
  }, [orders]);

  const recentIssues = useMemo(() => {
    return orders
      .filter((order) => order.status === "CANCELLED")
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        code: formatOrderCode(order.number),
        reason: order.cancellationReason ?? "Sin motivo capturado",
        at: order.cancelledAt ?? order.updatedAt ?? order.createdAt,
      }));
  }, [orders]);

  return (
    <div className="admin-ops-page" aria-live="polite">
      <header className="admin-ops-header">
        <button type="button" className="btn-secondary btn-sm" onClick={loadOrders} disabled={loading}>
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
        {error && <p className="admin-alert admin-alert--error">{error}</p>}
      </header>

      <section className="admin-ops-summary">
        <article>
          <span>Ingresos totales</span>
          <strong>{formatCurrency(metrics.totalRevenue)}</strong>
        </article>
        <article>
          <span>Ingresos hoy</span>
          <strong>{formatCurrency(metrics.revenueToday)}</strong>
        </article>
        <article>
          <span>Pendientes</span>
          <strong>{metrics.pending}</strong>
        </article>
        <article>
          <span>En preparación</span>
          <strong>{metrics.preparing}</strong>
        </article>
        <article>
          <span>Confirmados</span>
          <strong>{metrics.confirmed}</strong>
        </article>
      </section>

      <div className="admin-ops-grid">
        <section aria-label="Pedidos por día" className="admin-ops-card">
          <h3>Demanda diaria (últimos 10 días)</h3>
          {ordersByDay.length === 0 ? (
            <p className="admin-customers-empty">Sin datos suficientes.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Pedidos</th>
                  <th>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {ordersByDay.map((entry) => (
                  <tr key={entry.date}>
                    <td>{dateFormatter.format(new Date(entry.date))}</td>
                    <td>{entry.count}</td>
                    <td>{formatCurrency(entry.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section aria-label="Productos más vendidos" className="admin-ops-card">
          <h3>Top productos</h3>
          {topProducts.length === 0 ? (
            <p className="admin-customers-empty">Todavía no hay ventas registradas.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product) => (
                  <tr key={product.label}>
                    <td>{product.label}</td>
                    <td>{product.quantity}</td>
                    <td>{formatCurrency(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section aria-label="Cancelaciones recientes" className="admin-ops-card">
          <h3>Cancelaciones recientes</h3>
          {recentIssues.length === 0 ? (
            <p className="admin-customers-empty">Sin cancelaciones en este período.</p>
          ) : (
            <ul className="admin-ops-issues">
              {recentIssues.map((issue) => (
                <li key={issue.id}>
                  <strong>{issue.code}</strong>
                  <span>{issue.reason}</span>
                  <span>{issue.at ? dateFormatter.format(new Date(issue.at)) : "Sin fecha"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
