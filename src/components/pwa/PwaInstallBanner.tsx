import React, { useEffect, useState } from "react";
import { useAuth } from "hooks/useAuth";
import { usePwaInstallPrompt } from "hooks/usePwaInstallPrompt";

export const PwaInstallBanner: React.FC = () => {
  const { user } = useAuth();
  const { promptEvent, clearPrompt, isInstalled, isIos, isAndroid } = usePwaInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    setShowFallback(false);
    if (!user || isInstalled) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [user, isInstalled]);

  if (!visible) {
    return null;
  }

  const handleInstall = async () => {
    if (!promptEvent) {
      setShowFallback(true);
      return;
    }

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (error) {
      console.error("No se pudo completar la instalación PWA", error);
    } finally {
      clearPrompt();
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  const renderInstructions = (message: string) => (
    <div className="pwa-banner" role="dialog" aria-live="polite">
      <div className="pwa-banner__content">
        <div>
          <strong>Instalá la app</strong>
          <p className="small">{message}</p>
        </div>
        <div className="pwa-banner__actions">
          <button className="btn-secondary btn-sm" type="button" onClick={handleDismiss}>
            Más tarde
          </button>
        </div>
      </div>
    </div>
  );

  if (isIos && (showFallback || !promptEvent)) {
    return renderInstructions("Tocá el botón Compartir y elegí 'Agregar a pantalla de inicio'.");
  }

  if (showFallback || (!promptEvent && isAndroid)) {
    return renderInstructions("Abrí el menú ⋮ del navegador y elegí 'Agregar a pantalla principal'.");
  }

  if (!promptEvent) {
    return null;
  }

  return (
    <div className="pwa-banner" role="dialog" aria-live="polite">
      <div className="pwa-banner__content">
        <div>
          <strong>Instalá la app</strong>
          <p className="small">Sumala a tu pantalla para acceder más rápido a los pedidos.</p>
        </div>
        <div className="pwa-banner__actions">
          <button className="btn-secondary btn-sm" type="button" onClick={handleDismiss}>
            Más tarde
          </button>
          <button className="btn-primary btn-sm" type="button" onClick={handleInstall}>
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
};
