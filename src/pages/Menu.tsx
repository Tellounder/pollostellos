import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "hooks/useCart";
import { useAuth } from "hooks/useAuth";
import { useCustomerSummary } from "hooks/useCustomerSummary";
import { COMBOS, INDIVIDUALES } from "utils/constants";
import type { Combo } from "utils/constants";
import { ComboCard } from "components/products/ComboCard";
import { ExtrasList } from "components/products/ExtrasList";
import { OverlayPortal } from "components/common/OverlayPortal";
import useScrollLock from "hooks/useScrollLock";
import Avatar1 from "../assets/avatar/av1.svg";
import Avatar2 from "../assets/avatar/av2.svg";
import Avatar3 from "../assets/avatar/av3.svg";
import Avatar4 from "../assets/avatar/av4.svg";
import Avatar5 from "../assets/avatar/av5.svg";
import Avatar6 from "../assets/avatar/av6.svg";
import Avatar7 from "../assets/avatar/avt1.png";
import Avatar8 from "../assets/avatar/avt2.png";
import Avatar9 from "../assets/avatar/avt3.png";
import Avatar10 from "../assets/avatar/avt4.png";
import Avatar11 from "../assets/avatar/avt5.png";

const AVATARS = [
  Avatar1,
  Avatar2,
  Avatar3,
  Avatar4,
  Avatar5,
  Avatar6,
  Avatar7,
  Avatar8,
  Avatar9,
  Avatar10,
  Avatar11,
];

const COMBO1_SPECIAL_PRICE = 24000;
const COMBO2_ORIGINAL_PRICE = 48000;

type SliderMessage = {
  title: string;
  body: string;
  ctaLabel?: string;
  onCta?: () => void;
};

const LockedComboModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onLogin: () => void;
}> = ({ open, onClose, onLogin }) => {
  useScrollLock(open);

  if (!open) {
    return null;
  }

  const handleLogin = () => {
    onClose();
    onLogin();
  };

  return (
    <OverlayPortal>
      <div className="bonus-overlay" role="dialog" aria-modal="true" aria-label="Combo exclusivo para usuarios">
        <div className="bonus-overlay__content bonus-modal">
          <div className="bonus-modal__confetti" aria-hidden>
            🔒
          </div>
          <p className="bonus-overlay__eyebrow small">Combo especial</p>
          <h3>Registrate para desbloquearlo</h3>
          <p className="small">
            El Combo 2 es parte de los beneficios para usuarios registrados. Iniciá sesión o creá tu cuenta y obtené el precio especial.
          </p>
          <div className="cta-row">
            <button className="btn-ghost" type="button" onClick={onClose}>
              Más tarde
            </button>
            <button className="btn-primary" type="button" onClick={handleLogin}>
              Iniciar sesión
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

const UserSection: React.FC = () => {
  const { user, logout, login, backendUserId } = useAuth();
  const [avatarIndex, setAvatarIndex] = useState<number | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const summary = useCustomerSummary(backendUserId, user?.uid ?? null);

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

  const messages = useMemo<SliderMessage[]>(() => {
    if (!user) {
      return [
        {
          title: "Pollos Tello’s, alta gastronomía sin espera.",
          body: "Elegí tu combo, confirmá por WhatsApp y listo: nosotros nos encargamos.",
        },
        {
          title: "Atajos para vos.",
          body: "Registrate para guardar tus datos y pedir en segundos.",
          ctaLabel: "Registrate",
          onCta: login,
        },
        {
          title: "Bonus Tello’s en camino.",
          body: "Cada pedido suma. Registrate y desbloqueá regalos como el Combo 2.",
          ctaLabel: "Conocé beneficios",
          onCta: login,
        },
      ];
    }

    const lastOrderLabel = summary.lastPurchase?.items?.[0]?.label ?? null;
    const hasPendingBonus = summary.pendingBonus;

    return [
      {
        title: "Gracias por volver.",
        body: "Delivery gourmet de barrio, directo a tu puerta.",
      },
      {
        title: lastOrderLabel ? `¿Repetimos ${lastOrderLabel}?` : "Tu combo favorito está a un toque.",
        body: lastOrderLabel
          ? "Tu último pedido quedó listo como favorito. Podés sumarlo al carrito en segundos."
          : "Guardamos tus datos y preferencias para confirmar el próximo pedido sin vueltas.",
      },
      {
        title: "Bonus Tello’s activo.",
        body: hasPendingBonus
          ? "Tenés un beneficio listo para reclamar en el checkout. No lo dejes pasar."
          : "Seguí sumando pedidos: las sorpresas llegan cuando menos lo esperás.",
      },
    ];
  }, [login, summary.lastPurchase, summary.pendingBonus, user]);

  useEffect(() => {
    setMessageIndex(0);
    if (messages.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [messages]);

  const currentMessage = messages[messageIndex] ?? messages[0];

  const renderTicker = () => (
    <div className="menu-intro__ticker" role="status" aria-live="polite">
      <div className="menu-intro__message">
        <strong className="menu-intro__message-title">{currentMessage.title}</strong>
        <span className="menu-intro__message-body small">{currentMessage.body}</span>
        {currentMessage.ctaLabel && currentMessage.onCta && (
          <button className="btn-secondary btn-sm menu-intro__message-cta" onClick={currentMessage.onCta}>
            {currentMessage.ctaLabel}
          </button>
        )}
      </div>
      {messages.length > 1 && (
        <div className="menu-intro__ticker-dots">
          {messages.map((_, index) => (
            <span
              key={index}
              className={`menu-intro__ticker-dot ${messageIndex === index ? "is-active" : ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (!user) {
    return (
      <div className="card menu-intro menu-intro--guest">
        <h2 className="menu-intro__title">Armá tu pedido</h2>
        {renderTicker()}
      </div>
    );
  }

  return (
    <div className="card menu-intro menu-intro--user">
      <div
        className="menu-intro__avatar"
        aria-hidden
        style={avatarSrc ? { backgroundImage: `url(${avatarSrc})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      />
      <div className="menu-intro__content">
        <h2 className="menu-intro__title">¡Hola, {user.displayName || "crack"}!</h2>
        {renderTicker()}
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
  const { user, login } = useAuth();
  const canCheckout = items.length > 0;
  const isGuest = !user;
  const [lockedComboModalOpen, setLockedComboModalOpen] = useState(false);

  const handleLockedComboClick = () => {
    setLockedComboModalOpen(true);
  };

  const combos = useMemo(() => {
    if (isGuest) {
      return COMBOS.filter((combo) => combo.id === 1 || combo.id === 2);
    }
    return COMBOS;
  }, [isGuest]);

  const renderCombo = (combo: Combo) => {
    let locked = false;
    let lockedMessage: string | undefined;
    let originalPrice: number | undefined;
    let displayPrice = combo.price;
    let priceForCart = combo.price;

    if (combo.id === 1) {
      displayPrice = COMBO1_SPECIAL_PRICE;
      priceForCart = COMBO1_SPECIAL_PRICE;
    }

    if (combo.id === 2) {
      originalPrice = COMBO2_ORIGINAL_PRICE;
      if (isGuest) {
        locked = true;
        lockedMessage = "Registrate para acceder al Combo 2 con precio especial o repetí el Combo 1.";
      }
    }

    const comboForCard = { ...combo, price: priceForCart, originalPrice } as Combo & { originalPrice?: number };

    return (
      <div className="menu-combos__slide" key={combo.id} role="listitem">
        <ComboCard
          combo={comboForCard}
          displayPrice={displayPrice}
          originalPrice={originalPrice}
          locked={locked}
          lockedMessage={lockedMessage}
          onLockedClick={locked ? handleLockedComboClick : undefined}
        />
      </div>
    );
  };

  return (
    <section className="grid menu-view">
      <UserSection />
      <section className="menu-combos" aria-label="Combos disponibles">
        <div className="menu-combos__header">
          <h2 className="menu-combos__title">Elegí tu combo</h2>
          <p className="small menu-combos__hint">Deslizá para ver todas las opciones</p>
        </div>
        <div className="menu-combos__slider" role="list">
          {combos.map(renderCombo)}
        </div>
      </section>
      <section className="menu-combos" aria-label="Individuales disponibles">
        <div className="menu-combos__header">
          <h2 className="menu-combos__title">--- INDIVIDUALES ---</h2>
          <p className="small menu-combos__hint">Deslizá para ver todas las opciones</p>
        </div>
        <div className="menu-combos__slider" role="list">
          {INDIVIDUALES.map(renderCombo)}
        </div>
      </section>
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
      <LockedComboModal
        open={lockedComboModalOpen}
        onClose={() => setLockedComboModalOpen(false)}
        onLogin={login}
      />
    </section>
  );
}
