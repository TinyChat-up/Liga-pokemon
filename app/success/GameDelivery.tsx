"use client";

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { PRODUCT } from "@/lib/product";

type DeliveryQr = {
  id: string;
  order?: number;
  title: string;
  url: string;
};

type Delivery = {
  gameCode: string;
  masterUsername: string;
  masterPassword: string;
  playerUrl: string;
  masterUrl: string;
  routeQrs: DeliveryQr[];
  finalQr: DeliveryQr;
  arenaQr: DeliveryQr;
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const [, base64 = ""] = dataUrl.split(",");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export function GameDelivery() {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copyMessage, setCopyMessage] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [masterUsername, setMasterUsername] = useState("");
  const [masterPassword, setMasterPassword] = useState("");

  const allQrs = useMemo(() => {
    if (!delivery) return [];
    return [...delivery.routeQrs, delivery.finalQr, delivery.arenaQr];
  }, [delivery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const querySessionId = new URLSearchParams(window.location.search).get("session_id") ?? "";
      const sessionId = querySessionId || sessionStorage.getItem("qr-quest-checkout-session") || "";
      if (querySessionId) sessionStorage.setItem("qr-quest-checkout-session", querySessionId);
      const storedCredentials = sessionStorage.getItem("qr-quest-master-credentials");
      if (storedCredentials) {
        try {
          const parsed = JSON.parse(storedCredentials) as { username?: string; password?: string };
          setMasterUsername(parsed.username ?? "");
          setMasterPassword(parsed.password ?? "");
          if (parsed.username && parsed.password) void deliver(sessionId, parsed.username, parsed.password);
          else setLoading(false);
        } catch {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function deliver(sessionId: string, username = masterUsername, password = masterPassword) {
    if (!sessionId) {
      setError("No se encuentra la sesión de pago. Vuelve al correo o al enlace de Stripe.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, master_username: username, master_password: password }),
      });
      const data = (await response.json()) as Partial<Delivery> & { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? "No se pudo preparar tu partida.");
      if (!data.gameCode || !data.masterUsername || !data.masterPassword || !data.playerUrl || !data.masterUrl || !data.routeQrs || !data.finalQr || !data.arenaQr) {
        throw new Error("La entrega no contiene todos los datos de la partida.");
      }
      setDelivery(data as Delivery);
      sessionStorage.removeItem("qr-quest-master-credentials");
      window.history.replaceState({}, "", "/success");
    } catch (deliveryError) {
      setError(deliveryError instanceof Error ? deliveryError.message : "No se pudo preparar tu partida.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopyMessage(`${label} copiado.`);
    window.setTimeout(() => setCopyMessage(""), 1800);
  }

  async function downloadQrPack() {
    if (!delivery) return;
    setDownloading(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder(`qr-quest-${delivery.gameCode}`) ?? zip;
      const qrOptions = {
        errorCorrectionLevel: "M" as const,
        margin: 3,
        width: 900,
        color: { dark: "#17223b", light: "#fffdf2" },
      };

      for (const qr of allQrs) {
        const dataUrl = await QRCode.toDataURL(qr.url, qrOptions);
        const prefix = qr.order ? `${String(qr.order).padStart(2, "0")}-` : "";
        folder.file(`${prefix}${qr.id}.png`, dataUrlToBytes(dataUrl));
      }

      folder.file(
        "instrucciones.txt",
        [
          "QR Quest Party",
          "",
          `Usuario master: ${delivery.masterUsername}`,
          `Contrasena master: ${delivery.masterPassword}`,
          `Enlace master: ${delivery.masterUrl}`,
          `Enlace jugadores: ${delivery.playerUrl}`,
          "",
          "Imprime los 12 QR numerados y colocalos en orden.",
          "El QR alto-mando es el final y se usa cuando la ruta esta completa.",
          "El QR arena es opcional para retos libres.",
        ].join("\n"),
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `qr-quest-${delivery.gameCode}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function downloadPdfKit() {
    if (!delivery) return;
    setDownloading(true);

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const cardWidth = 92;
      const cardHeight = 128;
      const cardGap = 6;
      const startX = (pageWidth - cardWidth * 2 - cardGap) / 2;
      const startY = 20;
      const rowGap = 7;

      for (let index = 0; index < delivery.routeQrs.length; index += 1) {
        const qr = delivery.routeQrs[index];
        const pageIndex = Math.floor(index / 4);
        const cardIndex = index % 4;
        const column = cardIndex % 2;
        const row = Math.floor(cardIndex / 2);
        const x = startX + column * (cardWidth + cardGap);
        const y = startY + row * (cardHeight + rowGap);
        const isRocket = qr.id.startsWith("rocket");

        if (cardIndex === 0) {
          if (index > 0) pdf.addPage();

          pdf.setFillColor(246, 250, 244);
          pdf.rect(0, 0, pageWidth, pageHeight, "F");
          pdf.setTextColor(23, 34, 59);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.text(`${PRODUCT.name.toUpperCase()} · RUTA`, 10, 10);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.text(`Hoja ${pageIndex + 1} de 3 · Recorta por las lineas exteriores`, pageWidth - 10, 10, { align: "right" });
        }

        const dataUrl = await QRCode.toDataURL(qr.url, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 900,
          color: { dark: "#17223b", light: "#fffdf2" },
        });

        pdf.setFillColor(255, 253, 242);
        pdf.setDrawColor(23, 34, 59);
        pdf.setLineWidth(0.7);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");

        if (isRocket) {
          pdf.setFillColor(220, 57, 54);
        } else {
          pdf.setFillColor(47, 128, 237);
        }
        pdf.roundedRect(x, y, cardWidth, 22, 2, 2, "F");
        pdf.rect(x, y + 18, cardWidth, 4, "F");

        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.text(PRODUCT.name.toUpperCase(), x + 5, y + 7);
        pdf.setFontSize(13);
        pdf.text(`QR ${String(qr.order ?? index + 1).padStart(2, "0")}`, x + 5, y + 16);
        pdf.setFontSize(7);
        pdf.text(isRocket ? "TEAM ROCKET" : "ENTRENADOR", x + cardWidth - 5, y + 16, { align: "right" });

        pdf.setTextColor(23, 34, 59);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(qr.title, x + cardWidth / 2, y + 31, { align: "center", maxWidth: cardWidth - 10 });
        pdf.addImage(dataUrl, "PNG", x + 18, y + 37, 56, 56);

        pdf.setFillColor(238, 243, 231);
        pdf.roundedRect(x + 12, y + 98, cardWidth - 24, 12, 2, 2, "F");
        pdf.setFont("courier", "bold");
        pdf.setFontSize(8);
        pdf.text(qr.id.toUpperCase(), x + cardWidth / 2, y + 105.5, { align: "center" });

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.text("Escanea para iniciar el encuentro", x + cardWidth / 2, y + 116, { align: "center" });
        pdf.setTextColor(87, 96, 112);
        pdf.setFontSize(6.5);
        pdf.text("QR unico de esta partida", x + cardWidth / 2, y + 122, { align: "center" });
      }

      pdf.save(`qr-quest-ruta-${delivery.gameCode}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <p className="delivery-status">Preparando tu partida...</p>;
  }

  if (!delivery) {
    return (
      <section className="delivery-setup">
        <p className="eyebrow">ÚLTIMO PASO</p>
        <h2>Confirma tu acceso master</h2>
        <p>Escribe el mismo usuario y contraseña que elegiste antes de pagar.</p>
        {error && <p className="checkout-error">{error}</p>}
        <form onSubmit={(event) => { event.preventDefault(); const sessionId = new URLSearchParams(window.location.search).get("session_id") || sessionStorage.getItem("qr-quest-checkout-session") || ""; void deliver(sessionId); }}>
          <label htmlFor="delivery-username">Usuario master</label>
          <input id="delivery-username" value={masterUsername} onChange={(event) => setMasterUsername(event.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" />
          <label htmlFor="delivery-password">Contraseña master</label>
          <input id="delivery-password" type="password" value={masterPassword} onChange={(event) => setMasterPassword(event.target.value)} autoComplete="current-password" />
          <button className="buy-button" type="submit" disabled={loading}>{loading ? "Preparando partida..." : "Activar mi partida"}</button>
        </form>
      </section>
    );
  }

  const whatsappText = `Entra a la partida QR Quest Party: ${delivery.playerUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  return (
    <section className="delivery-panel">
      <article className="master-code-card">
        <span>Acceso privado del master</span>
        <b>{delivery.masterUsername}</b>
        <small>Tu usuario master elegido durante la compra.</small>
        <code className="master-game-code">Partida: {delivery.gameCode}</code>
        <code className="master-password-value">{delivery.masterPassword}</code>
      </article>

      <div className="delivery-actions">
        <a className="buy-button" href={delivery.masterUrl}>
          Iniciar sesión master
        </a>
        <a className="store-secondary" href={whatsappUrl} target="_blank" rel="noreferrer">
          Enviar link por WhatsApp
        </a>
        <button type="button" className="store-secondary" onClick={() => copy(delivery.playerUrl, "Link de jugadores")}>
          Copiar link jugadores
        </button>
        <button type="button" className="store-secondary" onClick={() => copy(delivery.masterUrl, "Link master")}>
          Copiar link master
        </button>
        <button type="button" className="store-secondary" onClick={() => copy(delivery.masterUsername, "Usuario master")}>
          Copiar usuario master
        </button>
        <button type="button" className="store-secondary" onClick={() => copy(delivery.masterPassword, "Contraseña master")}>
          Copiar contraseña master
        </button>
        <button type="button" className="buy-button" disabled={downloading} onClick={downloadPdfKit}>
          {downloading ? "Preparando PDF..." : "Descargar PDF de ruta"}
        </button>
        <button type="button" className="store-secondary" disabled={downloading} onClick={downloadQrPack}>
          Descargar PNG ZIP
        </button>
      </div>

      {copyMessage && <p className="delivery-status">{copyMessage}</p>}

      <div className="delivery-qr-preview">
        {allQrs.slice(0, 4).map((qr) => (
          <article key={qr.id}>
            <b>{qr.order ? `${qr.order}. ` : ""}{qr.title}</b>
            <small>{qr.id}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
