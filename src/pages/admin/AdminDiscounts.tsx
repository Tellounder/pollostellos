import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ApiDiscountCode, type ApiShareCoupon } from "utils/api";
import { formatCurrency } from "utils/orders";

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

type CouponStatusFilter = ApiShareCoupon["status"] | "ALL";

const STATUS_OPTIONS: Array<{ value: CouponStatusFilter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "ISSUED", label: "Disponibles" },
  { value: "ACTIVATED", label: "Compartidos" },
  { value: "REDEEMED", label: "Canjeados" },
];

export function AdminDiscounts() {
  const [shareCoupons, setShareCoupons] = useState<ApiShareCoupon[]>([]);
  const [discountCodes, setDiscountCodes] = useState<ApiDiscountCode[]>([]);
  const [statusFilter, setStatusFilter] = useState<CouponStatusFilter>("ALL");
  const [activeOnly, setActiveOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [couponsResponse, codesResponse] = await Promise.all([
        api.listAllShareCoupons(statusFilter === "ALL" ? undefined : statusFilter),
        api.listDiscountCodes({ activeOnly }),
      ]);
      setShareCoupons(couponsResponse);
      setDiscountCodes(codesResponse);
      setError(null);
    } catch (err) {
      console.error("No se pudieron cargar los beneficios", err);
      setError("No pudimos obtener la información de descuentos. Reintentá en instantes.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, activeOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    const issued = shareCoupons.filter((coupon) => coupon.status === "ISSUED").length;
    const activated = shareCoupons.filter((coupon) => coupon.status === "ACTIVATED").length;
    const redeemed = shareCoupons.filter((coupon) => coupon.status === "REDEEMED").length;
    const totalDiscountValue = discountCodes.reduce((sum, code) => {
      const value = Number(code.value ?? 0);
      const remaining = code.maxRedemptions - code.redemptions.length;
      return sum + (remaining > 0 ? value : 0);
    }, 0);

    return { issued, activated, redeemed, totalDiscountValue };
  }, [shareCoupons, discountCodes]);

  const topAmbassadors = useMemo(() => {
    const counts = new Map<string, { name: string; email: string; total: number }>();
    shareCoupons.forEach((coupon) => {
      if (!coupon.user) return;
      const key = coupon.user.id;
      const entry = counts.get(key) ?? {
        name: coupon.user.displayName ?? coupon.user.email,
        email: coupon.user.email,
        total: 0,
      };
      if (coupon.status === "ACTIVATED" || coupon.status === "REDEEMED") {
        entry.total += 1;
      }
      counts.set(key, entry);
    });
    return Array.from(counts.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [shareCoupons]);

  return (
    <div className="admin-discounts-page" aria-live="polite">
      <header className="admin-discounts-header">
        <div className="admin-discounts-filters">
          <label>
            <span>Estado</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CouponStatusFilter)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-discounts-toggle">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(event) => setActiveOnly(event.target.checked)}
            />
            Mostrar sólo códigos vigentes
          </label>
          <button type="button" className="btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
        {error && <p className="admin-alert admin-alert--error">{error}</p>}
      </header>

      <section className="admin-discounts-summary">
        <article>
          <span>Códigos emitidos</span>
          <strong>{summary.issued}</strong>
        </article>
        <article>
          <span>Compartidos</span>
          <strong>{summary.activated}</strong>
        </article>
        <article>
          <span>Canjeados</span>
          <strong>{summary.redeemed}</strong>
        </article>
        <article>
          <span>Saldo disponible</span>
          <strong>{formatCurrency(summary.totalDiscountValue)}</strong>
        </article>
      </section>

      <div className="admin-discounts-body">
        <section className="admin-discounts-coupons" aria-label="Códigos para compartir">
          <header>
            <h3>Referidos y beneficios</h3>
            <span>{shareCoupons.length} códigos registrados</span>
          </header>
          {shareCoupons.length === 0 ? (
            <p className="admin-customers-empty">No hay registros para los filtros seleccionados.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Estado</th>
                  <th>Cliente</th>
                  <th>Actualización</th>
                </tr>
              </thead>
              <tbody>
                {shareCoupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td>{coupon.code}</td>
                    <td>{statusLabel(coupon.status)}</td>
                    <td>{coupon.user?.displayName ?? coupon.user?.email ?? "Sin asignar"}</td>
                    <td>
                      {coupon.updatedAt
                        ? dateTimeFormatter.format(new Date(coupon.updatedAt))
                        : dateTimeFormatter.format(new Date(coupon.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-discounts-codes" aria-label="Descuentos personalizados">
          <header>
            <h3>Descuentos asignados</h3>
            <span>{discountCodes.length} códigos en total</span>
          </header>
          {discountCodes.length === 0 ? (
            <p className="admin-customers-empty">Aún no se asignaron descuentos manuales.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Valor</th>
                  <th>Cliente</th>
                  <th>Redimidos</th>
                  <th>Vence</th>
                </tr>
              </thead>
              <tbody>
                {discountCodes.map((code) => (
                  <tr key={code.id}>
                    <td>{code.code}</td>
                    <td>{code.percentage ? `${Number(code.percentage)}%` : `$ ${code.value}`}</td>
                    <td>{code.owner?.displayName ?? code.owner?.email ?? "Sin asignar"}</td>
                    <td>{code.redemptions.length}/{code.maxRedemptions}</td>
                    <td>{code.expiresAt ? dateTimeFormatter.format(new Date(code.expiresAt)) : "Sin vencimiento"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="admin-discounts-top" aria-label="Embajadores destacados">
        <h3>Top referidores</h3>
        {topAmbassadors.length === 0 ? (
          <p className="admin-customers-empty">Todavía no tenemos referidos activos.</p>
        ) : (
          <ul>
            {topAmbassadors.map((entry) => (
              <li key={entry.email}>
                <strong>{entry.name}</strong>
                <span>{entry.email}</span>
                <span>{entry.total} códigos compartidos</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const statusLabel = (status: ApiShareCoupon["status"]) => {
  switch (status) {
    case "ISSUED":
      return "Disponible";
    case "ACTIVATED":
      return "Compartido";
    case "REDEEMED":
      return "Canjeado";
    default:
      return "";
  }
};
