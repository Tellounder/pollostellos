/**
 * Finalización: confirma el pedido enviado y permite volver al inicio.
 */
import { useNavigate } from "react-router-dom";

export function Thanks() {
  const navigate = useNavigate();
  return (
    <section className="grid" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="card center">
        <h2>¡Gracias por tu compra! ✅</h2>
        <p className="small">
          Tu pedido fue enviado por WhatsApp. Te vamos a escribir para confirmar.
        </p>
      </div>
      <div className="card center">
        <h3>Próximamente</h3>
        <p className="small">
          Estamos preparando un <strong>portal con muchos beneficios y descuentos</strong>. ¡Estate atento! 🔓✨
        </p>
      </div>
      <div className="center">
        <button className="btn-primary" onClick={() => navigate("/")}>
          Volver al inicio
        </button>
      </div>
    </section>
  );
}
