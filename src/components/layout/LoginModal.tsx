import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, TERMS_ACCEPTED_KEY, TERMS_PENDING_KEY } from "hooks/useAuth";
import { FaXmark } from "react-icons/fa6";
import { FcGoogle } from "react-icons/fc";
import { Link } from "react-router-dom";
import { OverlayPortal } from "components/common/OverlayPortal";

type Props = {
  open: boolean;
  onClose: () => void;
};

export const LoginModal: React.FC<Props> = ({ open, onClose }) => {
  const { login } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(TERMS_ACCEPTED_KEY) === "true";
    } catch (error) {
      return false;
    }
  });
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    setStatus("idle");
    setError(null);
    setIsRegistering(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setError(null);
      setIsRegistering(false);
      return;
    }

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
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [handleClose, open]);

  const handleAuth = async () => {
    if (status === "loading" || !acceptedTerms) return;
    setStatus("loading");
    setError(null);
    try {
      window.localStorage.setItem(TERMS_PENDING_KEY, "true");
    } catch (error) {
      // ignore storage errors
    }
    try {
      await login();
      handleClose();
    } catch (authError) {
      console.error("No se pudo iniciar sesión con Google", authError);
      const code = (authError as { code?: string }).code;

      if (code === "auth/web-storage-unsupported") {
        setError(
          "Tu navegador bloquea el almacenamiento necesario para iniciar sesión. Probá desactivar bloqueo de cookies o abrir el sitio en Safari/Chrome fuera de modo privado."
        );
      } else {
        setError("No pudimos conectar con Google. Revisá tu conexión o probá en otra ventana.");
      }
      setStatus("error");
      try {
        window.localStorage.removeItem(TERMS_PENDING_KEY);
      } catch (error) {
        // ignore
      }
    }
  };

  const toggleMode = () => {
    setIsRegistering((prev) => !prev);
    setStatus("idle");
    setError(null);
  };

  useEffect(() => {
    console.log("[LoginModal] open:", open);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <OverlayPortal>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-desc"
      >
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
          disabled={status === "loading" || !acceptedTerms}
        >
          <FcGoogle aria-hidden />
          {status === "loading"
            ? "Conectando..."
            : isRegistering
            ? "Registrarse con Google"
            : "Iniciar sesión con Google"}
        </button>
        <label className="modal__checkbox">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => {
              const value = event.target.checked;
              setAcceptedTerms(value);
              try {
                if (value) {
                  window.localStorage.setItem(TERMS_ACCEPTED_KEY, "true");
                } else {
                  window.localStorage.removeItem(TERMS_ACCEPTED_KEY);
                }
              } catch (error) {
                // ignore
              }
            }}
          />
          <span>
            Acepto los <Link to="/legales/terminos">términos y condiciones</Link>.
          </span>
        </label>
        <button className="modal__link" type="button" onClick={toggleMode}>
          {isRegistering ? "¿Ya tenés cuenta? Iniciá sesión" : "¿No tenés cuenta? Registrate"}
        </button>
          <button className="btn-ghost modal__secondary" type="button" onClick={handleClose}>
            Cerrar
          </button>
        </div>
      </div>
    </OverlayPortal>
  );
};
