import React from "react";
import { OverlayPortal } from "components/common/OverlayPortal";
import type { DiscountEntry, ShareCouponSummary } from "utils/orders";

type DiscountHistoryItem = {
  id: string;
  code: string;
  valueApplied: number;
  redeemedAt: string;
  orderCode?: string;
};

type DiscountsModalProps = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error?: string | null;
  totalSavings: number;
  totalRedemptions: number;
  activeDiscounts: DiscountEntry[];
  history: DiscountHistoryItem[];
  shareCoupons: ShareCouponSummary[];
  onShareCoupon: (coupon: ShareCouponSummary) => Promise<void> | void;
  onRefresh: () => void;
  onApplyDiscount?: (discount: DiscountEntry) => void;
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const DiscountsModal: React.FC<DiscountsModalProps> = ({
  open,
  onClose,
  loading,
  error,
  totalSavings,
  totalRedemptions,
  activeDiscounts,
  history,
  shareCoupons,
  onShareCoupon,
  onRefresh,
  onApplyDiscount,
}) => {
  const [sharingId, setSharingId] = React.useState<string | null>(null);
  const [applyMessage, setApplyMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) {
      setSharingId(null);
      setApplyMessage(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!applyMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setApplyMessage(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [applyMessage]);

  if (!open) return null;

  const handleShare = async (coupon: ShareCouponSummary) => {
    try {
      setSharingId(coupon.id);
      await onShareCoupon(coupon);
    } catch (error) {
      console.error("No se pudo compartir el cupón", error);
    } finally {
      setSharingId(null);
    }
  };

  return (
    <OverlayPortal>
      <div className="orders-overlay" role="dialog" aria-modal="true" aria-label="Descuentos y ahorros">
        <div className="orders-modal discounts-modal">
          <header className="orders-modal__header">
            <div>
              <h2>Descuentos y beneficios</h2>
              <p className="orders-modal__subtitle">
                Mirá los códigos que tenés disponibles y cuánto ahorraste en tus pedidos confirmados.
              </p>
            </div>
            <button className="orders-close" type="button" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </header>
          <div className="orders-modal__main">

          {error && <p className="orders-error">{error}</p>}

          {loading ? (
            <div className="orders-loading" aria-busy="true">
              <div className="loader-ring loader-ring--sm">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <span>Cargando descuentos…</span>
            </div>
          ) : (
            <div className="discounts-content">
              <div className="discounts-column">
                <section className="discount-panel discount-panel--summary" aria-label="Resumen de ahorros">
                  <div className="discount-panel__header">
                    <div>
                      <h3>Resumen</h3>
                      <p>Últimos ahorros registrados en tu cuenta.</p>
                    </div>
                    <button className="btn-ghost btn-sm" type="button" onClick={onRefresh}>
                      Actualizar
                    </button>
                  </div>
                  <dl className="discount-summary">
                    <div>
                      <dt>Ahorro total</dt>
                      <dd>{currencyFormatter.format(totalSavings)}</dd>
                    </div>
                    <div>
                      <dt>Canjes realizados</dt>
                      <dd>{totalRedemptions}</dd>
                    </div>
                  </dl>
                </section>

                <section className="discount-panel" aria-labelledby="discounts-share">
                  <div className="discount-panel__header">
                    <h3 id="discounts-share">Códigos para compartir</h3>
                    <p>Enviá estos enlaces por WhatsApp para sumar beneficios.</p>
                  </div>
                  {shareCoupons.length === 0 ? (
                    <p className="discount-panel__empty">
                      Generamos tres códigos al mes para que compartas por WhatsApp y sumes beneficios. Tocá “Actualizar” si no ves los tuyos.
                    </p>
                  ) : (
                    <ul className="discounts-share-list">
                      {shareCoupons.map((coupon) => (
                        <li key={coupon.id} className={`discounts-share-item discounts-share-item--${coupon.status.toLowerCase()}`}>
                          <div className="discounts-share-item__header">
                            <strong>{coupon.code}</strong>
                            <span>{formatCycle(coupon.year, coupon.month)}</span>
                          </div>
                          <div className="discounts-share-item__meta">
                            <span>{resolveShareStatus(coupon)}</span>
                            {coupon.activatedAt && <span>Activado: {dateFormatter.format(new Date(coupon.activatedAt))}</span>}
                          </div>
                          <div className="discounts-share-item__actions">
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              disabled={coupon.status !== "ISSUED" || sharingId === coupon.id}
                              onClick={() => handleShare(coupon)}
                            >
                              {sharingId === coupon.id ? "Compartiendo…" : "Compartir"}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <div className="discounts-column">
                <section className="discount-panel" aria-labelledby="discounts-activos">
                  <div className="discount-panel__header">
                    <h3 id="discounts-activos">Códigos activos</h3>
                    <p>Aplicalos durante el checkout para obtener descuentos inmediatos.</p>
                    {applyMessage && <p className="discount-panel__feedback">{applyMessage}</p>}
                  </div>
                  {activeDiscounts.length === 0 ? (
                    <p className="discount-panel__empty">Hoy no tenés descuentos activos. ¡Seguí sumando pedidos y referidos!</p>
                  ) : (
                    <ul className="discounts-list">
                      {activeDiscounts.map((code) => (
                        <li key={code.id} className="discounts-item">
                          <div className="discounts-item__header">
                            <strong>{code.code}</strong>
                            <span className="discounts-item__value">{resolveDiscountLabel(code)}</span>
                          </div>
                          <div className="discounts-item__meta">
                            {code.label && <span>{code.label}</span>}
                            {code.description && <span>{code.description}</span>}
                            <span>Usos restantes: {code.usesRemaining}</span>
                            <span>Canjes totales: {code.totalUses}</span>
                            {code.expiresAt && <span>Vence: {dateFormatter.format(new Date(code.expiresAt))}</span>}
                          </div>
                          {onApplyDiscount && (
                            <div className="discounts-item__actions">
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() => {
                                  try {
                                    window.sessionStorage.setItem("pt_checkout_discount", code.code);
                                    setApplyMessage(`Listo: ${code.code} se aplicará en tu checkout.`);
                                  } catch (error) {
                                    console.error("No se pudo guardar el código para el checkout", error);
                                    setApplyMessage("No pudimos guardar el código. Probá copiarlo manualmente.");
                                  }
                                  if (onApplyDiscount) {
                                    onApplyDiscount(code);
                                  }
                                }}
                              >
                                Aplicar en checkout
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="discount-panel" aria-labelledby="discounts-historial">
                  <div className="discount-panel__header">
                    <h3 id="discounts-historial">Historial de ahorros</h3>
                    <p>Consultá cuánto aplicaste en pedidos anteriores.</p>
                  </div>
                  {history.length === 0 ? (
                    <p className="discount-panel__empty">Todavía no aplicaste descuentos. Cuando lo hagas, los verás acá.</p>
                  ) : (
                    <ul className="discounts-history">
                      {history.map((item) => (
                        <li key={item.id} className="discounts-history__item">
                          <div>
                            <strong>{item.code}</strong>
                            <span>{dateFormatter.format(new Date(item.redeemedAt))}</span>
                          </div>
                          <div>
                            <span>Ahorro: {currencyFormatter.format(item.valueApplied)}</span>
                            {item.orderCode && <span>Pedido {item.orderCode}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          )}
      </div>
          <footer className="orders-modal__footer">
            <button className="btn-primary" type="button" onClick={onClose}>
              Listo
            </button>
          </footer>
        </div>
      </div>
    </OverlayPortal>
  );
};

const resolveDiscountLabel = (code: DiscountEntry) => {
  if (code.percentage) {
    return `${parseFloat(code.percentage)}%`;
  }
  return currencyFormatter.format(parseFloat(code.value));
};

const cycleFormatter = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
});

const formatCycle = (year: number, month: number) => {
  return cycleFormatter.format(new Date(year, month - 1, 1));
};

const resolveShareStatus = (coupon: ShareCouponSummary) => {
  switch (coupon.status) {
    case "ACTIVATED":
      return "Compartido";
    case "REDEEMED":
      return "Canjeado";
    default:
      return "Listo para compartir";
  }
};
