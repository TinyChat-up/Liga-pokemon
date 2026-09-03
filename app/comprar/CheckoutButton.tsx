"use client";

import { useState } from "react";

type CheckoutButtonProps = {
  label?: string;
};

export function CheckoutButton({ label = "Crear mi partida — 1,99 EUR" }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setLoading(true);
    setError("");

    try {
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
        {loading ? "Abriendo pago..." : label}
      </button>
      {error && <p className="checkout-error">{error}</p>}
    </div>
  );
}
