import React, { useEffect, useRef } from "react";
import { OverlayPortal } from "components/common/OverlayPortal";

interface Props {
  active: boolean;
  seconds: number;
}

export const BonusCountdownOverlay: React.FC<Props> = ({ active, seconds }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || typeof document === "undefined") {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      containerRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
    };
  }, [active]);

  if (!active) {
    return null;
  }

  return (
    <OverlayPortal>
      <div className="bonus-overlay" role="status" aria-live="polite">
        <div
          className="bonus-overlay__content bonus-modal"
          ref={containerRef}
          tabIndex={-1}
        >
          <div className="bonus-modal__confetti" aria-hidden>
            ⏳
          </div>
          <p className="bonus-overlay__eyebrow small">Reservando tu Bonus</p>
          <h3>Ya casi es tuyo</h3>
          <p className="small">
            Dejá esta pestaña abierta. En {seconds}s confirmamos tu regalo para esta compra.
          </p>
          <div className="bonus-overlay__timer" aria-live="assertive">
            <span>{seconds}</span>
            <small>segundos</small>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};
