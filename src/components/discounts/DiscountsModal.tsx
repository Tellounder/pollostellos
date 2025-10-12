import React from "react";
import { OverlayPortal } from "components/common/OverlayPortal";
import type { ShareCouponSummary } from "utils/orders";

type ActiveDiscount = {
  id: string;
  code: string;
  label: string;
  value: string;
  percentage?: string | null;
  expiresAt?: string | null;
  usesRemaining: number;
  totalUses: number;
};

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
  activeDiscounts: ActiveDiscount[];
  history: DiscountHistoryItem[];
  shareCoupons: ShareCouponSummary[];
  onShareCoupon: (coupon: ShareCouponSummary) => Promise<void> | void;
  onRefresh: () => void;
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
}) => {
  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const [sharingId, setSharingId] = React.useState<string | null>(null);

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

          <div className="discounts-summary">
            <div>
              <span className="discounts-summary__label">Ahorro total</span>
              <strong className="discounts-summary__value">{currencyFormatter.format(totalSavings)}</strong>
            </div>
            <div>
              <span className="discounts-summary__label">Canjes realizados</span>
              <strong className="discounts-summary__value">{totalRedemptions}</strong>
            </div>
            <button className="btn-ghost btn-sm" type="button" onClick={onRefresh}>
              Actualizar
            </button>
          </div>

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
              <section className="discounts-section" aria-labelledby="discounts-share">
                <div className="orders-section__header">
                  <h3 id="discounts-share">Códigos para compartir</h3>
                </div>
                {shareCoupons.length === 0 ? (
                  <p className="orders-empty">
                    Generamos tres códigos al mes para que compartas por WhatsApp y sumes beneficios. Tocá
                    “Actualizar” si no ves los tuyos.
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
                          {coupon.activatedAt && (
                            <span>Activado: {dateFormatter.format(new Date(coupon.activatedAt))}</span>
                          )}
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

              <section className="discounts-section" aria-labelledby="discounts-activos">
                <div className="orders-section__header">
                  <h3 id="discounts-activos">Códigos activos</h3>
                </div>
                {activeDiscounts.length === 0 ? (
                  <p className="orders-empty">Hoy no tenés descuentos activos. ¡Seguí sumando pedidos y referidos!</p>
                ) : (
                  <ul className="discounts-list">
                    {activeDiscounts.map((code) => (
                      <li key={code.id} className="discounts-item">
                        <div className="discounts-item__header">
                          <strong>{code.code}</strong>
                          <span className="discounts-item__value">{resolveDiscountLabel(code)}</span>
                        </div>
                        <div className="discounts-item__meta">
                          <span>Usos restantes: {code.usesRemaining}</span>
                          <span>Canjes totales: {code.totalUses}</span>
                          {code.expiresAt && (
                            <span>Vence: {dateFormatter.format(new Date(code.expiresAt))}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="discounts-section" aria-labelledby="discounts-historial">
                <div className="orders-section__header">
                  <h3 id="discounts-historial">Historial de ahorros</h3>
                </div>
                {history.length === 0 ? (
                  <p className="orders-empty">Todavía no aplicaste descuentos. Cuando lo hagas, los verás acá.</p>
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
          )}

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

const resolveDiscountLabel = (code: ActiveDiscount) => {
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
