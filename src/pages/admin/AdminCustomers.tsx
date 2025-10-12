import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type ApiShareCoupon,
  type ApiUserDetail,
  type ApiUserEngagement,
  type ApiUserListItem,
  type CreateUserDiscountPayload,
} from "utils/api";
import { formatCurrency, formatOrderCode } from "utils/orders";

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function AdminCustomers() {
  const [customers, setCustomers] = useState<ApiUserListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<ApiUserListItem | null>(null);

  const [detail, setDetail] = useState<ApiUserDetail | null>(null);
  const [engagement, setEngagement] = useState<ApiUserEngagement | null>(null);
  const [shareCoupons, setShareCoupons] = useState<ApiShareCoupon[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState("5000");
  const [issuingCoupons, setIssuingCoupons] = useState(false);
  const [grantingDiscount, setGrantingDiscount] = useState(false);

  const loadCustomers = useCallback(
    async (term: string) => {
      setLoading(true);
      try {
        const response = await api.listUsers({ take: 50, search: term.trim() || undefined });
        setCustomers(response.items);
        setError(null);
      } catch (err) {
        console.error("No se pudieron cargar los clientes", err);
        setError("No pudimos cargar los clientes. Reintentá en unos segundos.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadCustomerDetail = useCallback(async (customer: ApiUserListItem) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [detailResponse, engagementResponse, couponsResponse] = await Promise.all([
        api.getUserDetail(customer.id),
        api.getUserEngagement(customer.id),
        api.listShareCoupons(customer.id),
      ]);
      setDetail(detailResponse);
      setEngagement(engagementResponse);
      setShareCoupons(couponsResponse);
    } catch (err) {
      console.error("No se pudo cargar el detalle del cliente", err);
      setDetailError("No pudimos cargar el detalle de este cliente.");
      setDetail(null);
      setEngagement(null);
      setShareCoupons([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers("");
  }, [loadCustomers]);

  useEffect(() => {
    if (!selectedCustomer && customers.length > 0) {
      const first = customers[0];
      setSelectedCustomer(first);
      loadCustomerDetail(first);
    }
  }, [customers, selectedCustomer, loadCustomerDetail]);

  const handleSelectCustomer = (customer: ApiUserListItem) => {
    setSelectedCustomer(customer);
    loadCustomerDetail(customer);
  };

  const handleSubmitDiscount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer) return;

    const value = Number(discountValue);
    if (Number.isNaN(value) || value <= 0) {
      setFeedback("Ingrese un monto válido para el descuento.");
      return;
    }

    const payload: CreateUserDiscountPayload = {
      value,
      label: `Premio fidelidad ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
    };

    try {
      setGrantingDiscount(true);
      await api.createUserDiscount(selectedCustomer.id, payload);
      setFeedback("Asignamos un nuevo descuento de cortesía.");
      await loadCustomerDetail(selectedCustomer);
    } catch (err) {
      console.error("No se pudo otorgar el descuento", err);
      setFeedback("No pudimos otorgar el descuento. Probá nuevamente.");
    } finally {
      setGrantingDiscount(false);
    }
  };

  const handleIssueCoupons = async () => {
    if (!selectedCustomer) return;
    try {
      setIssuingCoupons(true);
      const coupons = await api.issueShareCoupons(selectedCustomer.id);
      setShareCoupons(coupons);
      setFeedback("Generamos los códigos mensuales para compartir.");
    } catch (err) {
      console.error("No se pudieron generar los códigos", err);
      setFeedback("No pudimos generar los códigos. Intentá de nuevo.");
    } finally {
      setIssuingCoupons(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) {
      return customers;
    }
    const normalized = searchTerm.trim().toLowerCase();
    return customers.filter((customer) => {
      const fullName = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.toLowerCase();
      return (
        customer.email.toLowerCase().includes(normalized) ||
        fullName.includes(normalized) ||
        (customer.displayName ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [customers, searchTerm]);

  return (
    <div className="admin-customers-page" aria-live="polite">
      <header className="admin-customers-header">
        <div className="admin-customers-search">
          <label>
            <span>Buscar cliente</span>
            <input
              type="search"
              placeholder="Correo, nombre o alias"
              value={searchTerm}
              onChange={(event) => {
                const value = event.target.value;
                setSearchTerm(value);
              }}
            />
          </label>
          <button type="button" className="btn-secondary btn-sm" onClick={() => loadCustomers(searchTerm)} disabled={loading}>
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </div>
        {error && <p className="admin-alert admin-alert--error">{error}</p>}
        {feedback && <p className="admin-alert admin-alert--info">{feedback}</p>}
      </header>

      <div className="admin-customers-body">
        <aside className="admin-customers-list" aria-label="Listado de clientes">
          {loading && customers.length === 0 ? (
            <div className="admin-orders-empty" aria-busy="true">
              <div className="loader-ring loader-ring--sm">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <span>Cargando clientes…</span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="admin-orders-empty">
              <p>No encontramos clientes con ese criterio.</p>
            </div>
          ) : (
            <ul>
              {filteredCustomers.map((customer) => {
                const isSelected = selectedCustomer?.id === customer.id;
                return (
                  <li key={customer.id} className={`admin-customers-item${isSelected ? " is-selected" : ""}`}>
                    <button type="button" onClick={() => handleSelectCustomer(customer)}>
                      <strong>{customer.displayName ?? customer.firstName ?? customer.email}</strong>
                      <span>{customer.email}</span>
                      <span>
                        Alta: {dateTimeFormatter.format(new Date(customer.createdAt))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="admin-customers-detail" aria-live="polite">
          {!selectedCustomer ? (
            <div className="admin-orders-empty">
              <p>Seleccioná un cliente para ver su historial.</p>
            </div>
          ) : detailLoading ? (
            <div className="admin-orders-empty" aria-busy="true">
              <div className="loader-ring loader-ring--sm">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <span>Cargando detalle…</span>
            </div>
          ) : detailError ? (
            <div className="admin-orders-empty">
              <p>{detailError}</p>
            </div>
          ) : detail ? (
            <article className="admin-customers-card">
              <header>
                <div>
                  <h3>{detail.displayName || `${detail.firstName ?? ""} ${detail.lastName ?? ""}`.trim() || detail.email}</h3>
                  <span>{detail.email}</span>
                </div>
                <span className={`admin-badge${selectedCustomer.isActive ? " is-active" : " is-inactive"}`}>
                  {selectedCustomer.isActive ? "Activo" : "Inactivo"}
                </span>
              </header>

              <div className="admin-customers-info">
                <div>
                  <span>Teléfono</span>
                  <strong>{detail.phone || "No informado"}</strong>
                </div>
                <div>
                  <span>Última dirección</span>
                  <strong>{detail.addresses[0]?.line1 ?? "Sin dirección guardada"}</strong>
                </div>
                <div>
                  <span>Último ingreso</span>
                  <strong>
                    {selectedCustomer.lastLoginAt
                      ? dateTimeFormatter.format(new Date(selectedCustomer.lastLoginAt))
                      : "Sin registro"}
                  </strong>
                </div>
                <div>
                  <span>Pedidos totales</span>
                  <strong>{engagement?.lifetimeOrders ?? 0}</strong>
                </div>
                <div>
                  <span>Ventas acumuladas</span>
                  <strong>{formatCurrency(Number(engagement?.lifetimeNetSales ?? "0"))}</strong>
                </div>
                <div>
                  <span>Pedidos este mes</span>
                  <strong>{engagement?.monthlyOrders ?? 0}</strong>
                </div>
              </div>

              <section className="admin-customers-section" aria-label="Acciones de fidelización">
                <h4>Premiar cliente</h4>
                <div className="admin-customers-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={handleIssueCoupons}
                    disabled={issuingCoupons}
                  >
                    {issuingCoupons ? "Generando…" : "Generar códigos para compartir"}
                  </button>
                  <form className="admin-customers-discount" onSubmit={handleSubmitDiscount}>
                    <label>
                      <span>Monto de descuento ($)</span>
                      <input
                        type="number"
                        min={100}
                        step={100}
                        value={discountValue}
                        onChange={(event) => setDiscountValue(event.target.value)}
                      />
                    </label>
                    <button type="submit" className="btn-primary btn-sm" disabled={grantingDiscount}>
                      {grantingDiscount ? "Otorgando…" : "Otorgar descuento"}
                    </button>
                  </form>
                </div>
              </section>

              <section className="admin-customers-section" aria-label="Pedidos recientes">
                <h4>Últimos pedidos</h4>
                {detail.orders?.length ? (
                  <ul className="admin-customers-orders">
                    {detail.orders.map((order) => (
                      <li key={order.id}>
                        <div>
                          <strong>{formatOrderCode(order.number)}</strong>
                          <span>{dateTimeFormatter.format(new Date(order.createdAt))}</span>
                        </div>
                        <span>{formatCurrency(order.totalNet ?? order.totalGross ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-customers-empty">Sin pedidos registrados todavía.</p>
                )}
              </section>

              <section className="admin-customers-section" aria-label="Códigos para compartir">
                <h4>Códigos mensuales</h4>
                {shareCoupons.length === 0 ? (
                  <p className="admin-customers-empty">Generá códigos mensuales para activar su programa de referidos.</p>
                ) : (
                  <ul className="admin-customers-coupons">
                    {shareCoupons.map((coupon) => (
                      <li key={coupon.id}>
                        <span>{coupon.code}</span>
                        <span>{coupon.status === "ISSUED" ? "Listo para compartir" : coupon.status === "ACTIVATED" ? "Compartido" : "Canjeado"}</span>
                        <span>
                          {coupon.activatedAt
                            ? `Activado ${dateTimeFormatter.format(new Date(coupon.activatedAt))}`
                            : "Sin envío"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="admin-customers-section" aria-label="Descuentos disponibles">
                <h4>Descuentos asignados</h4>
                {detail.discountCodesOwned.length === 0 ? (
                  <p className="admin-customers-empty">Todavía no tiene descuentos asignados.</p>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Valor</th>
                        <th>Vencimiento</th>
                        <th>Canjes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.discountCodesOwned.map((code) => (
                        <tr key={code.id}>
                          <td>{code.code}</td>
                          <td>{code.percentage ? `${Number(code.percentage)}%` : `$${code.value}`}</td>
                          <td>{code.expiresAt ? dateTimeFormatter.format(new Date(code.expiresAt)) : "Sin vencimiento"}</td>
                          <td>{code.redemptions.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </article>
          ) : null}
        </section>
      </div>
    </div>
  );
}
