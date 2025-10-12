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
import { api, type CreateOrderPayload } from "utils/api";
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

const formatOrderCode = (orderNumber: number) => `PT-${orderNumber.toString().padStart(5, "0")}`;

const promoExtra = EXTRAS.find((extra) => extra.id === "deshuesado") ?? null;

const isBonusThreshold = (count: number) => count >= 3 && (count % 7 === 3 || count % 7 === 0);

type OrderForm = {
  customerName: string;
  deliveryAddress: string;
  email: string;
  phoneNumber: string;
  paymentMethod: string;
};

type LastOrderRef = {
  id: string;
  number: number;
  code: string;
  whatsappUrl: string;
  message: string;
};

const initialForm: OrderForm = {
  customerName: "",
  deliveryAddress: "",
  email: "",
  phoneNumber: "",
  paymentMethod: "Efectivo",
};

const TIMELINE_STEPS: Array<{ title: string; description: string }> = [
  {
    title: "Revisá",
    description: "Chequeá nombre y entrega.",
  },
  {
    title: "WhatsApp",
    description: "Abrimos el chat con tu pedido listo para ajustar y enviar.",
  },
  {
    title: "Confirmación",
    description: "Validamos el pedido; si volvés, ves tu progreso.",
  },
];

const SUMMARY_PREVIEW_COUNT = 2;

const Checkout: React.FC = () => {
  const { items, addItem, setQty, total, totalLabel, clearCart } = useCart();
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
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [lastOrderRef, setLastOrderRef] = useState<LastOrderRef | null>(null);
  const isRegistered = Boolean(user && backendUserId);
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

    if (!promoExtra || !isRegistered) {
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
  }, [isRegistered, promoExtra, readStoredProfile, show]);

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

  const resolveWhatsAppUrl = () => {
    if (lastOrderRef) {
      return lastOrderRef.whatsappUrl;
    }
    const message = buildPedidoMessage();
    return waLink(WHATSAPP_NUMBER, message);
  };

  const openWhatsApp = () => {
    const url = resolveWhatsAppUrl();
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

    if (isIOS) {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const finalizeOrder = () => {
    if (lastOrderRef) {
      try {
        window.sessionStorage.removeItem("pt_last_order_whatsapp");
        window.sessionStorage.setItem(
          "pt_last_order_context",
          JSON.stringify({
            whatsappUrl: lastOrderRef.whatsappUrl,
            code: lastOrderRef.code,
            number: lastOrderRef.number,
          })
        );
      } catch (error) {
        console.error("No se pudo guardar la última referencia de pedido", error);
      }
    }
    clearCart();
    setForm(initialForm);
    setLastOrderRef(null);
    navigate("/thanks");
  };

  const startBonusCountdown = () => {
    setIsSubmitting(false);
    setBonusStage("countdown");
    setBonusCountdown(60);
    clearPendingBonus();
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

    if (isIOS) {
      openWhatsApp();
    } else {
      window.setTimeout(() => {
        openWhatsApp();
      }, 400);
    }
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
    if (!promoExtra || !isRegistered || promoTriggeredRef.current || accepted || open) {
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

  const buildPedidoMessage = useCallback(
    (orderCode?: string) => {
      let intro = `🍗 NUEVO PEDIDO - POLLOS TELLO’S\n\n`;

      intro += `\t\u{200B}👤 Cliente: ${form.customerName || user?.displayName || "Invitado"}\n`;
      if (orderCode) {
        intro += `\t\u{200B}📦 Pedido: ${orderCode}\n`;
      }
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
    },
    [accepted, form, items, totalLabel, user]
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const submitStart = Date.now();
    setLastOrderRef(null);

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

    try {
      const orderPayload: CreateOrderPayload = {
        userId: backendUserId ?? undefined,
        customerName: form.customerName.trim(),
        customerEmail: form.email.trim(),
        customerPhone: form.phoneNumber ? form.phoneNumber.trim() : undefined,
        delivery: {
          addressLine: form.deliveryAddress.trim(),
        },
        paymentMethod: form.paymentMethod,
        notes: accepted ? "Aceptó pollo deshuesado de cortesía." : undefined,
        items: cartItems.map((item) => {
          const metadata: Record<string, unknown> = {};
          if ("description" in item && item.description) {
            metadata.description = item.description as string;
          }

          if (
            "originalPrice" in item &&
            typeof item.originalPrice === "number" &&
            item.originalPrice > item.price
          ) {
            metadata.originalUnitPrice = Number(item.originalPrice.toFixed(2));
            metadata.discountValue = Number(((item.originalPrice - item.price) * item.qty).toFixed(2));
          }

          return {
            productId: String((item as { id: string | number }).id),
            label: "name" in item ? item.name : item.label,
            quantity: item.qty,
            unitPrice: Number(item.price.toFixed(2)),
            lineTotal: Number((item.price * item.qty).toFixed(2)),
            side: item.side,
            type: "name" in item ? "combo" : "extra",
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          };
        }),
        totalGross: Number(total.toFixed(2)),
        totalNet: Number(total.toFixed(2)),
        metadata: {
          acceptedUpsell: accepted,
          guestCheckout: !backendUserId,
        },
      };

      const createdOrder = await api.createOrder(orderPayload);
      const orderCode = formatOrderCode(createdOrder.number);
      const messageWithCode = buildPedidoMessage(orderCode);
      const whatsappUrl = waLink(WHATSAPP_NUMBER, messageWithCode);

      setLastOrderRef({
        id: createdOrder.id,
        number: createdOrder.number,
        code: orderCode,
        whatsappUrl,
        message: messageWithCode,
      });
    } catch (error) {
      console.error("No se pudo crear el pedido", error);
      setLastOrderRef(null);
    }

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
    setSummaryExpanded(false);
  }, [items.length]);

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

  const summaryItemsToRender = useMemo(() => {
    if (summaryExpanded || !isRegistered) {
      return items;
    }
    return items.slice(0, SUMMARY_PREVIEW_COUNT);
  }, [isRegistered, items, summaryExpanded]);

  const renderSummaryList = (list: CartItem[]) =>
    list.map((item) => {
      const hasDiscount =
        "originalPrice" in item &&
        typeof item.originalPrice === "number" &&
        item.originalPrice > item.price;

      return (
        <li className="checkout-summary__item" key={item.key}>
          <div className="checkout-summary__main">
            <span className="checkout-summary__title">{"name" in item ? item.name : item.label}</span>
            {"description" in item && item.description && (
              <span className="checkout-summary__description">{item.description}</span>
            )}
            {item.side && <span className="checkout-summary__meta">Guarnición: {item.side}</span>}
          </div>
          <div className="checkout-summary__meta-group">
            <div className="checkout-summary__price">
              {hasDiscount ? (
                <>
                  <span className="checkout-summary__price-original">
                    {formatArs((item as { originalPrice: number }).originalPrice)}
                  </span>
                  <span className="checkout-summary__price-current">{formatArs(item.price)}</span>
                </>
              ) : (
                <span>{formatArs(item.price)}</span>
              )}
            </div>
            <div className="checkout-summary__controls" role="group" aria-label="Cantidad">
              <button
                className="btn-ghost"
                onClick={() => setQty(item.key, Math.max(0, item.qty - 1))}
                aria-label={item.qty === 1 ? "Quitar" : "Restar"}
              >
                -
              </button>
              <span className="checkout-summary__count" aria-live="polite">
                {item.qty}
              </span>
              <button className="btn-ghost" onClick={() => setQty(item.key, item.qty + 1)}>
                +
              </button>
            </div>
          </div>
        </li>
      );
    });

  const timelinePosition = useMemo(() => {
    if (bonusStage === "reward") {
      return 3;
    }
    if (bonusStage === "countdown" || bonusStage === "pre") {
      return 2;
    }
    if (isSubmitting) {
      return 2;
    }
    return 1;
  }, [bonusStage, isSubmitting]);

  if (!isRegistered) {
    return (
      <div ref={formTopRef} className="container checkout-shell checkout-shell--guest">
        <div className="checkout-shell__inner checkout-shell__inner--guest">
          <header className="checkout-head checkout-head--guest">
            <h1 className="checkout-head__title">Confirmá tu pedido</h1>
            <p className="checkout-head__subtitle">
              Completá tus datos y enviá el WhatsApp: nosotros seguimos tu pedido y te avisamos cuando esté listo.
            </p>
          </header>
          {prefillNotice && <p className="prefill-note">{prefillNotice}</p>}
          <section className="checkout-card checkout-card--form">
            <div className="checkout-card__header">
              <span className="checkout-card__eyebrow">Datos de entrega</span>
              <h3 className="checkout-card__title">Contanos a dónde enviamos</h3>
            </div>
            <div className="checkout-form-grid">
              <label className="field checkout-field">
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
              <label className="field checkout-field">
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
              <label className="field checkout-field">
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
              <label className="field checkout-field">
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
              <label className="field checkout-field">
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
          </section>
          <section className="checkout-card checkout-card--summary">
            <div className="checkout-card__header">
              <span className="checkout-card__eyebrow">Tu pedido</span>
              <h3 className="checkout-card__title">Revisá antes de enviar</h3>
            </div>
            {items.length === 0 ? (
              <p className="checkout-empty">Todavía no agregaste productos. Volvé al menú para sumar combos.</p>
            ) : (
              <>
                <ul className="checkout-summary__list">{renderSummaryList(summaryItemsToRender)}</ul>
                <div className="checkout-summary__footer">
                  <span>Total</span>
                  <strong>{totalLabel}</strong>
                </div>
                <div className="checkout-summary__actions">
                  <button
                    className="btn-primary checkout-summary__button"
                    onClick={handleSubmit}
                    disabled={!isFormValid || isSubmitting}
                  >
                    Enviar pedido por WhatsApp
                  </button>
                  <span className="checkout-summary__note">
                    Enviá el mensaje y listo. Guardamos tus datos para que la próxima vez sea aún más rápido.
                  </span>
                  <button className="btn-ghost checkout-summary__secondary" onClick={() => navigate("/menu")}>
                    Volver al menú
                  </button>
                </div>
              </>
            )}
          </section>
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
  }

  return (
    <div ref={formTopRef} className="container checkout-shell">
      <div className="checkout-shell__inner">
        <header className="checkout-head">
          <span className="checkout-head__eyebrow">Paso final</span>
          <h1 className="checkout-head__title">Confirmá tu pedido</h1>
          <p className="checkout-head__subtitle">
            Mandá el WhatsApp: tu pedido se prepara igual. Si volvés, acá te mostramos el estado y guardamos sorpresas para vos.
          </p>
        </header>
        <section className="checkout-overview">
          <div className="checkout-overview__status">
            <span className="checkout-card__eyebrow">Seguimiento en curso</span>
            <h2 className="checkout-card__title">Todo listo para enviar</h2>
            <p className="checkout-overview__lead">
              Revisá los datos, abrí el chat y, si querés, regresá para ver cómo avanza y sumar beneficios.
            </p>
          </div>
          <ol className="checkout-timeline checkout-timeline--inline">
            {TIMELINE_STEPS.map((step, index) => {
              const position = index + 1;
              const stateClass =
                timelinePosition > position
                  ? "is-complete"
                  : timelinePosition === position
                    ? "is-active"
                    : "";
              return (
                <li key={step.title} className={`checkout-timeline__item ${stateClass}`}>
                  <div className="checkout-timeline__badge" aria-hidden="true">
                    {position}
                  </div>
                  <div className="checkout-timeline__body">
                    <span className="checkout-timeline__title">{step.title}</span>
                    <span className="checkout-timeline__text">{step.description}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          {prefillNotice && (
            <span className="checkout-overview__chip" role="status">{prefillNotice}</span>
          )}
        </section>
        <div className="checkout-columns">
          <div className="checkout-primary">
            <section className="checkout-card checkout-card--form">
              <div className="checkout-card__header">
                <span className="checkout-card__eyebrow">Datos del cliente</span>
                <h3 className="checkout-card__title">Personalizá tu entrega</h3>
                <p className="checkout-card__hint">
                  Guardamos estos datos para tu próxima vez. ¿Querés pollo deshuesado? Pedilo en el mensaje de WhatsApp: es para todos, incluso invitados.
                </p>
              </div>
              <div className="checkout-form-grid">
                <label className="field checkout-field">
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
                <label className="field checkout-field">
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
                <label className="field checkout-field">
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
                <label className="field checkout-field">
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
                <label className="field checkout-field">
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
            </section>
          </div>
          <aside className="checkout-secondary">
            <section className="checkout-card checkout-card--summary">
              <div className="checkout-card__header">
                <span className="checkout-card__eyebrow">Tu selección</span>
                <h3 className="checkout-card__title">Resumen rápido</h3>
              </div>
              {items.length === 0 ? (
                <p className="checkout-empty">Todavía no agregaste productos. Volvé al menú para sumar combos.</p>
              ) : (
                <>
                  <ul className="checkout-summary__list">{renderSummaryList(summaryItemsToRender)}</ul>
                  {isRegistered && items.length > SUMMARY_PREVIEW_COUNT && (
                    <button
                      type="button"
                      className="checkout-summary__toggle btn-ghost"
                      onClick={() => setSummaryExpanded((prev) => !prev)}
                      aria-expanded={summaryExpanded}
                    >
                      {summaryExpanded
                        ? "Ver menos"
                        : `Ver todo (${items.length - SUMMARY_PREVIEW_COUNT} extra${
                            items.length - SUMMARY_PREVIEW_COUNT === 1 ? "" : "s"
                          })`}
                    </button>
                  )}
                  <div className="checkout-summary__footer">
                    <span>Total</span>
                    <strong>{totalLabel}</strong>
                  </div>
                  <div className="checkout-summary__actions">
                    <button
                      className="btn-primary checkout-summary__button"
                      onClick={handleSubmit}
                      disabled={!isFormValid || isSubmitting}
                    >
                      Enviar pedido por WhatsApp
                    </button>
                    <span className="checkout-summary__note">
                      Enviá el mensaje. Si regresás, acá tenés el seguimiento y los premios acumulados.
                    </span>
                    <button className="btn-ghost checkout-summary__secondary" onClick={() => navigate("/menu")}>
                      Volver al menú
                    </button>
                    <p className="checkout-summary__microcopy">
                      ¿Ya saliste? Guardamos tus datos y recordamos tus favoritos para la próxima visita.
                    </p>
                  </div>
                </>
              )}
            </section>
          </aside>
        </div>
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
