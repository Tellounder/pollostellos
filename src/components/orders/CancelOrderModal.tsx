import React from "react";
import { OverlayPortal } from "components/common/OverlayPortal";

type CancelOrderModalProps = {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string | null) => void;
};

const QUICK_REASONS = [
  "Cliente no responde",
  "Error en el domicilio",
  "Stock agotado",
  "Pedido duplicado",
];

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({ open, loading, onClose, onConfirm }) => {
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setReason("");
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onConfirm(reason.trim() ? reason.trim() : null);
  };

  return (
    <OverlayPortal>
      <div className="orders-overlay" role="dialog" aria-modal="true" aria-label="Cancelar pedido">
        <form className="orders-modal" onSubmit={handleSubmit}>
          <header className="orders-modal__header">
            <div>
              <h2>Cancelar pedido</h2>
              <p className="orders-modal__subtitle">
                ¿Querés agregar un motivo para el equipo? Esto nos ayuda a ajustar el servicio.
              </p>
            </div>
            <button className="orders-close" type="button" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </header>

          <div className="orders-content" style={{ flexDirection: "column", gap: 16 }}>
            <div className="orders-quick-reasons" role="list">
              {QUICK_REASONS.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  className={`orders-quick-reasons__chip${reason === suggestion ? " is-active" : ""}`}
                  onClick={() => setReason(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <label className="profile-grid--full">
              <span>Motivo (opcional)</span>
              <textarea
                name="reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ej: Cliente no responde, stock agotado, etc."
              />
            </label>
          </div>

          <footer className="orders-modal__footer" style={{ display: "flex", gap: 12 }}>
            <button className="btn-ghost" type="button" onClick={onClose}>
              Volver
            </button>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Cancelando…" : "Confirmar cancelación"}
            </button>
          </footer>
        </form>
      </div>
    </OverlayPortal>
  );
};
