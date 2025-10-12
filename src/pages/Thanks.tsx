/**
 * Finalización: confirma el pedido enviado y permite volver al inicio.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type LastOrderContext = {
  whatsappUrl?: string | null;
  code?: string | null;
  number?: number | null;
};

export function Thanks() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(12);
  const [whatsappOpened, setWhatsappOpened] = useState(false);

  const lastOrderContext = useMemo<LastOrderContext>(() => {
    try {
      const raw = window.sessionStorage.getItem("pt_last_order_context");
      if (!raw) return {};
      return JSON.parse(raw) as LastOrderContext;
    } catch (error) {
      console.error("No se pudo recuperar el contexto del pedido", error);
      return {};
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lastOrderContext.whatsappUrl || whatsappOpened) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.open(lastOrderContext.whatsappUrl!, "_blank", "noopener,noreferrer");
      setWhatsappOpened(true);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [lastOrderContext.whatsappUrl, whatsappOpened]);

  useEffect(() => {
    if (countdown !== 0) {
      return;
    }
    cleanupContext();
    navigate("/", { replace: true, state: { openOrders: true } });
  }, [countdown, navigate]);

  const cleanupContext = () => {
    try {
      window.sessionStorage.removeItem("pt_last_order_context");
    } catch (error) {
      console.error("No se pudo limpiar el contexto del pedido", error);
    }
  };

  const handleOpenOrders = () => {
    cleanupContext();
    navigate("/", { replace: true, state: { openOrders: true } });
  };

  const handleOpenWhatsApp = () => {
    if (!lastOrderContext.whatsappUrl) {
      return;
    }
    window.open(lastOrderContext.whatsappUrl, "_blank", "noopener,noreferrer");
    setWhatsappOpened(true);
  };

  const orderCodeLabel = lastOrderContext.code
    ? `Pedido ${lastOrderContext.code}`
    : "Tu pedido";

  return (
    <section className="thanks-shell" aria-live="polite">
      <div className="card thanks-card">
        <h2>¡Gracias por elegir Pollos Tello’s! ✅</h2>
        <p>
          {orderCodeLabel} está en marcha. Abrimos WhatsApp con el detalle listo para que confirmes el
          mensaje. Si todavía no lo enviaste, tocá el botón y lo reabrimos.
        </p>
        <div className="thanks-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleOpenWhatsApp}
            disabled={!lastOrderContext.whatsappUrl}
          >
            Abrir WhatsApp nuevamente
          </button>
        </div>
      </div>
      <div className="card thanks-card">
        <h3>Seguimiento desde la app</h3>
        <p>
          Te llevamos a <strong>Mis pedidos</strong> para seguir el estado — pendiente, en preparación o
          confirmado — y chatear con el equipo sin salir de la app. Además, ahí encontrás tus descuentos
          activos y códigos para compartir.
        </p>
        <div className="thanks-progress" role="status">
          <span>Volvemos en {countdown} segundos…</span>
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{ width: `${((12 - countdown) / 12) * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="thanks-actions">
          <button type="button" className="btn-primary" onClick={handleOpenOrders}>
            Quiero ver mis pedidos ahora
          </button>
        </div>
      </div>
      <div className="thanks-note">
        <p>
          Recordá que podés cerrar WhatsApp cuando quieras: la orden queda registrada y la vas a ver en
          la app junto con tus sorpresas de fidelización.
        </p>
      </div>
    </section>
  );
}
