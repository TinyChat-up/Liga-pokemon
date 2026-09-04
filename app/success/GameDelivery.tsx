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

function drawInstructionsPage(pdf: jsPDF, delivery: Delivery, pageWidth: number, pageHeight: number, playerQr: string) {
  const ink: [number, number, number] = [23, 34, 59];
  const blue: [number, number, number] = [47, 128, 237];
  const red: [number, number, number] = [220, 57, 54];
  const paper: [number, number, number] = [255, 253, 242];

  pdf.setFillColor(132, 216, 247);
  pdf.rect(0, 0, pageWidth, 76, "F");
  pdf.setFillColor(85, 189, 104);
  pdf.rect(0, 76, pageWidth, pageHeight - 76, "F");
  pdf.setFillColor(...paper);
  pdf.roundedRect(10, 12, pageWidth - 20, 53, 4, 4, "F");

  pdf.setTextColor(...ink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("BIENVENIDOS A", pageWidth / 2, 23, { align: "center" });
  pdf.setFontSize(27);
  pdf.text(PRODUCT.name.toUpperCase(), pageWidth / 2, 36, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("Una aventura de retos, capturas y recompensas para jugar en equipo.", pageWidth / 2, 47, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...red);
  pdf.text("PARTIDA " + delivery.gameCode.toUpperCase(), pageWidth / 2, 58, { align: "center" });

  pdf.setFillColor(...paper);
  pdf.setDrawColor(...ink);
  pdf.setLineWidth(0.6);
  pdf.roundedRect(10, 84, pageWidth - 20, 92, 4, 4, "FD");
  pdf.setTextColor(...ink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("Como jugar", 18, 97);

  const steps = [
    ["1", "Entra", "Escanea este QR con tu movil para abrir la partida."],
    ["2", "Crea tu perfil", "Escribe tu nombre y elige a tu companero de aventura."],
    ["3", "Sigue la ruta", "Busca los QR numerados y escanealos siempre en orden."],
    ["4", "Supera el reto", "Responde al desafio para ganar tokens y nuevas capturas."],
    ["5", "Llega al final", "Completa los 12 QR para desbloquear el Alto Mando."],
  ];

  steps.forEach(([number, title, description], index) => {
    const y = 108 + index * 12.5;
    pdf.setFillColor(...(index === 3 ? red : blue));
    pdf.circle(23, y - 2.5, 4.5, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(number, 23, y, { align: "center" });
    pdf.setTextColor(...ink);
    pdf.setFontSize(9.5);
    pdf.text(title, 31, y - 1);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(description, 31, y + 3.5, { maxWidth: 101 });
  });

  pdf.setFillColor(255, 253, 242);
  pdf.setDrawColor(...ink);
  pdf.roundedRect(128, 84, 72, 92, 4, 4, "FD");
  pdf.setTextColor(...ink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Empieza aqui", 164, 97, { align: "center" });
  pdf.addImage(playerQr, "PNG", 141, 104, 46, 46);
  pdf.setFontSize(8.5);
  pdf.text("Escanea para entrar", 164, 159, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("No necesitas instalar ninguna app.", 164, 166, { align: "center", maxWidth: 56 });

  pdf.setFillColor(255, 243, 211);
  pdf.roundedRect(10, 185, pageWidth - 20, 43, 4, 4, "F");
  pdf.setTextColor(...ink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Reglas de la ruta", 18, 198);
  pdf.setFontSize(8.5);
  pdf.text("- Hay 12 QR obligatorios: 8 entrenadores y 4 misiones Team Rocket.", 18, 207);
  pdf.text("- Entrenador superado: +2 tokens. Team Rocket superado: +3 tokens.", 18, 214);
  pdf.text("- Cada QR se completa una sola vez. Si te atascas, pide ayuda al master.", 18, 221);

  pdf.setFillColor(...ink);
  pdf.roundedRect(10, 238, pageWidth - 20, 43, 4, 4, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Antes de empezar", 18, 251);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text("1. Comparte esta hoja o el enlace de jugadores.  2. Recorta las tarjetas de las paginas siguientes.", 18, 261);
  pdf.text("3. Coloca los 12 QR en orden por el espacio del evento.  4. Guarda el acceso master en privado.", 18, 270);

  pdf.setTextColor(...ink);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(`${PRODUCT.name} · Guia de jugadores`, 10, pageHeight - 8);
  pdf.text("Pagina 1 de 4", pageWidth - 10, pageHeight - 8, { align: "right" });
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
      const playerQr = await QRCode.toDataURL(delivery.playerUrl, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 900,
        color: { dark: "#17223b", light: "#fffdf2" },
      });

      drawInstructionsPage(pdf, delivery, pageWidth, pageHeight, playerQr);

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
          pdf.addPage();

          pdf.setFillColor(246, 250, 244);
          pdf.rect(0, 0, pageWidth, pageHeight, "F");
          pdf.setTextColor(23, 34, 59);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.text(`${PRODUCT.name.toUpperCase()} · RUTA`, 10, 10);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.text(`Hoja ${pageIndex + 2} de 4 · Recorta por las lineas exteriores`, pageWidth - 10, 10, { align: "right" });
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

      pdf.save(`qr-quest-kit-${delivery.gameCode}.pdf`);
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
          {downloading ? "Preparando PDF..." : "Descargar instrucciones y QR"}
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
