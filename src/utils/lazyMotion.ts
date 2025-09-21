import type { AnimatePresenceProps, MotionProps } from "framer-motion";

let motionModulePromise: Promise<typeof import("framer-motion")> | null = null;

export const loadMotionModule = async () => {
  if (!motionModulePromise) {
    motionModulePromise = import("framer-motion");
  }
  return motionModulePromise;
};

export const preloadMotionModule = () => {
  if (typeof window === "undefined") return;
  void loadMotionModule();
};

export type MotionModule = Awaited<ReturnType<typeof loadMotionModule>>;
export type MotionComponent<T extends keyof MotionModule["motion"]> = MotionModule["motion"][T];
export type { AnimatePresenceProps, MotionProps };
