/**
 * Datos de entrega: formulario + resumen antes de enviar pedido vía WhatsApp.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "hooks/useCart";
import { useAuth } from "hooks/useAuth";
import { useUpsell } from "hooks/useUpsell";
import { UpsellModal } from "components/cart/UpsellModal";
import { waLink } from "utils/format";
import { EXTRAS, WHATSAPP_NUMBER } from "utils/constants";

const formatArs = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(value);

const promoExtra = EXTRAS.find((extra) => extra.id === "deshuesado") ?? null;

type OrderForm = {
  customerName: string;
  deliveryAddress: string;
  email: string;
  phoneNumber: string;
  paymentMethod: string;
};

const initialForm: OrderForm = {
  customerName: "",
  deliveryAddress: "",
  email: "",
  phoneNumber: "",
  paymentMethod: "Efectivo (MP próximamente)",
};

const Checkout: React.FC = () => {
  const { items, addItem, setQty, removeItem, totalLabel, clearCart } = useCart();
  const { user } = useAuth();
  const { open, countdown, item, accepted, show, accept, cancel, reset } = useUpsell();
  const navigate = useNavigate();
  const [form, setForm] = useState<OrderForm>(initialForm);
  const promoTriggeredRef = useRef(false);
  const pendingFocusRef = useRef<null | (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)>(null);
  const wasOpenRef = useRef(open);
  const formTopRef = useRef<HTMLDivElement | null>(null);
  const showTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    promoTriggeredRef.current = false;
    pendingFocusRef.current = null;
    if (showTimeoutRef.current) {
      window.clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    reset();
  }, [reset]);

  const resumePendingFocus = useCallback(() => {
    const element = pendingFocusRef.current;
    if (!element) {
      return;
    }
    pendingFocusRef.current = null;

    window.setTimeout(() => {
      if (!element.isConnected) {
        return;
      }
      try {
        element.focus({ preventScroll: true });
      } catch (error) {
        element.focus();
      }
    }, 120);
  }, []);

  const handleUpsellAccept = () => {
    if (promoExtra) {
      addItem(promoExtra);
    }
    accept();
    resumePendingFocus();
  };

  const handleUpsellCancel = () => {
    cancel();
    resumePendingFocus();
  };

  const handleFormFocus = (
    event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    if (!promoExtra || promoTriggeredRef.current || accepted || open) {
      return;
    }
    promoTriggeredRef.current = true;
    pendingFocusRef.current = event.currentTarget;
    if (typeof event.currentTarget.blur === "function") {
      event.currentTarget.blur();
    }
    const rect = formTopRef.current?.getBoundingClientRect();
    if (rect) {
      const target = Math.max(0, rect.top + window.scrollY - 32);
      window.scrollTo({ top: target, behavior: "smooth" });
    }

    if (showTimeoutRef.current) {
      window.clearTimeout(showTimeoutRef.current);
    }

    showTimeoutRef.current = window.setTimeout(() => {
      show(promoExtra);
      showTimeoutRef.current = null;
    }, rect ? 160 : 60);
  };

  const handleChange = <K extends keyof OrderForm>(field: K, value: OrderForm[K]) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const pedidoMessage = useMemo(() => {
    let intro = `🍗 NUEVO PEDIDO - POLLOS TELLO’S\n\n`;

    intro += `\t\u{200B}👤 Cliente: ${form.customerName || user?.displayName || "Invitado"}\n`;
    if (form.email) {
      intro += `\t\u{200B}📧 Email: ${form.email}\n`;
    }
    if (form.phoneNumber) {
      intro += `\t\u{200B}📱 Teléfono: ${form.phoneNumber}\n`;
    }
    intro += `\t\u{200B}📍 Dirección: ${form.deliveryAddress}\n\n`;
    intro += `\t\u{200B}🛒 CARRITO:\n`;

    const itemsText = items
      .map((item) => {
        const label = "name" in item ? item.name : item.label;
        const sideLabel = item.side ? ` (${item.side})` : "";
        const total = formatArs(item.price * item.qty);
        let base = `\t\u{200B}- ${label}${sideLabel} x${item.qty} — ${total}`;
        if ("description" in item && item.description) {
          base += `\n\t\u{200B}  _${item.description}_`;
        }
        return base;
      })
      .join("\n");

    intro += `${itemsText}\n\n`;
    intro += `\t\u{200B}💰 TOTAL: ${totalLabel}`;
    intro += `\n\t\u{200B}🍖 Pollo deshuesado: ${accepted ? "Sí" : "No"}`;
    intro += `\n\t\u{200B}💳 Método de pago: ${form.paymentMethod}`;
    intro += `\n\t\u{200B}👤 Usuario: ${user?.displayName || user?.email || "Invitado"}`;

    return intro;
  }, [accepted, form, items, totalLabel, user]);

  const handleSubmit = () => {
    window.open(waLink(WHATSAPP_NUMBER, pedidoMessage), "_blank");
    clearCart();
    setForm(initialForm);
    navigate("/thanks");
  };

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      resumePendingFocus();
    }
    wasOpenRef.current = open;
  }, [open, resumePendingFocus]);

  const isFormValid = useMemo(() => {
    if (items.length === 0) return false;
    const hasName = form.customerName.trim().length > 0;
    const hasAddress = form.deliveryAddress.trim().length > 0;
    const hasEmail = /.+@.+\..+/.test(form.email.trim());
    const hasPayment = form.paymentMethod.trim().length > 0;
    return hasName && hasAddress && hasEmail && hasPayment;
  }, [form, items.length]);

  useEffect(
    () => () => {
      if (showTimeoutRef.current) {
        window.clearTimeout(showTimeoutRef.current);
      }
    },
    []
  );

  return (
    <div ref={formTopRef} className="container">
      <h2>Datos de entrega</h2>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="grid" style={{ gap: 16 }}>
          <label className="field">
            <span className="field-label">Nombre y apellido *</span>
            <input
              type="text"
              autoComplete="name"
              value={form.customerName}
              onChange={(e) => handleChange("customerName", e.target.value)}
              onFocus={handleFormFocus}
              placeholder="Tu nombre"
            />
          </label>
          <label className="field">
            <span className="field-label">Dirección *</span>
            <input
              type="text"
              autoComplete="street-address"
              value={form.deliveryAddress}
              onChange={(e) => handleChange("deliveryAddress", e.target.value)}
              onFocus={handleFormFocus}
              placeholder="Calle, número, piso, depto."
            />
          </label>
          <label className="field">
            <span className="field-label">Correo electrónico *</span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              onFocus={handleFormFocus}
              placeholder="tu@email.com"
            />
          </label>
          <label className="field">
            <span className="field-label">Teléfono</span>
            <input
              type="tel"
              autoComplete="tel"
              value={form.phoneNumber}
              onChange={(e) => handleChange("phoneNumber", e.target.value)}
              onFocus={handleFormFocus}
              placeholder="+54 9 11 1234-5678"
            />
          </label>
          <label className="field">
            <span className="field-label">Método de pago *</span>
            <select
              value={form.paymentMethod}
              onChange={(e) => handleChange("paymentMethod", e.target.value)}
              onFocus={handleFormFocus}
            >
              <option value="Efectivo (MP próximamente)">Efectivo (MP próximamente)</option>
              <option value="Mercado Pago (pronto)">Mercado Pago (pronto)</option>
            </select>
          </label>
        </div>
      </div>
      <div className="card">
        <h3>Tu pedido</h3>
        {items.length === 0 ? (
          <p className="small">Todavía no agregaste productos.</p>
        ) : (
          <>
            {items.map((item) => (
              <div className="cart-line" key={item.key}>
                <div style={{ maxWidth: "65%" }}>
                  <strong>{"name" in item ? item.name : item.label}</strong>
                  {"description" in item && item.description && (
                    <div className="small">{item.description}</div>
                  )}
                  {item.side && <div className="small">Guarnición: {item.side}</div>}
                  <div className="small">{formatArs(item.price)}</div>
                </div>
                <div className="stepper" role="group">
                  <button className="btn-ghost" onClick={() => setQty(item.key, item.qty - 1)}>
                    -
                  </button>
                  <div className="count">{item.qty}</div>
                  <button className="btn-ghost" onClick={() => setQty(item.key, item.qty + 1)}>
                    +
                  </button>
                </div>
                <button className="btn-ghost" onClick={() => removeItem(item.key)}>
                  Eliminar
                </button>
              </div>
            ))}
            <hr />
            <div className="cart-line">
              <strong>Total</strong>
              <strong>{totalLabel}</strong>
            </div>
          </>
        )}
      </div>
      <div className="actions">
        <button className="btn-primary" onClick={handleSubmit} disabled={!isFormValid}>
          Realizar pedido
        </button>
        <button className="btn-ghost" onClick={() => navigate("/menu")}>
          Volver a combos
        </button>
      </div>
      <UpsellModal
        open={open}
        countdown={countdown}
        item={item}
        onAccept={handleUpsellAccept}
        onCancel={handleUpsellCancel}
      />
    </div>
  );
};

export { Checkout };
