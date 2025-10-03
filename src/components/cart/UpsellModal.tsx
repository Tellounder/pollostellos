/**
 * Modal de upsell: oferta contextual con captura rápida de datos del pedido.
 */
import React from "react";
import type { Product } from "store/cart";
import { isExtra } from "utils/constants";
import useScrollLock from "hooks/useScrollLock";
import { OverlayPortal } from "components/common/OverlayPortal";

type Props = {
  open: boolean;
  countdown: number;
  item?: Product | null;
  onAccept: () => void;
  onCancel: () => void;
};

export const UpsellModal: React.FC<Props> = ({ open, countdown, item, onAccept, onCancel }) => {
  useScrollLock(open);

  if (!open || !item) return null;

  const label = isExtra(item) ? item.label : item.name;
  const promoTitle = isExtra(item)
    ? `${label}`
    : `Sumá ${label}`;

  return (
    <OverlayPortal>
      <div className="bonus-overlay" role="dialog" aria-modal="true" aria-label={`Promo ${label}`}>
        <div className="bonus-overlay__content bonus-modal upsell-modal">
          <div className="bonus-modal__confetti" aria-hidden>
            🍗
          </div>
          <p className="bonus-overlay__eyebrow small">Oferta exclusiva</p>
          <h3>{promoTitle}</h3>
          <p className="small">
            Experiencia para tu paladar: pollito deshuesado listo para servir. Sumalo gratis antes de confirmar tu pedido.
          </p>
          <div className="cta-row">
            <button className="btn-ghost" aria-label="No aceptar" onClick={onCancel}>
              No, gracias
            </button>
            <button className="btn-primary" aria-label="Aceptar promoción" onClick={onAccept}>
              Deshuesado
            </button>
          </div>
          <div className="bonus-overlay__timer bonus-overlay__timer--compact" aria-live="polite">
            <span>{countdown}</span>
            <small>segundos</small>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};
