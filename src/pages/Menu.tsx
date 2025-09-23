import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "hooks/useCart";
import { useAuth } from "hooks/useAuth";
import { COMBOS } from "utils/constants";
import { ComboCard } from "components/products/ComboCard";
import { ExtrasList } from "components/products/ExtrasList";
import Avatar1 from "../assets/avatar/av1.svg";
import Avatar2 from "../assets/avatar/av2.svg";
import Avatar3 from "../assets/avatar/av3.svg";
import Avatar4 from "../assets/avatar/av4.svg";
import Avatar5 from "../assets/avatar/av5.svg";
import Avatar6 from "../assets/avatar/av6.svg";

const AVATARS = [Avatar1, Avatar2, Avatar3, Avatar4, Avatar5, Avatar6];

const UserSection: React.FC = () => {
  const { user, logout } = useAuth();
  const [avatarIndex, setAvatarIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setAvatarIndex(null);
      return;
    }

    const pickRandom = () => Math.floor(Math.random() * AVATARS.length);

    if (typeof window === "undefined") {
      setAvatarIndex(pickRandom());
      return;
    }

    const sessionKey = `pt-avatar-${user.uid || user.email || "guest"}`;

    try {
      const stored = window.sessionStorage.getItem(sessionKey);
      const storedIndex = stored !== null ? Number(stored) : Number.NaN;

      if (
        Number.isInteger(storedIndex) &&
        storedIndex >= 0 &&
        storedIndex < AVATARS.length
      ) {
        setAvatarIndex(storedIndex);
        return;
      }

      const newIndex = pickRandom();
      window.sessionStorage.setItem(sessionKey, String(newIndex));
      setAvatarIndex(newIndex);
    } catch (error) {
      setAvatarIndex((prev) => (prev !== null ? prev : pickRandom()));
    }
  }, [user?.uid, user?.email]);

  const avatarSrc = avatarIndex !== null ? AVATARS[avatarIndex] : null;

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
      <div
        className={`menu-intro__avatar${avatarSrc ? " menu-intro__avatar--img" : ""}`}
        aria-hidden
        style={avatarSrc ? { backgroundImage: `url(${avatarSrc})` } : undefined}
      />
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
