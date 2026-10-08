import type { Metadata } from "next";

// Public: anyone with a certificate's code checks it here, without signing in (outside the app's shell and its
// sign-in gate). Its pages carry people's names: search engines keep out.
export const metadata: Metadata = {
  title: "Verificar un certificado",
  description: "Comprueba si un certificado de Rubinstein Colleague es auténtico y está vigente.",
  robots: { index: false, follow: false },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
