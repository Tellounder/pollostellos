import React, { useEffect, useRef } from "react";
import { OverlayPortal } from "components/common/OverlayPortal";

interface Props {
  open: boolean;
  userName: string;
  totalPurchases: number;
  onRedeem: () => void;
}

export const BonusRewardModal: React.FC<Props> = ({ open, userName, totalPurchases, onRedeem }) => {
  const redeemRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      redeemRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <OverlayPortal>
      <div className="bonus-overlay" role="dialog" aria-modal="true" aria-label="Bonus desbloqueado">
        <div className="bonus-overlay__content bonus-modal">
          <div className="bonus-modal__confetti" aria-hidden>
            🎁
          </div>
          <p className="bonus-overlay__eyebrow small">Regalo desbloqueado</p>
          <h3>¡{userName || "Cliente"}, gracias por ser parte de Pollos Tello&apos;s!</h3>
          <p className="small">
            {totalPurchases > 0
              ? `Llevás ${totalPurchases} pedidos con nosotros, así que te premiamos con un Bonus Tello's exclusivo.`
              : "Te premiamos con un Bonus Tello's exclusivo."}
          </p>
          <p className="bonus-overlay__note small">Tenés 5 oportunidades: tocá el botón y descubrí tu regalo.</p>
          <button className="btn-primary" type="button" onClick={onRedeem} ref={redeemRef}>
            Bonus Tello&apos;s
          </button>
        </div>
      </div>
    </OverlayPortal>
  );
};
