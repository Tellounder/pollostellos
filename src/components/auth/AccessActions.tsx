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
  onOpenOrders: () => void;
  onOpenAdmin?: () => void;
  isAdmin: boolean;
  onOpenDiscounts: () => void;
  onOpenProfile: () => void;
  actionsDisabled?: boolean;
  hasActiveOrder?: boolean;
};

export function AccessActions({
  user,
  onStartAsGuest,
  onOpenLogin,
  onLogout,
  onGoToMenu,
  onOpenOrders,
  onOpenAdmin,
  isAdmin,
  onOpenDiscounts,
  onOpenProfile,
  actionsDisabled = false,
  hasActiveOrder = false,
}: Props) {
  if (user) {
    return (
      <div className="home-actions home-actions--signed">
        <div className="home-actions__intro">
          <p className="home-actions__greeting">¡Hola, {user.displayName || "crack"}!</p>
          <span className="home-actions__hint">Elegí cómo querés continuar</span>
        </div>
        <button className="btn-primary home-actions__primary" type="button" onClick={onGoToMenu}>
          Ir al menú
        </button>
        <div className="home-actions__grid">
          <button
            className="btn-soft btn-sm"
            type="button"
            onClick={onOpenOrders}
            disabled={actionsDisabled}
            aria-label={hasActiveOrder ? "Mis pedidos (pedido en curso)" : undefined}
          >
            Mis pedidos
            {hasActiveOrder && <span className="home-actions__badge" aria-hidden="true" />}
          </button>
          {isAdmin && (
            <button
              className="btn-soft btn-sm"
              type="button"
              onClick={onOpenAdmin ?? onOpenOrders}
              disabled={actionsDisabled}
            >
              Gestionar pedidos
            </button>
          )}
          <button
            className="btn-soft btn-sm"
            type="button"
            onClick={onOpenDiscounts}
            disabled={actionsDisabled}
          >
            Descuentos
          </button>
          <button
            className="btn-soft btn-sm"
            type="button"
            onClick={onOpenProfile}
            disabled={actionsDisabled}
          >
            Mi perfil
          </button>
        </div>
        <button className="btn-ghost home-actions__logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="home-actions home-actions--guest">
      <button
        type="button"
        className="btn-primary home-actions__primary"
        onClick={onStartAsGuest}
        aria-label="Continuar como invitado"
      >
        Continuar como invitado
      </button>
      <div className="home-actions__grid home-actions__grid--guest">
        <button
          type="button"
          className="btn-soft btn-sm"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            console.log("[AccessActions] click login");
            onOpenLogin();
          }}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          className="btn-soft btn-sm btn-soft--accent"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            console.log("[AccessActions] click register");
            onOpenLogin();
          }}
        >
          Registrarse
        </button>
      </div>
    </div>
  );
}
