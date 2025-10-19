import type { PropsWithChildren } from "react";
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

let sharedOverlayRoot: HTMLElement | null = null;
const OVERLAY_ROOT_ID = "pt-overlay-root";

type ScrollSnapshot = {
  overflow: string;
  paddingRight: string;
  position: string;
  top: string;
  width: string;
  scrollY: number;
};

let activeLocks = 0;
let snapshot: ScrollSnapshot | null = null;

const lockBodyScroll = () => {
  if (typeof document === "undefined") {
    return;
  }

  const body = document.body;
  if (activeLocks === 0) {
    snapshot = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      scrollY: window.scrollY || window.pageYOffset,
    };

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${snapshot.scrollY}px`;
    body.style.width = "100%";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    body.classList.add("pt-overlay-open");
  }

  activeLocks += 1;
};

const unlockBodyScroll = () => {
  if (typeof document === "undefined") {
    return;
  }
  if (activeLocks === 0) {
    return;
  }

  activeLocks -= 1;

  if (activeLocks === 0 && snapshot) {
    const body = document.body;
    body.style.overflow = snapshot.overflow;
    body.style.paddingRight = snapshot.paddingRight;
    body.style.position = snapshot.position;
    body.style.top = snapshot.top;
    body.style.width = snapshot.width;
    body.classList.remove("pt-overlay-open");
    window.scrollTo({ top: snapshot.scrollY });
    snapshot = null;
  }
};

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

  useEffect(() => {
    if (!target) {
      return;
    }
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [target]);

  if (!target) {
    return null;
  }

  return createPortal(children, target);
}

export default OverlayPortal;
