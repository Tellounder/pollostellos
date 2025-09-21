/**
 * Estado global para el upsell del checkout (popup + timers).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "store/cart";

type UpsellContextType = {
  open: boolean;
  countdown: number;
  item: Product | null;
  accepted: boolean;
  show: (product: Product) => void;
  accept: () => void;
  cancel: () => void;
  reset: () => void;
};

const UpsellContext = createContext<UpsellContextType | undefined>(undefined);

const COUNTDOWN_START = 8;

export function UpsellProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [item, setItem] = useState<Product | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [dismissedSession, setDismissedSession] = useState(false);

  const tickRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearTimers();
    setOpen(false);
    setCountdown(COUNTDOWN_START);
    setItem(null);
    document.body.classList.remove("modal-open");
  }, [clearTimers]);

  const show = useCallback(
    (product: Product) => {
      if (accepted || dismissedSession) {
        return;
      }
      setItem(product);
      setCountdown(COUNTDOWN_START);
      setOpen(true);
      document.body.classList.add("modal-open");

      tickRef.current = window.setInterval(() => {
        setCountdown((value) => (value > 0 ? value - 1 : 0));
      }, 1000);

      timerRef.current = window.setTimeout(() => {
        setDismissedSession(true);
        close();
      }, COUNTDOWN_START * 1000);
    },
    [accepted, dismissedSession, close]
  );

  const accept = useCallback(() => {
    setAccepted(true);
    close();
  }, [close]);

  const cancel = useCallback(() => {
    setDismissedSession(true);
    setAccepted(false);
    close();
  }, [close]);

  const reset = useCallback(() => {
    clearTimers();
    setOpen(false);
    setCountdown(COUNTDOWN_START);
    setItem(null);
    setAccepted(false);
    setDismissedSession(false);
    document.body.classList.remove("modal-open");
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const value = useMemo(
    () => ({ open, countdown, item, accepted, show, accept, cancel, reset }),
    [open, countdown, item, accepted, show, accept, cancel, reset]
  );

  return <UpsellContext.Provider value={value}>{children}</UpsellContext.Provider>;
}

export function useUpsell() {
  const context = useContext(UpsellContext);
  if (!context) {
    throw new Error("useUpsell must be used within an UpsellProvider");
  }
  return context;
}
