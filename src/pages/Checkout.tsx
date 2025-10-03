/**
 * Datos de entrega: formulario + resumen antes de enviar pedido vía WhatsApp.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "hooks/useCart";
import { useAuth } from "hooks/useAuth";
import { useUpsell } from "hooks/useUpsell";
import { UpsellModal } from "components/cart/UpsellModal";
import { BonusPreModal } from "components/bonus/BonusPreModal";
import { BonusCountdownOverlay } from "components/bonus/BonusCountdownOverlay";
import { BonusRewardModal } from "components/bonus/BonusRewardModal";
import { SubmittingOverlay } from "components/common/SubmittingOverlay";
import { waLink } from "utils/format";
import { api } from "utils/api";
import { EXTRAS, WHATSAPP_NUMBER } from "utils/constants";
import type { CartItem } from "store/cart";
import {
  PREFILL_FALLBACK_KEY,
  buildBonusCounterKeys,
  buildLastPurchaseKeys,
  buildPendingBonusKeys,
  writeStringToKeys,
  writeJSONToKeys,
  readFirstString,
  removeStoredKeys,
  type StoredPurchase,
  type PendingBonusState,
} from "utils/customerStorage";

const formatArs = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(value);

const promoExtra = EXTRAS.find((extra) => extra.id === "deshuesado") ?? null;

const isBonusThreshold = (count: number) => count >= 3 && (count % 7 === 3 || count % 7 === 0);

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
  paymentMethod: "Efectivo",
};

const Checkout: React.FC = () => {
  const { items, addItem, setQty, removeItem, totalLabel, clearCart } = useCart();
  const { user, backendUserId } = useAuth();
  const { open, countdown, item, accepted, show, accept, cancel, reset } = useUpsell();
  const navigate = useNavigate();
  const [form, setForm] = useState<OrderForm>(initialForm);
  const promoTriggeredRef = useRef(false);
  const formInteractedRef = useRef(false);
  const pendingFocusRef = useRef<null | (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)>(null);
  const wasOpenRef = useRef(open);
  const formTopRef = useRef<HTMLDivElement | null>(null);
  const showTimeoutRef = useRef<number | null>(null);
  const [bonusStage, setBonusStage] = useState<"idle" | "pre" | "countdown" | "reward">("idle");
  const [bonusInfo, setBonusInfo] = useState<{ totalPurchases: number } | null>(null);
  const [bonusCountdown, setBonusCountdown] = useState(60);
  const bonusIntervalRef = useRef<number | null>(null);
  const bonusTimeoutRef = useRef<number | null>(null);
  const submitDelayRef = useRef<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null);
  const profileStorageKey = useMemo(() => {
    if (!backendUserId) return null;
    return `pt_checkout_profile_${backendUserId}`;
  }, [backendUserId]);
  const profileCandidateKeys = useMemo(() => {
    const keys = new Set<string>();
    if (profileStorageKey) keys.add(profileStorageKey);
    if (user?.uid) keys.add(`${PREFILL_FALLBACK_KEY}_${user.uid}`);
    keys.add(PREFILL_FALLBACK_KEY);
    return Array.from(keys);
  }, [profileStorageKey, user?.uid]);
  const bonusCounterKeys = useMemo(
    () => buildBonusCounterKeys(backendUserId, user?.uid ?? null),
    [backendUserId, user?.uid]
  );
  const lastPurchaseKeys = useMemo(
    () => buildLastPurchaseKeys(backendUserId, user?.uid ?? null),
    [backendUserId, user?.uid]
  );
  const bonusPendingKeys = useMemo(
    () => buildPendingBonusKeys(backendUserId, user?.uid ?? null),
    [backendUserId, user?.uid]
  );
  const purchaseSnapshotRef = useRef<{ summary: StoredPurchase; totalPurchases: number } | null>(null);

  const persistProfileSnapshot = useCallback(
    (data: Partial<OrderForm>) => {
      if (typeof window === "undefined") {
        return;
      }
      try {
        const payload = JSON.stringify(data);
        for (const key of profileCandidateKeys) {
          window.localStorage.setItem(key, payload);
        }
        setPrefillNotice("Dirección predeterminada cargada automáticamente. Podés editarla antes de enviar.");
      } catch (storageError) {
        console.error("No se pudo guardar el perfil local de checkout", storageError);
      }
    },
    [profileCandidateKeys]
  );

  const readStoredProfile = useCallback(() => {
    if (typeof window === "undefined") {
      return false;
    }
    for (const key of profileCandidateKeys) {
      try {
        const stored = window.localStorage.getItem(key);
        if (!stored) continue;
        const data = JSON.parse(stored) as Partial<OrderForm>;
        setForm((prev) => ({ ...prev, ...data }));
        setPrefillNotice("Dirección predeterminada cargada automáticamente. Podés editarla antes de enviar.");
        return true;
      } catch (error) {
        console.error("No se pudo recuperar el perfil de checkout", error);
      }
    }
    return false;
  }, [profileCandidateKeys]);

  const readLocalBonusCount = useCallback(() => {
    if (typeof window === "undefined") {
      return 0;
    }
    const raw = readFirstString(bonusCounterKeys);
    if (!raw) {
      return 0;
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [bonusCounterKeys]);

  const persistBonusCount = useCallback(
    (value: number) => {
      if (typeof window === "undefined") {
        return;
      }
      if (!value || bonusCounterKeys.length === 0) {
        return;
      }
      writeStringToKeys(bonusCounterKeys, String(value));
    },
    [bonusCounterKeys]
  );

  const persistLastPurchase = useCallback(
    (purchase: StoredPurchase) => {
      writeJSONToKeys(lastPurchaseKeys, purchase);
    },
    [lastPurchaseKeys]
  );

  const markPendingBonus = useCallback(
    (state: PendingBonusState) => {
      writeJSONToKeys(bonusPendingKeys, state);
    },
    [bonusPendingKeys]
  );

  const clearPendingBonus = useCallback(() => {
    removeStoredKeys(bonusPendingKeys);
  }, [bonusPendingKeys]);

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

  const cleanupBonusTimers = useCallback(() => {
    if (bonusIntervalRef.current) {
      window.clearInterval(bonusIntervalRef.current);
      bonusIntervalRef.current = null;
    }
    if (bonusTimeoutRef.current) {
      window.clearTimeout(bonusTimeoutRef.current);
      bonusTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    let autoUpsellTimer: number | null = null;
    const restored = readStoredProfile();

    if (!restored) {
      setPrefillNotice(null);
    }

    if (!promoExtra) {
      return () => {
        if (autoUpsellTimer) {
          window.clearTimeout(autoUpsellTimer);
        }
      };
    }

    if (restored && !formInteractedRef.current && !promoTriggeredRef.current) {
      autoUpsellTimer = window.setTimeout(() => {
        if (!formInteractedRef.current && !promoTriggeredRef.current) {
          formInteractedRef.current = true;
          promoTriggeredRef.current = true;
          show(promoExtra);
        }
      }, 3000);
    }

    return () => {
      if (autoUpsellTimer) {
        window.clearTimeout(autoUpsellTimer);
      }
    };
  }, [promoExtra, readStoredProfile, show, user]);

  const handleUpsellAccept = () => {
    if (!user) {
      window.alert("Registrate para acceder al deshuesado de cortesía.");
      cancel();
      resumePendingFocus();
      return;
    }
    if (promoExtra) {
      const freeExtra = { ...promoExtra, price: 0, originalPrice: promoExtra.price };
      addItem(freeExtra);
    }
    accept();
    resumePendingFocus();
  };

  const handleUpsellCancel = () => {
    cancel();
    resumePendingFocus();
  };

  const openWhatsApp = () => {
    window.open(waLink(WHATSAPP_NUMBER, pedidoMessage), "_blank");
  };

  const finalizeOrder = () => {
    clearCart();
    setForm(initialForm);
    navigate("/thanks");
  };

  const startBonusCountdown = () => {
    setIsSubmitting(false);
    setBonusStage("countdown");
    setBonusCountdown(60);
    clearPendingBonus();
    window.setTimeout(() => {
      openWhatsApp();
    }, 400);
    cleanupBonusTimers();
    bonusIntervalRef.current = window.setInterval(() => {
      setBonusCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    bonusTimeoutRef.current = window.setTimeout(() => {
      cleanupBonusTimers();
      setBonusStage("reward");
    }, 60000);
  };

  const handleBonusRedeem = () => {
    cleanupBonusTimers();
    setBonusStage("idle");
    const snapshot = purchaseSnapshotRef.current;
    if (snapshot) {
      persistLastPurchase(snapshot.summary);
      purchaseSnapshotRef.current = null;
    }
    clearPendingBonus();
    setBonusInfo(null);
    setIsSubmitting(false);
    finalizeOrder();
  };

  const handleBonusLater = () => {
    cleanupBonusTimers();
    setBonusStage("idle");
    const snapshot = purchaseSnapshotRef.current;
    if (snapshot) {
      persistLastPurchase(snapshot.summary);
    }
    const total = bonusInfo?.totalPurchases ?? snapshot?.totalPurchases ?? 0;
    if (total) {
      markPendingBonus({ totalPurchases: total, createdAt: new Date().toISOString() });
    }
    setBonusInfo(null);
    setIsSubmitting(false);
    purchaseSnapshotRef.current = null;
    openWhatsApp();
    finalizeOrder();
  };

  const handleFormFocus = (
    event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    formInteractedRef.current = true;
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
    const normalizedValue =
      typeof value === "string" && field === "paymentMethod" ? (value as string).trim() : value;
    setForm((prev) => ({
      ...prev,
      [field]: normalizedValue,
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
        const originalUnit = "originalPrice" in item && typeof item.originalPrice === "number" ? item.originalPrice : null;
        const currentTotal = formatArs(item.price * item.qty);
        const basePrice =
          originalUnit && originalUnit > item.price
            ? `${currentTotal} (antes ${formatArs(originalUnit * item.qty)})`
            : currentTotal;
        let base = `\t\u{200B}- ${label}${sideLabel} x${item.qty} — ${basePrice}`;
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

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const submitStart = Date.now();

    const cartItems = items as CartItem[];
    const purchaseSummary: StoredPurchase = {
      placedAt: new Date().toISOString(),
      totalLabel,
      items: cartItems.map((item) => ({
        productId: String((item as { id: string | number }).id),
        label: "name" in item ? item.name : item.label,
        qty: item.qty,
        side: item.side ?? null,
        type: "name" in item ? "combo" : "extra",
      })),
    };
    purchaseSnapshotRef.current = { summary: purchaseSummary, totalPurchases: 0 };

    const profileSnapshot: Partial<OrderForm> = {
      customerName: form.customerName,
      deliveryAddress: form.deliveryAddress,
      email: form.email,
      phoneNumber: form.phoneNumber,
      paymentMethod: form.paymentMethod,
    };
    persistProfileSnapshot(profileSnapshot);

    const operationsPromise = (async () => {
      let totalPurchases = 0;
      let unlockBonus = false;

      if (backendUserId) {
        const rawName = form.customerName.trim();
        const nameParts = rawName ? rawName.split(/\s+/) : [];
        const [firstName, ...rest] = nameParts;
        const lastNameValue = rest.join(" ").trim();

        try {
          await api.updateUserProfile(backendUserId, {
            firstName: firstName || undefined,
            lastName: lastNameValue ? lastNameValue : undefined,
            displayName: rawName || undefined,
            phone: form.phoneNumber || undefined,
            address: form.deliveryAddress
              ? {
                  line1: form.deliveryAddress.trim(),
                  label: "Entrega",
                }
              : undefined,
          });
        } catch (error) {
          console.error("No se pudo guardar el perfil del usuario", error);
        }

        try {
          const summary = await api.registerPurchase(backendUserId);
          totalPurchases = summary.totalPurchases;
          unlockBonus = summary.unlockBonus;
        } catch (error) {
          console.error("No se pudo registrar la compra", error);
        }
      }

      return { totalPurchases, unlockBonus };
    })();

    const TIMEOUT_SYMBOL = Symbol("purchase-timeout");
    const operationsOutcome = await Promise.race([
      operationsPromise,
      new Promise<typeof TIMEOUT_SYMBOL>((resolve) =>
        window.setTimeout(() => resolve(TIMEOUT_SYMBOL), 4500)
      ),
    ]);

    if (operationsOutcome === TIMEOUT_SYMBOL) {
      operationsPromise
        .then((result) => {
          if (result && result.totalPurchases > 0) {
            persistBonusCount(result.totalPurchases);
          }
        })
        .catch(() => {
          /* already mostrado */
        });
    }

    let totalPurchases =
      operationsOutcome && operationsOutcome !== TIMEOUT_SYMBOL
        ? operationsOutcome.totalPurchases
        : 0;
    let unlockBonus =
      operationsOutcome && operationsOutcome !== TIMEOUT_SYMBOL
        ? operationsOutcome.unlockBonus
        : false;

    if (!totalPurchases) {
      const current = readLocalBonusCount();
      totalPurchases = current + 1;
    }

    persistBonusCount(totalPurchases);
    purchaseSnapshotRef.current = { summary: purchaseSummary, totalPurchases };

    if (!unlockBonus && isBonusThreshold(totalPurchases)) {
      unlockBonus = true;
    }

    const ensureMinOverlay = (callback: () => void) => {
      const elapsed = Date.now() - submitStart;
      const remaining = Math.max(0, 5000 - elapsed);
      if (submitDelayRef.current) {
        window.clearTimeout(submitDelayRef.current);
      }
      submitDelayRef.current = window.setTimeout(() => {
        submitDelayRef.current = null;
        callback();
      }, remaining);
    };

    if (unlockBonus) {
      const total = totalPurchases;
      ensureMinOverlay(() => {
        clearPendingBonus();
        setBonusInfo({ totalPurchases: total });
        setBonusStage("pre");
        setIsSubmitting(false);
      });
      return;
    }

    ensureMinOverlay(() => {
      const snapshot = purchaseSnapshotRef.current;
      if (snapshot) {
        persistLastPurchase(snapshot.summary);
        purchaseSnapshotRef.current = null;
      }
      clearPendingBonus();
      openWhatsApp();
      finalizeOrder();
      setIsSubmitting(false);
    });
  };

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      resumePendingFocus();
    }
    wasOpenRef.current = open;
  }, [open, resumePendingFocus]);

  useEffect(() => {
    return () => {
      cleanupBonusTimers();
    };
  }, [cleanupBonusTimers]);

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

  useEffect(
    () => () => {
      if (submitDelayRef.current) {
        window.clearTimeout(submitDelayRef.current);
      }
    },
    []
  );

  return (
    <div ref={formTopRef} className="container">
      <h2>Datos de entrega</h2>
      {prefillNotice && <p className="prefill-note">{prefillNotice}</p>}
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
              <option value="Efectivo">Efectivo</option>
              <option value="Mercado Pago">Mercado Pago</option>
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
            {items.map((item) => {
              const hasDiscount =
                "originalPrice" in item && typeof item.originalPrice === "number" && item.originalPrice > item.price;

              return (
                <div className="cart-line" key={item.key}>
                  <div style={{ maxWidth: "65%" }}>
                    <strong>{"name" in item ? item.name : item.label}</strong>
                    {"description" in item && item.description && (
                      <div className="small">{item.description}</div>
                    )}
                    {item.side && <div className="small">Guarnición: {item.side}</div>}
                    <div className="small cart-line__price">
                      {hasDiscount ? (
                        <>
                          <span className="cart-line__price-original">
                            {formatArs((item as { originalPrice: number }).originalPrice)}
                          </span>
                          <span className="cart-line__price-current">{formatArs(item.price)}</span>
                        </>
                      ) : (
                        <span>{formatArs(item.price)}</span>
                      )}
                    </div>
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
              );
            })}
            <hr />
            <div className="cart-line">
              <strong>Total</strong>
              <strong>{totalLabel}</strong>
            </div>
          </>
        )}
      </div>
      <div className="actions">
        <button className="btn-primary" onClick={handleSubmit} disabled={!isFormValid || isSubmitting}>
          Realizar pedido
        </button>
        <button className="btn-ghost" onClick={() => navigate("/menu")}>
          Volver a combos
        </button>
      </div>
      <SubmittingOverlay active={isSubmitting && bonusStage === "idle"} />
      <BonusPreModal
        open={bonusStage === "pre"}
        userName={user?.displayName || user?.email || "Cliente"}
        totalPurchases={bonusInfo?.totalPurchases}
        onConfirm={startBonusCountdown}
        onCancel={handleBonusLater}
      />
      <BonusCountdownOverlay active={bonusStage === "countdown"} seconds={bonusCountdown} />
      <BonusRewardModal
        open={bonusStage === "reward"}
        userName={user?.displayName || user?.email || "Cliente"}
        totalPurchases={bonusInfo?.totalPurchases || 3}
        onRedeem={handleBonusRedeem}
      />
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
