"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => { setEscuro(document.documentElement.getAttribute("data-theme") === "dark"); }, []);

  function alternar() {
    const novo = !escuro;
    setEscuro(novo);
    const aplicar = () => document.documentElement.setAttribute("data-theme", novo ? "dark" : "light");
    try { window.localStorage.setItem("synvora-theme", novo ? "dark" : "light"); } catch {}
    const d = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (d.startViewTransition) d.startViewTransition(aplicar); else aplicar();
  }

  return (
    <button type="button" className="icon-btn" onClick={alternar} aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"} title="Tema">
      {escuro ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>
      )}
    </button>
  );
}
