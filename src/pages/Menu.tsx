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

const COMBO1_SPECIAL_PRICE = 26000;
const COMBO2_ORIGINAL_PRICE = 52000;

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
          title: "Seguimos tu pedido acá.",
          body: "Te abrimos WhatsApp con tu orden lista. Enviála y volvé para revisar el estado y reordenar al toque.",
        },
        {
          title: "Guardá tus datos y progreso.",
          body: "Registrate para no completar tus datos de nuevo y ver el avance de tus pedidos confirmados.",
          ctaLabel: "Registrate",
          onCta: login,
        },
        {
          title: "Estamos atentos al mensaje.",
          body: "Si ya enviaste tu pedido, dejá la app abierta: te avisamos acá adentro cuando lo procesemos.",
        },
      ];
    }

    const lastOrderLabel = summary.lastPurchase?.items?.[0]?.label ?? null;
    const hasPendingBonus = summary.pendingBonus;

    return [
      {
        title: "Seguimos tu orden en tiempo real.",
        body: "Si ya la enviaste, mantené la app abierta: te avisamos cuando la confirmemos.",
      },
      {
        title: lastOrderLabel ? `¿Repetimos ${lastOrderLabel}?` : "Tu combo favorito listo en un toque.",
        body: lastOrderLabel
          ? "Sólo necesitás confirmar. Guardamos tus elecciones para que vuelvas rápido."
          : "Tu información quedó guardada. Cada confirmación hace tu próximo pedido más simple.",
      },
      {
        title: "Progreso y sorpresas.",
        body: hasPendingBonus
          ? "Tenemos una sorpresa esperándote en el checkout. Revisala cuando quieras."
          : "Cada pedido confirmado suma puntos. Te avisamos acá cuando haya una sorpresa para vos.",
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
    <div className="menu-hero__ticker" role="status" aria-live="polite">
      <div className="menu-hero__message">
        <strong className="menu-hero__message-title">{currentMessage.title}</strong>
        <span className="menu-hero__message-body">{currentMessage.body}</span>
        {currentMessage.ctaLabel && currentMessage.onCta && (
          <button className="btn-soft btn-sm menu-hero__message-cta" onClick={currentMessage.onCta}>
            {currentMessage.ctaLabel}
          </button>
        )}
      </div>
      
    </div>
  );

  if (!user) {
    return (
      <section className="card menu-hero menu-hero--guest">
        <header className="menu-hero__header">
          <span className="menu-hero__eyebrow">Primer pedido en segundos</span>
          <h2 className="menu-hero__title">Armá tu pedido</h2>
        </header>
        {renderTicker()}
        <div className="menu-hero__actions">
          <button className="btn-primary" type="button" onClick={login}>
            Iniciar sesión con Google
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card menu-hero menu-hero--user">
      <div className="menu-hero__profile">
        <div
          className="menu-hero__avatar"
          aria-hidden
          style={avatarSrc ? { backgroundImage: `url(${avatarSrc})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        />
        <div className="menu-hero__content">
          <span className="menu-hero__eyebrow">Progreso y sorpresas</span>
          <h2 className="menu-hero__title">¡Hola, {user.displayName || "crack"}!</h2>
          {renderTicker()}
        </div>
      </div>
      <button className="btn-ghost btn-sm menu-hero__logout" onClick={logout}>
        Cerrar sesión
      </button>
    </section>
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
      const guestOrder = [1, 3, 2];
      return COMBOS.filter((combo) => guestOrder.includes(combo.id)).sort(
        (a, b) => guestOrder.indexOf(a.id) - guestOrder.indexOf(b.id)
      );
    }
    return COMBOS;
  }, [isGuest]);

  const renderCombo = (combo: Combo) => {
    let locked = false;
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
          onLockedClick={locked ? handleLockedComboClick : undefined}
        />
      </div>
    );
  };

  return (
    <div className="menu-shell">
      <UserSection />

      <section className="menu-section" aria-label="Combos disponibles">
        <header className="menu-section__header">
          <div>
            <span className="menu-section__eyebrow">Clásicos de la casa</span>
            <h2 className="menu-section__title">Elegí tu combo</h2>
          </div>
          <p className="menu-section__hint">Deslizá para ver todas las opciones</p>
        </header>
        {isGuest && (
          <p className="menu-section__guest-hint" role="note">
            Invitados pueden repetir el Combo 1 y el Menú Infantil. Registrate para desbloquear el Combo Familiar.
          </p>
        )}
        <div className="menu-section__slider menu-combos__slider" role="list">
          {combos.map(renderCombo)}
        </div>
      </section>

      <section className="menu-section" aria-label="Individuales disponibles">
        <header className="menu-section__header">
          <div>
            <span className="menu-section__eyebrow">Para completar tu mesa</span>
            <h2 className="menu-section__title">Individuales</h2>
          </div>
          <p className="menu-section__hint">Deslizá para ver todas las opciones</p>
        </header>
        <div className="menu-section__slider menu-combos__slider" role="list">
          {INDIVIDUALES.map(renderCombo)}
        </div>
      </section>

      <ExtrasList />

      <section className="card menu-nav">
        <div className="menu-nav__body">
          <h3 className="menu-nav__title">¿Listo para confirmar?</h3>
          <p className="menu-nav__copy">Podés revisar el carrito antes de continuar al checkout.</p>
        </div>
        <div className="menu-nav__actions">
          <button className="btn-ghost" onClick={() => navigate("/")} aria-label="Volver al inicio">
            Atrás
          </button>
          <button
            className="btn-primary"
            aria-label="Ir al checkout"
            onClick={() => navigate("/checkout")}
            disabled={!canCheckout}
          >
            Ir al checkout
          </button>
        </div>
      </section>

      <LockedComboModal
        open={lockedComboModalOpen}
        onClose={() => setLockedComboModalOpen(false)}
        onLogin={login}
      />
    </div>
  );
}
