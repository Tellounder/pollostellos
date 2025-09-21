import { useNavigate } from "react-router-dom";
import { useCart } from "hooks/useCart";
import { useAuth } from "hooks/useAuth";
import { COMBOS } from "utils/constants";
import { ComboCard } from "components/products/ComboCard";
import { ExtrasList } from "components/products/ExtrasList";

const UserSection: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <div className="card menu-intro menu-intro--guest">
        <h2 className="menu-intro__title">Armá tu pedido</h2>
        <p className="menu-intro__text small">
          Elegí un combo irresistible y sumá extras si querés darle un plus.
        </p>
      </div>
    );
  }

  return (
    <div className="card menu-intro menu-intro--user">
      <div className="menu-intro__avatar" aria-hidden />
      <div className="menu-intro__content">
        <h2 className="menu-intro__title">¡Hola, {user.displayName || "crack"}!</h2>
        <p className="menu-intro__text small">
          Guardamos tus datos para acelerar el pedido. Próximamente vas a poder elegir tu avatar.
        </p>
      </div>
      <button className="btn-ghost btn-sm menu-intro__logout" onClick={logout}>
        Cerrar sesión
      </button>
    </div>
  );
};

export function Menu() {
  const navigate = useNavigate();
  const { items } = useCart();
  const canCheckout = items.length > 0;

  return (
    <section className="grid menu-view" aria-label="Selección de combos">
      <UserSection />
      <div className="combos-grid">
        {COMBOS.map((c) => (
          <ComboCard key={c.id} combo={c} />
        ))}
      </div>
      <ExtrasList />
      <div className="card">
        <div
          className="row"
          style={{ justifyContent: "space-between", width: "100%" }}
        >
          <button
            className="btn-ghost"
            onClick={() => navigate("/")}
            aria-label="Volver al inicio"
          >
            Atrás
          </button>
          <div className="row" style={{ marginLeft: "auto", gap: 10 }}>
            <button
              className="btn-primary"
              aria-label="Ir a datos"
              onClick={() => {
                navigate("/checkout");
              }}
              disabled={!canCheckout}
            >
              Siguiente
            </button>
          </div>
        </div>
        <p className="small">
          Podés abrir el carrito para revisar antes de continuar.
        </p>
      </div>
    </section>
  );
}
