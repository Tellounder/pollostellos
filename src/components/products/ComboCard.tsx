import React, { useEffect, useRef, useState } from "react";
import type { Combo } from "utils/constants";
import { useCart } from "hooks/useCart";
import { money } from "utils/format";

type Props = {
  combo: Combo;
  displayPrice?: number;
  originalPrice?: number;
  locked?: boolean;
  lockedMessage?: string;
  onLockedClick?: () => void;
};

export const ComboCard: React.FC<Props> = ({
  combo,
  displayPrice,
  originalPrice,
  locked = false,
  onLockedClick, // removed lockedMessage from destructuring to avoid unused variable
}) => {
  const { addItem } = useCart();
  const DEFAULT_LABEL = "Guarnición favorita";
  const [selectedSide, setSelectedSide] = useState<string>("");
  const [quickLabel, setQuickLabel] = useState<string>(DEFAULT_LABEL);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  const sideOptions = combo.sideOptions ?? [];
  const requiresSide = combo.hasSide && sideOptions.length > 0;
  const canAdd = !requiresSide || Boolean(selectedSide);
  const effectivePrice = displayPrice ?? combo.price;
  const isLocked = locked;

  const priceElement = (
    <span className="combo-card__price">
      {typeof originalPrice === "number" && (
        <span className="combo-card__price-original">{money(originalPrice)}</span>
      )}
      <span className="combo-card__price-current">{money(effectivePrice)}</span>
    </span>
  );

  const handleSelectChange = (value: string) => {
    setSelectedSide(value);
    setQuickLabel(value ? value : DEFAULT_LABEL);
  };

  useEffect(() => {
    if (!requiresSide) {
      setQuickLabel(DEFAULT_LABEL);
      setSelectedSide("");
    }
  }, [requiresSide]);

  const handleAdd = () => {
    if (requiresSide && !selectedSide) {
      return;
    }
    addItem(combo, 1, requiresSide ? selectedSide : undefined);
  };

  const handleAction = () => {
    if (isLocked) {
      onLockedClick?.();
      return;
    }
    handleAdd();
  };

  const openNativeSelect = () => {
    const select = selectRef.current;
    if (!select) {
      return;
    }
    if (typeof (select as any).showPicker === "function") {
      (select as any).showPicker();
      return;
    }
    select.focus();
    select.click();
  };

  return (
    <article className={`combo-card${isLocked ? " combo-card--locked" : ""}`} aria-label={combo.name}>
      <header className="combo-card__header">
        <h3 className="combo-card__title">{combo.name}</h3>
        {isLocked && <span className="combo-card__badge">Exclusivo </span>}
      </header>

      {combo.image ? (
        <div className="combo-card__media-wrap" aria-hidden="true">
          <div className="combo-card__media">
            <img src={combo.image} alt={`Presentación de ${combo.name}`} loading="lazy" />
          </div>
          <div className="combo-card__price-tag combo-card__price-tag--overlay">{priceElement}</div>
        </div>
      ) : (
        <div className="combo-card__price-tag combo-card__price-tag--inline" aria-hidden="true">
          {priceElement}
        </div>
      )}

      {!combo.image && <div className="combo-card__spacer" aria-hidden="true" />}

      <p className="combo-card__description">{combo.description}</p>

      {requiresSide ? (
        <div className="combo-card__controls">
          <span className="combo-card__hint combo-card__hint--inline">Elegí tu guarnición favorita</span>
          <div className="combo-card__controls-row">
            <button
              className="btn-secondary combo-card__quick-select"
              type="button"
              onClick={openNativeSelect}
              aria-haspopup="listbox"
              aria-controls={`combo-select-${combo.id}`}
            >
              {quickLabel === DEFAULT_LABEL ? (
                <span className="combo-card__btn-text">
                  Guarnición
                  <br />
                  favorita
                </span>
              ) : (
                <span className="combo-card__btn-text">{quickLabel}</span>
              )}
            </button>

            <label className="combo-card__select" aria-hidden="true">
              <select
                id={`combo-select-${combo.id}`}
                ref={selectRef}
                value={selectedSide}
                onChange={(event) => handleSelectChange(event.target.value)}
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

            <button
              className="btn-primary btn-sm combo-card__button"
              onClick={handleAction}
              disabled={!canAdd}
              aria-disabled={!canAdd}
            >
              {isLocked ? (
                <span className="combo-card__btn-text">
                  Registrate
                  <br />
                  y ahorrá
                </span>
              ) : (
                <span className="combo-card__btn-text">
                  Agregar al
                  <br />
                  carrito
                </span>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="combo-card__controls combo-card__controls--solo">
          <button
            className="btn-primary btn-sm combo-card__button"
            onClick={handleAction}
            disabled={!canAdd}
            aria-disabled={!canAdd}
          >
            {isLocked ? (
              <span className="combo-card__btn-text">
                Registrate
                <br />
                y ahorrá
              </span>
            ) : (
              <span className="combo-card__btn-text">
                Agregar al
                <br />
                carrito
              </span>
            )}
          </button>
        </div>
      )}
    </article>
  );
};
