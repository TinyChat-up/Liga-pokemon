import { PRODUCT } from "@/lib/product";
import Link from "next/link";
import { PurchaseForm } from "./comprar/PurchaseForm";

export default function Storefront() {
  return (
    <main className="storefront">
      <section className="store-hero">
        <header className="store-nav">
          <Link className="store-brand" href="/"><span className="store-brand-ball" aria-hidden="true">◓</span><span>QR <b>QUEST</b></span></Link>
          <nav aria-label="Navegación principal"><a href="#como-funciona">Cómo funciona</a><Link href="/master">Iniciar sesión</Link></nav>
        </header>
        <div className="store-hero-grid">
          <div className="store-hero-copy"><p className="eyebrow">{PRODUCT.name.toUpperCase()} · EDICIÓN RUTA</p><span className="store-price-tag">PARTIDA DIGITAL · {PRODUCT.displayPrice}</span><h1>{PRODUCT.tagline}</h1><p>{PRODUCT.subtagline}</p><PurchaseForm /><small>Pago único · partida privada · sin instalar ninguna app</small></div>
          <div className="store-cover" role="img" aria-label="Carátula original de una aventura de ruta QR"><div className="store-cover-shell"><div className="store-cover-topline"><span>QR QUEST PARTY</span><b>01</b></div><div className="store-cover-art" /><div className="store-cover-bottom"><b>LA RUTA TE ESPERA</b><small>12 PARADAS · CAPTURAS · COMBATES</small></div></div><span className="store-cover-caption">AVENTURA DIGITAL PARA TU EVENTO</span></div>
        </div>
        <a className="store-scroll-cue" href="#como-funciona">Descubre la aventura <span aria-hidden="true">↓</span></a>
      </section>
      <section className="store-proof" aria-label="Resumen del producto"><div><b>12</b><span>QR de ruta</span></div><div><b>1</b><span>master por partida</span></div><div><b>∞</b><span>jugadores</span></div><div><b>0</b><span>apps que instalar</span></div></section>
      <section className="store-intro" aria-labelledby="como-funciona"><p className="eyebrow">UNA AVENTURA EN EL MUNDO REAL</p><h2 id="como-funciona">Tú preparas la ruta. El móvil hace el resto.</h2><p>Convierte una fiesta, cumpleaños o reunión en una búsqueda de criaturas con combates, retos y recompensas. No hace falta instalar ninguna aplicación.</p></section>
      <section className="store-features" aria-label="Incluido"><article data-step="01" data-icon="✦"><b>Consigue tu partida</b><span>Tras el pago recibes un acceso privado master de tu propia aventura.</span></article><article data-step="02" data-icon="⌁"><b>Prepara el mapa</b><span>Descarga los 12 QR numerados, imprímelos y escóndelos como checkpoints de una ruta.</span></article><article data-step="03" data-icon="◒"><b>Reúne al equipo</b><span>Comparte el enlace de jugadores por WhatsApp. Cada persona crea su perfil con su nombre.</span></article><article data-step="04" data-icon="★"><b>Empieza la aventura</b><span>Escanean, combaten, capturan y ganan premios. Si se despistan, puede aparecer una criatura salvaje.</span></article></section>
      <section className="store-route-band" aria-label="La experiencia del juego"><div className="store-route-copy"><p className="eyebrow">COMO UN RPG DE BOLSILLO</p><h2>Una historia que se juega caminando.</h2><p>El móvil se convierte en mapa, Pokédex y campo de batalla. El master marca el ritmo y el grupo descubre cada parada en el mundo real.</p></div><div className="store-route-map" aria-hidden="true"><span className="route-line-art" /><i className="route-node route-node-start">⌂<b>INICIO</b></i><i className="route-node route-node-battle">⚔<b>COMBATE</b></i><i className="route-node route-node-wild">✦<b>SALVAJE</b></i><i className="route-node route-node-final">★<b>FINAL</b></i></div></section>
      <section className="store-gameplay" aria-label="Contenido del juego"><div><p className="eyebrow">DISEÑADO PARA MÓVIL</p><h2>Una ruta que siempre tiene algo que contar.</h2><p>Doce paradas, encuentros cooperativos, retos sorpresa, capturas aleatorias y un combate final. El master controla perfiles, energía, tokens y premios desde su propio panel.</p></div><ul><li><b>12</b><span>QR de ruta</span></li><li><b>1</b><span>master privado</span></li><li><b>∞</b><span>jugadores</span></li></ul></section>
      <section className="store-cta"><p className="eyebrow">TU EVENTO. TU AVENTURA.</p><h2>Todo listo justo después del pago.</h2><p>Descarga los QR, abre el panel master y comparte el enlace de jugadores.</p><a className="buy-button" href="#crear-partida">Preparar mi partida · {PRODUCT.displayPrice}</a></section>
    </main>
  );
}
