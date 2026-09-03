"use client";

import { useState } from "react";
import { CheckoutButton } from "./CheckoutButton";

export function PurchaseForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="purchase-form" id="crear-partida">
      <div className="purchase-form-heading"><span>01</span><div><b>Elige tu acceso privado</b><small>Tú decides el usuario y la contraseña de tu partida.</small></div></div>
      <div className="purchase-fields">
        <label htmlFor="purchase-username"><span>Usuario master</span><input id="purchase-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ej. entrenador_ana" autoCapitalize="none" autoCorrect="off" autoComplete="username" maxLength={32} /></label>
        <label htmlFor="purchase-password"><span>Contraseña master</span><input id="purchase-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="12 caracteres o más" autoComplete="new-password" maxLength={80} /></label>
      </div>
      <CheckoutButton label="Crear mi partida · 1,99 EUR" masterUsername={username} masterPassword={password} />
      <small className="purchase-form-note">No usamos nombres ni datos de partidas anteriores. Guarda estas credenciales: serán tu llave para volver a entrar.</small>
    </div>
  );
}
