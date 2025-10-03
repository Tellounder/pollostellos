import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { createPortal } from "react-dom";

let sharedOverlayRoot: HTMLElement | null = null;
const OVERLAY_ROOT_ID = "pt-overlay-root";

const ensureOverlayRoot = () => {
  if (typeof document === "undefined") {
    return null;
  }

  if (sharedOverlayRoot && document.body.contains(sharedOverlayRoot)) {
    return sharedOverlayRoot;
  }

  const existing = document.getElementById(OVERLAY_ROOT_ID);
  if (existing) {
    sharedOverlayRoot = existing as HTMLElement;
    return sharedOverlayRoot;
  }

  const element = document.createElement("div");
  element.id = OVERLAY_ROOT_ID;
  element.setAttribute("role", "presentation");
  document.body.appendChild(element);
  sharedOverlayRoot = element;
  return sharedOverlayRoot;
};

export function OverlayPortal({ children }: PropsWithChildren) {
  const target = useMemo(() => ensureOverlayRoot(), []);

  if (!target) {
    return null;
  }

  return createPortal(children, target);
}

export default OverlayPortal;
