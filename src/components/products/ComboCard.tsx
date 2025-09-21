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
    <article className="combo-card" aria-label={combo.name}>
      <header className="combo-card__header">
        <h3 className="combo-card__title">{combo.name}</h3>
      </header>
      <p className="combo-card__description">{combo.description}</p>
      {requiresSide && (
        <div className="combo-card__options">
          <label className="combo-card__picker">
            <span className="combo-card__hint">Elegí tu guarnición</span>
            <select
              value={selectedSide}
              onChange={(event) => setSelectedSide(event.target.value)}
              aria-label={`Guarnición para ${combo.name}`}
            >
              <option value="" disabled>
                Seleccioná una opción
              </option>
              {sideOptions.map((option) => (
                <option value={option} key={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <footer className="combo-card__footer">
        <span className="combo-card__price">{money(combo.price)}</span>
        <button
          className="btn-primary btn-sm combo-card__button"
          onClick={handleAdd}
          disabled={!canAdd}
          aria-disabled={!canAdd}
        >
          Agregar
        </button>
      </footer>
    </article>
  );
};
