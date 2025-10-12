import React from "react";
import { OverlayPortal } from "components/common/OverlayPortal";

export type ProfileFormValues = {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  addressLine: string;
  addressNotes: string;
};

export type ProfileStats = {
  monthlyOrders: number;
  lifetimeOrders: number;
  lifetimeNetSales: number;
  discountUsage: number;
  qualifiesForBonus: boolean;
};

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  saving: boolean;
  error?: string | null;
  success?: string | null;
  initialValues?: ProfileFormValues | null;
  stats?: ProfileStats | null;
  onSubmit: (values: ProfileFormValues) => void;
};

export const ProfileModal: React.FC<ProfileModalProps> = ({
  open,
  onClose,
  loading,
  saving,
  error,
  success,
  initialValues,
  stats,
  onSubmit,
}) => {
  const [form, setForm] = React.useState<ProfileFormValues | null>(null);

  React.useEffect(() => {
    if (!open) {
      setForm(null);
      return;
    }
    if (initialValues) {
      setForm(initialValues);
    }
  }, [open, initialValues]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    onSubmit(form);
  };

  return (
    <OverlayPortal>
      <div className="orders-overlay" role="dialog" aria-modal="true" aria-label="Perfil de usuario">
        <div className="orders-modal profile-modal">
          <header className="orders-modal__header">
            <div>
              <h2>Tu perfil</h2>
              <p className="orders-modal__subtitle">
                Actualizá tus datos de contacto y revisá tus estadísticas de pedidos.
              </p>
            </div>
            <button className="orders-close" type="button" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </header>

          {error && <p className="orders-error">{error}</p>}
          {success && <p className="profile-success">{success}</p>}

          {loading || !form ? (
            <div className="orders-loading" aria-busy="true">
              <div className="loader-ring loader-ring--sm">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <span>Cargando perfil…</span>
            </div>
          ) : (
            <form className="profile-form" onSubmit={handleSubmit}>
              <div className="profile-grid">
                <label>
                  <span>Nombre</span>
                  <input
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Nombre"
                  />
                </label>
                <label>
                  <span>Apellido</span>
                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Apellido"
                  />
                </label>
                <label>
                  <span>Nombre visible</span>
                  <input
                    type="text"
                    name="displayName"
                    value={form.displayName}
                    onChange={handleChange}
                    placeholder="Cómo aparece en la app"
                  />
                </label>
                <label>
                  <span>Teléfono</span>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+54 9 ..."
                  />
                </label>
                <label className="profile-grid--full">
                  <span>Dirección</span>
                  <input
                    type="text"
                    name="addressLine"
                    value={form.addressLine}
                    onChange={handleChange}
                    placeholder="Calle, número, piso…"
                  />
                </label>
                <label className="profile-grid--full">
                  <span>Notas de entrega</span>
                  <textarea
                    name="addressNotes"
                    value={form.addressNotes}
                    onChange={handleChange}
                    placeholder="Comentarios para el reparto"
                    rows={2}
                  />
                </label>
              </div>

              {stats && (
                <div className="profile-stats">
                  <div>
                    <span>Pedidos este mes</span>
                    <strong>{stats.monthlyOrders}</strong>
                  </div>
                  <div>
                    <span>Pedidos totales</span>
                    <strong>{stats.lifetimeOrders}</strong>
                  </div>
                  <div>
                    <span>Ventas netas acumuladas</span>
                    <strong>{currencyFormatter.format(stats.lifetimeNetSales)}</strong>
                  </div>
                  <div>
                    <span>Ahorro total en descuentos</span>
                    <strong>{currencyFormatter.format(stats.discountUsage)}</strong>
                  </div>
                  <div>
                    <span>¿Con bonus activo?</span>
                    <strong>{stats.qualifiesForBonus ? "Sí" : "Todavía no"}</strong>
                  </div>
                </div>
              )}

              <footer className="profile-actions">
                <button className="btn-ghost" type="button" onClick={onClose}>
                  Cancelar
                </button>
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </footer>
            </form>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
});
