import { useEffect, useState } from "react";
import { loadMotionModule, preloadMotionModule } from "utils/lazyMotion";
import type { MotionModule } from "utils/lazyMotion";

if (typeof window !== "undefined") {
  preloadMotionModule();
}

const slogans = [
  "🍗 El sabor que conquista",
  "🔥 Pollito deshuesado",
  "🎰 ¿Ya canjeaste tu premio?",
  "💳 Pagos electronicos",
];

const transition = { duration: 0.4, ease: "easeInOut" as const };

const variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

export default function FooterSlogans() {
  const [index, setIndex] = useState(0);
  const [motionLib, setMotionLib] = useState<Pick<MotionModule, "AnimatePresence" | "motion"> | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % slogans.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    loadMotionModule()
      .then((mod) => {
        if (mounted) {
          setMotionLib({ AnimatePresence: mod.AnimatePresence, motion: mod.motion });
        }
      })
      .catch((error) => {
        console.error("No se pudo cargar framer-motion", error);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!motionLib) {
    return (
      <footer className="footer-slogans" role="contentinfo">
        <div className="footer-slogans__inner" aria-live="polite">
          <span className="footer-slogans__text">{slogans[index]}</span>
        </div>
      </footer>
    );
  }

  const { AnimatePresence, motion } = motionLib;

  return (
    <footer className="footer-slogans" role="contentinfo">
      <div className="footer-slogans__inner" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.span
            key={slogans[index]}
            className="footer-slogans__text"
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transition}
          >
            {slogans[index]}
          </motion.span>
        </AnimatePresence>
      </div>
    </footer>
  );
}
