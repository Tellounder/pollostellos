import { Link } from "react-router-dom";

export function Terms() {
  return (
    <main className="legal-page" role="main">
      <div className="legal-page__container">
        <h1>Términos y condiciones</h1>
        <p className="legal-page__lead">
          Al usar Pollos Tello&apos;s aceptás estas reglas básicas para que podamos brindarte un servicio seguro y sin sorpresas.
        </p>

        <section>
          <h2>1. Uso del sitio</h2>
          <p>
            Este sitio está pensado para que armes tu pedido y lo confirmes por WhatsApp. Necesitás ser mayor de 18 años para comprar; si hacés un pedido en nombre de otra persona, asumimos que contás con su autorización.
          </p>
        </section>

        <section>
          <h2>2. Pedidos y disponibilidad</h2>
          <p>
            Todos los productos están sujetos a disponibilidad. Si algo cambia (por ejemplo, algún acompañamiento puntual), te lo avisamos por WhatsApp antes de preparar el pedido para que elijas una alternativa.
          </p>
        </section>

        <section>
          <h2>3. Precios y medios de pago</h2>
          <p>
            Los precios publicados incluyen impuestos. Podés abonar con Mercado Pago, tarjetas, transferencia o efectivo. Si pagás en efectivo, recordá indicar con qué billetes abonás para coordinar el cambio.
          </p>
        </section>

        <section>
          <h2>4. Datos personales</h2>
          <p>
            Guardamos tus datos (nombre, dirección, teléfono y mail) sólo para agilizar pedidos futuros. Podés pedirnos que los borremos cuando quieras escribiendo a nuestro WhatsApp o a consultaspollostellos@gmail.com.
          </p>
        </section>

        <section>
          <h2>5. Cobertura y tiempos</h2>
          <p>
            Entregamos en Ciudadela, Versalles, Villa Real, Villa Raffo, Caseros y José Ingenieros. Los tiempos informados son estimados; pueden variar por tránsito o condiciones climáticas. Si hay demoras te avisamos por WhatsApp.
          </p>
        </section>

        <section>
          <h2>6. Promociones y códigos</h2>
          <p>
            Los cupones y beneficios tienen vigencia limitada y se aplican según las condiciones informadas (por ejemplo, una única vez por usuario). Si detectamos uso indebido podemos anular el beneficio sin previo aviso.
          </p>
        </section>

        <section>
          <h2>7. Modificaciones</h2>
          <p>
            Podemos actualizar estos términos para reflejar mejoras del servicio. La versión vigente siempre va a estar publicada en esta página. Si el cambio es importante, lo comunicaremos por nuestros canales habituales.
          </p>
        </section>

        <p className="legal-page__footer">
          ¿Tenés dudas? Escribinos a nuestro WhatsApp para recibir ayuda inmediata.
        </p>

        <Link className="btn-primary legal-page__back" to="/">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
