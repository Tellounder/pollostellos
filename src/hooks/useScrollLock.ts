import { useEffect } from "react";

let lockCount = 0;

const dataOverflowKey = "scrollLockOverflow";
const dataPaddingKey = "scrollLockPadding";

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    if (typeof document === "undefined") {
      return;
    }

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    lockCount += 1;

    if (lockCount === 1) {
      body.dataset[dataOverflowKey] = previousOverflow;
      body.dataset[dataPaddingKey] = previousPadding;
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
      body.classList.add("overlay-locked");
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        body.classList.remove("overlay-locked");
        body.style.overflow = body.dataset[dataOverflowKey] ?? "";
        body.style.paddingRight = body.dataset[dataPaddingKey] ?? "";
        delete body.dataset[dataOverflowKey];
        delete body.dataset[dataPaddingKey];
      }
    };
  }, [active]);
}

export default useScrollLock;
