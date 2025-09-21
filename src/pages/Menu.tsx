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
      <div className="card center">
        <p>¡Bienvenido, Invitado! Continúa con tu pedido.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>¡Qué bueno verte, {user.displayName || 'crack'}!</h3>
      <p className="small">Aquí tienes algunas opciones:</p>
      <div className="grid grid-3" style={{ marginTop: '1rem' }}>
        <button className="btn-secondary">Mis pedidos</button>
        <button className="btn-secondary">Descuentos</button>
        <button className="btn-secondary">Mi perfil</button>
      </div>
      <div className="space" />
      <button className="btn-ghost" onClick={logout}>
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
    <section className="grid" aria-label="Selección de combos">

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
