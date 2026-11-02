"use client";
import { useState } from "react";

export default function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); } catch {
      const t = document.createElement("textarea"); t.value = texto; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch {} t.remove();
    }
    setOk(true); setTimeout(() => setOk(false), 2000);
  }
  return <button type="button" className="btn" onClick={copiar} aria-live="polite">{ok ? "Copiado!" : "Copiar link"}</button>;
}
