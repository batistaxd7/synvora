"use client";
import { useState } from "react";

// Botão de formulário que trava e mostra "enviando" enquanto o servidor responde
export default function BotaoEnviar({ children, enviando, className }: { children: React.ReactNode; enviando: string; className?: string }) {
  const [pendente, setPendente] = useState(false);
  return (
    <button
      type="submit"
      className={className ?? "btn"}
      aria-busy={pendente}
      style={pendente ? { opacity: 0.6, pointerEvents: "none" } : undefined}
      onClick={(e) => {
        const f = e.currentTarget.form;
        if (f && !f.checkValidity()) return;
        setTimeout(() => setPendente(true), 0);
        setTimeout(() => setPendente(false), 20000);
      }}
    >
      {pendente ? enviando : children}
    </button>
  );
}
