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
}: Props) {
  if (user) {
    return (
      <>
        <h2 className="home-hero__greeting">¡Hola, {user.displayName || "crack"}!</h2>
        <div className="home-hero__actions home-hero__actions--signed">
          <button className="btn-primary home-hero__primary" type="button" onClick={onGoToMenu}>
            Ir al menú
          </button>
          <div className="home-hero__secondary">
            <button
              className="btn-secondary btn-sm"
              type="button"
              onClick={onOpenOrders}
              disabled={actionsDisabled}
            >
              Mis pedidos
            </button>
            {isAdmin && (
              <button
                className="btn-secondary btn-sm"
                type="button"
                onClick={onOpenAdmin ?? onOpenOrders}
                disabled={actionsDisabled}
              >
                Gestionar pedidos
              </button>
            )}
            <button
              className="btn-secondary btn-sm"
              type="button"
              onClick={onOpenDiscounts}
              disabled={actionsDisabled}
            >
              Descuentos
            </button>
            <button
              className="btn-secondary btn-sm"
              type="button"
              onClick={onOpenProfile}
              disabled={actionsDisabled}
            >
              Mi perfil
            </button>
          </div>
        </div>
        <button className="btn-ghost home-hero__ghost" onClick={onLogout}>
          Cerrar sesión
        </button>
      </>
    );
  }

  return (
    <div className="home-hero__actions">
      <button
        className="btn-primary home-hero__primary"
        onClick={onStartAsGuest}
        aria-label="Continuar como invitado"
      >
        Continuar como invitado
      </button>

      <div className="home-hero__secondary">
        <button className="btn-secondary btn-sm" onClick={onOpenLogin}>
          Iniciar sesión
        </button>

        <button className="btn-secondary btn-sm" onClick={onOpenLogin}>
          Registrarse
        </button>
      </div>
    </div>
  );
}
