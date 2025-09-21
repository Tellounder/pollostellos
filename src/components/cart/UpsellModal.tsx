/**
 * Modal de upsell: oferta contextual con captura rápida de datos del pedido.
 */
import React from "react";
import type { Product } from "store/cart";
import { isExtra } from "utils/constants";

type Props = {
  open: boolean;
  countdown: number;
  item?: Product | null;
  onAccept: () => void;
  onCancel: () => void;
};

export const UpsellModal: React.FC<Props> = ({ open, countdown, item, onAccept, onCancel }) => {
  if (!open || !item) return null;

  const label = isExtra(item) ? item.label : item.name;
  const priceLabel = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(item.price);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`Promo ${label}`}>
      <div className="box">
        <div className="spinner spin" aria-hidden>
          🍗
        </div>
        <h3 style={{ fontSize: 24, marginTop: 4 }}>Promo por tiempo limitado</h3>
        <h4 style={{ margin: 6, fontSize: 18, color: "var(--text)" }}>
          Sumá {label} al mismo precio
        </h4>
        <p className="lead" style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
          Mantiene el valor en {priceLabel}
        </p>
        <p className="small">
          Mejorá la experiencia: pollo deshuesado listo para servir.
        </p>
        <div className="cta-row">
          <button className="btn-ghost" aria-label="No aceptar" onClick={onCancel}>
            No, gracias
          </button>
          <button className="btn-primary" aria-label="Aceptar promoción" onClick={onAccept}>
            Agregar deshuesado
          </button>
        </div>
        <div className="countdown">Se cierra en {countdown}s…</div>
      </div>
    </div>
  );
};
