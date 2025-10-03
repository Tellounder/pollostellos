import { memo, useState } from "react";
import { EXTRAS } from "../../utils/constants";
import { useCart } from "../../hooks/useCart";
import { money } from "../../utils/format";

export const ExtrasList = memo(() => {
  const { items, addItem, setQty } = useCart();
  const [activeExtra, setActiveExtra] = useState<string | null>(null);

  const handleCardClick = (extraId: string) => {
    setActiveExtra(prev => (prev === extraId ? null : extraId));
  };

  return (
    <section className="card extras-list" aria-label="Extras y toppings">
      <h3 className="extras-list__title">Extras / Toppings</h3>
      <div className="extras-list__items">
        {EXTRAS.map((extra) => {
          const itemInCart = items.find((item) => item.key === extra.id);
          const count = itemInCart?.qty || 0;
          const isActive = activeExtra === extra.id;

          return (
            <article
              key={extra.id}
              className={`extras-list__item ${isActive ? "is-active" : ""}`}
              onClick={() => handleCardClick(extra.id)}
            >
              <h4 className="extras-list__item-title">{extra.label}</h4>
              <div className="extras-list__media">
                {extra.image ? (
                  <img src={extra.image} alt={extra.label} className="extras-list__image" />
                ) : (
                  <div className="extras-list__thumb" aria-hidden></div>
                )}
              </div>

              <div className="extras-list__bottom">
                {count === 0 ? (
                  <button
                    className="btn-primary extras-list__add"
                    onClick={(e) => {
                      e.stopPropagation(); // Evita que el click se propague al article
                      addItem(extra, 1);
                    }}
                    aria-label={`Agregar ${extra.label}`}
                  >
                    AGREGAR
                  </button>
                ) : (
                  <>
                    <div className="extras-list__price-badge">{money(extra.price)}</div>
                    <div
                      className="extras-list__stepper"
                      role="group"
                      aria-label={`Cantidad de ${extra.label}`}
                    >
                      <button
                        className="btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQty(extra.id, count - 1);
                        }}
                        aria-label="Quitar uno"
                      >
                        -
                      </button>
                      <div className="count" aria-live="polite">
                        {count}
                      </div>
                      <button
                        className="btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          addItem(extra, 1);
                        }}
                        aria-label="Agregar uno"
                      >
                        +
                      </button>
                    </div>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
});