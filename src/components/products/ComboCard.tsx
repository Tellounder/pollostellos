import React, { useState } from "react";
import type { Combo } from "utils/constants";
import { useCart } from "hooks/useCart";
import { money } from "utils/format";

type Props = {
  combo: Combo;
};

export const ComboCard: React.FC<Props> = ({ combo }) => {
  const { addItem } = useCart();
  const [selectedSide, setSelectedSide] = useState<string>("");

  const sideOptions = combo.sideOptions ?? [];
  const requiresSide = combo.hasSide && sideOptions.length > 0;
  const canAdd = !requiresSide || Boolean(selectedSide);

  const handleAdd = () => {
    if (requiresSide && !selectedSide) {
      return;
    }
    addItem(combo, 1, requiresSide ? selectedSide : undefined);
  };

  return (
    <div className="combo-card">
      <h3>{combo.name}</h3>
      <p>{combo.description}</p>
      {requiresSide && (
        <>
          <div className="small">Elegí tu guarnición</div>
          <div
            className="chip-group"
            role="group"
            aria-label={`Guarnición para ${combo.name}`}
          >
            {sideOptions.map((option) => (
              <button
                type="button"
                key={option}
                className={`chip ${selectedSide === option ? "active" : ""}`}
                onClick={() => setSelectedSide(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="price">{money(combo.price)}</div>
      <button
        className="btn-primary"
        onClick={handleAdd}
        disabled={!canAdd}
        aria-disabled={!canAdd}
      >
        Agregar
      </button>
    </div>
  );
};
