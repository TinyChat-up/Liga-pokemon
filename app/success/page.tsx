import { GameDelivery } from "./GameDelivery";

export default function SuccessPage() {
  return (
    <main className="storefront checkout-result">
      <section className="store-hero">
        <p className="eyebrow">PAGO COMPLETADO</p>
        <h1>Tu partida está lista.</h1>
        <p>
          Aquí tienes tu código master, el enlace que puedes compartir con jugadores y los QR de la ruta para imprimir o
          colocar en tu evento.
        </p>
        <GameDelivery />
      </section>
    </main>
  );
}
