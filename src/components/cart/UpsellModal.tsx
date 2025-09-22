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
  

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`Promo ${label}`}>
      <div className="box">
        <div className="spinner spin" aria-hidden>
          🍗
        </div>
        <h3 style={{ fontSize: 24, marginTop: 4 }}>PROMO POR TIEMPO LIMITADO</h3>
        <h4 style={{ margin: 6, fontSize: 18, color: "var(--text)" }}>
          Sumálo GRATIS
        </h4>
       
        <p className="small">
          Experiencia para tu paladar: Pollito deshuesado listo para servir.
        </p>
        <div className="cta-row">
          <button className="btn-ghost" aria-label="No aceptar" onClick={onCancel}>
            No, gracias
          </button>
          <button className="btn-primary" aria-label="Aceptar promoción" onClick={onAccept}>
            Sin Hueso
          </button>
        </div>
        <div className="countdown">Se cierra en {countdown}s…</div>
      </div>
    </div>
  );
};
