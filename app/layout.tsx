import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synvora",
  description: "Gestão para lojistas com loja física e e-commerce",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
