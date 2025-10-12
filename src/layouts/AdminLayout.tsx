import { NavLink, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { ADMIN_EMAIL } from "config/admin";

const navItems = [
  { path: "/admin", label: "Panel" },
  { path: "/admin/pedidos", label: "Pedidos" },
  { path: "/admin/clientes", label: "Clientes" },
  { path: "/admin/descuentos", label: "Descuentos" },
  { path: "/admin/operaciones", label: "Operaciones" },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = useMemo(() => user?.email?.toLowerCase() === ADMIN_EMAIL, [user?.email]);

  const [timestamp, setTimestamp] = useState(() =>
    new Date().toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimestamp(new Date().toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" }));
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const sectionTitle = (() => {
    if (location.pathname.startsWith("/admin/pedidos")) return "Gestión de pedidos";
    if (location.pathname.startsWith("/admin/clientes")) return "Clientes";
    if (location.pathname.startsWith("/admin/descuentos")) return "Descuentos";
    if (location.pathname.startsWith("/admin/operaciones")) return "Operaciones";
    return "Panel general";
  })();

  return (
    <div className="admin-shell">
      <aside className="admin-shell__sidebar">
        <div className="admin-shell__brand">
          <span className="admin-shell__logo" aria-hidden>
            🍗
          </span>
          <div>
            <p>Pollos Tello’s</p>
            <small>Control y gestión</small>
          </div>
        </div>
        <nav className="admin-shell__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              className={({ isActive }) =>
                `admin-shell__nav-link${isActive ? " is-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-shell__content">
        <header className="admin-shell__topbar">
          <div>
            <p className="admin-shell__topbar-label">Modo administrador</p>
            <h2 className="admin-shell__topbar-title">{sectionTitle}</h2>
          </div>
          <div className="admin-shell__topbar-user">
            <div>
              <strong>{user?.displayName ?? user?.email ?? "Admin"}</strong>
              <span>{timestamp}</span>
            </div>
            <button type="button" className="btn-ghost" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </header>
        <main className="admin-shell__main" role="main" aria-live="polite">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
