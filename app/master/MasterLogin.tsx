"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { claimGameMaster } from "@/lib/game/supabase-service";
import { GAME_CODE_MIN_LENGTH, STORAGE_KEYS, normalizeGameCode } from "@/lib/game/rules";
import { supabase } from "@/lib/supabase";

export function MasterLogin() {
  const [gameCode, setGameCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeGameCode(gameCode);
    if (code.length < GAME_CODE_MIN_LENGTH) {
      setError(`El usuario debe tener al menos ${GAME_CODE_MIN_LENGTH} caracteres.`);
      return;
    }
    if (password.trim().length < 12) {
      setError("La contraseña master debe tener al menos 12 caracteres.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const token = await claimGameMaster(supabase, code, password.trim());
      localStorage.setItem(STORAGE_KEYS.activeGameCode, code);
      localStorage.setItem(`${STORAGE_KEYS.masterTokenPrefix}${code}`, token);
      window.location.assign(`/?game=${encodeURIComponent(code)}&master=1`);
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
        <label htmlFor="master-code">Usuario master</label>
        <input id="master-code" value={gameCode} onChange={(event) => setGameCode(event.target.value)} placeholder="quest-..." autoCapitalize="none" autoCorrect="off" autoComplete="username" />
        <label htmlFor="master-password">Contraseña master</label>
        <input id="master-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña privada" autoComplete="current-password" />
        <button className="master-login-submit" type="submit" disabled={loading}>{loading ? "Comprobando..." : "Entrar al panel master"}</button>
      </form>
      {error && <p className="toast master-login-error">{error}</p>}
      <Link className="master-login-back" href="/comprar">Volver a la tienda</Link>
    </section>
  );
}
