/**
 * Datos de entrega: formulario + resumen antes de enviar pedido vía WhatsApp.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "hooks/useCart";
import { useAuth } from "hooks/useAuth";
import { useUpsell } from "hooks/useUpsell";
import { useUserDataLoader } from "hooks/useUserDataLoader";
import { UpsellModal } from "components/cart/UpsellModal";
import { SubmittingOverlay } from "components/common/SubmittingOverlay";
import { waLink } from "utils/format";
import { api, type CreateOrderPayload } from "utils/api";
import { EXTRAS, WHATSAPP_NUMBER } from "utils/constants";
import type { CartItem } from "store/cart";
import { PREFILL_FALLBACK_KEY, buildLastPurchaseKeys, writeJSONToKeys, type StoredPurchase } from "utils/customerStorage";
import { processDiscounts, type DiscountEntry } from "utils/orders";

const formatArs = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(value);

const formatOrderCode = (orderNumber: number) => `PT-${orderNumber.toString().padStart(5, "0")}`;

const promoExtra = EXTRAS.find((extra) => extra.id === "deshuesado") ?? null;

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

const SUMMARY_PREVIEW_COUNT = 2;
const REGISTERED_SUBMIT_TRANSITION_MS = 2000;
const REGISTERED_REDIRECT_COUNTDOWN_MS = 35000;
const REGISTERED_WHATSAPP_TRIGGER_DELAY_MS = 25000;
const GUEST_SUBMIT_TRANSITION_MS = 3000;
const GUEST_REDIRECT_COUNTDOWN_MS = 10000;
const GUEST_WHATSAPP_TRIGGER_DELAY_MS = 10000;

const Checkout: React.FC = () => {
  const { items, addItem, setQty, total, clearCart } = useCart();
  const { user, backendUserId } = useAuth();
  const { open, countdown, item, accepted, show, accept, cancel, reset } = useUpsell();
  const { ensureUserData } = useUserDataLoader(backendUserId ?? null);
  const navigate = useNavigate();
  const [form, setForm] = useState<OrderForm>(initialForm);
  const promoTriggeredRef = useRef(false);
  const formInteractedRef = useRef(false);
  const pendingFocusRef = useRef<null | (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)>(null);
  const wasOpenRef = useRef(open);
  const formTopRef = useRef<HTMLDivElement | null>(null);
  const showTimeoutRef = useRef<number | null>(null);
  const submitDelayRef = useRef<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [availableDiscounts, setAvailableDiscounts] = useState<DiscountEntry[]>([]);
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [selectedDiscount, setSelectedDiscount] = useState<DiscountEntry | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountFeedback, setDiscountFeedback] = useState<string | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const isRegistered = Boolean(user);
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
  const lastPurchaseKeys = useMemo(
    () => buildLastPurchaseKeys(backendUserId, user?.uid ?? null),
    [backendUserId, user?.uid]
  );
  const finalTotal = useMemo(() => Math.max(total - discountAmount, 0), [total, discountAmount]);
  const finalTotalLabel = useMemo(() => formatArs(finalTotal), [finalTotal]);
  const selectedDiscountDescriptor = useMemo(() => {
    if (!selectedDiscount) {
      return null;
    }
    const parts = [selectedDiscount.label, selectedDiscount.description]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter((part) => part.length > 0);
    if (parts.length > 0) {
      return `${parts.join(" · ")} (${selectedDiscount.code})`;
    }
    return selectedDiscount.code;
  }, [selectedDiscount]);

  const calculateDiscountAmount = useCallback(
    (entry: DiscountEntry) => {
      const base = total;
      const percentage = entry.percentage ? Number(entry.percentage) : null;
      let computed = percentage ? base * (percentage / 100) : Number(entry.value);
      if (!Number.isFinite(computed)) computed = 0;
      computed = Math.min(Math.max(computed, 0), base);
      return computed;
    },
    [total]
  );

  const applyDiscountCode = useCallback(
    (codeRaw: string, source: DiscountEntry[] = availableDiscounts) => {
      const normalized = codeRaw.trim().toUpperCase();
      if (!normalized) {
        setSelectedDiscount(null);
        setDiscountAmount(0);
        setDiscountFeedback(null);
        setDiscountError(null);
        return false;
      }

      const found = source.find((entry) => entry.code.toUpperCase() === normalized);
      if (!found) {
        setSelectedDiscount(null);
        setDiscountAmount(0);
        setDiscountFeedback(null);
        setDiscountError("Ese código no está disponible.");
        return false;
      }

      const amount = calculateDiscountAmount(found);
      if (amount <= 0) {
        setSelectedDiscount(null);
        setDiscountAmount(0);
        setDiscountFeedback(null);
        setDiscountError("El código no tiene saldo para este pedido.");
        return false;
      }

      setSelectedDiscount(found);
      setDiscountAmount(amount);
      const descriptorParts = [found.label, found.description]
        .map((part) => (typeof part === "string" ? part.trim() : ""))
        .filter((part) => part.length > 0);
      const descriptor = descriptorParts.length > 0 ? descriptorParts.join(" · ") : found.code;
      setDiscountFeedback(`Aplicaste ${formatArs(amount)} con ${descriptor}.`);
      setDiscountError(null);
      setDiscountCodeInput(found.code);
      try {
        window.sessionStorage.setItem("pt_checkout_discount", found.code);
      } catch {
        /* noop */
      }
      return true;
    },
    [availableDiscounts, calculateDiscountAmount]
  );

  const clearDiscount = useCallback(() => {
    setSelectedDiscount(null);
    setDiscountAmount(0);
    setDiscountFeedback(null);
    setDiscountError(null);
    setDiscountCodeInput("");
    try {
      window.sessionStorage.removeItem("pt_checkout_discount");
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!isRegistered || !backendUserId) {
      setAvailableDiscounts((prev) => (prev.length > 0 ? [] : prev));
      if (
        selectedDiscount ||
        discountAmount > 0 ||
        discountFeedback ||
        discountError ||
        discountCodeInput
      ) {
        clearDiscount();
      }
      return;
    }

    let isMounted = true;

    ensureUserData()
      .then((bundle) => {
        if (!bundle || !isMounted) return;
        const snapshot = processDiscounts(bundle.detail);
        setAvailableDiscounts((prev) => {
          const sameLength = prev.length === snapshot.active.length;
          const matches =
            sameLength &&
            prev.every((entry, index) => {
              const next = snapshot.active[index];
              if (!next) return false;
              return (
                entry.code === next.code &&
                entry.usesRemaining === next.usesRemaining &&
                entry.value === next.value &&
                entry.percentage === next.percentage &&
                entry.label === next.label &&
                entry.description === next.description
              );
            });
          return matches ? prev : snapshot.active;
        });

        const storedCode = (() => {
          try {
            return window.sessionStorage.getItem("pt_checkout_discount");
          } catch {
            return null;
          }
        })();

        if (storedCode) {
          const success = applyDiscountCode(storedCode, snapshot.active);
          if (success) {
            try {
              window.sessionStorage.removeItem("pt_checkout_discount");
            } catch {
              /* noop */
            }
          }
        } else if (selectedDiscount) {
          const stillValid = snapshot.active.find((entry) => entry.code === selectedDiscount.code);
          if (!stillValid) {
            clearDiscount();
          }
        }
      })
      .catch((error) => {
        console.error("No se pudieron cargar los descuentos disponibles", error);
      });

    return () => {
      isMounted = false;
    };
  }, [
    applyDiscountCode,
    backendUserId,
    clearDiscount,
    discountAmount,
    discountCodeInput,
    discountError,
    discountFeedback,
    ensureUserData,
    isRegistered,
    selectedDiscount,
  ]);

  useEffect(() => {
    if (!selectedDiscount) {
      return;
    }
    const updatedAmount = calculateDiscountAmount(selectedDiscount);
    if (updatedAmount <= 0) {
      clearDiscount();
      return;
    }
    if (Math.abs(updatedAmount - discountAmount) > 0.01) {
      setDiscountAmount(updatedAmount);
      const descriptorParts = [selectedDiscount.label, selectedDiscount.description]
        .map((part) => (typeof part === "string" ? part.trim() : ""))
        .filter((part) => part.length > 0);
      const descriptor = descriptorParts.length > 0 ? descriptorParts.join(" · ") : selectedDiscount.code;
      setDiscountFeedback(`Aplicaste ${formatArs(updatedAmount)} con ${descriptor}.`);
    }
  }, [calculateDiscountAmount, clearDiscount, discountAmount, selectedDiscount, total]);

  const handleApplyDiscount = useCallback(() => {
    applyDiscountCode(discountCodeInput);
  }, [applyDiscountCode, discountCodeInput]);
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

  const persistLastPurchase = useCallback(
    (purchase: StoredPurchase) => {
      writeJSONToKeys(lastPurchaseKeys, purchase);
    },
    [lastPurchaseKeys]
  );

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

  const resetCheckoutState = () => {
    clearCart();
    setForm(initialForm);
  };

  const finalizeRegisteredOrder = (context: LastOrderRef) => {
    try {
      window.sessionStorage.removeItem("pt_last_order_whatsapp");
      window.sessionStorage.setItem(
        "pt_last_order_context",
        JSON.stringify({
          mode: "registered" as const,
          whatsappUrl: context.whatsappUrl,
          code: context.code,
          number: context.number,
          redirectStartedAt: Date.now(),
          redirectDurationMs: REGISTERED_REDIRECT_COUNTDOWN_MS,
          whatsappTriggerDelayMs: REGISTERED_WHATSAPP_TRIGGER_DELAY_MS,
          whatsappOpenedAt: null,
        })
      );
    } catch (error) {
      console.error("No se pudo guardar la última referencia de pedido", error);
    }
    resetCheckoutState();
    navigate("/thanks", { replace: true, state: { origin: "registered" } });
  };

  const finalizeGuestOrder = (whatsappUrl: string) => {
    try {
      window.sessionStorage.setItem(
        "pt_last_order_context",
        JSON.stringify({
          mode: "guest" as const,
          whatsappUrl,
          redirectStartedAt: Date.now(),
          redirectDurationMs: GUEST_REDIRECT_COUNTDOWN_MS,
          whatsappTriggerDelayMs: GUEST_WHATSAPP_TRIGGER_DELAY_MS,
          whatsappOpenedAt: null,
        })
      );
    } catch (error) {
      console.error("No se pudo guardar la referencia del pedido invitado", error);
    }
    resetCheckoutState();
    navigate("/thanks", { replace: true, state: { origin: "guest" } });
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
      intro += `\t\u{200B}💰 TOTAL: ${finalTotalLabel}`;
      if (selectedDiscount && discountAmount > 0) {
        const labelText = selectedDiscountDescriptor ?? selectedDiscount.code;
        intro += `\n\t\u{200B}💸 Descuento aplicado: ${labelText} (-${formatArs(discountAmount)})`;
      }
      intro += `\n\t\u{200B}🍖 Pollo deshuesado: ${accepted ? "Sí" : "No"}`;
      intro += `\n\t\u{200B}💳 Método de pago: ${form.paymentMethod}`;
      intro += `\n\t\u{200B}👤 Usuario: ${user?.displayName || user?.email || "Invitado"}`;

      return intro;
    },
    [accepted, discountAmount, finalTotalLabel, form, items, selectedDiscount, selectedDiscountDescriptor, user]
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const submitStart = Date.now();
    const cartItems = items as CartItem[];
    const purchaseSummary: StoredPurchase = {
      placedAt: new Date().toISOString(),
      totalLabel: finalTotalLabel,
      items: cartItems.map((item) => ({
        productId: String((item as { id: string | number }).id),
        label: "name" in item ? item.name : item.label,
        qty: item.qty,
        side: item.side ?? null,
        type: "name" in item ? "combo" : "extra",
      })),
    };
    const profileSnapshot: Partial<OrderForm> = {
      customerName: form.customerName,
      deliveryAddress: form.deliveryAddress,
      email: form.email,
      phoneNumber: form.phoneNumber,
      paymentMethod: form.paymentMethod,
    };
    persistProfileSnapshot(profileSnapshot);

    let createdOrderContext: LastOrderRef | null = null;

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
        totalNet: Number(finalTotal.toFixed(2)),
        metadata: {
          acceptedUpsell: accepted,
          guestCheckout: !backendUserId,
        },
      };

      if (selectedDiscount && discountAmount > 0) {
        orderPayload.discountCode = selectedDiscount.code;
        orderPayload.discountTotal = Number(discountAmount.toFixed(2));
        orderPayload.metadata = {
          ...orderPayload.metadata,
          appliedDiscount: {
            code: selectedDiscount.code,
            amount: Number(discountAmount.toFixed(2)),
            label: selectedDiscount.label ?? null,
            description: selectedDiscount.description ?? null,
          },
        };
      }

      if (!isRegistered) {
        const fallbackMessage = buildPedidoMessage();
        const fallbackWhatsappUrl = waLink(WHATSAPP_NUMBER, fallbackMessage);

        void api
          .createOrder(orderPayload)
          .catch((error) => console.error("No se pudo registrar el pedido del invitado", error));

        const elapsedGuest = Date.now() - submitStart;
        const remainingGuest = Math.max(0, GUEST_SUBMIT_TRANSITION_MS - elapsedGuest);

        if (submitDelayRef.current) {
          window.clearTimeout(submitDelayRef.current);
        }

        submitDelayRef.current = window.setTimeout(() => {
          submitDelayRef.current = null;
          try {
            persistLastPurchase(purchaseSummary);
          } catch (error) {
            console.error("No se pudo guardar el resumen de compra del invitado", error);
          }
          setIsSubmitting(false);
          finalizeGuestOrder(fallbackWhatsappUrl);
        }, remainingGuest);

        return;
      }

      const createdOrder = await api.createOrder(orderPayload);
      const orderCode = formatOrderCode(createdOrder.number);
      const messageWithCode = buildPedidoMessage(orderCode);
      const whatsappUrl = waLink(WHATSAPP_NUMBER, messageWithCode);

      createdOrderContext = {
        id: createdOrder.id,
        number: createdOrder.number,
        code: orderCode,
        whatsappUrl,
        message: messageWithCode,
      };
    } catch (error) {
      console.error("No se pudo crear el pedido", error);
      setIsSubmitting(false);
      return;
    }

    if (!createdOrderContext) {
      setIsSubmitting(false);
      return;
    }

    if (backendUserId) {
      const rawName = form.customerName.trim();
      const nameParts = rawName ? rawName.split(/\s+/) : [];
      const [firstName, ...rest] = nameParts;
      const lastNameValue = rest.join(" ").trim();
      const profilePayload = {
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
      } as const;

      void (async () => {
        try {
          await api.updateUserProfile(backendUserId, profilePayload);
        } catch (error) {
          console.error("No se pudo guardar el perfil del usuario", error);
        }

        try {
          await api.registerPurchase(backendUserId);
        } catch (error) {
          console.error("No se pudo registrar la compra", error);
        }
      })();
    }

    const elapsed = Date.now() - submitStart;
    const remaining = Math.max(0, REGISTERED_SUBMIT_TRANSITION_MS - elapsed);

    if (submitDelayRef.current) {
      window.clearTimeout(submitDelayRef.current);
    }

    submitDelayRef.current = window.setTimeout(() => {
      submitDelayRef.current = null;
      try {
        persistLastPurchase(purchaseSummary);
      } catch (error) {
        console.error("No se pudo guardar el resumen de compra", error);
      }
      setIsSubmitting(false);
      finalizeRegisteredOrder(createdOrderContext!);
    }, remaining);
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

  if (!isRegistered) {
    return (
      <div ref={formTopRef} className="container checkout-shell checkout-shell--guest">
        <div className="checkout-shell__inner checkout-shell__inner--guest">
      
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
                <div className="checkout-summary__totals">
                  <div className="checkout-summary__line">
                    <span>Subtotal</span>
                    <span>{formatArs(total)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="checkout-summary__line checkout-summary__line--discount">
                      <span>{selectedDiscountDescriptor ?? selectedDiscount?.code ?? "Descuento"}</span>
                      <span>-{formatArs(discountAmount)}</span>
                    </div>
                  )}
                  <div className="checkout-summary__line checkout-summary__line--total">
                    <span>Total a pagar</span>
                    <strong>{finalTotalLabel}</strong>
                  </div>
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
        <SubmittingOverlay active={isSubmitting} />
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
                  {isRegistered && (
                    <div className="checkout-discount" aria-label="Aplicar código de descuento">
                      <div className="checkout-discount__header">
                        <span>¿Tenés un código de descuento?</span>
                        {selectedDiscount && (
                          <button
                            type="button"
                            className="btn-soft btn-sm"
                            onClick={clearDiscount}
                          >
                            Quitar código
                          </button>
                        )}
                      </div>
                      <div className="checkout-discount__field">
                        <input
                          type="text"
                          name="discount"
                          value={discountCodeInput}
                          onChange={(event) => {
                            const value = event.target.value.toUpperCase();
                            setDiscountCodeInput(value);
                            setDiscountError(null);
                            if (!value) {
                              setDiscountFeedback(null);
                            }
                          }}
                          placeholder={availableDiscounts.length ? "Ingresá tu código o elegí uno" : "Ingresá tu código"}
                          autoComplete="off"
                          className="checkout-discount__input"
                          inputMode="text"
                        />
                        <button type="button" className="btn-secondary btn-sm" onClick={handleApplyDiscount}>
                          Aplicar
                        </button>
                      </div>
                      {discountError && (
                        <p className="checkout-discount__feedback checkout-discount__feedback--error">{discountError}</p>
                      )}
                      {discountFeedback && !discountError && (
                        <p className="checkout-discount__feedback checkout-discount__feedback--success">{discountFeedback}</p>
                      )}
                      {availableDiscounts.length > 0 && (
                        <div className="checkout-discount__chips" role="list">
                          {availableDiscounts.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              title={[
                                entry.label,
                                entry.description,
                              ]
                                .map((part) => (typeof part === "string" ? part.trim() : ""))
                                .filter((part) => part.length > 0)
                                .join(" · ") || entry.code}
                              className={`checkout-discount__chip${selectedDiscount?.code === entry.code ? " is-active" : ""}`}
                              onClick={() => applyDiscountCode(entry.code)}
                            >
                              <span>{entry.code}</span>
                              <small>
                                {entry.percentage
                                  ? `${Number(entry.percentage)}%`
                                  : formatArs(Number(entry.value))}
                              </small>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
                  <div className="checkout-summary__totals">
                    <div className="checkout-summary__line">
                      <span>Subtotal</span>
                      <span>{formatArs(total)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="checkout-summary__line checkout-summary__line--discount">
                        <span>{selectedDiscountDescriptor ?? selectedDiscount?.code ?? "Descuento"}</span>
                        <span>-{formatArs(discountAmount)}</span>
                      </div>
                    )}
                    <div className="checkout-summary__line checkout-summary__line--total">
                      <span>Total a pagar</span>
                      <strong>{finalTotalLabel}</strong>
                    </div>
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
      <SubmittingOverlay active={isSubmitting} />
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
