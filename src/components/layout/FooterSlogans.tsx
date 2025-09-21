import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const slogans = [
  "🍗 El sabor que conquista",
  "🔥 Más rápido que el delivery",
  "🎰 ¿Jugaste al Jackpollo?",
  "💳 Próximamente MercadoPago",
];

const transition = { duration: 0.4, ease: "easeInOut" as const };

const variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

export default function FooterSlogans() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % slogans.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

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
