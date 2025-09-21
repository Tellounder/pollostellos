import React, { useState } from "react";
import { useAuth } from "hooks/useAuth";

type Props = {
  open: boolean;
  onClose: () => void;
};

export const LoginModal: React.FC<Props> = ({ open, onClose }) => {
  const { login } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);

  const handleLogin = async () => {
    await login();
    onClose();
  };

  const handleRegister = async () => {
    // Implement registration logic here
    await login(); // For now, registration uses the same login flow
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Iniciar sesión o registrarse">
      <div className="box">
        <h3>{isRegistering ? "Registrarse" : "Iniciar Sesión"}</h3>
        <p>
          {isRegistering
            ? "Crea una cuenta para guardar tus pedidos."
            : "Inicia sesión para acceder a tus pedidos guardados."}
        </p>
        <button className="btn-primary" onClick={isRegistering ? handleRegister : handleLogin}>
          {isRegistering ? "Registrarse con Google" : "Iniciar Sesión con Google"}
        </button>
        <button className="btn-ghost" onClick={() => setIsRegistering(!isRegistering)}>
          {isRegistering ? "¿Ya tienes cuenta? Iniciar Sesión" : "¿No tienes cuenta? Registrarse"}
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
};
