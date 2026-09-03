import Link from "next/link";

export default function CancelPage() {
  return (
    <main className="storefront checkout-result">
      <section className="store-hero">
        <p className="eyebrow">PAGO CANCELADO</p>
        <h1>No se ha cobrado nada.</h1>
        <p>Puedes volver a la pantalla de compra cuando quieras.</p>
        <Link className="buy-button" href="/">
          Volver a comprar
        </Link>
      </section>
    </main>
  );
}
