"use client";

import { useState } from "react";
import { CheckoutButton } from "./CheckoutButton";

export function PurchaseForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [promotionCode, setPromotionCode] = useState("");

  return (
    <div className="purchase-form" id="crear-partida">
      <div className="promotion-intro"><span>PRUEBA GRATIS</span><b>Codigo promocional: <code>QRQUEST-INVITA</code></b><small>Escribelo aqui para crear una partida sin pagar.</small></div>
      <label className="promotion-field" htmlFor="purchase-promotion-code"><span>Codigo promocional</span><input id="purchase-promotion-code" value={promotionCode} onChange={(event) => setPromotionCode(event.target.value)} placeholder="QRQUEST-INVITA" autoCapitalize="characters" autoCorrect="off" maxLength={64} /></label>
      <div className="purchase-form-heading"><span>01</span><div><b>Elige tu acceso privado</b><small>Tu decides el usuario y la contrasena de tu partida.</small></div></div>
      <div className="purchase-fields">
        <label htmlFor="purchase-username"><span>Usuario master</span><input id="purchase-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ej. entrenador_ana" autoCapitalize="none" autoCorrect="off" autoComplete="username" maxLength={32} /></label>
        <label htmlFor="purchase-password"><span>Contraseña master</span><input id="purchase-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="12 caracteres o más" autoComplete="new-password" maxLength={80} /></label>
      </div>
      <CheckoutButton label="Crear mi partida · 1,99 EUR" masterUsername={username} masterPassword={password} promotionCode={promotionCode} />
      <small className="purchase-form-note">No usamos nombres ni datos de partidas anteriores. Guarda estas credenciales: serán tu llave para volver a entrar.</small>
    </div>
  );
}
