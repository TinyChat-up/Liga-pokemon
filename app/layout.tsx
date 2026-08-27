import type { Metadata } from "next";
import "./globals.css";
import "./game-ui.css";

export const metadata: Metadata = {
  title: "Nivel 27 · Liga de la Terraza",
  description: "La ruta QR de la Liga de la Terraza.",
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
