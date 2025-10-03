import React from "react";
import useScrollLock from "hooks/useScrollLock";
import { OverlayPortal } from "components/common/OverlayPortal";

export const SubmittingOverlay: React.FC<{ active: boolean }> = ({ active }) => {
  useScrollLock(active);

  if (!active) return null;

  return (
    <OverlayPortal>
      <div className="bonus-overlay" role="status" aria-live="polite">
        <div className="bonus-overlay__content bonus-modal">
          <p className="bonus-overlay__eyebrow small" aria-hidden="true">
            Preparando pedido
          </p>
        <div className="bonus-overlay__spinner" aria-hidden>
          <div className="loader-ring">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
          <p className="small">Estamos abriendo WhatsApp con tu pedido listo. Puede tardar unos segundos.</p>
        </div>
      </div>
    </OverlayPortal>
  );
};
