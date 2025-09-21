/**
 * Home access widget: gestiona CTA de invitado vs. usuario autenticado.
 */
import type { User } from "firebase/auth";

type Props = {
  user: User | null;
  onStartAsGuest: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  onGoToMenu: () => void;
};

export function AccessActions({ user, onStartAsGuest, onOpenLogin, onLogout, onGoToMenu }: Props) {
  if (user) {
    return (
      <>
        <h2 style={{ marginBottom: "1rem" }}>¡Bienvenido, {user.displayName || "Invitado"}!</h2>
        <div className="row" style={{ justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
          <button className="btn-primary btn-inline" type="button" onClick={onGoToMenu}>
            Ir al menú
          </button>
          <button className="btn-secondary btn-inline" type="button" disabled title="Próximamente">
            Mis pedidos
          </button>
          <button className="btn-secondary btn-inline" type="button" disabled title="Próximamente">
            Descuentos aplicados
          </button>
          <button className="btn-secondary btn-inline" type="button" disabled title="Próximamente">
            Mi perfil
          </button>
        </div>
        <div className="space"></div>
        <button className="btn-ghost" onClick={onLogout}>
          Cerrar sesión
        </button>
      </>
    );
  }

  return (
    <div className="row" style={{ justifyContent: "center" }}>
      <button
        className="btn-primary btn-inline"
        onClick={onStartAsGuest}
        aria-label="Continuar como invitado"
      >
        Continuar como invitado
      </button>

      <button className="btn-secondary btn-inline" onClick={onOpenLogin}>
        Iniciar sesión
      </button>

      <button className="btn-secondary btn-inline" onClick={onOpenLogin}>
        Registrarse
      </button>
    </div>
  );
}
