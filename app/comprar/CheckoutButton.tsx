"use client";

import { useState } from "react";

type CheckoutButtonProps = {
  label?: string;
  masterUsername: string;
  masterPassword: string;
  promotionCode?: string;
};

export function CheckoutButton({ label = "Crear mi partida — 1,99 EUR", masterUsername, masterPassword, promotionCode = "" }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    const username = masterUsername.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
      setError("El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.");
      return;
    }
    if (masterPassword.trim().length < 12) {
      setError("La contraseña debe tener al menos 12 caracteres.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      sessionStorage.setItem("qr-quest-master-credentials", JSON.stringify({ username, password: masterPassword.trim() }));

      if (promotionCode.trim()) {
        const response = await fetch("/api/promo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promotion_code: promotionCode, master_username: username, master_password: masterPassword.trim() }),
        });
        const data = (await response.json()) as { session_id?: string; error?: string };

        if (!response.ok || !data.session_id) {
          throw new Error(data.error ?? "No se pudo aplicar el código promocional.");
        }

        sessionStorage.setItem("qr-quest-checkout-session", data.session_id);
        window.location.href = "/success";
        return;
      }

      const response = await fetch("/api/checkout", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "No se pudo abrir el pago.");
      }

      window.location.href = data.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "No se pudo abrir el pago.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="checkout-box">
      <button type="button" className="buy-button" disabled={loading} onClick={startCheckout}>
        {loading ? "Preparando partida..." : promotionCode.trim() ? "Activar codigo promocional" : label}
      </button>
      {error && <p className="checkout-error">{error}</p>}
    </div>
  );
}
