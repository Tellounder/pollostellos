import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "hooks/useAuth";
import { FaXmark } from "react-icons/fa6";
import { FcGoogle } from "react-icons/fc";

type Props = {
  open: boolean;
  onClose: () => void;
};

export const LoginModal: React.FC<Props> = ({ open, onClose }) => {
  const { login } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    setStatus("idle");
    setError(null);
    setIsRegistering(false);

    const timer = window.setTimeout(() => {
      primaryButtonRef.current?.focus({ preventScroll: true });
    }, 50);

    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleClose = () => {
    setStatus("idle");
    setError(null);
    setIsRegistering(false);
    onClose();
  };

  const handleAuth = async () => {
    if (status === "loading") return;
    setStatus("loading");
    setError(null);
    try {
      await login();
      handleClose();
    } catch (authError) {
      console.error("No se pudo iniciar sesión con Google", authError);
      setError("No pudimos conectar con Google. Revisá tu conexión o probá en otra ventana.");
      setStatus("error");
    }
  };

  const toggleMode = () => {
    setIsRegistering((prev) => !prev);
    setStatus("idle");
    setError(null);
  };

  if (!open) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" aria-describedby="auth-modal-desc">
      <div className="box auth-modal" role="document">
        <button className="modal__close" type="button" onClick={handleClose} aria-label="Cerrar ventana">
          <FaXmark aria-hidden />
        </button>
        <h3 id="auth-modal-title">{isRegistering ? "Registrarse" : "Iniciar sesión"}</h3>
        <p id="auth-modal-desc" className="modal__lead">
          {isRegistering
            ? "Creá una cuenta para guardar tus pedidos favoritos y recibir promos personalizadas."
            : "Iniciá sesión para acceder a tus pedidos guardados y repetir tus favoritos al instante."}
        </p>
        {error && (
          <div className="modal__error" role="alert">
            {error}
          </div>
        )}
        <button
          ref={primaryButtonRef}
          className="btn-google"
          onClick={handleAuth}
          disabled={status === "loading"}
        >
          <FcGoogle aria-hidden />
          {status === "loading"
            ? "Conectando..."
            : isRegistering
            ? "Registrarse con Google"
            : "Iniciar sesión con Google"}
        </button>
        <button className="modal__link" type="button" onClick={toggleMode}>
          {isRegistering ? "¿Ya tenés cuenta? Iniciá sesión" : "¿No tenés cuenta? Registrate"}
        </button>
        <button className="btn-ghost modal__secondary" type="button" onClick={handleClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
};
