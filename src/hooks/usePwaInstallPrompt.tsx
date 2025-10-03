import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

interface PwaInstallContextValue {
  promptEvent: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  isIos: boolean;
  isAndroid: boolean;
  setPromptEvent: React.Dispatch<React.SetStateAction<BeforeInstallPromptEvent | null>>;
  clearPrompt: () => void;
}

const PwaInstallContext = createContext<PwaInstallContextValue | undefined>(undefined);

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  const matchStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return matchStandalone || iosStandalone;
};

const detectIsIos = () => {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
};

const detectIsAndroid = () => {
  if (typeof navigator === "undefined") return false;
  return /android/.test(navigator.userAgent.toLowerCase());
};

export const PwaInstallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(isStandalone);
  const [isIos] = useState<boolean>(detectIsIos);
  const [isAndroid] = useState<boolean>(detectIsAndroid);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const value = useMemo<PwaInstallContextValue>(
    () => ({ promptEvent, isInstalled, isIos, isAndroid, setPromptEvent, clearPrompt: () => setPromptEvent(null) }),
    [promptEvent, isInstalled, isIos, isAndroid]
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
};

export const usePwaInstallPrompt = () => {
  const context = useContext(PwaInstallContext);
  if (!context) {
    throw new Error("usePwaInstallPrompt must be used within a PwaInstallProvider");
  }
  return context;
};
