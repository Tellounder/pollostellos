/**
 * Onboarding screen: invita a registrarse o continuar como invitado antes de entrar al flujo in-app.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "hooks/useAuth";
import { LoginModal } from "components/layout/LoginModal";
import { AccessActions } from "components/auth/AccessActions";

export function Home() {
  const { user, logout } = useAuth(); // Get logout for the new buttons
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/menu", { replace: true });
    }
  }, [user, navigate]);

  // Removed automatic navigation to /menu

  const startAsGuest = () => {
    try {
      sessionStorage.setItem("pt_guest", "true");
      sessionStorage.setItem("pt_greet_shown", "true");
    } catch (e) {
      console.error(e);
    }
    navigate("/menu");
  };

  return (
    <div className="grid" style={{ maxWidth: 560, margin: "24px auto", justifyItems: "center" }}>
      <div className="card center auth-card home-hero">
        <h1 className="home-hero__title">
          <span className="home-hero__icon" aria-hidden>
            🍗
          </span>
          <span>NUEVO PEDIDO</span>
        </h1>
        <p className="small home-hero__subtitle">Alta gastronomía sin espera</p>

        <AccessActions
          user={user}
          onStartAsGuest={startAsGuest}
          onOpenLogin={() => setLoginOpen(true)}
          onLogout={logout}
          onGoToMenu={() => navigate("/menu")}
        />
      </div>
      <div className="card center auth-card" style={{ padding: "24px 20px" }}>
        <h2>Zona de reparto</h2>
        <div className="zone-marquee" aria-label="Zonas disponibles">
          <div className="zone-marquee__track" aria-hidden>
            <span className="zone-marquee__item">CIUDADELA</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">VILLA REAL</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">VERSALLES</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">VILLA RAFFO</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">CASEROS</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">CIUDADELA</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">VILLA REAL</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">VERSALLES</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">VILLA RAFFO</span>
            <span className="zone-marquee__bullet">•</span>
            <span className="zone-marquee__item">CASEROS</span>
          </div>
        </div>
        <div className="map-container" aria-label="Cobertura de reparto">
          <iframe
            title="Zona de reparto Pollos Tello's"
            src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d10647.59322850008!2d-58.53262697618754!3d-34.62290339114094!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1ses-419!2sar!4v1758408103462!5m2!1ses-419!2sar"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <div className="radar-overlay" aria-hidden="true"></div>
        </div>
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
