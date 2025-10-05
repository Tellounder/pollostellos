import React from "react";
import { OverlayPortal } from "components/common/OverlayPortal";

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
