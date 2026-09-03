"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { loginGameMaster } from "@/lib/game/supabase-service";
import { STORAGE_KEYS } from "@/lib/game/rules";
import { supabase } from "@/lib/supabase";

export function MasterLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(cleanUsername)) {
      setError("El usuario debe tener entre 3 y 32 caracteres y solo usar letras, números, punto o guion.");
      return;
    }
    if (password.trim().length < 12) {
      setError("La contraseña master debe tener al menos 12 caracteres.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await loginGameMaster(supabase, cleanUsername, password.trim());
      localStorage.setItem(STORAGE_KEYS.activeGameCode, result.gameCode);
      localStorage.setItem(`${STORAGE_KEYS.masterTokenPrefix}${result.gameCode}`, result.masterToken);
      window.location.assign(`/?game=${encodeURIComponent(result.gameCode)}&master=1`);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se ha podido iniciar sesión.");
      setLoading(false);
    }
  }

  return (
    <section className="master-login-view">
      <button className="wordmark" type="button" onClick={() => window.location.assign("/")}>
        <span className="ball-mark" aria-hidden="true">◓</span> QR QUEST
      </button>
      <div className="master-login-art" aria-hidden="true">
        <span>MASTER</span>
        <b>◆</b>
      </div>
      <p className="eyebrow">ACCESO DE ORGANIZADOR</p>
      <h1>Abre tu partida.</h1>
      <p className="lead">Usa el usuario y la contraseña que recibiste después del pago para gestionar jugadores, curas, tienda y premios.</p>
      <form className="master-login-form" onSubmit={submit}>
        <label htmlFor="master-code">Tu usuario master</label>
        <input id="master-code" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ej. entrenador_ana" autoCapitalize="none" autoCorrect="off" autoComplete="username" />
        <label htmlFor="master-password">Contraseña master</label>
        <input id="master-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña privada" autoComplete="current-password" />
        <button className="master-login-submit" type="submit" disabled={loading}>{loading ? "Comprobando..." : "Entrar al panel master"}</button>
      </form>
      {error && <p className="toast master-login-error">{error}</p>}
      <Link className="master-login-back" href="/">Volver a la tienda</Link>
    </section>
  );
}
