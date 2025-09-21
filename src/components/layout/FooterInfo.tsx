import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

const FAQS: FaqItem[] = [
  {
    id: "pedido",
    question: "¿Cómo hago mi pedido?",
    answer:
      "Elegí tus combos favoritos, toca \"Agregar\" y abrí el carrito. Confirmá tus datos y enviá el pedido directo por WhatsApp, sin pasos complicados.",
  },
  {
    id: "entrega",
    question: "¿Dónde entregan?",
    answer:
      "Repartimos en Avellaneda, Piñeyro, Dock Sud, Sarandí y zonas cercanas. Consultanos por WhatsApp si estás a unos minutos extra y lo coordinamos.",
  },
  {
    id: "pagos",
    question: "¿Qué medios de pago aceptan?",
    answer:
      "Podés abonar con Mercado Pago, tarjetas de crédito y débito, transferencias o efectivo al recibir tu pedido.",
  },
];

const accordionVariants = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
};

function FaqBlock({ activeId, onToggle }: { activeId: string | null; onToggle: (id: string) => void }) {
  return (
    <div className="footer-faq" role="list">
      {FAQS.map(({ id, question, answer }) => {
        const isOpen = activeId === id;
        const contentId = `faq-panel-${id}`;
        return (
          <article key={id} className={`footer-faq__item ${isOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="footer-faq__trigger"
              onClick={() => onToggle(isOpen ? "" : id)}
              aria-expanded={isOpen}
              aria-controls={contentId}
            >
              <span>{question}</span>
              <span className={`footer-faq__icon ${isOpen ? "rotated" : ""}`} aria-hidden>
                {isOpen ? "➖" : "➕"}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key={id}
                  id={contentId}
                  className="footer-faq__content"
                  variants={accordionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.24, ease: "easeOut" }}
                >
                  <p>{answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </article>
        );
      })}
    </div>
  );
}

function TrustBlock() {
  return (
    <div className="footer-trust" aria-label="Confianza y medios de pago">
      <p className="footer-trust__headline">Pagos 100% seguros con Mercado Pago.</p>
      <div className="footer-trust__icons" aria-hidden>
        <span role="img" aria-label="Efectivo">
          💵
        </span>
        <span role="img" aria-label="Tarjeta">
          💳
        </span>
        <span role="img" aria-label="Mercado Pago">
          🅿️
        </span>
      </div>
      <p className="footer-trust__eta">Tiempo promedio de entrega: 30–45 min.</p>
    </div>
  );
}

function LegalBlock() {
  return (
    <div className="footer-legal" aria-label="Información legal y redes sociales">
      <p className="footer-legal__copy">© 2025 Pollos Tello’s. Todos los derechos reservados.</p>
      <nav className="footer-legal__links" aria-label="Enlaces legales">
        <a href="#terminos">Términos</a>
        <span aria-hidden>•</span>
        <a href="#privacidad">Privacidad</a>
        <span aria-hidden>•</span>
        <a href="#contacto">Contacto</a>
      </nav>
      <div className="footer-legal__social" aria-label="Redes sociales">
        <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram Pollos Tello’s">
          📸
        </a>
        <a href="https://www.tiktok.com" target="_blank" rel="noreferrer" aria-label="TikTok Pollos Tello’s">
          🎵
        </a>
      </div>
    </div>
  );
}

function FooterInfo(): JSX.Element {
  const [openId, setOpenId] = useState<string | null>(FAQS[0].id);

  return (
    <footer className="footer-info footer-info--faq" role="contentinfo">
      <div className="footer-info__inner">
        <h2 className="footer-info__title">¿Necesitás ayuda rápida?</h2>
        <FaqBlock activeId={openId} onToggle={(id) => setOpenId(id || null)} />
        <TrustBlock />
        <LegalBlock />
      </div>
    </footer>
  );
}

export default FooterInfo;
