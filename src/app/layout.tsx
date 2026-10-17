import type { Metadata, Viewport } from "next";
import { Inter_Tight, Red_Hat_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const display = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Red_Hat_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Action Colleague — Estudio de cursos",
    template: "%s · Action Colleague",
  },
  description: "Crea cursos de formación con IA o con tu propio material, y sigue el avance de tu equipo.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
