/**
 * Drawer lateral: carrito persistente dentro del flujo de compra.
 */
import { useCart } from "hooks/useCart";
import { money } from "utils/format";

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
  onGoCheckout: () => void;
};

export const CartDrawer: React.FC<CartDrawerProps> = ({ open, onClose, onGoCheckout }) => {
  const { items, setQty, removeItem, totalLabel, clearCart } = useCart();

  return (
    <aside
      className={`cart-drawer ${open ? "open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Carrito"
    >
      <div className="cart-drawer__inner">
        <header className="cart-drawer__header">
          <h3 className="cart-drawer__title">Tu carrito</h3>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar carrito">
            Cerrar
          </button>
        </header>

        <div className="cart-drawer__body">
          {items.length === 0 ? (
            <p className="small cart-drawer__empty">Vacío por ahora.</p>
          ) : (
            items.map((item) => {
              const label = "name" in item ? item.name : item.label;
              return (
                <article key={item.key} className="cart-line cart-line--drawer">
                  <div className="cart-line__info">
                    <strong className="cart-line__name">{label}</strong>
                    {item.side && <div className="cart-line__meta small">Guarnición: {item.side}</div>}
                    <div className="cart-line__meta small">{money(item.price)} c/u</div>
                  </div>
                  <div className="cart-line__actions">
                    <div className="stepper" role="group" aria-label={`Cantidad ${label}`}>
                      <button
                        className="btn-ghost btn-sm"
                        aria-label="Quitar"
                        onClick={() => setQty(item.key, item.qty - 1)}
                      >
                        -
                      </button>
                      <div className="count" aria-live="polite">
                        {item.qty}
                      </div>
                      <button
                        className="btn-ghost btn-sm"
                        aria-label="Agregar"
                        onClick={() => setQty(item.key, item.qty + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="btn-ghost btn-sm cart-line__remove"
                      onClick={() => removeItem(item.key)}
                      aria-label={`Eliminar ${label}`}
                    >
                      ✕
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <footer className="cart-drawer__footer">
          <div className="cart-drawer__total">
            <span>Total</span>
            <strong className="price">{totalLabel}</strong>
          </div>
          <div className="cart-drawer__cta">
            <button className="btn-ghost btn-sm" onClick={clearCart}>
              Vaciar
            </button>
            <button
              className="btn-primary btn-sm"
              onClick={onGoCheckout}
              disabled={items.length === 0}
            >
              Ir a datos
            </button>
          </div>
        </footer>
      </div>
    </aside>
  );
};
