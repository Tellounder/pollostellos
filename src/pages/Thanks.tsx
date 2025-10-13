/**
 * Finalización: confirma el pedido enviado y mantiene la cuenta regresiva hacia Mis pedidos.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const DEFAULT_REDIRECT_DURATION_MS = 30000;
const DEFAULT_WHATSAPP_TRIGGER_DELAY_MS = 12000;
const RING_SIZE = 172;
const RING_STROKE = 16;

type LastOrderContext = {
  whatsappUrl?: string | null;
  code?: string | null;
  number?: number | null;
  redirectStartedAt?: number | null;
  redirectDurationMs?: number | null;
  whatsappTriggerDelayMs?: number | null;
  whatsappOpenedAt?: number | null;
};

export function Thanks() {
  const navigate = useNavigate();
  const [lastOrderContext, setLastOrderContext] = useState<LastOrderContext>(() => {
    if (typeof window === "undefined") {
      return {};
    }
    try {
      const raw = window.sessionStorage.getItem("pt_last_order_context");
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as LastOrderContext;
      if (!parsed.whatsappUrl) {
        return {};
      }
      const normalized: LastOrderContext = {
        whatsappUrl: parsed.whatsappUrl,
        code: parsed.code ?? null,
        number: parsed.number ?? null,
        redirectDurationMs: parsed.redirectDurationMs ?? DEFAULT_REDIRECT_DURATION_MS,
        redirectStartedAt: parsed.redirectStartedAt ?? Date.now(),
        whatsappOpenedAt: parsed.whatsappOpenedAt ?? null,
      };
      window.sessionStorage.setItem("pt_last_order_context", JSON.stringify(normalized));
      return normalized;
    } catch (error) {
      console.error("No se pudo recuperar el contexto del pedido", error);
      return {};
    }
  });

  const redirectRef = useRef(false);

  const updateContext = useCallback(
    (patch: Partial<LastOrderContext>) => {
      setLastOrderContext((prev) => {
        const next = { ...prev, ...patch };
        if (typeof window !== "undefined") {
          try {
            const sanitized: LastOrderContext = { ...next };
            Object.keys(sanitized).forEach((key) => {
              const typedKey = key as keyof LastOrderContext;
              if (sanitized[typedKey] === undefined) {
                delete sanitized[typedKey];
              }
            });
            if (!sanitized.whatsappUrl) {
              window.sessionStorage.removeItem("pt_last_order_context");
            } else {
              window.sessionStorage.setItem("pt_last_order_context", JSON.stringify(sanitized));
            }
          } catch (error) {
            console.error("No se pudo actualizar el contexto del pedido", error);
          }
        }
        return next;
      });
    },
    []
  );

  const clearContext = useCallback(() => {
    setLastOrderContext({});
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem("pt_last_order_context");
      } catch (error) {
        console.error("No se pudo limpiar el contexto del pedido", error);
      }
    }
  }, []);

  const redirectDurationMs = DEFAULT_REDIRECT_DURATION_MS;
  const redirectStartedAt = lastOrderContext.redirectStartedAt ?? Date.now();
  const redirectDeadline = redirectStartedAt + redirectDurationMs;
  const whatsappTriggerDelayMs = DEFAULT_WHATSAPP_TRIGGER_DELAY_MS;
  const whatsappTriggerAt = redirectStartedAt + whatsappTriggerDelayMs;
  const totalCountdownSeconds = Math.max(1, Math.round(DEFAULT_REDIRECT_DURATION_MS / 1000));

  const [countdown, setCountdown] = useState(() => {
    if (!redirectDeadline) {
      return totalCountdownSeconds;
    }
    return Math.max(0, Math.ceil((redirectDeadline - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!redirectDeadline) {
      return;
    }
    const tick = () => {
      setCountdown(Math.max(0, Math.ceil((redirectDeadline - Date.now()) / 1000)));
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [redirectDeadline]);

  useEffect(() => {
    if (lastOrderContext.whatsappUrl || redirectRef.current) {
      return;
    }
    redirectRef.current = true;
    clearContext();
    navigate("/", { replace: true });
  }, [clearContext, lastOrderContext.whatsappUrl, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      return;
    }
    redirectRef.current = true;
    clearContext();
    navigate("/", { replace: true, state: { openOrders: true } });
  }, [clearContext, countdown, navigate]);

  const launchWhatsApp = useCallback((url: string) => {
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIOS) {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  useEffect(() => {
    if (!lastOrderContext.whatsappUrl) {
      return;
    }
    if (!whatsappTriggerAt) {
      return;
    }
    if (lastOrderContext.whatsappOpenedAt) {
      return;
    }
    const delay = Math.max(0, whatsappTriggerAt - Date.now());
    const timer = window.setTimeout(() => {
      launchWhatsApp(lastOrderContext.whatsappUrl!);
      updateContext({ whatsappOpenedAt: Date.now() });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    lastOrderContext.whatsappOpenedAt,
    lastOrderContext.whatsappUrl,
    launchWhatsApp,
    updateContext,
    whatsappTriggerAt,
  ]);

  const orderCodeLabel = lastOrderContext.code ? `Pedido ${lastOrderContext.code}` : "Tu pedido";
  const ringRadius = (RING_SIZE - RING_STROKE) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const countdownRatio = Math.max(0, Math.min(1, countdown / totalCountdownSeconds));
  const ringOffset = ringCircumference * (1 - countdownRatio);
  return (
    <section className="thanks-shell" aria-live="polite">
      <div
        className="card thanks-card thanks-card--countdown"
        style={{ textAlign: "center", backdropFilter: "blur(18px)", background: "rgba(20, 20, 20, 0.45)" }}
      >
        <h2 className="thanks-card__title" style={{ marginBottom: 12 }}>
          {orderCodeLabel}
        </h2>
        <p className="thanks-progress__lead" style={{ marginBottom: 28 }}>
          Ahora te llevamos a WhatsApp, con todo el paquete cargado.
        </p>
        <div className="thanks-progress thanks-progress--ring" role="status" aria-live="assertive">
          <div
            className="thanks-progress__ring thanks-progress__ring--glass"
            style={{ position: "relative", display: "inline-block" }}
          >
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              role="presentation"
              style={{ filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.35))" }}
            >
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={ringRadius}
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={ringRadius}
                stroke="url(#thanks-ring-gradient)"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                fill="none"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
              <defs>
                <linearGradient id="thanks-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffbd5a" />
                  <stop offset="100%" stopColor="#ff7a2f" />
                </linearGradient>
              </defs>
            </svg>
            <div
              className="thanks-progress__timer thanks-progress__timer--center"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                color: "#fff",
                gap: 2,
                pointerEvents: "none",
              }}
            >
              <span>{countdown}</span>
              <small>seg</small>
            </div>
          </div>
        </div>
        <p className="thanks-progress__note" style={{ marginTop: 28 }}>
          Volvé acá si querés ver el progreso y beneficios.
        </p>
      </div>
    </section>
  );
}
