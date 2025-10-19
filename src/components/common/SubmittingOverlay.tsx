import React from "react";
import { OverlayPortal } from "components/common/OverlayPortal";

export const SubmittingOverlay: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;

  return (
    <OverlayPortal>
      <div className="bonus-overlay checkin-overlay" role="status" aria-live="polite">
        <div className="bonus-overlay__content bonus-modal checkin-overlay__card">
          <div className="checkin-overlay__icon" aria-hidden>
            <span aria-hidden="true" role="img">
              🍗
            </span>
          </div>
          <p className="checkin-overlay__title">Check in pollo</p>
          <p className="checkin-overlay__subtitle">Cargando tu pedido…</p>
        </div>
      </div>
    </OverlayPortal>
  );
};
