import React, { useEffect, useRef } from "react";
import { OverlayPortal } from "components/common/OverlayPortal";

interface Props {
  open: boolean;
  userName: string;
  totalPurchases?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const BonusPreModal: React.FC<Props> = ({ open, userName, totalPurchases, onConfirm, onCancel }) => {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      confirmRef.current?.focus();
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
      <div className="bonus-overlay" role="dialog" aria-modal="true" aria-label="Bonus por frecuencia">
        <div className="bonus-overlay__content bonus-modal">
          <div className="bonus-modal__confetti" aria-hidden>
            🎉
          </div>
          <p className="bonus-overlay__eyebrow small">Bonus Tello&apos;s</p>
          <h3>¡{userName || "Cliente"}, estás activando un regalito!</h3>
          <p className="small">
            {totalPurchases
              ? `Ya acumulaste ${totalPurchases} pedidos con nosotros. Confirmá “Hacer mi pedido” para enviar los datos por WhatsApp y reservar tu Bonus Tello's.`
              : "Confirmá “Hacer mi pedido” para enviar los datos por WhatsApp y reservar tu Bonus Tello's."}
          </p>
          <p className="bonus-overlay__note small" aria-live="polite">
            Al continuar abriremos WhatsApp con tu pedido listo para enviar.
          </p>
          <div className="cta-row">
            <button className="btn-ghost" type="button" onClick={onCancel}>
              Más tarde
            </button>
            <button className="btn-primary" type="button" onClick={onConfirm} ref={confirmRef}>
              Hacer mi pedido
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};
