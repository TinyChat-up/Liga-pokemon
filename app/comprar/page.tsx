import { PRODUCT } from "@/lib/product";
import { CheckoutButton } from "./CheckoutButton";

export default function BuyPage() {
  return (
    <main className="storefront">
      <section className="store-hero">
        <div className="store-hero-copy">
          <p className="eyebrow">{PRODUCT.name.toUpperCase()}</p>
          <h1>{PRODUCT.tagline}</h1>
          <p>{PRODUCT.subtagline}</p>
          <CheckoutButton />
          <small>Pago único. Partida privada, kit QR y acceso master incluidos.</small>
        </div>
      </section>

      <section className="store-intro" aria-labelledby="como-funciona">
        <p className="eyebrow">UNA AVENTURA EN EL MUNDO REAL</p>
        <h2 id="como-funciona">Tú preparas la ruta. El móvil hace el resto.</h2>
        <p>Convierte una fiesta, cumpleaños o reunión en una búsqueda de criaturas con combates, retos y recompensas. No hace falta instalar ninguna aplicación.</p>
      </section>

      <section className="store-features" aria-label="Incluido">
        <article data-step="01">
          <b>Compra tu partida</b>
          <span>Recibes un código y un enlace master privados. Solo ese enlace permite gestionar el evento.</span>
        </article>
        <article data-step="02">
          <b>Descarga la ruta</b>
          <span>El kit incluye 12 QR numerados, el final y las instrucciones para imprimirlos y esconderlos.</span>
        </article>
        <article data-step="03">
          <b>Comparte el enlace</b>
          <span>Cada participante escribe su propio nombre y crea un perfil dentro de tu partida.</span>
        </article>
        <article data-step="04">
          <b>Empieza la aventura</b>
          <span>Escanean, combaten y capturan. Si tardan en avanzar, una criatura salvaje puede aparecer.</span>
        </article>
      </section>

      <section className="store-gameplay" aria-label="Contenido del juego">
        <div>
          <p className="eyebrow">DISEÑADO PARA MÓVIL</p>
          <h2>Una ruta que siempre tiene algo que contar.</h2>
          <p>Doce paradas, encuentros cooperativos, retos sorpresa, capturas aleatorias y un combate final. El master controla perfiles, energía, tokens y premios desde su propio panel.</p>
        </div>
        <ul>
          <li><b>12</b><span>QR de ruta</span></li>
          <li><b>1</b><span>master privado</span></li>
          <li><b>∞</b><span>jugadores</span></li>
        </ul>
      </section>

      <section className="store-cta">
        <p className="eyebrow">TU EVENTO. TU AVENTURA.</p>
        <h2>Todo listo justo después del pago.</h2>
        <p>Descarga los QR, abre el panel master y comparte el enlace de jugadores.</p>
        <CheckoutButton label={`Crear mi partida — ${PRODUCT.displayPrice}`} />
      </section>
    </main>
  );
}
