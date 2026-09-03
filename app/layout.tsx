import type { Metadata } from "next";
import "./globals.css";
import "./game-ui.css";

export const metadata: Metadata = {
  title: "QR Quest Party",
  description: "Juego de ruta QR con combates, capturas y panel master para eventos.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
